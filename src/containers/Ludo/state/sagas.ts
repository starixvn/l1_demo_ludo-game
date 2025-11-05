/**
 * Ludo Game State Sagas
 *
 * Redux Sagas that handle all asynchronous game logic for the Ludo game.
 * Manages game initialization, coin movement, turn progression, and game state changes.
 * Acts as the central coordinator for all game mechanics and player interactions.
 */

import {
  call,
  delay,
  put,
  select,
  takeEvery,
  takeLatest,
} from 'redux-saga/effects';

import { api } from 'common/http';
import { mapByProperty } from 'common/utils';
import { enableDie, ActionTypes as DiceActionTypes } from 'containers/Dice/state/actions';
import { addLogEntry } from 'containers/StepLogs/state/actions';
import { Rolls } from 'containers/Dice/state/interfaces';
import { currentDieRoll1Selector, currentDieRoll2Selector, currentDieRollSumSelector } from 'containers/Dice/state/selectors';
import { DEFAULT_STARTING_BASE, WINNING_MOVES, LUDO_MOVE_ANIMATION_DELAY, LUDO_STATE_UPDATE_DELAY, NO_MOVE_DELAY } from 'globalConstants';
import { WalkwayPosition } from 'state/interfaces';

import {
  clearHighlightedCells,
  disqualifyCoin,
  enableBase,
  getInitialGameDataSuccess,
  homeCoin,
  liftCoin,
  markWinner,
  moveCoin,
  moveCoinFailure,
  moveCoinSuccess,
  nextTurn,
  passTurnTo,
  placeCoin,
  setHighlightedCells,
  setPlayers,
  spawnCoin,
  spawnCoinSuccess,
  ActionTypes,
} from './actions';
import {
  BaseID,
  CellType,
  ICell,
  ICoin,
  IServerGameData,
  IState,
  IWalkway,
} from './interfaces';
import {
  basesSelector,
  cellsSelector,
  coinsSelector,
  currentTurnSelector,
  linksSelector,
  walkwaysSelector,
} from './selectors';

/**
 * Watcher saga for initial game data loading
 * Listens for GET_INITIAL_GAME_DATA actions and triggers data loading
 */
function * watchForGetInitialGameData() {
  yield takeLatest(ActionTypes.GET_INITIAL_GAME_DATA, getInitialGameDataSaga);
}

/**
 * Loads initial game data from JSON file
 *
 * This is the first saga that runs when the game starts. It:
 * 1. Fetches board configuration from initialGameData.json
 * 2. Processes and transforms the data for Redux state
 * 3. Sets up all game entities (bases, coins, cells, walkways)
 * 4. Initializes the game state with default values
 */
function * getInitialGameDataSaga() {
  // Fetch complete board configuration from JSON file
  const data: IServerGameData = yield call(api.get, { url: '/initialGameData.json' });

  // Process bases - add spawnable state (initially false for all players)
  const basesArray = data.bases.map((base) => ({ ...base, spawnable: false }));
  const bases = mapByProperty(basesArray, 'ID');

  // Process coins - assign colors based on their base ownership
  const coins = data.coins.map((coin) => ({ ...coin, color: bases[coin.baseID].color }));

  // Create complete game state object
  const gameData: IState = {
    bases,                              // Player bases with spawnable state
    cells: data.cells,                  // All board cells with positions and types
    coins: mapByProperty(coins, 'coinID'), // All game coins mapped by ID
    availableActions: null,             // No action selection initially
    availableActionsDieValue: null,     // No die value for actions initially
    highlightedCells: null,             // No cells highlighted initially
    currentTurn: DEFAULT_STARTING_BASE, // Start with configured default base
    links: data.links,                  // Movement connectivity between cells
    relationships: data.relationships,  // Component relationships for rendering
    walkways: mapByProperty(data.walkways, 'ID'), // Walkway configurations
  };

  // Dispatch success action to update Redux store
  yield put(getInitialGameDataSuccess(gameData));
}

/**
 * Watcher saga for coin spawning actions
 * Triggers when a player attempts to spawn a coin from their base
 */
function * watchForSpawnCoin() {
  yield takeLatest(ActionTypes.SPAWN_COIN, spawnCoinSaga);
}

