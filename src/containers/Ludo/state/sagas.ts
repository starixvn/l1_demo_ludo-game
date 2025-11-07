/**
 * Ludo Game State Sagas
 *
 * Redux Sagas that handle all asynchronous game logic for the Ludo game.
 * Manages game initialization, horse movement, turn progression, and game state changes.
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
import { enableDie, disableDie, invalidateDieRoll, rollDie, ActionTypes as DiceActionTypes } from 'containers/Dice/state/actions';
import { addLogEntry } from 'containers/StepLogs/state/actions';
import { setAutoActionsEnabled } from 'containers/StepLogs/state/actions';
import { Rolls } from 'containers/Dice/state/interfaces';
import { currentDieRoll1Selector, currentDieRoll2Selector, currentDieRollSumSelector, isDieRollAllowedSelector, isDieRollValidSelector } from 'containers/Dice/state/selectors';
import { DEFAULT_STARTING_BASE, WINNING_MOVES, LUDO_MOVE_ANIMATION_DELAY, LUDO_STATE_UPDATE_DELAY, NO_MOVE_DELAY } from 'globalConstants';
import { WalkwayPosition } from 'state/interfaces';

import {
  clearAvailableActions,
  clearHighlightedCells,
  setAvailableActions,
  pauseReplay,
  nextReplayStep,
  disqualifyHorse,
  enableBase,
  getInitialGameDataSuccess,
  homeHorse,
  liftHorse,
  markWinner,
  moveHorse,
  moveHorseFailure,
  moveHorseSuccess,
  nextTurn,
  passTurnTo,
  placeHorse,
  setHighlightedCells,
  setPlayers,
  spawnHorse,
  spawnHorseSuccess,
  startHorseJump,
  stopHorseJump,
  ActionTypes,
} from './actions';
import {
  BaseID,
  CellType,
  IBase,
  ICell,
  IHorse,
  IServerGameData,
  IState,
  IWalkway,
} from './interfaces';
import {
  basesSelector,
  cellsSelector,
  horsesSelector,
  currentTurnSelector,
  linksSelector,
  walkwaysSelector,
  cellIndexLookupSelector,
  replaySelector,
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
 * 3. Sets up all game entities (bases, horses, cells, walkways)
 * 4. Initializes the game state with default values
 */
function * getInitialGameDataSaga() {
  // Fetch complete board configuration from JSON file
  const data: IServerGameData = yield call(api.get, { url: '/initialGameData.json' });

  // Process bases - add spawnable state (initially false for all players)
  const basesArray = data.bases.map((base) => ({ ...base, spawnable: false }));
  const bases = mapByProperty(basesArray, 'ID');

  // Process horses - assign colors based on their base ownership and initialize animation state
  const horses = data.horses.map((horse) => ({ ...horse, color: bases[horse.baseID].color, isJumping: false }));

  // Create complete game state object
  const gameData: IState = {
    bases,                              // Player bases with spawnable state
    cells: data.cells,                  // All board cells with positions and types
    horses: mapByProperty(horses, 'horseID'), // All game horses mapped by ID
    availableActions: null,             // No action selection initially
    availableActionsDieValue: null,     // No die value for actions initially
    highlightedCells: null,             // No cells highlighted initially
    highlightedCellsByHorse: null,       // No cell-to-horse mapping initially
    currentTurn: DEFAULT_STARTING_BASE, // Start with configured default base
    links: data.links,                  // Movement connectivity between cells
    relationships: data.relationships,  // Component relationships for rendering
    walkways: mapByProperty(data.walkways, 'ID'), // Walkway configurations
  };

  // Dispatch success action to update Redux store
  yield put(getInitialGameDataSuccess(gameData));
}

/**
 * Watcher saga for horse spawning actions
 * Triggers when a player attempts to spawn a horse from their base
 */
function * watchForSpawnHorse() {
  yield takeLatest(ActionTypes.SPAWN_HORSE, spawnHorseSaga);
}

/**
 * Handles spawning a horse from base onto the board
 *
 * This saga executes when a player rolls a 6 and chooses to spawn a horse.
 * It finds the appropriate spawn cell for the player's base and moves the horse there.
 * After spawning, the die roll becomes invalid (can't be used again).
 *
 * @param action - Contains baseID and horseID to spawn
 */
function * spawnHorseSaga(action: ReturnType<typeof spawnHorse>) {
  const { baseID, horseID } = action.data!;

  // Get current game state
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const walkways: ReturnType<typeof walkwaysSelector> = yield select(walkwaysSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);

  // Find the player's base and their walkway
  const base = bases[baseID];
  const walkway = Object.values(walkways).find((walkway) => walkway.baseID === baseID)!;

  // Get cells for this player's walkway and find the spawn cell
  const walkwayCells = cells[walkway.position];
  const spawnCellForHorse = Object.values(walkwayCells).find((cell) => cell.cellType === CellType.SPAWN)!;

  // Find the specific horse ID to spawn from the base's horse list
  const horseIDToSpawn = base.horseIDs.find((ID) => ID === horseID)!;

  // Log the spawn action for game history
  yield put(addLogEntry({
    player: base.color,
    action: 'Spawned horse',
    details: `Spawned horse ${horseID.split('_')[1]}`,
  }));

  // Execute the spawn - move horse from base to spawn cell
  yield put(spawnHorseSuccess(spawnCellForHorse.cellID, horseIDToSpawn, baseID, walkway.position));

  // Note: Roll invalidation is handled in spawnHorseSuccessSaga (Dice sagas)
}

/**
 * Watcher saga for horse movement actions
 * Triggers when a player attempts to move a horse along the board
 */
function * watchForMoveHorse() {
  yield takeLatest(ActionTypes.MOVE_HORSE, moveHorseSaga);
}

/**
 * Validates if a horse can make a specific move
 *
 * Checks if moving the horse by the given number of steps would exceed
 * the total distance needed to reach home (WINNING_MOVES = 56).
 *
 * @param horseID - The horse to validate movement for
 * @param stepsToTake - Number of steps from the die roll
 * @returns true if the move is valid (won't overshoot home)
 */
export function * isCurrentMoveValid(horseID: IHorse['horseID'], stepsToTake: Rolls) {
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const horse = horses[horseID];
  return horse.steps + stepsToTake <= WINNING_MOVES;
}

/**
 * Gets all horses that can be moved by the current player
 *
 * Filters the current player's horses to find those that:
 * - Are spawned on the board (not in base)
 * - Are not retired (haven't reached home)
 * - Can move the rolled number of spaces without overshooting
 *
 * @param stepsToTake - Number of steps from the die roll
 * @returns Array of horse IDs that can be moved
 */
export function * getMovableHorses(stepsToTake: Rolls) {
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const currentTurnBase: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);

  // Filter horses that meet all movement criteria
  const movableHorses =
    bases[currentTurnBase].horseIDs
    .filter((horseID) =>
      horses[horseID].isSpawned              // Must be on the board
      && !horses[horseID].isRetired         // Must not be home yet
      && horses[horseID].steps + stepsToTake <= WINNING_MOVES, // Must not overshoot
    );

  return movableHorses;
}

/**
 * Finds blocking horses along a horse's movement path
 * Returns information about the first blocking horse encountered
 * @param horseID - The horse that wants to move
 * @param stepsToTake - Number of steps to move
 * @returns Object with blockingHorseID, blockingCellID, and stepsBeforeBlocking, or null if no blocking
 */
export function * findBlockingHorse(
  horseID: IHorse['horseID'],
  stepsToTake: Rolls
): Generator<any, { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null, any> {
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const links: ReturnType<typeof linksSelector> = yield select(linksSelector);
  const currentHorse = horses[horseID];

  if (!currentHorse.isSpawned || currentHorse.isRetired) {
    return null; // Horse not on board or already home
  }

  let currentCellID = currentHorse.cellID;

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
        return cellData?.cellType === CellType.HOMEPATH && cellData.baseID === currentHorse.baseID;
      });
      nextCell = matchingHomePath || nextCells[0];
    }

    if (!nextCell) {
      break;
    }

    // Check if next cell has any horses (blocking) BEFORE moving to it
    if (nextCell.cellID !== 'HOME') {
      const cellData = cells[nextCell.position]?.[nextCell.cellID];
      if (cellData && cellData.horseIDs && cellData.horseIDs.length > 0) {
        // Found a blocking horse - can be same color or different color
        const blockingHorseID = cellData.horseIDs[0]; // Get first horse on the cell
        const blockingHorse = horses[blockingHorseID];
        
        if (blockingHorse) {
          // Blocking horse found at this step - can move up to 'step' steps before it
          // Track whether it's same color or different color
          const isSameColor = blockingHorse.baseID === currentHorse.baseID;
          return {
            blockingHorseID,
            blockingCellID: nextCell.cellID,
            stepsBeforeBlocking: step, // Number of steps we can take before hitting the blocker
            isSameColor, // Whether the blocking horse is the same color
          };
        }
      }
    }

    // Move to next cell for next iteration
    currentCellID = nextCell.cellID;
  }

  return null; // No blocking horse found
}

