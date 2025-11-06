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
import { currentDieRoll1Selector, currentDieRoll2Selector, currentDieRollSumSelector, isDieRollAllowedSelector, isDieRollValidSelector } from 'containers/Dice/state/selectors';
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
    highlightedCellsByCoin: null,       // No cell-to-coin mapping initially
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
export function * isCurrentMoveValid(coinID: ICoin['coinID'], stepsToTake: Rolls) {
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
): Generator<any, { blockingCoinID: ICoin['coinID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null, any> {
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
        // Found a blocking coin - can be same color or different color
        const blockingCoinID = cellData.coinIDs[0]; // Get first coin on the cell
        const blockingCoin = coins[blockingCoinID];
        
        if (blockingCoin) {
          // Blocking coin found at this step - can move up to 'step' steps before it
          // Track whether it's same color or different color
          const isSameColor = blockingCoin.baseID === currentCoin.baseID;
          return {
            blockingCoinID,
            blockingCellID: nextCell.cellID,
            stepsBeforeBlocking: step, // Number of steps we can take before hitting the blocker
            isSameColor, // Whether the blocking coin is the same color
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
  const { coinID, stepsToUse } = action.data!;
  const currentDieRoll: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);
  
  // Determine how many steps to move
  // If stepsToUse is provided (when using one die from a pair), use that instead of the sum
  const stepsToMove = stepsToUse !== undefined ? stepsToUse : currentDieRoll;
  
  // Check for blocking coins BEFORE allowing movement
  // Use the actual steps we're moving, not the full die sum
  const blockingInfo: { blockingCoinID: ICoin['coinID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
    yield call(findBlockingCoin, coinID, stepsToMove as Rolls);
  
  // Track if we can kick the blocking coin (if any)
  let canKickBlockingCoin = false;
  let blockingCellIDToKick: string | null = null;
  
  // If blocking coin is detected, check if we can kick it
  // Blocking applies to both same-color and different-color coins
  // But we can kick opponent coins if stepsToMove exactly equals the blocking step
  if (blockingInfo) {
    const blockingStep = blockingInfo.stepsBeforeBlocking + 1;
    
    // Check if we can kick this blocking coin
    // Can kick if: stepsToMove === blockingStep AND blocking coin is opponent (not same color)
    canKickBlockingCoin = stepsToMove === blockingStep && !blockingInfo.isSameColor;
    
    if (!canKickBlockingCoin) {
      // Cannot kick - block the movement
      console.warn(`Coin ${coinID} cannot move - blocked by ${blockingInfo.blockingCoinID} (same color: ${blockingInfo.isSameColor}, steps: ${stepsToMove}, blockingStep: ${blockingStep})`);
      yield put(moveCoinFailure());
      // Wait for player to see the dice result before passing turn
      yield delay(NO_MOVE_DELAY);
      yield put(nextTurn());
      yield put(enableDie());
      return;
    }
    // If canKickBlockingCoin is true, proceed with movement (will kick the blocking coin)
    blockingCellIDToKick = blockingInfo.blockingCellID;
  }

  // Validate that this move is possible
  // Use the actual steps we're moving, not necessarily the full die sum
  const movableCoins: ICoin['coinID'][] = yield call(getMovableCoins, stepsToMove as Rolls);
  const isCurrentMovePossible: boolean = yield call(isCurrentMoveValid, coinID, stepsToMove as Rolls);

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
    // Blocking applies to both same-color and different-color coins
    // Exception: If we're allowed to kick this specific blocking cell, allow movement to it
    if (nextCell.cellID !== 'HOME') {
      const nextCellData = cells[nextCell.position]?.[nextCell.cellID];
      if (nextCellData && nextCellData.coinIDs && nextCellData.coinIDs.length > 0) {
        // Found a coin on the next cell - check if we can kick it
        // Allow movement if this is the blocking cell we're allowed to kick
        if (canKickBlockingCoin && blockingCellIDToKick && nextCell.cellID === blockingCellIDToKick) {
          // This is the blocking cell we're allowed to kick - proceed with movement
          // The kick will be handled by performDisqualificationCheck later
        } else {
          // Cannot kick this coin - block the movement
          // Note: We cannot kick same-color coins, so any blocking coin prevents movement
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

  // Any cell type (NORMAL, SPAWN, HOMEPATH) allows captures if it has opponent coins
  // Check each coin on the target cell
  for (const coinID of cellInWhichCoinLanded.coinIDs) {
    const coin = coins[coinID];
    // If it's an opponent coin, disqualify it (kick it)
    if (activeCoin.baseID !== coin.baseID) {
      yield put(disqualifyCoin(coinID, walkwayPosition, cellID));
      return true; // Bonus turn for successful capture
    }
  }

  return false; // No captures occurred
}

/**
 * Helper function to highlight cells reachable with a specific number of steps
 * Used for highlighting cells when using one die value from a pair
 */
// eslint-disable-next-line require-yield
function * highlightCellsWithSteps(
  coin: ICoin,
  startCellID: string,
  steps: number,
  blockingInfo: { blockingCoinID: ICoin['coinID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null,
  reachableCells: Set<string>,
  cells: ReturnType<typeof cellsSelector>,
  links: ReturnType<typeof linksSelector>,
  coins: ReturnType<typeof coinsSelector>,
  cellsByCoin: Map<string, Array<{ coinID: ICoin['coinID']; moveType: 'spawn' | 'kick' | 'move' }>>,
  addReachableCell: (cellID: string, coinID: ICoin['coinID'], moveType: 'spawn' | 'kick' | 'move') => void
): Generator<any, void, any> {
  const visited = new Map<string, number>();
  const queue: Array<{ cellID: string; position: WalkwayPosition; stepsRemaining: number }> = [
    { cellID: startCellID, position: coin.position, stepsRemaining: steps },
  ];

  while (queue.length > 0) {
    const { cellID, position, stepsRemaining } = queue.shift()!;

    if (stepsRemaining === 0) {
      // We've reached this cell in exactly the right number of steps
      if (cellID !== 'HOME') {
        const cellData = cells[position]?.[cellID];
        if (cellData && cellData.coinIDs && cellData.coinIDs.length > 0) {
          const coinOnCell = coins[cellData.coinIDs[0]];
          // If it's a blocking coin, don't highlight (we're avoiding it)
          if (coinOnCell) {
            // Only skip if it's the specific blocking cell we're trying to avoid
            if (blockingInfo && cellID === blockingInfo.blockingCellID) {
              continue; // This is the blocking cell - don't highlight
            }
            // Otherwise, if there's a coin but it's not the blocking one, we can still highlight
            // (this handles cases where there might be other coins on the path)
          }
        }
      }
      // Determine move type: check if there's an opponent coin on this cell (kick) or normal move
      const cellDataForType = cells[position]?.[cellID];
      let moveType: 'kick' | 'move' = 'move';
      if (cellDataForType && cellDataForType.coinIDs && cellDataForType.coinIDs.length > 0) {
        const coinOnCell = coins[cellDataForType.coinIDs[0]];
        if (coinOnCell && coinOnCell.baseID !== coin.baseID) {
          moveType = 'kick'; // Opponent coin can be kicked
        }
      }
      addReachableCell(cellID, coin.coinID, moveType);
      continue;
    }

    const prevStepsRemaining = visited.get(cellID);
    if (prevStepsRemaining !== undefined && prevStepsRemaining >= stepsRemaining) {
      continue;
    }
    visited.set(cellID, stepsRemaining);

    const nextCells = links[cellID];
    if (!nextCells || nextCells.length === 0) {
      continue;
    }

    for (const nextCell of nextCells) {
      if (nextCell.cellID === 'HOME' && stepsRemaining > 1) {
        continue;
      }

      if (nextCell.cellID !== 'HOME') {
        const cellData = cells[nextCell.position]?.[nextCell.cellID];
        if (cellData && cellData.cellType === CellType.HOMEPATH) {
          if (cellData.baseID !== coin.baseID) {
            continue;
          }
        }
        
        // Check if next cell has a blocking coin - skip if it's the blocking cell we're avoiding
        if (cellData && cellData.coinIDs && cellData.coinIDs.length > 0) {
          const coinOnCell = coins[cellData.coinIDs[0]];
          if (coinOnCell) {
            // If this is the blocking cell we're trying to avoid, don't explore past it
            if (blockingInfo && nextCell.cellID === blockingInfo.blockingCellID) {
              continue; // Don't explore past the blocking cell
            }
          }
        }
      }

      queue.push({ cellID: nextCell.cellID, position: nextCell.position, stepsRemaining: stepsRemaining - 1 });
    }
  }
}

/**
 * Calculates all reachable cells for the current player's coins
 * Returns a Set of cell IDs that can be reached with any valid dice roll (sum of 2-12)
 * Also returns a Map of cellID -> Array<{coinID, moveType}> to track which coins can reach which cells
 */
export function * calculateReachableCells(): Generator<any, { reachableCells: Set<string>; cellsByCoin: Map<string, Array<{ coinID: ICoin['coinID']; moveType: 'spawn' | 'kick' | 'move' }>> }, any> {
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const links: ReturnType<typeof linksSelector> = yield select(linksSelector);

  // Get current dice values to check if it's a pair (for the new blocking rule)
  const roll1: ReturnType<typeof currentDieRoll1Selector> = yield select(currentDieRoll1Selector);
  const roll2: ReturnType<typeof currentDieRoll2Selector> = yield select(currentDieRoll2Selector);
  const isDieRollAllowed: ReturnType<typeof isDieRollAllowedSelector> = yield select(isDieRollAllowedSelector);
  const isDieRollValid: ReturnType<typeof isDieRollValidSelector> = yield select(isDieRollValidSelector);
  
  // Check if it's a valid pair (both dice are the same and valid values)
  // Only consider it a pair if the roll is valid (not default/initial values)
  const isPair = isDieRollValid && roll1 === roll2 && roll1 >= 1 && roll1 <= 6;
  const singleDieValue = isPair ? roll1 : null; // If pair, use one die value (both are the same)
  
  // Show step 1 as a potential option in these cases:
  // 1. Before rolling (isDieRollAllowed && !isDieRollValid) - dice are clickable but not rolled yet
  // 2. After rolling a pair (isPair) - show step 1 as one option when pair is rolled
  // 3. After rolling when dice are disabled but roll is valid - for bonus turns
  // This ensures step 1 is always shown when appropriate, regardless of timing
  const showPreRollStep1 = isDieRollAllowed || (isDieRollValid && !isDieRollAllowed);

  const reachableCells = new Set<string>();
  const cellsByCoin = new Map<string, Array<{ coinID: ICoin['coinID']; moveType: 'spawn' | 'kick' | 'move' }>>();
  const currentBase = bases[currentTurn];

  if (!currentBase) {
    return { reachableCells, cellsByCoin };
  }

  // Helper function to add a cell to both reachableCells and cellsByCoin
  const addReachableCell = (cellID: string, coinID: ICoin['coinID'], moveType: 'spawn' | 'kick' | 'move') => {
    reachableCells.add(cellID);
    if (!cellsByCoin.has(cellID)) {
      cellsByCoin.set(cellID, []);
    }
    const existing = cellsByCoin.get(cellID)!;
    // Only add if not already present (avoid duplicates)
    if (!existing.some(e => e.coinID === coinID && e.moveType === moveType)) {
      existing.push({ coinID, moveType });
    }
  };

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
          addReachableCell(spawnCell.cellID, coin.coinID, 'spawn');
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

        // Check for blocking coins for this specific step count
        const blockingInfo: { blockingCoinID: ICoin['coinID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
          yield call(findBlockingCoin, coin.coinID, steps as Rolls);
        
        let maxStepsToExplore = steps;
        let shouldHighlightBlockingCell = false;
        
        if (blockingInfo) {
          // Blocking coin detected at step (stepsBeforeBlocking + 1)
          const blockingStep = blockingInfo.stepsBeforeBlocking + 1;
          
          if (steps < blockingStep) {
            // Die roll is less than blocking step - can only move steps before blocker
            // Don't explore any further - stop immediately
            maxStepsToExplore = blockingInfo.stepsBeforeBlocking;
            if (maxStepsToExplore <= 0) {
              continue; // Cannot move at all - skip this step count
            }
          } else if (steps === blockingStep && !blockingInfo.isSameColor) {
            // Die roll equals blocking step AND blocking coin is opponent (different color)
            // Can kick the blocking coin - highlight the blocking cell itself
            // Note: Same-color coins cannot be kicked, so we skip highlighting
            shouldHighlightBlockingCell = true;
            maxStepsToExplore = steps; // Can move full distance and kick
          } else {
            // Either:
            // - Die roll > blocking step (cannot kick, would overshoot)
            // - Die roll == blocking step but blocking coin is same color (cannot kick same color)
            continue; // Skip this step count - no highlighting
          }
        }

        // Use BFS to find all cells reachable in exactly 'maxStepsToExplore' moves
        // Track visited cells with their step count to avoid revisiting with more steps
        const visited = new Map<string, number>(); // cellID -> minimum steps to reach
        const queue: Array<{ cellID: string; position: WalkwayPosition; stepsRemaining: number }> = [
          { cellID: startCellID, position: coin.position, stepsRemaining: maxStepsToExplore },
        ];

        while (queue.length > 0) {
          const { cellID, position, stepsRemaining } = queue.shift()!;

          if (stepsRemaining === 0) {
            // We've reached this cell in exactly the right number of steps
            if (cellID !== 'HOME') {
              const cellData = cells[position]?.[cellID];
              if (cellData && cellData.coinIDs && cellData.coinIDs.length > 0) {
                const coinOnCell = coins[cellData.coinIDs[0]];
                // If it's a blocking coin (opponent or same color)
                if (coinOnCell) {
                  // Can only kick opponent coins (different color), not same-color coins
                  const isOpponentCoin = coinOnCell.baseID !== coin.baseID;
                  if (isOpponentCoin && shouldHighlightBlockingCell && blockingInfo && cellID === blockingInfo.blockingCellID && !blockingInfo.isSameColor) {
                    // This is the opponent blocking cell and we can kick it - highlight it
                    addReachableCell(cellID, coin.coinID, 'kick');
                  }
                  // Otherwise, blocked (same-color or opponent we can't kick) - don't highlight
                  continue;
                }
              }
            }
            // Determine move type: check if there's an opponent coin on this cell (kick) or normal move
            const cellDataForType = cells[position]?.[cellID];
            let moveType: 'kick' | 'move' = 'move';
            if (cellDataForType && cellDataForType.coinIDs && cellDataForType.coinIDs.length > 0) {
              const coinOnCell = coins[cellDataForType.coinIDs[0]];
              if (coinOnCell && coinOnCell.baseID !== coin.baseID) {
                moveType = 'kick'; // Opponent coin can be kicked
              }
            }
            addReachableCell(cellID, coin.coinID, moveType);
            continue;
          }

          // Check if we've already visited this cell with fewer or equal steps remaining
          const prevStepsRemaining = visited.get(cellID);
          if (prevStepsRemaining !== undefined && prevStepsRemaining >= stepsRemaining) {
            continue; // Already visited with equal or better path
          }
          visited.set(cellID, stepsRemaining);

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
              
              // Check if next cell has a blocking coin
              if (cellData && cellData.coinIDs && cellData.coinIDs.length > 0) {
                const coinOnCell = coins[cellData.coinIDs[0]];
                // If it's any blocking coin (same color or opponent)
                if (coinOnCell) {
                  // Check if we can kick this specific blocking coin
                  // We can only kick opponent coins (different color) if:
                  // 1. We have blockingInfo for this step count
                  // 2. This is the exact blocking cell we detected
                  // 3. The die roll equals the blocking step (steps === blockingStep)
                  // 4. The blocking coin is NOT same color (!blockingInfo.isSameColor)
                  const isOpponentCoin = coinOnCell.baseID !== coin.baseID;
                  if (isOpponentCoin && blockingInfo && nextCell.cellID === blockingInfo.blockingCellID && shouldHighlightBlockingCell && !blockingInfo.isSameColor) {
                    // This is the opponent blocking cell we detected and we can kick it - allow exploring to reach it
                    // Continue to queue.push below
                  } else {
                    // Blocked by coin (same-color or opponent we can't kick) - don't explore this path
                    // This prevents highlighting cells beyond any blocking coin
                    // This handles cases where:
                    // - The blocking coin is same color (cannot kick)
                    // - The blocking coin is not the one we detected for this step count
                    // - We cannot kick it (steps <= blockingStep)
                    // - We're exploring a different path that also has a blocking coin
                    continue;
                  }
                }
              }
              
            }

            queue.push({ cellID: nextCell.cellID, position: nextCell.position, stepsRemaining: stepsRemaining - 1 });
          }
        }
      }
      
      // Additional logic: If it's a pair OR before rolling, also check if we can use one die value
      // This allows players to move with one die when blocking is detected for the full sum
      // OR when they want to move with just one die value instead of the sum
      // OR before rolling (to show step 1 as a potential option if a pair is rolled)
      // This is especially important for coins on the spawn cell (steps === 0) to show step 1
      // ALWAYS show step 1 as an option when:
      // 1. It's a pair (any pair value) - show step 1 AND the pair value as options
      // 2. Before rolling (showPreRollStep1) - show step 1 as a potential option
      // 3. For coins on spawn cell (steps === 0) - always show step 1 as a potential option
      //    This ensures step 1 highlighting is never randomly missing for coins that can move
      const isOnSpawnCell = coin.steps === 0;
      const shouldShowStep1 = isPair || showPreRollStep1 || isOnSpawnCell;
      const shouldShowPairValue = isPair && singleDieValue && singleDieValue >= 1 && singleDieValue <= 6;
      
      // Always show step 1 when it's a pair or before rolling
      if (shouldShowStep1) {
        const step1Value = 1;
        // Check for blocking for step 1
        const blockingInfoForStep1: { blockingCoinID: ICoin['coinID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
          yield call(findBlockingCoin, coin.coinID, step1Value as Rolls);
        
        // For coins on spawn cell (steps === 0), this should always be true for step 1
        if (coin.steps + step1Value <= WINNING_MOVES) {
          if (blockingInfoForStep1) {
            // Blocking detected for step 1
            const blockingStep = blockingInfoForStep1.stepsBeforeBlocking + 1;
            
            if (step1Value < blockingStep) {
              // Step 1 is less than blocking step - can move to valid cell before blocker
              yield call(highlightCellsWithSteps, coin, startCellID, step1Value, blockingInfoForStep1, reachableCells, cells, links, coins, cellsByCoin, addReachableCell);
            } else if (step1Value === blockingStep && !blockingInfoForStep1.isSameColor) {
              // Step 1 equals blocking step AND blocking coin is opponent - can kick
              // Highlight the blocking cell itself
              addReachableCell(blockingInfoForStep1.blockingCellID, coin.coinID, 'kick');
            }
            // If step1Value > blockingStep, cannot move (would overshoot) - but this shouldn't happen for step 1
          } else {
            // No blocking for step 1 - show all cells reachable with step 1
            // This is critical for coins on spawn cell to show step 1 highlighting
            yield call(highlightCellsWithSteps, coin, startCellID, step1Value, null, reachableCells, cells, links, coins, cellsByCoin, addReachableCell);
          }
        }
      }
      
      // Also show the pair value as an option (in addition to step 1) when it's a pair
      if (shouldShowPairValue && singleDieValue !== 1) {
        // Only show pair value if it's different from step 1 (already handled above)
        const blockingInfoForPair: { blockingCoinID: ICoin['coinID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
          yield call(findBlockingCoin, coin.coinID, singleDieValue as Rolls);
        
        // Check if we can move with the pair value
        if (coin.steps + singleDieValue <= WINNING_MOVES) {
          if (blockingInfoForPair) {
            // Blocking detected for pair value
            const blockingStep = blockingInfoForPair.stepsBeforeBlocking + 1;
            
            if (singleDieValue < blockingStep) {
              // Pair value is less than blocking step - can move to valid cell before blocker
              yield call(highlightCellsWithSteps, coin, startCellID, singleDieValue, blockingInfoForPair, reachableCells, cells, links, coins, cellsByCoin, addReachableCell);
            } else if (singleDieValue === blockingStep && !blockingInfoForPair.isSameColor) {
              // Pair value equals blocking step AND blocking coin is opponent - can kick
              // Highlight the blocking cell itself
              addReachableCell(blockingInfoForPair.blockingCellID, coin.coinID, 'kick');
            }
            // If singleDieValue > blockingStep, cannot move (would overshoot)
          } else {
            // No blocking for pair value - show all cells reachable with pair value
            yield call(highlightCellsWithSteps, coin, startCellID, singleDieValue, null, reachableCells, cells, links, coins, cellsByCoin, addReachableCell);
          }
        }
      }
      // Note: The main loop above already handles highlighting for the full sum (dieSum = roll1 + roll2)
      // So we don't need to check blocking for the full sum here
    }
  }

  return { reachableCells, cellsByCoin };
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
  const result: { reachableCells: Set<string>; cellsByCoin: Map<string, Array<{ coinID: ICoin['coinID']; moveType: 'spawn' | 'kick' | 'move' }>> } = yield call(calculateReachableCells);

  // Set highlighted cells
  if (result.reachableCells.size > 0) {
    yield put(setHighlightedCells(result.reachableCells, result.cellsByCoin));
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