/**
 * Handles spawning a coin from base onto the board
 *
 * This saga executes when a player rolls a 6 and chooses to spawn a coin.
 * It finds the appropriate spawn cell for the player's base and moves the coin there.
 * After spawning, the die roll becomes invalid (can't be used again).
 *
 * @param action - Contains baseID and coinID to spawn
 */
function * spawnCoinSaga(action: ReturnType<typeof spawnCoin>) {
  const { baseID, coinID } = action.data!;

  // Get current game state
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const walkways: ReturnType<typeof walkwaysSelector> = yield select(walkwaysSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);

  // Find the player's base and their walkway
  const base = bases[baseID];
  const walkway = Object.values(walkways).find((walkway) => walkway.baseID === baseID)!;

  // Get cells for this player's walkway and find the spawn cell
  const walkwayCells = cells[walkway.position];
  const spawnCellForCoin = Object.values(walkwayCells).find((cell) => cell.cellType === CellType.SPAWN)!;

  // Find the specific coin ID to spawn from the base's coin list
  const coinIDToSpawn = base.coinIDs.find((ID) => ID === coinID)!;

  // Log the spawn action for game history
  yield put(addLogEntry({
    player: base.color,
    action: 'Spawned coin',
    details: `Spawned coin ${coinID.split('_')[1]}`,
  }));

  // Execute the spawn - move coin from base to spawn cell
  yield put(spawnCoinSuccess(spawnCellForCoin.cellID, coinIDToSpawn, baseID, walkway.position));

  // Note: Roll invalidation is handled in spawnCoinSuccessSaga (Dice sagas)
}

/**
 * Watcher saga for coin movement actions
 * Triggers when a player attempts to move a coin along the board
 */
function * watchForMoveCoin() {
  yield takeLatest(ActionTypes.MOVE_COIN, moveCoinSaga);
}

/**
 * Validates if a coin can make a specific move
 *
 * Checks if moving the coin by the given number of steps would exceed
 * the total distance needed to reach home (WINNING_MOVES = 56).
 *
 * @param coinID - The coin to validate movement for
 * @param stepsToTake - Number of steps from the die roll
 * @returns true if the move is valid (won't overshoot home)
 */
function * isCurrentMoveValid(coinID: ICoin['coinID'], stepsToTake: Rolls) {
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const coin = coins[coinID];
  return coin.steps + stepsToTake <= WINNING_MOVES;
}

/**
 * Gets all coins that can be moved by the current player
 *
 * Filters the current player's coins to find those that:
 * - Are spawned on the board (not in base)
 * - Are not retired (haven't reached home)
 * - Can move the rolled number of spaces without overshooting
 *
 * @param stepsToTake - Number of steps from the die roll
 * @returns Array of coin IDs that can be moved
 */
export function * getMovableCoins(stepsToTake: Rolls) {
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const currentTurnBase: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);

  // Filter coins that meet all movement criteria
  const movableCoins =
    bases[currentTurnBase].coinIDs
    .filter((coinID) =>
      coins[coinID].isSpawned              // Must be on the board
      && !coins[coinID].isRetired         // Must not be home yet
      && coins[coinID].steps + stepsToTake <= WINNING_MOVES, // Must not overshoot
    );

  return movableCoins;
}

/**
 * Finds blocking coins along a coin's movement path
 * Returns information about the first blocking coin encountered
 * @param coinID - The coin that wants to move
 * @param stepsToTake - Number of steps to move
 * @returns Object with blockingCoinID, blockingCellID, and stepsBeforeBlocking, or null if no blocking
 */