/**
 * Main saga for handling horse movement along the board
 *
 * This is the most complex saga in the game. It handles:
 * 1. Validating the move is possible
 * 2. Moving the horse step-by-step with animation
 * 3. Handling special cases (home path entry, reaching home)
 * 4. Checking for horse disqualifications (captures)
 * 5. Determining if the player gets a bonus turn
 *
 * The movement happens one cell at a time with 100ms delays for smooth animation.
 *
 * @param action - Contains horseID, target cellID, and walkway position
 */
function * moveHorseSaga(action: ReturnType<typeof moveHorse>) {
  let { cellID, walkwayPosition } = { ...action.data! };
  const { horseID, stepsToUse } = action.data!;
  const currentDieRoll: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);
  
  // Determine how many steps to move
  // If stepsToUse is provided (when using one die from a pair), use that instead of the sum
  const stepsToMove = stepsToUse !== undefined ? stepsToUse : currentDieRoll;
  
  // Check for blocking horses BEFORE allowing movement
  // Use the actual steps we're moving, not the full die sum
  const blockingInfo: { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
    yield call(findBlockingHorse, horseID, stepsToMove as Rolls);
  
  // Track if we can kick the blocking horse (if any)
  let canKickBlockingHorse = false;
  let blockingCellIDToKick: string | null = null;
  
  // If blocking horse is detected, check if we can kick it
  // Blocking applies to both same-color and different-color horses
  // But we can kick opponent horses if stepsToMove exactly equals the blocking step
  if (blockingInfo) {
    const blockingStep = blockingInfo.stepsBeforeBlocking + 1;
    
    // Check if we can kick this blocking horse
    // Can kick if: stepsToMove === blockingStep AND blocking horse is opponent (not same color)
    canKickBlockingHorse = stepsToMove === blockingStep && !blockingInfo.isSameColor;
    
    if (!canKickBlockingHorse) {
      // Cannot kick - block the movement
      console.warn(`Horse ${horseID} cannot move - blocked by ${blockingInfo.blockingHorseID} (same color: ${blockingInfo.isSameColor}, steps: ${stepsToMove}, blockingStep: ${blockingStep})`);
      yield put(moveHorseFailure());
      
      // Check if replay is active - replay system handles turn progression
      const replay: ReturnType<typeof replaySelector> = yield select(replaySelector);
      if (replay?.isActive && !replay.isPaused) {
        console.log('[REPLAY] Horse blocked - no move, advancing replay step');
        // Wait for player to see the dice result
        yield delay(NO_MOVE_DELAY);
        yield put(invalidateDieRoll());
        
        // Manually advance replay step since no MOVE_HORSE_SUCCESS will be dispatched
        if (replay.cursor < replay.steps.length - 1) {
          const nextStepIndex = replay.cursor + 1;
          yield put(nextReplayStep());
          
          yield delay(50); // Small delay to ensure state update
          const updatedReplay: ReturnType<typeof replaySelector> = yield select(replaySelector);
          const nextStep = updatedReplay?.steps?.[updatedReplay.cursor];
          if (nextStep) {
            const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
            const baseID = mapPlayerIndexToBase(nextStep.currentPlayer);
            
            console.log('[REPLAY] Horse blocked - advancing to next step:', {
              completedStep: replay.cursor,
              nextStep: nextStepIndex,
              nextStepPlayer: nextStep.currentPlayer,
              nextStepPlayerColor: bases[baseID].color,
            });
            
            yield delay(200);
            yield put(passTurnTo(baseID));
            yield put(enableDie());
            yield delay(100);
            yield put(rollDie());
          }
        } else {
          // Finished
          yield put(pauseReplay());
        }
        return;
      }
      
      // Wait for player to see the dice result before passing turn
      yield delay(NO_MOVE_DELAY);
      yield put(nextTurn());
      yield put(enableDie());
      return;
    }
    // If canKickBlockingHorse is true, proceed with movement (will kick the blocking horse)
    blockingCellIDToKick = blockingInfo.blockingCellID;
  }

  // Validate that this move is possible
  // Use the actual steps we're moving, not necessarily the full die sum
  const movableHorses: IHorse['horseID'][] = yield call(getMovableHorses, stepsToMove as Rolls);
  const isCurrentMovePossible: boolean = yield call(isCurrentMoveValid, horseID, stepsToMove as Rolls);

  // If no horses can move, skip turn
  if (movableHorses.length === 0) {
    yield put(moveHorseFailure());
    
    // Check if replay is active - replay system handles turn progression
    const replay: ReturnType<typeof replaySelector> = yield select(replaySelector);
    if (replay?.isActive && !replay.isPaused) {
      console.log('[REPLAY] No horses can move - advancing replay step');
      // Wait for player to see the dice result
      yield delay(NO_MOVE_DELAY);
      yield put(invalidateDieRoll());
      
      // Manually advance replay step since no MOVE_HORSE_SUCCESS will be dispatched
      if (replay.cursor < replay.steps.length - 1) {
        const nextStepIndex = replay.cursor + 1;
        yield put(nextReplayStep());
        
        yield delay(50); // Small delay to ensure state update
        const updatedReplay: ReturnType<typeof replaySelector> = yield select(replaySelector);
        const nextStep = updatedReplay?.steps?.[updatedReplay.cursor];
        if (nextStep) {
          const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
          const baseID = mapPlayerIndexToBase(nextStep.currentPlayer);
          
          console.log('[REPLAY] No horses can move - advancing to next step:', {
            completedStep: replay.cursor,
            nextStep: nextStepIndex,
            nextStepPlayer: nextStep.currentPlayer,
            nextStepPlayerColor: bases[baseID].color,
          });
          
          yield delay(200);
          yield put(passTurnTo(baseID));
          yield put(enableDie());
          yield delay(100);
          yield put(rollDie());
        }
      } else {
        // Finished
        yield put(pauseReplay());
      }
      return;
    }
    
    yield put(nextTurn());
    yield put(enableDie());
    return;
  }
  // If this specific horse can't move, reject the action
  else if (!isCurrentMovePossible) {
    yield put(moveHorseFailure());
    return;
  }

  // Don't invalidate roll here - wait until action completes (handled in moveHorseSuccessSaga)

  // Track if horse reached home during movement
  let bonusChanceForHomeHorse = false;

  // Move the horse step-by-step based on steps to move
  for (let i = 0; i < stepsToMove; i++) {
    // Get fresh state for each step (state may change during movement)
    const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
    const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
    const links: ReturnType<typeof linksSelector> = yield select(linksSelector);

    // Find next possible cells from current position
    const nextCells = links[cellID];
    
    // Safety check: if no links found, this is a configuration error
    if (!nextCells || nextCells.length === 0) {
      console.error(`No links found for cell ${cellID} - horse ${horseID} cannot move forward`);
      yield put(moveHorseFailure());
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
        // Priority 1: Try to find a home path cell that matches this horse's base
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
              && horses[horseID].baseID === cellData.baseID;
          }
        );

        if (matchingHomePath) {
          // Use the matching home path if found - PRIORITIZE this!
          nextCell = matchingHomePath;
        } else {
          // No matching home path found - filter valid cells
          // Filter out any home path cells that don't match this horse's base
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
            // Allow: non-home-path cells OR home path cells that match this horse's base
            return cellData.cellType !== CellType.HOMEPATH
              || cellData.baseID === horses[horseID].baseID;
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
                && cellData.baseID === horses[horseID].baseID;
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
              // All cells are home paths but none match this horse's base
              // This is a configuration error - log and fail the move
              console.error(`Horse ${horseID} at ${cellID} has no valid moves - all next cells are other bases' home paths`);
              yield put(moveHorseFailure());
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
          yield put(moveHorseFailure());
          yield put(nextTurn());
          yield put(enableDie());
          return;
        }
        
        if (cellData.cellType === CellType.HOMEPATH && cellData.baseID !== horses[horseID].baseID) {
          // Prevent entering another base's home path
          console.warn(`Horse ${horseID} cannot enter ${nextCells[0].cellID} - wrong base home path (expected ${horses[horseID].baseID}, got ${cellData.baseID})`);
          yield put(moveHorseFailure());
          yield put(nextTurn());
          yield put(enableDie());
          return; // Fail the move instead of allowing it
        } else {
          nextCell = nextCells[0];
        }
      }
    }

    // Check for blocking horse on next cell - if found, cannot move over
    // Blocking applies to both same-color and different-color horses
    // Exception: If we're allowed to kick this specific blocking cell, allow movement to it
    if (nextCell.cellID !== 'HOME') {
      const nextCellData = cells[nextCell.position]?.[nextCell.cellID];
      if (nextCellData && nextCellData.horseIDs && nextCellData.horseIDs.length > 0) {
        // Found a horse on the next cell - check if we can kick it
        // Allow movement if this is the blocking cell we're allowed to kick
        if (canKickBlockingHorse && blockingCellIDToKick && nextCell.cellID === blockingCellIDToKick) {
          // This is the blocking cell we're allowed to kick - proceed with movement
          // The kick will be handled by performDisqualificationCheck later
        } else {
          // Cannot kick this horse - block the movement
          // Note: We cannot kick same-color horses, so any blocking horse prevents movement
          console.warn(`Horse ${horseID} cannot move to ${nextCell.cellID} - blocked by ${nextCellData.horseIDs[0]}`);
          yield put(moveHorseFailure());
          yield put(nextTurn());
          yield put(enableDie());
          return; // Stop movement and pass turn
        }
      }
    }

    // Start jumping animation
    yield put(startHorseJump(horseID));

    // Animate: lift horse from current cell
    yield put(liftHorse(cellID, horseID, walkwayPosition));

    // Check if we've reached the home position
    if (nextCell.cellID === 'HOME') {
      yield put(homeHorse(horseID));
      bonusChanceForHomeHorse = true;
    } else {
      // Place horse on next cell
      yield put(placeHorse(nextCell.cellID, horseID, nextCell.position));
    }

    // Animation delay for smooth movement and jumping
    yield delay(LUDO_MOVE_ANIMATION_DELAY);

    // Stop jumping animation after movement completes
    yield put(stopHorseJump(horseID));

    // Update position for next iteration
    cellID = nextCell.cellID;
    walkwayPosition = nextCell.position;
  }

  // Get dice values to check for bonus turn
  const roll1: ReturnType<typeof currentDieRoll1Selector> = yield select(currentDieRoll1Selector);
  const roll2: ReturnType<typeof currentDieRoll2Selector> = yield select(currentDieRoll2Selector);
  
  // Determine if player gets a bonus turn
  const bonusChance = bonusChanceForHomeHorse                          // Reached home
  || (yield call(performDisqualificationCheck, action.data!.horseID, walkwayPosition, cellID)) // Captured opponent
  || ((roll1 === Rolls.ONE && roll2 === Rolls.SIX) || (roll1 === Rolls.SIX && roll2 === Rolls.ONE) || roll1 === roll2); // Rolled spawnable combination

  // Log the successful move
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const playerColor = bases[horses[horseID].baseID].color;

  // Log the move action
  yield put(addLogEntry({
    player: playerColor,
    action: 'Moved horse',
    details: `Moved horse ${horseID.split('_')[1]} ${stepsToMove} spaces`,
  }));

  // Verify replay target position if replay is active
  const replay: ReturnType<typeof replaySelector> = yield select(replaySelector);
  if (replay?.isActive && !replay.isPaused && replay.cursor < replay.steps.length) {
    // Get fresh state after movement completes
    yield delay(50); // Small delay to ensure reducer has updated state
    const updatedHorses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
    const finalHorse = updatedHorses[horseID];
    const step = replay.steps[replay.cursor];
    const { newPosition } = step.playerAction || { newPosition: 0 };
    
    const indexMap: ReturnType<typeof cellIndexLookupSelector> = yield select(cellIndexLookupSelector);
    const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
    
    // Get the actual index of the cell the horse is on
    const finalCellData = (cells as any)[finalHorse.position]?.[finalHorse.cellID];
    const finalIndex = finalCellData?.index;
    const targetCellInfo = indexMap.get(newPosition);
    const targetCellData = targetCellInfo ? (cells as any)[targetCellInfo.position]?.[targetCellInfo.cellID] : null;
    
    // Check if we reached the target index from replay file
    if (newPosition !== 0 && finalIndex !== newPosition) {
      console.warn('[REPLAY] Position mismatch after movement:', {
        step: replay.cursor,
        horseID,
        expectedIndex: newPosition,
        actualIndex: finalIndex,
        expectedCell: targetCellInfo ? { cellID: targetCellInfo.cellID, position: targetCellInfo.position, cellType: targetCellData?.cellType, baseID: targetCellData?.baseID } : null,
        actualCell: { cellID: finalHorse.cellID, position: finalHorse.position, cellType: finalCellData?.cellType, baseID: finalCellData?.baseID },
        stepsMoved: stepsToMove,
      });
      
      // If target is a homepath cell and we're not there, this indicates a routing issue
      if (targetCellData?.cellType === CellType.HOMEPATH) {
        console.error('[REPLAY] CRITICAL: Target is homepath cell but horse ended at different index. Homepath routing may be incorrect.', {
          targetCellID: targetCellInfo?.cellID,
          targetBaseID: targetCellData?.baseID,
          actualCellID: finalHorse.cellID,
          actualBaseID: finalCellData?.baseID,
          horseBaseID: finalHorse.baseID,
        });
      }
    } else if (newPosition !== 0 && finalIndex === newPosition) {
      console.log('[REPLAY] Position verified - horse reached target index:', {
        step: replay.cursor,
        horseID,
        index: newPosition,
        cellID: finalHorse.cellID,
        cellType: finalCellData?.cellType,
        stepsMoved: stepsToMove,
      });
    }
  }

  // Complete the move and handle turn progression
  yield put(moveHorseSuccess(bonusChance, horseID, stepsToMove as Rolls));

  // Check if replay is active - replay system handles turn progression
  if (replay?.isActive && !replay.isPaused) {
    // Replay system will handle turn progression via replayAdvanceStepSaga
    return;
  }

  // Advance to next turn unless player gets bonus
  // Note: Roll invalidation and die enabling are handled in moveHorseSuccessSaga
  if (!bonusChance) {
    yield put(nextTurn());
  }
}