export function * findBlockingCoin(
  coinID: ICoin['coinID'],
  stepsToTake: Rolls
): Generator<any, { blockingCoinID: ICoin['coinID'], blockingCellID: string, stepsBeforeBlocking: number } | null, any> {
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const links: ReturnType<typeof linksSelector> = yield select(linksSelector);
  const currentCoin = coins[coinID];

  if (!currentCoin.isSpawned || currentCoin.isRetired) {
    return null; // Coin not on board or already home
  }

  let currentCellID = currentCoin.cellID;

  // Traverse the path step by step
  for (let step = 0; step < stepsToTake; step++) {
    const nextCells = links[currentCellID];
    
    if (!nextCells || nextCells.length === 0) {
      break; // End of path
    }

    // Find the next cell (prioritize HOME, then home path, then first available)
    let nextCell;
    const homeCell = nextCells.find((cell) => cell.cellID === 'HOME');
    if (homeCell) {
      nextCell = homeCell;
    } else {
      // Find matching home path or use first available
      const matchingHomePath = nextCells.find((cell) => {
        if (cell.cellID === 'HOME') return false;
        const cellData = cells[cell.position]?.[cell.cellID];
        return cellData?.cellType === CellType.HOMEPATH && cellData.baseID === currentCoin.baseID;
      });
      nextCell = matchingHomePath || nextCells[0];
    }

    if (!nextCell) {
      break;
    }

    // Check if next cell has any coins (blocking) BEFORE moving to it
    if (nextCell.cellID !== 'HOME') {
      const cellData = cells[nextCell.position]?.[nextCell.cellID];
      if (cellData && cellData.coinIDs && cellData.coinIDs.length > 0) {
        // Found a blocking coin - check if it's the same base (can't block own coins)
        const blockingCoinID = cellData.coinIDs[0]; // Get first coin on the cell
        const blockingCoin = coins[blockingCoinID];
        
        // Only block if it's a different base (opponent's coin)
        if (blockingCoin && blockingCoin.baseID !== currentCoin.baseID) {
          // Blocking coin found at this step - can move up to 'step' steps before it
          return {
            blockingCoinID,
            blockingCellID: nextCell.cellID,
            stepsBeforeBlocking: step, // Number of steps we can take before hitting the blocker
          };
        }
      }
    }

    // Move to next cell for next iteration
    currentCellID = nextCell.cellID;
  }

  return null; // No blocking coin found
}

/**
 * Main saga for handling coin movement along the board
 *
 * This is the most complex saga in the game. It handles:
 * 1. Validating the move is possible
 * 2. Moving the coin step-by-step with animation
 * 3. Handling special cases (home path entry, reaching home)
 * 4. Checking for coin disqualifications (captures)
 * 5. Determining if the player gets a bonus turn
 *
 * The movement happens one cell at a time with 100ms delays for smooth animation.
 *
 * @param action - Contains coinID, target cellID, and walkway position
 */