/**
 * Checks if the moving horse captures any opponent horses
 *
 * When a horse lands on a normal cell, it checks if there are any opponent horses
 * on that cell. If found, those horses are sent back to their base (disqualified).
 * This gives the player a bonus turn for successful captures.
 *
 * @param activeHorseID - The horse that just moved
 * @param walkwayPosition - Position where the horse landed
 * @param cellID - Specific cell where the horse landed
 * @returns true if any horses were captured (player gets bonus turn)
 */
function * performDisqualificationCheck(activeHorseID: IHorse['horseID'], walkwayPosition: WalkwayPosition, cellID: ICell['cellID']) {
  // No captures possible at home position
  if (cellID === 'HOME') {
    return false;
  }

  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);

  const activeHorse = horses[activeHorseID];
  const cellInWhichHorseLanded = cells[walkwayPosition][cellID];

  // Debug logging for development
  console.log(cellInWhichHorseLanded, activeHorse);

  // Any cell type (NORMAL, SPAWN, HOMEPATH) allows captures if it has opponent horses
  // Check each horse on the target cell
  for (const horseID of cellInWhichHorseLanded.horseIDs) {
    const horse = horses[horseID];
    // If it's an opponent horse, disqualify it (kick it)
    if (activeHorse.baseID !== horse.baseID) {
      yield put(disqualifyHorse(horseID, walkwayPosition, cellID));
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
  horse: IHorse,
  startCellID: string,
  steps: number,
  blockingInfo: { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null,
  reachableCells: Set<string>,
  cells: ReturnType<typeof cellsSelector>,
  links: ReturnType<typeof linksSelector>,
  horses: ReturnType<typeof horsesSelector>,
  cellsByHorse: Map<string, Array<{ horseID: IHorse['horseID']; moveType: 'spawn' | 'kick' | 'move' }>>,
  addReachableCell: (cellID: string, horseID: IHorse['horseID'], moveType: 'spawn' | 'kick' | 'move') => void
): Generator<any, void, any> {
  const visited = new Map<string, number>();
  const queue: Array<{ cellID: string; position: WalkwayPosition; stepsRemaining: number }> = [
    { cellID: startCellID, position: horse.position, stepsRemaining: steps },
  ];

  while (queue.length > 0) {
    const { cellID, position, stepsRemaining } = queue.shift()!;

    if (stepsRemaining === 0) {
      // We've reached this cell in exactly the right number of steps
      if (cellID !== 'HOME') {
        const cellData = cells[position]?.[cellID];
        if (cellData && cellData.horseIDs && cellData.horseIDs.length > 0) {
          const horseOnCell = horses[cellData.horseIDs[0]];
          // If it's a blocking horse, don't highlight (we're avoiding it)
          if (horseOnCell) {
            // Only skip if it's the specific blocking cell we're trying to avoid
            if (blockingInfo && cellID === blockingInfo.blockingCellID) {
              continue; // This is the blocking cell - don't highlight
            }
            // Otherwise, if there's a horse but it's not the blocking one, we can still highlight
            // (this handles cases where there might be other horses on the path)
          }
        }
      }
      // Determine move type: check if there's an opponent horse on this cell (kick) or normal move
      const cellDataForType = cells[position]?.[cellID];
      let moveType: 'kick' | 'move' = 'move';
      if (cellDataForType && cellDataForType.horseIDs && cellDataForType.horseIDs.length > 0) {
        const horseOnCell = horses[cellDataForType.horseIDs[0]];
        if (horseOnCell && horseOnCell.baseID !== horse.baseID) {
          moveType = 'kick'; // Opponent horse can be kicked
        }
      }
      addReachableCell(cellID, horse.horseID, moveType);
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
          if (cellData.baseID !== horse.baseID) {
            continue;
          }
        }
        
        // Check if next cell has a blocking horse - skip if it's the blocking cell we're avoiding
        if (cellData && cellData.horseIDs && cellData.horseIDs.length > 0) {
          const horseOnCell = horses[cellData.horseIDs[0]];
          if (horseOnCell) {
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
 * Calculates all reachable cells for the current player's horses
 * Returns a Set of cell IDs that can be reached with any valid dice roll (sum of 2-12)
 * Also returns a Map of cellID -> Array<{horseID, moveType}> to track which horses can reach which cells
 *
 * This function handles:
 * - Spawn moves for horses in base
 * - Normal moves with dice sums (2-12)
 * - Special pair handling (single die values)
 * - Blocking horse detection and kicking logic
 * - Home path restrictions
 */
export function * calculateReachableCells(): Generator<any, { reachableCells: Set<string>; cellsByHorse: Map<string, Array<{ horseID: IHorse['horseID']; moveType: 'spawn' | 'kick' | 'move' }>> }, any> {
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
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
  const cellsByHorse = new Map<string, Array<{ horseID: IHorse['horseID']; moveType: 'spawn' | 'kick' | 'move' }>>();
  const currentBase = bases[currentTurn];

  if (!currentBase) {
    return { reachableCells, cellsByHorse };
  }

  // Helper function to add a cell to both reachableCells and cellsByHorse
  const addReachableCell = (cellID: string, horseID: IHorse['horseID'], moveType: 'spawn' | 'kick' | 'move') => {
    reachableCells.add(cellID);
    if (!cellsByHorse.has(cellID)) {
      cellsByHorse.set(cellID, []);
    }
    const existing = cellsByHorse.get(cellID)!;
    // Only add if not already present (avoid duplicates)
    if (!existing.some(e => e.horseID === horseID && e.moveType === moveType)) {
      existing.push({ horseID, moveType });
    }
  };

  // Get all horses for the current player
  const playerHorses = currentBase.horseIDs.map((horseID) => horses[horseID]);

  // Process each horse for all possible move types
  for (const horse of playerHorses) {
    if (horse.isRetired) {
      continue; // Skip retired horses
    }

    // Calculate spawn moves for unspawned horses
    yield call(calculateSpawnMoves, horse, currentBase, cells, addReachableCell);

    // Calculate normal movement for spawned horses
    if (horse.isSpawned && horse.cellID) {
      yield call(calculateNormalMoves, horse, cells, links, horses, reachableCells, cellsByHorse, addReachableCell);
      yield call(calculateStep1Moves, horse, isPair, showPreRollStep1, cells, links, horses, reachableCells, cellsByHorse, addReachableCell);
      yield call(calculatePairMoves, horse, isPair, singleDieValue, cells, links, horses, reachableCells, cellsByHorse, addReachableCell);
    }
  }

  return { reachableCells, cellsByHorse };
}

/**
 * Calculates spawn moves for horses that haven't been spawned yet
 * Horses can only spawn to their base's spawn cell when rolling 6 or doubles
 */
function * calculateSpawnMoves(
  horse: IHorse,
  currentBase: IBase,
  cells: ReturnType<typeof cellsSelector>,
  addReachableCell: (cellID: string, horseID: string, moveType: 'spawn' | 'kick' | 'move') => void
): Generator<any, void, any> {
  if (horse.isSpawned) {
    return; // Only process unspawned horses
  }

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
      addReachableCell(spawnCell.cellID, horse.horseID, 'spawn');
    }
  }
}

/**
 * Calculates normal movement for spawned horses (dice sums 2-12)
 * Uses BFS to find all reachable cells while respecting blocking horses and game rules
 */
function * calculateNormalMoves(
  horse: IHorse,
  cells: ReturnType<typeof cellsSelector>,
  links: ReturnType<typeof linksSelector>,
  horses: ReturnType<typeof horsesSelector>,
  reachableCells: Set<string>,
  cellsByHorse: Map<string, Array<{ horseID: string; moveType: 'spawn' | 'kick' | 'move' }>>,
  addReachableCell: (cellID: string, horseID: string, moveType: 'spawn' | 'kick' | 'move') => void
): Generator<any, void, any> {
  const startCellID = horse.cellID!;

  // Calculate all cells reachable with 2-12 steps (two dice: min 1+1=2, max 6+6=12)
  for (let steps = 1; steps <= 12; steps++) {
    // Check if this move would overshoot home
    if (horse.steps + steps > WINNING_MOVES) {
      continue; // Skip moves that overshoot
    }

    // Process blocking horse logic and determine exploration parameters
    const blockingResult = yield call(processBlockingLogic, horse.horseID, steps);
    if (!blockingResult.canExplore) {
      continue; // Cannot move with this step count due to blocking
    }

    const { maxStepsToExplore, shouldHighlightBlockingCell, blockingInfo } = blockingResult;

    // Use BFS to find all cells reachable in exactly 'maxStepsToExplore' moves
    yield call(exploreReachableCells,
      horse, startCellID, maxStepsToExplore, shouldHighlightBlockingCell, blockingInfo,
      cells, links, horses, reachableCells, cellsByHorse, addReachableCell);
  }
}

/**
 * Processes blocking horse logic for a specific step count
 * Returns exploration parameters based on blocking horse analysis
 *
 * BLOCKING LOGIC SCENARIOS:
 * 1. No blocking horse: Can explore full step distance
 * 2. Blocking horse with steps < blocking step: Can only move up to blocker
 * 3. Blocking horse with steps == blocking step && opponent: Can kick and highlight blocking cell
 * 4. Blocking horse with steps == blocking step && same color: Cannot move (can't kick same color)
 * 5. Blocking horse with steps > blocking step: Cannot move (would overshoot blocker)
 */
function * processBlockingLogic(
  horseID: string,
  steps: number
): Generator<any, {
  canExplore: boolean;
  maxStepsToExplore: number;
  shouldHighlightBlockingCell: boolean;
  blockingInfo: any
}, any> {
  // Check for blocking horses for this specific step count
  const blockingInfo: { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null =
    yield call(findBlockingHorse, horseID, steps as Rolls);

  let maxStepsToExplore = steps;
  let shouldHighlightBlockingCell = false;
  let canExplore = true;

  if (blockingInfo) {
    // Blocking horse detected at step (stepsBeforeBlocking + 1)
    // Example: if stepsBeforeBlocking = 2, blocking horse is at step 3
    const blockingStep = blockingInfo.stepsBeforeBlocking + 1;

    if (steps < blockingStep) {
      // SCENARIO 2: Die roll is less than blocking step - can only move steps before blocker
      // Example: rolling 4 but blocker at step 5 - can only move 4 steps
      // Don't explore any further - stop immediately
      maxStepsToExplore = blockingInfo.stepsBeforeBlocking;
      if (maxStepsToExplore <= 0) {
        canExplore = false; // Cannot move at all - skip this step count
      }
    } else if (steps === blockingStep && !blockingInfo.isSameColor) {
      // SCENARIO 3: Die roll equals blocking step AND blocking horse is opponent (different color)
      // Can kick the blocking horse - highlight the blocking cell itself
      // Note: Same-color horses cannot be kicked, so we skip highlighting
      shouldHighlightBlockingCell = true;
      maxStepsToExplore = steps; // Can move full distance and kick
    } else {
      // SCENARIO 4 & 5: Either:
      // - Die roll > blocking step (cannot kick, would overshoot)
      // - Die roll == blocking step but blocking horse is same color (cannot kick same color)
      canExplore = false; // Skip this step count - no highlighting
    }
  }
  // SCENARIO 1: No blocking horse - canExplore = true, maxStepsToExplore = steps

  return { canExplore, maxStepsToExplore, shouldHighlightBlockingCell, blockingInfo };
}

/**
 * Explores all cells reachable from a starting position using BFS
 * Handles the complex logic of cell traversal, blocking, and move type determination
 */
function * exploreReachableCells(
  horse: IHorse,
  startCellID: string,
  maxStepsToExplore: number,
  shouldHighlightBlockingCell: boolean,
  blockingInfo: any,
  cells: ReturnType<typeof cellsSelector>,
  links: ReturnType<typeof linksSelector>,
  horses: ReturnType<typeof horsesSelector>,
  reachableCells: Set<string>,
  cellsByHorse: Map<string, Array<{ horseID: string; moveType: 'spawn' | 'kick' | 'move' }>>,
  addReachableCell: (cellID: string, horseID: string, moveType: 'spawn' | 'kick' | 'move') => void
): Generator<any, void, any> {
  // Track visited cells with their step count to avoid revisiting with more steps
  const visited = new Map<string, number>(); // cellID -> minimum steps to reach
  const queue: Array<{ cellID: string; position: WalkwayPosition; stepsRemaining: number }> = [
    { cellID: startCellID, position: horse.position, stepsRemaining: maxStepsToExplore },
  ];

  while (queue.length > 0) {
    const { cellID, position, stepsRemaining } = queue.shift()!;

    if (stepsRemaining === 0) {
      // We've reached this cell in exactly the right number of steps
      yield call(processReachedCell, cellID, position, shouldHighlightBlockingCell, blockingInfo,
        cells, horses, horse, addReachableCell);
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

    // Add all valid next cells to queue
    for (const nextCell of nextCells) {
      if (yield call(isValidNextCell, nextCell, stepsRemaining, horse, cells, horses, blockingInfo, shouldHighlightBlockingCell)) {
        queue.push({ cellID: nextCell.cellID, position: nextCell.position, stepsRemaining: stepsRemaining - 1 });
      }
    }
  }
}

/**
 * Processes a cell that has been reached in exactly the target number of steps
 * Determines if it should be highlighted based on blocking and move type logic
 */
function * processReachedCell(
  cellID: string,
  position: WalkwayPosition,
  shouldHighlightBlockingCell: boolean,
  blockingInfo: any,
  cells: ReturnType<typeof cellsSelector>,
  horses: ReturnType<typeof horsesSelector>,
  horse: IHorse,
  addReachableCell: (cellID: string, horseID: string, moveType: 'spawn' | 'kick' | 'move') => void
): Generator<any, void, any> {
  if (cellID !== 'HOME') {
    const cellData = cells[position]?.[cellID];
    if (cellData && cellData.horseIDs && cellData.horseIDs.length > 0) {
      const horseOnCell = horses[cellData.horseIDs[0]];

      // Check if this cell has a blocking horse that affects highlighting
      if (horseOnCell) {
        // Can only kick opponent horses (different color), not same-color horses
        const isOpponentHorse = horseOnCell.baseID !== horse.baseID;

        if (isOpponentHorse && shouldHighlightBlockingCell && blockingInfo && cellID === blockingInfo.blockingCellID && !blockingInfo.isSameColor) {
          // This is the opponent blocking cell we detected and we can kick it - highlight it
          addReachableCell(cellID, horse.horseID, 'kick');
          return;
        } else {
          // Otherwise, blocked (same-color or opponent we can't kick) - don't highlight
          // This prevents showing cells that are blocked by horses
          return;
        }
      }
    }
  }

  // Determine move type: check if there's an opponent horse on this cell (kick) or normal move
  const cellDataForType = cells[position]?.[cellID];
  let moveType: 'kick' | 'move' = 'move';
  if (cellDataForType && cellDataForType.horseIDs && cellDataForType.horseIDs.length > 0) {
    const horseOnCell = horses[cellDataForType.horseIDs[0]];
    if (horseOnCell && horseOnCell.baseID !== horse.baseID) {
      moveType = 'kick'; // Opponent horse can be kicked
    }
  }
  addReachableCell(cellID, horse.horseID, moveType);
}

/**
 * Validates if a cell can be explored as a next move
 * Checks home path restrictions and blocking horse rules
 */
function * isValidNextCell(
  nextCell: any,
  stepsRemaining: number,
  horse: IHorse,
  cells: ReturnType<typeof cellsSelector>,
  horses: ReturnType<typeof horsesSelector>,
  blockingInfo: any,
  shouldHighlightBlockingCell: boolean
): Generator<any, boolean, any> {
  // Skip HOME cells in intermediate steps (we'll add it at the end if reachable)
  if (nextCell.cellID === 'HOME' && stepsRemaining > 1) {
    return false;
  }

  // For homepath cells, only allow if they match the horse's base
  if (nextCell.cellID !== 'HOME') {
    const cellData = cells[nextCell.position]?.[nextCell.cellID];
    if (cellData && cellData.cellType === CellType.HOMEPATH) {
      if (cellData.baseID !== horse.baseID) {
        return false; // Skip other players' homepaths
      }
    }

    // Check if next cell has a blocking horse
    if (cellData && cellData.horseIDs && cellData.horseIDs.length > 0) {
      const horseOnCell = horses[cellData.horseIDs[0]];

      // If it's any blocking horse (same color or opponent)
      if (horseOnCell) {
        // Check if we can kick this specific blocking horse
        // We can only kick opponent horses (different color) if:
        // 1. We have blockingInfo for this step count
        // 2. This is the exact blocking cell we detected
        // 3. We should highlight blocking cells (indicates we can kick)
        // 4. The blocking horse is NOT same color (!blockingInfo.isSameColor)
        const isOpponentHorse = horseOnCell.baseID !== horse.baseID;

        if (isOpponentHorse && blockingInfo && nextCell.cellID === blockingInfo.blockingCellID && shouldHighlightBlockingCell && !blockingInfo.isSameColor) {
          // This is the opponent blocking cell we detected and we can kick it - allow exploring to reach it
          return true;
        } else {
          // Blocked by horse (same-color or opponent we can't kick) - don't explore this path
          // This prevents highlighting cells beyond any blocking horse
          // This handles cases where:
          // - The blocking horse is same color (cannot kick)
          // - The blocking horse is not the one we detected for this step count
          // - We cannot kick it (steps <= blockingStep)
          // - We're exploring a different path that also has a blocking horse
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Calculates step 1 highlighting for special cases
 * Step 1 is shown when:
 * - It's a pair (any pair value) - show step 1 AND the pair value as options
 * - Before rolling (showPreRollStep1) - show step 1 as a potential option
 * - For horses on spawn cell (steps === 0) - always show step 1 as a potential option
 */
function * calculateStep1Moves(
  horse: IHorse,
  isPair: boolean,
  showPreRollStep1: boolean,
  cells: ReturnType<typeof cellsSelector>,
  links: ReturnType<typeof linksSelector>,
  horses: ReturnType<typeof horsesSelector>,
  reachableCells: Set<string>,
  cellsByHorse: Map<string, Array<{ horseID: string; moveType: 'spawn' | 'kick' | 'move' }>>,
  addReachableCell: (cellID: string, horseID: string, moveType: 'spawn' | 'kick' | 'move') => void
): Generator<any, void, any> {
  const startCellID = horse.cellID!;
  const isOnSpawnCell = horse.steps === 0;
  const shouldShowStep1 = isPair || showPreRollStep1 || isOnSpawnCell;

  if (!shouldShowStep1) {
    return;
  }

  const step1Value = 1;

  // For horses on spawn cell (steps === 0), this should always be true for step 1
  if (horse.steps + step1Value <= WINNING_MOVES) {
    const blockingInfoForStep1 = yield call(findBlockingHorse, horse.horseID, step1Value as Rolls);

    if (blockingInfoForStep1) {
      // Blocking detected for step 1
      const blockingStep = blockingInfoForStep1.stepsBeforeBlocking + 1;

      if (step1Value < blockingStep) {
        // Step 1 is less than blocking step - can move to valid cell before blocker
        yield call(highlightCellsWithSteps, horse, startCellID, step1Value, blockingInfoForStep1, reachableCells, cells, links, horses, cellsByHorse, addReachableCell);
      } else if (step1Value === blockingStep && !blockingInfoForStep1.isSameColor) {
        // Step 1 equals blocking step AND blocking horse is opponent - can kick
        // Highlight the blocking cell itself
        addReachableCell(blockingInfoForStep1.blockingCellID, horse.horseID, 'kick');
      }
      // If step1Value > blockingStep, cannot move (would overshoot) - but this shouldn't happen for step 1
    } else {
      // No blocking for step 1 - show all cells reachable with step 1
      // This is critical for horses on spawn cell to show step 1 highlighting
      yield call(highlightCellsWithSteps, horse, startCellID, step1Value, null, reachableCells, cells, links, horses, cellsByHorse, addReachableCell);
    }
  }
}

/**
 * Calculates pair value highlighting when dice show doubles
 * Shows the single die value as an additional option (besides step 1)
 */
function * calculatePairMoves(
  horse: IHorse,
  isPair: boolean,
  singleDieValue: number | null,
  cells: ReturnType<typeof cellsSelector>,
  links: ReturnType<typeof linksSelector>,
  horses: ReturnType<typeof horsesSelector>,
  reachableCells: Set<string>,
  cellsByHorse: Map<string, Array<{ horseID: string; moveType: 'spawn' | 'kick' | 'move' }>>,
  addReachableCell: (cellID: string, horseID: string, moveType: 'spawn' | 'kick' | 'move') => void
): Generator<any, void, any> {
  if (!isPair || !singleDieValue || singleDieValue < 1 || singleDieValue > 6) {
    return;
  }

  const startCellID = horse.cellID!;

  // Only show pair value if it's different from step 1 (already handled above)
  if (singleDieValue === 1) {
    return;
  }

  // Check if we can move with the pair value
  if (horse.steps + singleDieValue <= WINNING_MOVES) {
    const blockingInfoForPair = yield call(findBlockingHorse, horse.horseID, singleDieValue as Rolls);

    if (blockingInfoForPair) {
      // Blocking detected for pair value
      const blockingStep = blockingInfoForPair.stepsBeforeBlocking + 1;

      if (singleDieValue < blockingStep) {
        // Pair value is less than blocking step - can move to valid cell before blocker
        yield call(highlightCellsWithSteps, horse, startCellID, singleDieValue, blockingInfoForPair, reachableCells, cells, links, horses, cellsByHorse, addReachableCell);
      } else if (singleDieValue === blockingStep && !blockingInfoForPair.isSameColor) {
        // Pair value equals blocking step AND blocking horse is opponent - can kick
        // Highlight the blocking cell itself
        addReachableCell(blockingInfoForPair.blockingCellID, horse.horseID, 'kick');
      }
      // If singleDieValue > blockingStep, cannot move (would overshoot)
    } else {
      // No blocking for pair value - show all cells reachable with pair value
      yield call(highlightCellsWithSteps, horse, startCellID, singleDieValue, null, reachableCells, cells, links, horses, cellsByHorse, addReachableCell);
    }
  }
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
 * Maps player index (0-3) to BaseID
 * Mapping: 0 → BASE_1 (YELLOW), 1 → BASE_3 (BLUE), 2 → BASE_4 (RED), 3 → BASE_2 (GREEN)
 */
function mapPlayerIndexToBase(id: number): BaseID {
  return [BaseID.BASE_1, BaseID.BASE_3, BaseID.BASE_4, BaseID.BASE_2][Math.max(0, Math.min(3, id))];
}

/**
 * Handles when turn is passed to a player
 * Calculates and highlights all reachable cells for that player's horses
 * In replay mode, ensures the turn matches the replay file
 */
function * passTurnToSaga() {
  // Check if replay is active and ensure turn matches replay file
  const replay: ReturnType<typeof replaySelector> = yield select(replaySelector);
  if (replay?.isActive && !replay.isPaused && replay.cursor < replay.steps.length) {
    const step = replay.steps[replay.cursor];
    const expectedBaseID = mapPlayerIndexToBase(step.currentPlayer);
    const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
    const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
    
    // Log turn information
    console.log('[REPLAY] Turn Change:', {
      step: replay.cursor,
      expectedPlayer: step.currentPlayer,
      expectedBaseID: expectedBaseID,
      expectedPlayerColor: bases[expectedBaseID].color,
      currentTurn: currentTurn,
      currentPlayerColor: bases[currentTurn].color,
      corrected: currentTurn !== expectedBaseID,
    });
    
    // If turn doesn't match, correct it
    if (currentTurn !== expectedBaseID) {
      yield put(passTurnTo(expectedBaseID));
      // Small delay to ensure state update
      yield delay(50);
    }
  }

  // Clear any existing highlighting
  yield put(clearHighlightedCells());

  // Calculate reachable cells for current player
  const result: { reachableCells: Set<string>; cellsByHorse: Map<string, Array<{ horseID: IHorse['horseID']; moveType: 'spawn' | 'kick' | 'move' }>> } = yield call(calculateReachableCells);

  // Set highlighted cells
  if (result.reachableCells.size > 0) {
    yield put(setHighlightedCells(result.reachableCells, result.cellsByHorse));
  }
}

/**
 * Advances the game to the next player's turn
 *
 * Finds the next active player who hasn't won yet, skipping disabled players
 * or players who have already completed the game. Logs the turn transition.
 * 
 * Note: During replay mode, turn progression is handled by the replay system,
 * so this saga returns early to avoid conflicts.
 */
function * nextTurnSaga() {
  // Skip normal turn progression during replay - replay system handles turns
  const replay: ReturnType<typeof replaySelector> = yield select(replaySelector);
  if (replay?.isActive && !replay.isPaused) {
    console.log('[REPLAY] Skipping nextTurnSaga - replay system controls turn progression');
    return;
  }

  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);

  // Check if all bases are disabled - this shouldn't happen
  const enabledBases = Object.keys(bases).filter(key => bases[key as BaseID]?.enabled);
  if (enabledBases.length === 0) {
    // Re-check replay state in case it changed
    const currentReplay: ReturnType<typeof replaySelector> = yield select(replaySelector);
    console.error('[REPLAY] All bases are disabled - this should not happen', {
      replay: currentReplay,
      bases: Object.keys(bases).map(key => ({
        baseID: key,
        enabled: bases[key as BaseID]?.enabled,
        hasWon: bases[key as BaseID]?.hasWon,
      })),
    });
    // If replay is active, this is a critical error - try to enable all bases
    if (currentReplay?.isActive) {
      console.warn('[REPLAY] Attempting to enable all bases for replay');
      yield put(setPlayers(4));
      yield delay(100);
      // Re-select bases after enabling
      const updatedBases: ReturnType<typeof basesSelector> = yield select(basesSelector);
      const updatedEnabledBases = Object.keys(updatedBases).filter(key => updatedBases[key as BaseID]?.enabled);
      if (updatedEnabledBases.length === 0) {
        console.error('[REPLAY] Failed to enable bases - cannot proceed');
        return;
      }
    } else {
      return; // Exit if not replay and no bases enabled
    }
  }

  // Re-select bases in case they were just enabled, or use current ones
  const finalBases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const finalCurrentTurnBase: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);

  // Start with the configured next turn
  let nextTurn = finalBases[finalCurrentTurnBase].nextTurn;
  let nextBaseID = finalCurrentTurnBase;
  let validPlayerFound = false;
  const maxIterations = 4; // Maximum number of players to check
  let iterations = 0;

  // Find next valid player (enabled and hasn't won)
  // Iterate through players with a maximum limit to prevent infinite loops
  while (iterations < maxIterations && !validPlayerFound) {
    nextBaseID = finalBases[nextBaseID].nextTurn;
    const nextBase = finalBases[nextBaseID];
    
    // Check if this player is valid (enabled and hasn't won)
    if (nextBase && nextBase.enabled && !nextBase.hasWon) {
      nextTurn = nextBaseID;
      validPlayerFound = true;
      break;
    }
    
    iterations++;
    
    // Prevent infinite loop if we've checked all players
    if (nextBaseID === finalCurrentTurnBase) {
      // We've cycled back to the starting player - no valid players found
      console.warn('No valid players found for next turn - all players disabled or won');
      break;
    }
  }

  // Validate that we found a valid player before proceeding
  if (!validPlayerFound || !finalBases[nextTurn]) {
    console.error('Failed to find valid next player - game may be in invalid state', {
      currentTurn: finalCurrentTurnBase,
      bases: Object.keys(finalBases).map(key => ({
        baseID: key,
        enabled: finalBases[key as BaseID]?.enabled,
        hasWon: finalBases[key as BaseID]?.hasWon,
      })),
    });
    // Try to find any enabled player as fallback
    for (const key in finalBases) {
      if (finalBases[key] && finalBases[key].enabled && !finalBases[key].hasWon) {
        nextTurn = key as BaseID;
        validPlayerFound = true;
        break;
      }
    }
    
    // If still no valid player found, log error and exit
    if (!validPlayerFound || !finalBases[nextTurn]) {
      console.error('Cannot proceed - no valid players available', {
        currentTurn: finalCurrentTurnBase,
        bases: Object.keys(finalBases).map(key => ({
          baseID: key,
          enabled: finalBases[key as BaseID]?.enabled,
          hasWon: finalBases[key as BaseID]?.hasWon,
        })),
      });
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
    player: finalBases[nextTurn].color,
    action: 'Turn started',
    details: `${finalBases[nextTurn].color} player's turn`,
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
 * Watcher saga for horse disqualification
 * Handles when horses are captured and sent back to base
 */
function * watchForDisqualifyHorse() {
  yield takeLatest(ActionTypes.DISQUALIFY_HORSE, disqualifyHorseSaga);
}

/**
 * Logs when a horse is disqualified (captured by opponent)
 *
 * Called when one player's horse lands on the same cell as an opponent's horse,
 * sending the opponent's horse back to their base. This is logged for game history.
 *
 * @param action - Contains horseID that was disqualified
 */
function * disqualifyHorseSaga(action: ReturnType<typeof disqualifyHorse>) {
  const { horseID } = action.data!;
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const horse = horses[horseID];

  // Log the disqualification with highlight for importance
  yield put(addLogEntry({
    player: bases[horse.baseID].color,
    action: 'Horse disqualified',
    details: `Horse ${horseID.split('_')[1]} was sent back to base`,
    highlight: true, // Important event gets visual highlighting
  }));
}

/**
 * Watcher saga for horses reaching home
 * Celebrates when players successfully get horses to the finish
 */
function * watchForHomeHorse() {
  yield takeLatest(ActionTypes.HOME_HORSE, homeHorseSaga);
}

/**
 * Handles when a horse successfully reaches home
 *
 * This is the victory condition! When a horse reaches home:
 * 1. Logs the achievement
 * 2. Checks if the player has won (all 4 horses home)
 * 3. If won, marks the player as winner and logs victory
 *
 * @param action - Contains horseID that reached home
 */
function * homeHorseSaga(action: ReturnType<typeof homeHorse>) {
  const { horseID } = action.data!;

  // Get current game state
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);

  // Find which player owns this horse
  const { baseID } = horses[horseID];
  const base = bases[baseID];

  // Count how many of this player's horses are retired (at home)
  const retiredHorses = base.horseIDs.filter((horseID) => horses[horseID].isRetired);

  // Log the successful home arrival
  yield put(addLogEntry({
    player: base.color,
    action: 'Horse reached home',
    details: `Horse ${horseID.split('_')[1]} completed the journey!`,
    highlight: true, // Important achievement gets highlighting
  }));

  // Check for victory condition - all horses must be home
  const hasWon = retiredHorses.length === base.horseIDs.length;
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
  watchForSpawnHorse,          // Horse spawning from base
  watchForMoveHorse,           // Horse movement along board
  watchForDisqualifyHorse,     // Horse captures (logging only)
  watchForNextTurn,           // Turn progression
  watchForPassTurnTo,         // Calculate reachable cells when turn starts
  watchForRollDieComplete,    // Clear highlighting when dice is rolled
  watchForSetPlayers,         // Player count configuration
  watchForHomeHorse,           // Victory detection
  watchForReplay,              // Deterministic replay controller
];

/**
 * Replay: watch for START_REPLAY and inject deterministic data into normal game flow
 */
function * watchForReplay() {
  yield takeLatest(ActionTypes.START_REPLAY, replayFlowSaga);
  yield takeLatest(ActionTypes.STOP_REPLAY, stopReplaySaga);
  yield takeEvery(ActionTypes.SET_AVAILABLE_ACTIONS, replayAutoSelectActionSaga);
  yield takeEvery(ActionTypes.MOVE_HORSE_SUCCESS, replayAdvanceStepSaga);
  yield takeEvery(ActionTypes.SPAWN_HORSE_SUCCESS, replayAdvanceStepSaga);
}

function * stopReplaySaga() {
  // Re-enable auto actions when replay stops (restore normal gameplay)
  yield put(setAutoActionsEnabled(true));
}

function * replayFlowSaga() {
  // Ensure all 4 bases are enabled for replay (replay files are from 4-player games)
  yield put(setPlayers(4));
  yield delay(50); // Small delay to ensure state update
  
  // Enable auto actions so game can proceed normally
  yield put(setAutoActionsEnabled(true));
  // Clear existing highlights
  yield put(clearHighlightedCells());
  
  // Set initial turn from first replay step if available
  const replay: ReturnType<typeof replaySelector> = yield select(replaySelector);
  if (replay && replay.steps && replay.steps.length > 0) {
    const firstStep = replay.steps[0];
    const baseID = mapPlayerIndexToBase(firstStep.currentPlayer);
    const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
    
    console.log('[REPLAY] Replay Started:', {
      totalSteps: replay.steps.length,
      initialStep: 0,
      initialPlayer: firstStep.currentPlayer,
      initialPlayerColor: bases[baseID].color,
      initialBaseID: baseID,
      basesEnabled: Object.keys(bases).map(key => ({
        baseID: key,
        enabled: bases[key as BaseID]?.enabled,
      })),
    });
    
    yield put(passTurnTo(baseID));
    
    // Enable dice and trigger initial roll for first step
    yield put(enableDie());
    yield delay(100); // Small delay to ensure state is updated
    yield put(rollDie()); // Trigger dice roll for first step
  }
}

/**
 * Auto-selects the matching action from replay file when actions become available
 */
function * replayAutoSelectActionSaga(action: ReturnType<typeof setAvailableActions>) {
  console.log('[REPLAY] replayAutoSelectActionSaga triggered');
  const replay: ReturnType<typeof replaySelector> = yield select(replaySelector);
  console.log('[REPLAY] replayAutoSelectActionSaga - replay state:', {
    isActive: replay?.isActive,
    isPaused: replay?.isPaused,
    cursor: replay?.cursor,
    totalSteps: replay?.steps?.length,
  });
  
  if (!replay?.isActive || replay.isPaused || replay.cursor >= replay.steps.length) {
    console.log('[REPLAY] replayAutoSelectActionSaga - skipping (not active, paused, or cursor out of bounds)');
    return;
  }

  const step = replay.steps[replay.cursor];
  const { oldPosition, newPosition } = step.playerAction || { oldPosition: 0, newPosition: 0 };
  const availableActions = action.data?.actions || [];
  
  console.log('[REPLAY] replayAutoSelectActionSaga - action info:', {
    cursor: replay.cursor,
    oldPosition,
    newPosition,
    availableActionsCount: availableActions.length,
    availableActions: availableActions.map(a => ({ type: a.type, horseID: a.horseID, label: a.label })),
  });
  
  if (availableActions.length === 0) {
    console.warn('[REPLAY] replayAutoSelectActionSaga - no available actions');
    return;
  }

  // Find the action that matches the replay file
  const indexMap: ReturnType<typeof cellIndexLookupSelector> = yield select(cellIndexLookupSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const baseID = mapPlayerIndexToBase(step.currentPlayer);

  // Identify which horse should move based on oldPosition
  let horseIDToMove: IHorse['horseID'] | null = null;
  if (oldPosition === 0) {
    // Spawn: find first unspawned horse
    for (const hid of bases[baseID].horseIDs) {
      if (!horses[hid].isSpawned && !horses[hid].isRetired) {
        horseIDToMove = hid;
        break;
      }
    }
  } else {
    // Move: find horse at oldPosition
    const cellInfo = indexMap.get(oldPosition);
    if (cellInfo) {
      const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
      const cellData = (cells as any)[cellInfo.position]?.[cellInfo.cellID];
      const ids: string[] = (cellData?.horseIDs || []).slice();
      horseIDToMove = ids.find((hid) => horses[hid]?.baseID === baseID) || null;
    }
  }

  if (!horseIDToMove) {
    console.warn('[REPLAY] replayAutoSelectActionSaga - could not find horse to move', {
      oldPosition,
      newPosition,
      baseID,
    });
    return;
  }

  console.log('[REPLAY] replayAutoSelectActionSaga - found horse to move:', horseIDToMove);

  // Find the matching action and execute it
  if (oldPosition === 0 && newPosition !== 0) {
    // Spawn action
    const matchingAction = availableActions.find(
      (a) => a.type === 'spawn' && a.horseID === horseIDToMove
    );
    if (matchingAction) {
      const target = indexMap.get(newPosition);
      console.log('[REPLAY] Action Selected: SPAWN', {
        step: replay.cursor,
        player: step.currentPlayer,
        playerColor: bases[baseID].color,
        horseID: horseIDToMove,
        oldPosition: oldPosition,
        newPosition: newPosition,
        targetCell: target ? { cellID: (target as any).cellID, position: (target as any).position } : null,
        actionLabel: matchingAction.label,
        actionDescription: matchingAction.description,
      });
      
      yield delay(100); // Small delay for UI
      yield put(clearAvailableActions());
      console.log('[REPLAY] replayAutoSelectActionSaga - dispatching spawnHorse action');
      yield put(spawnHorse(baseID, horseIDToMove));
      console.log('[REPLAY] replayAutoSelectActionSaga - spawnHorse action dispatched');
    } else {
      console.warn('[REPLAY] replayAutoSelectActionSaga - spawn action not found for horse', horseIDToMove);
    }
  } else if (oldPosition !== 0 && newPosition !== 0) {
    // Move action - find by horseID and execute
    const matchingAction = availableActions.find(
      (a) => (a.type === 'move' || a.type === 'kick' || a.type === 'move_before') && a.horseID === horseIDToMove
    );
    if (matchingAction) {
      const horse = horses[horseIDToMove];
      const target = indexMap.get(newPosition);
      const oldCell = indexMap.get(oldPosition);
      
      // Determine action type
      let actionType = 'move';
      if (matchingAction.type === 'kick') {
        actionType = 'kick';
      } else if (matchingAction.type === 'move_before') {
        actionType = 'move_before';
      }
      
      console.log('[REPLAY] Action Selected:', actionType.toUpperCase(), {
        step: replay.cursor,
        player: step.currentPlayer,
        playerColor: bases[baseID].color,
        horseID: horseIDToMove,
        oldPosition: oldPosition,
        newPosition: newPosition,
        oldCell: oldCell ? { cellID: (oldCell as any).cellID, position: (oldCell as any).position } : null,
        targetCell: target ? { cellID: (target as any).cellID, position: (target as any).position } : null,
        actionType: matchingAction.type,
        actionLabel: matchingAction.label,
        actionDescription: matchingAction.description,
        blockingHorseID: matchingAction.blockingHorseID || null,
        stepsBeforeBlocking: matchingAction.stepsBeforeBlocking || null,
        stepsToUse: matchingAction.stepsToUse || null,
        kickedPlayer: step.kickedPlayer || null,
      });
      
      yield delay(100); // Small delay for UI
      yield put(clearAvailableActions());
      
      console.log('[REPLAY] replayAutoSelectActionSaga - dispatching moveHorse action');
      if (matchingAction.type === 'kick' && matchingAction.blockingHorseID) {
        yield put(moveHorse(horseIDToMove, horse.position, horse.cellID, matchingAction.blockingHorseID));
      } else if (matchingAction.type === 'move_before' && matchingAction.stepsBeforeBlocking !== undefined) {
        yield put(moveHorse(horseIDToMove, horse.position, horse.cellID, undefined, matchingAction.stepsBeforeBlocking));
      } else {
        yield put(moveHorse(horseIDToMove, horse.position, horse.cellID, undefined, undefined, matchingAction.stepsToUse));
      }
      console.log('[REPLAY] replayAutoSelectActionSaga - moveHorse action dispatched');
    } else {
      console.warn('[REPLAY] replayAutoSelectActionSaga - move action not found for horse', horseIDToMove);
    }
  } else if (oldPosition !== 0 && newPosition === 0) {
    // Disqualify action (horse sent back to base)
    console.log('[REPLAY] Action: DISQUALIFY', {
      step: replay.cursor,
      player: step.currentPlayer,
      playerColor: bases[baseID].color,
      horseID: horseIDToMove,
      oldPosition: oldPosition,
      newPosition: newPosition,
      reason: 'Horse sent back to base',
    });
  }
}

/**
 * Advances replay cursor after a successful move or spawn
 */
function * replayAdvanceStepSaga() {
  console.log('[REPLAY] replayAdvanceStepSaga triggered');
  const replay: ReturnType<typeof replaySelector> = yield select(replaySelector);
  console.log('[REPLAY] replayAdvanceStepSaga - replay state:', {
    isActive: replay?.isActive,
    isPaused: replay?.isPaused,
    cursor: replay?.cursor,
    totalSteps: replay?.steps?.length,
  });
  
  if (!replay?.isActive || replay.isPaused) {
    console.log('[REPLAY] replayAdvanceStepSaga - skipping (not active or paused)');
    return;
  }

  if (!replay.steps || replay.steps.length === 0) {
    console.warn('[REPLAY] replayAdvanceStepSaga - no steps available');
    return;
  }

  const currentStep = replay.steps[replay.cursor];
  if (!currentStep) {
    console.warn('[REPLAY] replayAdvanceStepSaga - current step not found at cursor', replay.cursor);
    return;
  }

  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const currentBaseID = mapPlayerIndexToBase(currentStep.currentPlayer);

  console.log('[REPLAY] replayAdvanceStepSaga - current step info:', {
    cursor: replay.cursor,
    currentPlayer: currentStep.currentPlayer,
    totalSteps: replay.steps.length,
    canAdvance: replay.cursor < replay.steps.length - 1,
  });

  // Advance to next step
  if (replay.cursor < replay.steps.length - 1) {
    const nextStepIndex = replay.cursor + 1;
    console.log('[REPLAY] replayAdvanceStepSaga - advancing cursor from', replay.cursor, 'to', nextStepIndex);
    yield put(nextReplayStep());
    
    // Get updated replay state after cursor advance
    yield delay(50); // Small delay to ensure state update
    const updatedReplay: ReturnType<typeof replaySelector> = yield select(replaySelector);
    const nextStep = updatedReplay?.steps?.[updatedReplay.cursor];
    
    console.log('[REPLAY] replayAdvanceStepSaga - after cursor advance:', {
      newCursor: updatedReplay?.cursor,
      nextStepExists: !!nextStep,
    });
    
    if (nextStep) {
      const baseID = mapPlayerIndexToBase(nextStep.currentPlayer);
      
      console.log('[REPLAY] Step Advanced:', {
        completedStep: replay.cursor,
        nextStep: nextStepIndex,
        totalSteps: replay.steps.length,
        completedStepPlayer: currentStep.currentPlayer,
        completedStepPlayerColor: bases[currentBaseID].color,
        nextStepPlayer: nextStep.currentPlayer,
        nextStepPlayerColor: bases[baseID].color,
        progress: `${nextStepIndex}/${replay.steps.length}`,
      });
      
      yield delay(200); // Delay for animation
      console.log('[REPLAY] replayAdvanceStepSaga - calling passTurnTo for next player');
      yield put(passTurnTo(baseID));
      
      // Ensure dice is enabled and trigger roll for next step
      yield put(enableDie());
      yield delay(100); // Small delay to ensure state is updated
      console.log('[REPLAY] replayAdvanceStepSaga - triggering dice roll for next step');
      yield put(rollDie()); // Trigger dice roll for next step
    } else {
      console.error('[REPLAY] replayAdvanceStepSaga - next step not found after cursor advance');
    }
  } else {
    // Finished - auto pause when all steps are replayed
    console.log('[REPLAY] Replay Completed:', {
      totalSteps: replay.steps.length,
      finalStep: replay.cursor,
      finalStepPlayer: currentStep.currentPlayer,
      finalStepPlayerColor: bases[currentBaseID].color,
      status: 'paused',
    });
    
    // Disable dice to prevent further rolling
    yield put(disableDie());
    yield put(pauseReplay());
  }
}