function * moveCoinSaga(action: ReturnType<typeof moveCoin>) {
  let { cellID, walkwayPosition } = { ...action.data! };
  const { coinID } = action.data!;
  const currentDieRoll: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);
  
  // Check for blocking coins BEFORE allowing movement
  const blockingInfo: { blockingCoinID: ICoin['coinID'], blockingCellID: string, stepsBeforeBlocking: number } | null = 
    yield call(findBlockingCoin, coinID, currentDieRoll);
  
  // If blocking coin is detected, cannot move at all - fail the move and pass turn
  if (blockingInfo) {
    console.warn(`Coin ${coinID} cannot move - blocked by ${blockingInfo.blockingCoinID}`);
    yield put(moveCoinFailure());
    // Wait for player to see the dice result before passing turn
    yield delay(NO_MOVE_DELAY);
    yield put(nextTurn());
    yield put(enableDie());
    return;
  }
  
  // Determine how many steps to move (always use full die roll - no partial moves allowed)
  const stepsToMove = currentDieRoll;

  // Validate that this move is possible
  const movableCoins: ICoin['coinID'][] = yield call(getMovableCoins, currentDieRoll);
  const isCurrentMovePossible: boolean = yield call(isCurrentMoveValid, coinID, currentDieRoll);

  // If no coins can move, skip turn
  if (movableCoins.length === 0) {
    yield put(moveCoinFailure());
    yield put(nextTurn());
    yield put(enableDie());
    return;
  }
  // If this specific coin can't move, reject the action
  else if (!isCurrentMovePossible) {
    yield put(moveCoinFailure());
    return;
  }

  // Don't invalidate roll here - wait until action completes (handled in moveCoinSuccessSaga)

  // Track if coin reached home during movement
  let bonusChanceForHomeCoin = false;

  // Move the coin step-by-step based on steps to move
  for (let i = 0; i < stepsToMove; i++) {
    // Get fresh state for each step (state may change during movement)
    const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
    const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
    const links: ReturnType<typeof linksSelector> = yield select(linksSelector);

    // Find next possible cells from current position
    const nextCells = links[cellID];
    
    // Safety check: if no links found, this is a configuration error
    if (!nextCells || nextCells.length === 0) {
      console.error(`No links found for cell ${cellID} - coin ${coinID} cannot move forward`);
      yield put(moveCoinFailure());
      yield put(nextTurn());
      yield put(enableDie());
      return; // Exit movement saga to prevent hanging
    }
    
    let nextCell;

    // Special logic for entering home path - ONLY allow same-base home path cells
    if (nextCells.length > 1) {
      // Multiple options available
      // Priority 0: Check if HOME is available - it's always the best choice
      const homeCell = nextCells.find((cell) => cell.cellID === 'HOME');
      if (homeCell) {
        // HOME is always allowed - it's the final destination
        nextCell = homeCell;
      } else {
        // Priority 1: Try to find a home path cell that matches this coin's base
        const matchingHomePath = nextCells.find(
          (cell) => {
            // Skip HOME cells - they're handled above
            if (cell.cellID === 'HOME') {
              return false;
            }
            const cellData = cells[cell.position]?.[cell.cellID];
            if (!cellData) {
              console.warn(`Cell data not found for ${cell.cellID} at position ${cell.position}`);
              return false;
            }
            return cellData.cellType === CellType.HOMEPATH
              && coins[coinID].baseID === cellData.baseID;
          }
        );

        if (matchingHomePath) {
          // Use the matching home path if found - PRIORITIZE this!
          nextCell = matchingHomePath;
        } else {
          // No matching home path found - filter valid cells
          // Filter out any home path cells that don't match this coin's base
          const validCells = nextCells.filter((cell) => {
            // HOME is always valid (handled above, but include it here as safety)
            if (cell.cellID === 'HOME') {
              return true;
            }
            const cellData = cells[cell.position]?.[cell.cellID];
            if (!cellData) {
              console.warn(`Cell data not found for ${cell.cellID} at position ${cell.position}`);
              return false;
            }
            // Allow: non-home-path cells OR home path cells that match this coin's base
            return cellData.cellType !== CellType.HOMEPATH
              || cellData.baseID === coins[coinID].baseID;
          });

          if (validCells.length > 0) {
            // Among valid cells, prioritize any matching home path cells
            // (in case the filter didn't catch it earlier)
            const homePathInValid = validCells.find((cell) => {
              if (cell.cellID === 'HOME') {
                return false; // Already handled
              }
              const cellData = cells[cell.position]?.[cell.cellID];
              return cellData?.cellType === CellType.HOMEPATH
                && cellData.baseID === coins[coinID].baseID;
            });
            
            nextCell = homePathInValid || validCells[0]; // Prefer home path, otherwise first valid
          } else {
            // No valid cells found after filtering - this is a configuration error
            // Prefer non-home-path cells, or if all are home paths, fail the move
            const nonHomePathCells = nextCells.filter((cell) => {
              // HOME is always valid
              if (cell.cellID === 'HOME') {
                return true;
              }
              const cellData = cells[cell.position]?.[cell.cellID];
              return cellData?.cellType !== CellType.HOMEPATH;
            });
            
            if (nonHomePathCells.length > 0) {
              nextCell = nonHomePathCells[0]; // Use non-home-path cell as last resort
            } else {
              // All cells are home paths but none match this coin's base
              // This is a configuration error - log and fail the move
              console.error(`Coin ${coinID} at ${cellID} has no valid moves - all next cells are other bases' home paths`);
              yield put(moveCoinFailure());
              yield put(nextTurn());
              yield put(enableDie());
              return; // Exit movement saga to prevent hanging
            }
          }
        }
      }
    } else {
      // Single option available - validate it's not someone else's home path
      // Special case: HOME is a valid destination (not stored in cells structure)
      if (nextCells[0].cellID === 'HOME') {
        // HOME is always allowed - it's the final destination
        nextCell = nextCells[0];
      } else {
        // For non-HOME cells, check cell data exists and validate home path access
        const cellData = cells[nextCells[0].position]?.[nextCells[0].cellID];
        if (!cellData) {
          console.error(`Cell data not found for ${nextCells[0].cellID} at position ${nextCells[0].position}`);
          yield put(moveCoinFailure());
          yield put(nextTurn());
          yield put(enableDie());
          return;
        }
        
        if (cellData.cellType === CellType.HOMEPATH && cellData.baseID !== coins[coinID].baseID) {
          // Prevent entering another base's home path
          console.warn(`Coin ${coinID} cannot enter ${nextCells[0].cellID} - wrong base home path (expected ${coins[coinID].baseID}, got ${cellData.baseID})`);
          yield put(moveCoinFailure());
          yield put(nextTurn());
          yield put(enableDie());
          return; // Fail the move instead of allowing it
        } else {
          nextCell = nextCells[0];
        }
      }
    }

    // Check for blocking coin on next cell - if found, cannot move over
    if (nextCell.cellID !== 'HOME') {
      const nextCellData = cells[nextCell.position]?.[nextCell.cellID];
      if (nextCellData && nextCellData.coinIDs && nextCellData.coinIDs.length > 0) {
        // Found a coin on the next cell
        const coinOnNextCell = coins[nextCellData.coinIDs[0]];
        const currentCoin = coins[coinID];
        
        // Check if it's a blocking coin (different base) - cannot move over
        if (coinOnNextCell && coinOnNextCell.baseID !== currentCoin.baseID) {
          // Blocking coin encountered - cannot move over
          console.warn(`Coin ${coinID} cannot move to ${nextCell.cellID} - blocked by ${nextCellData.coinIDs[0]}`);
          yield put(moveCoinFailure());
          yield put(nextTurn());
          yield put(enableDie());
          return; // Stop movement and pass turn
        }
      }
    }

    // Animate: lift coin from current cell
    yield put(liftCoin(cellID, coinID, walkwayPosition));

    // Check if we've reached the home position
    if (nextCell.cellID === 'HOME') {
      yield put(homeCoin(coinID));
      bonusChanceForHomeCoin = true;
    } else {
      // Place coin on next cell
      yield put(placeCoin(nextCell.cellID, coinID, nextCell.position));
    }

    // Animation delay for smooth movement
    yield delay(LUDO_MOVE_ANIMATION_DELAY);

    // Update position for next iteration
    cellID = nextCell.cellID;
    walkwayPosition = nextCell.position;
  }

  // Get dice values to check for bonus turn
  const roll1: ReturnType<typeof currentDieRoll1Selector> = yield select(currentDieRoll1Selector);
  const roll2: ReturnType<typeof currentDieRoll2Selector> = yield select(currentDieRoll2Selector);
  
  // Determine if player gets a bonus turn
  const bonusChance = bonusChanceForHomeCoin                          // Reached home
  || (yield call(performDisqualificationCheck, action.data!.coinID, walkwayPosition, cellID)) // Captured opponent
  || ((roll1 === Rolls.ONE && roll2 === Rolls.SIX) || (roll1 === Rolls.SIX && roll2 === Rolls.ONE) || roll1 === roll2); // Rolled spawnable combination

  // Log the successful move
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const playerColor = bases[coins[coinID].baseID].color;

  // Log the move action
  yield put(addLogEntry({
    player: playerColor,
    action: 'Moved coin',
    details: `Moved coin ${coinID.split('_')[1]} ${stepsToMove} spaces`,
  }));

  // Complete the move and handle turn progression
  yield put(moveCoinSuccess(bonusChance, coinID, stepsToMove as Rolls));

  // Advance to next turn unless player gets bonus
  // Note: Roll invalidation and die enabling are handled in moveCoinSuccessSaga
  if (!bonusChance) {
    yield put(nextTurn());
  }
}

/**
 * Checks if the moving coin captures any opponent coins
 *
 * When a coin lands on a normal cell, it checks if there are any opponent coins
 * on that cell. If found, those coins are sent back to their base (disqualified).
 * This gives the player a bonus turn for successful captures.
 *
 * @param activeCoinID - The coin that just moved
 * @param walkwayPosition - Position where the coin landed
 * @param cellID - Specific cell where the coin landed
 * @returns true if any coins were captured (player gets bonus turn)
 */
function * performDisqualificationCheck(activeCoinID: ICoin['coinID'], walkwayPosition: WalkwayPosition, cellID: ICell['cellID']) {
  // No captures possible at home position
  if (cellID === 'HOME') {
    return false;
  }

  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);

  const activeCoin = coins[activeCoinID];
  const cellInWhichCoinLanded = cells[walkwayPosition][cellID];

  // Debug logging for development
  console.log(cellInWhichCoinLanded, activeCoin);

  // Only normal cells allow captures (not spawn or home path cells)
  if (cellInWhichCoinLanded.cellType === CellType.NORMAL) {
    // Check each coin on the target cell
    for (const coinID of cellInWhichCoinLanded.coinIDs) {
      const coin = coins[coinID];
      // If it's an opponent coin, disqualify it
      if (activeCoin.baseID !== coin.baseID) {
        yield put(disqualifyCoin(coinID, walkwayPosition, cellID));
        return true; // Bonus turn for successful capture
      }
    }
  }

  return false; // No captures occurred
}

/**
 * Calculates all reachable cells for the current player's coins
 * Returns a Set of cell IDs that can be reached with any valid dice roll (sum of 2-12)
 */
export function * calculateReachableCells(): Generator<any, Set<string>, any> {
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const links: ReturnType<typeof linksSelector> = yield select(linksSelector);

  const reachableCells = new Set<string>();
  const currentBase = bases[currentTurn];

  if (!currentBase) {
    return reachableCells;
  }

  // Get all coins for the current player
  const playerCoins = currentBase.coinIDs.map((coinID) => coins[coinID]);

  // For each coin, calculate reachable cells
  for (const coin of playerCoins) {
    if (coin.isRetired) {
      continue; // Skip retired coins
    }

    if (!coin.isSpawned) {
      // Unspawned coin - can spawn to spawn cell
      // Find the spawn cell for this base
      const walkways: ReturnType<typeof walkwaysSelector> = yield select(walkwaysSelector);
      const walkway = Object.values(walkways).find(
        (w: IWalkway) => w.baseID === currentBase.ID
      );
      if (walkway) {
        const walkwayCells = cells[walkway.position];
        const spawnCell = Object.values(walkwayCells).find(
          (cell) => cell.cellType === CellType.SPAWN && cell.baseID === currentBase.ID
        );
        if (spawnCell) {
          reachableCells.add(spawnCell.cellID);
        }
      }
    } else {
      // Spawned coin - calculate cells reachable with 2-12 steps (sum of two dice)
      const startCellID = coin.cellID;
      if (!startCellID) continue;

      // Calculate all cells reachable with 2-12 steps (two dice: min 1+1=2, max 6+6=12)
      for (let steps = 2; steps <= 12; steps++) {
        // Check if this move would overshoot home
        if (coin.steps + steps > WINNING_MOVES) {
          continue; // Skip moves that overshoot
        }

        // Use BFS to find all cells reachable in exactly 'steps' moves
        const visited = new Set<string>();
        const queue: Array<{ cellID: string; stepsRemaining: number }> = [
          { cellID: startCellID, stepsRemaining: steps },
        ];

        while (queue.length > 0) {
          const { cellID, stepsRemaining } = queue.shift()!;

          if (stepsRemaining === 0) {
            // We've reached this cell in exactly the right number of steps
            reachableCells.add(cellID);
            continue;
          }

          if (visited.has(cellID)) {
            continue;
          }
          visited.add(cellID);

          const nextCells = links[cellID];
          if (!nextCells || nextCells.length === 0) {
            continue;
          }

          // Add all next cells to queue
          for (const nextCell of nextCells) {
            // Skip HOME cells in intermediate steps (we'll add it at the end if reachable)
            if (nextCell.cellID === 'HOME' && stepsRemaining > 1) {
              continue;
            }

            // For homepath cells, only allow if they match the coin's base
            if (nextCell.cellID !== 'HOME') {
              const cellData = cells[nextCell.position]?.[nextCell.cellID];
              if (cellData && cellData.cellType === CellType.HOMEPATH) {
                if (cellData.baseID !== coin.baseID) {
                  continue; // Skip other players' homepaths
                }
              }
            }

            queue.push({ cellID: nextCell.cellID, stepsRemaining: stepsRemaining - 1 });
          }
        }
      }
    }
  }

  return reachableCells;
}

/**
 * Watcher saga for turn progression
 * Advances to the next player's turn when current turn ends
 */
function * watchForNextTurn() {
  yield takeLatest(ActionTypes.NEXT_TURN, nextTurnSaga);
}

/**
 * Watcher saga for pass turn to action
 * Calculates and highlights reachable cells when a player's turn starts
 */
function * watchForPassTurnTo() {
  yield takeLatest(ActionTypes.PASS_TURN_TO, passTurnToSaga);
}

/**
 * Watcher saga for dice roll complete
 * Clears highlighting when dice is rolled
 */
function * watchForRollDieComplete() {
  yield takeEvery(DiceActionTypes.ROLL_DIE_COMPLETE, function * () {
    yield put(clearHighlightedCells());
  });
}

/**
 * Handles when turn is passed to a player
 * Calculates and highlights all reachable cells for that player's coins
 */
function * passTurnToSaga() {
  // Clear any existing highlighting
  yield put(clearHighlightedCells());

  // Calculate reachable cells for current player
  const reachableCells: Set<string> = yield call(calculateReachableCells);

  // Set highlighted cells
  if (reachableCells.size > 0) {
    yield put(setHighlightedCells(reachableCells));
  }
}

/**
 * Advances the game to the next player's turn
 *
 * Finds the next active player who hasn't won yet, skipping disabled players
 * or players who have already completed the game. Logs the turn transition.
 */
function * nextTurnSaga() {
  const currentTurnBase: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);

  // Start with the configured next turn
  let nextTurn = bases[currentTurnBase].nextTurn;
  let nextBaseID = currentTurnBase;
  let validPlayerFound = false;
  const maxIterations = 4; // Maximum number of players to check
  let iterations = 0;

  // Find next valid player (enabled and hasn't won)
  // Iterate through players with a maximum limit to prevent infinite loops
  while (iterations < maxIterations && !validPlayerFound) {
    nextBaseID = bases[nextBaseID].nextTurn;
    const nextBase = bases[nextBaseID];
    
    // Check if this player is valid (enabled and hasn't won)
    if (nextBase && nextBase.enabled && !nextBase.hasWon) {
      nextTurn = nextBaseID;
      validPlayerFound = true;
      break;
    }
    
    iterations++;
    
    // Prevent infinite loop if we've checked all players
    if (nextBaseID === currentTurnBase) {
      // We've cycled back to the starting player - no valid players found
      console.warn('No valid players found for next turn - all players disabled or won');
      break;
    }
  }

  // Validate that we found a valid player before proceeding
  if (!validPlayerFound || !bases[nextTurn]) {
    console.error('Failed to find valid next player - game may be in invalid state');
    // Try to find any enabled player as fallback
    for (const key in bases) {
      if (bases[key] && bases[key].enabled && !bases[key].hasWon) {
        nextTurn = key as BaseID;
        validPlayerFound = true;
        break;
      }
    }
    
    // If still no valid player found, log error and exit
    if (!validPlayerFound || !bases[nextTurn]) {
      console.error('Cannot proceed - no valid players available');
      yield put(addLogEntry({
        player: 'SYSTEM',
        action: 'Game Error',
        details: 'No valid players found - game cannot continue',
      }));
      return; // Exit saga without updating turn
    }
  }

  // Log the turn transition
  yield put(addLogEntry({
    player: bases[nextTurn].color,
    action: 'Turn started',
    details: `${bases[nextTurn].color} player's turn`,
  }));

  // Update current turn in state
  yield put(passTurnTo(nextTurn));
}

/**
 * Watcher saga for player setup
 * Configures which players are active based on selected player count
 */
function * watchForSetPlayers() {
  yield takeLatest(ActionTypes.SET_PLAYERS, setPlayersSaga);
}

/**
 * Sets up the game for the specified number of players
 *
 * Enables the appropriate player bases based on player count:
 * - 2 players: Enables BASE_2 and BASE_3 (Blue and Red)
 * - 3 players: Enables BASE_2, BASE_3, and BASE_4 (Blue, Red, Yellow)
 * - 4 players: Enables all bases (Blue, Green, Red, Yellow)
 *
 * @param action - Contains the desired player count (2, 3, or 4)
 */
function * setPlayersSaga(action: ReturnType<typeof setPlayers>) {
  const { playerCount } = action.data!;

  // Small delay to ensure state is updated before proceeding
  yield delay(LUDO_STATE_UPDATE_DELAY);

  switch (playerCount) {
    case 2:
      // 2-player game: Blue and Red players
      yield put(enableBase(BaseID.BASE_2));
      yield put(enableBase(BaseID.BASE_3));
      break;
    case 3:
      // 3-player game: Blue, Red, and Yellow players
      yield put(enableBase(BaseID.BASE_2));
      yield put(enableBase(BaseID.BASE_3));
      yield put(enableBase(BaseID.BASE_4));
      break;
    case 4:
      // 4-player game: All players enabled
      yield put(enableBase(BaseID.BASE_1));
      yield put(enableBase(BaseID.BASE_2));
      yield put(enableBase(BaseID.BASE_3));
      yield put(enableBase(BaseID.BASE_4));
      break;
    default:
      // Invalid player count - do nothing
      return;
  }

  // After enabling bases, find the first enabled base and set it as current turn
  // Get updated bases after enabling them
  const updatedBases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  
  // Find the first enabled base
  const firstEnabledBase = Object.values(updatedBases).find((base) => base.enabled);
  
  if (firstEnabledBase) {
    // Set the first enabled player's turn directly (this will trigger passTurnToSaga)
    // passTurnToSaga will respect the auto-actions setting from the user's checkbox
    yield put(passTurnTo(firstEnabledBase.ID));
  }
}

/**
 * Watcher saga for coin disqualification
 * Handles when coins are captured and sent back to base
 */
function * watchForDisqualifyCoin() {
  yield takeLatest(ActionTypes.DISQUALIFY_COIN, disqualifyCoinSaga);
}

/**
 * Logs when a coin is disqualified (captured by opponent)
 *
 * Called when one player's coin lands on the same cell as an opponent's coin,
 * sending the opponent's coin back to their base. This is logged for game history.
 *
 * @param action - Contains coinID that was disqualified
 */
function * disqualifyCoinSaga(action: ReturnType<typeof disqualifyCoin>) {
  const { coinID } = action.data!;
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const coin = coins[coinID];

  // Log the disqualification with highlight for importance
  yield put(addLogEntry({
    player: bases[coin.baseID].color,
    action: 'Coin disqualified',
    details: `Coin ${coinID.split('_')[1]} was sent back to base`,
    highlight: true, // Important event gets visual highlighting
  }));
}

/**
 * Watcher saga for coins reaching home
 * Celebrates when players successfully get coins to the finish
 */
function * watchForHomeCoin() {
  yield takeLatest(ActionTypes.HOME_COIN, homeCoinSaga);
}

/**
 * Handles when a coin successfully reaches home
 *
 * This is the victory condition! When a coin reaches home:
 * 1. Logs the achievement
 * 2. Checks if the player has won (all 4 coins home)
 * 3. If won, marks the player as winner and logs victory
 *
 * @param action - Contains coinID that reached home
 */
function * homeCoinSaga(action: ReturnType<typeof homeCoin>) {
  const { coinID } = action.data!;

  // Get current game state
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);

  // Find which player owns this coin
  const { baseID } = coins[coinID];
  const base = bases[baseID];

  // Count how many of this player's coins are retired (at home)
  const retiredCoins = base.coinIDs.filter((coinID) => coins[coinID].isRetired);

  // Log the successful home arrival
  yield put(addLogEntry({
    player: base.color,
    action: 'Coin reached home',
    details: `Coin ${coinID.split('_')[1]} completed the journey!`,
    highlight: true, // Important achievement gets highlighting
  }));

  // Check for victory condition - all coins must be home
  const hasWon = retiredCoins.length === base.coinIDs.length;
  if (hasWon) {
    // Player has won! Log victory and mark as winner
    yield put(addLogEntry({
      player: base.color,
      action: 'Game won!',
      details: `${base.color} player has won the game!`,
      highlight: true, // Victory is the most important event
    }));
    yield put(markWinner(baseID));
  }
}

/**
 * Root saga configuration for Ludo game
 *
 * Exports all watcher sagas that handle different aspects of the game.
 * Redux-Saga middleware will fork these sagas when the store is created.
 * Each saga listens for specific actions and handles the corresponding game logic.
 */
export const sagas = [
  watchForGetInitialGameData, // Game initialization from JSON
  watchForSpawnCoin,          // Coin spawning from base
  watchForMoveCoin,           // Coin movement along board
  watchForDisqualifyCoin,     // Coin captures (logging only)
  watchForNextTurn,           // Turn progression
  watchForPassTurnTo,         // Calculate reachable cells when turn starts
  watchForRollDieComplete,    // Clear highlighting when dice is rolled
  watchForSetPlayers,         // Player count configuration
  watchForHomeCoin,           // Victory detection
];
