/**
 * Dice Container Sagas
 *
 * Redux Sagas that handle asynchronous dice operations and automatic gameplay logic.
 * Manages die rolling, auto-actions, and turn progression based on game rules.
 */

import { integer, MersenneTwister19937 } from 'random-js';
import {
  call,
  delay,
  put,
  race,
  select,
  take,
  takeLatest,
} from 'redux-saga/effects';

import {
  markCurrentBase,
  moveHorse,
  nextTurn,
  spawnHorse,
  setAvailableActions,
  clearAvailableActions,
  IAvailableAction,
  ActionTypes as LudoActionTypes,
} from 'containers/Ludo/state/actions';
import { rollDie } from './actions';
import { BaseID, CellType, IBase, IHorse } from 'containers/Ludo/state/interfaces';
import { getMovableHorses, calculateReachableCells, findBlockingHorse } from 'containers/Ludo/state/sagas';
import { clearHighlightedCells, setHighlightedCells } from 'containers/Ludo/state/actions';
import { basesSelector, cellsSelector, horsesSelector, currentTurnSelector, linksSelector, walkwaysSelector } from 'containers/Ludo/state/selectors';
import { addLogEntry } from 'containers/StepLogs/state/actions';
import { autoActionsEnabledSelector, autoActionTimeoutSelector } from 'containers/StepLogs/state/selectors';
import { DICE_BONUS_TURN_DELAY, DICE_STATE_UPDATE_DELAY, DICE_ROLLING_ANIMATION_DURATION, NO_MOVE_DELAY, WINNING_MOVES } from 'globalConstants';

import { currentDieRoll1Selector, currentDieRoll2Selector, currentDieRollSumSelector } from './selectors';

import { enableDie, invalidateDieRoll, rollDieComplete, setDieResult, startRolling, stopRolling, ActionTypes } from './actions';
import { Rolls } from './interfaces';

/**
 * Watcher saga that listens for ROLL_DIE actions and triggers the roll die saga
 */
function * watchForRollDie() {
  yield takeLatest(ActionTypes.ROLL_DIE, rollDieSaga);
}

/**
 * Watcher saga that listens for SET_DIE_RESULT actions and triggers the set die result saga
 */
function * watchForSetDieResult() {
  yield takeLatest(ActionTypes.SET_DIE_RESULT, setDieResultSaga);
}

/**
 * Saga that handles the dice rolling process
 * Generates two random die rolls and logs the action
 * Hardcodes a spawnable roll (1-1) for the first turn of each base
 */
function * rollDieSaga() {
  // Start the rolling animation
  yield put(startRolling());

  // Wait for animation to complete (1.2 seconds)
  yield delay(DICE_ROLLING_ANIMATION_DURATION);

  // Get current player info to check if it's their first turn
  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const currentTurnBase = bases[currentTurn];
  const playerColor = currentTurnBase.color;

  // Check if this is the first turn for this base (no horses spawned yet)
  const hasSpawnedHorses = currentTurnBase.horseIDs.some(
    (horseID) => horses[horseID].isSpawned && !horses[horseID].isRetired
  );

  let dieRoll1: Rolls;
  let dieRoll2: Rolls;

  if (!hasSpawnedHorses) {
    // First turn for this base - hardcode a spawnable roll (1-1 double)
    // This ensures the base can spawn a horse on their first turn
    dieRoll1 = Rolls.ONE;
    dieRoll2 = Rolls.ONE;
  } else {
    // Not the first turn - generate random die rolls using Mersenne Twister for better randomness
    const mt = MersenneTwister19937.autoSeed();
    dieRoll1 = integer(Rolls.ONE, Rolls.SIX)(mt);
    dieRoll2 = integer(Rolls.ONE, Rolls.SIX)(mt);
  }

  // Log the dice roll action
  yield put(addLogEntry({
    player: playerColor,
    action: `Rolled ${dieRoll1}-${dieRoll2}`,
    details: `Dice roll: ${dieRoll1}-${dieRoll2} (sum: ${dieRoll1 + dieRoll2})${!hasSpawnedHorses ? ' [First Turn - Hardcoded]' : ''}`,
  }));

  // Dispatch the roll completion action and stop rolling animation
  yield put(rollDieComplete(dieRoll1, dieRoll2));
  yield put(stopRolling());
}

/**
 * Saga that handles setting a specific dice result
 * Uses predetermined values instead of random rolls
 */
function * setDieResultSaga(action: ReturnType<typeof setDieResult>) {
  if (!action.data) {
    return;
  }

  const { roll1, roll2 } = action.data;

  // Start the rolling animation
  yield put(startRolling());

  // Wait for animation to complete (1.2 seconds)
  yield delay(DICE_ROLLING_ANIMATION_DURATION);

  // Get current player info for logging
  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const currentTurnBase = bases[currentTurn];
  const playerColor = currentTurnBase.color;

  // Log the dice roll action
  yield put(addLogEntry({
    player: playerColor,
    action: `Rolled ${roll1}-${roll2} [Set Result]`,
    details: `Dice roll: ${roll1}-${roll2} (sum: ${roll1 + roll2}) [Manually Set]`,
  }));

  // Dispatch the roll completion action and stop rolling animation
  yield put(rollDieComplete(roll1, roll2));
  yield put(stopRolling());
}

/**
 * Checks if a horse can reach HOME or HOMEPATH after moving the specified number of steps
 * @param horseID - The horse to check
 * @param stepsToTake - Number of steps to simulate
 * @returns 'HOME' if horse can reach HOME, 'HOMEPATH' if it can reach HOMEPATH, null otherwise
 */
function * canReachHome(horseID: IHorse['horseID'], stepsToTake: Rolls): Generator<any, 'HOME' | 'HOMEPATH' | null, any> {
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const links: ReturnType<typeof linksSelector> = yield select(linksSelector);
  
  const horse = horses[horseID];
  if (!horse || !horse.isSpawned || horse.isRetired) {
    return null;
  }

  // Simulate the path the horse would take
  let currentCellID = horse.cellID;
  
  for (let step = 0; step < stepsToTake; step++) {
    const nextCells = links[currentCellID];
    if (!nextCells || nextCells.length === 0) {
      return null; // No path available
    }

    // First, check if any option leads directly to HOME
    const homeCell = nextCells.find((cell) => cell.cellID === 'HOME');
    if (homeCell) {
      return 'HOME'; // Can reach HOME!
    }

    let nextCell;
    
    // Try to find a home path cell that matches this horse's base
    const matchingHomePath = nextCells.find((cell) => {
      // Skip HOME cells - they don't exist in the cells structure
      if (cell.cellID === 'HOME') {
        return false;
      }
      const cellData = cells[cell.position]?.[cell.cellID];
      if (!cellData) {
        return false;
      }
      return cellData.cellType === CellType.HOMEPATH && horse.baseID === cellData.baseID;
    });

    if (matchingHomePath) {
      nextCell = matchingHomePath;
      // Continue checking if we can reach HOME from this home path
    } else {
      // Check if any option is a home path (even if not matching, to see if we're close)
      const anyHomePath = nextCells.find((cell) => {
        // Skip HOME cells
        if (cell.cellID === 'HOME') {
          return false;
        }
        const cellData = cells[cell.position]?.[cell.cellID];
        if (!cellData) {
          return false;
        }
        return cellData.cellType === CellType.HOMEPATH && horse.baseID === cellData.baseID;
      });
      if (anyHomePath) {
        // Check if we can reach HOME from this position
        const remainingSteps = stepsToTake - step - 1;
        if (remainingSteps > 0) {
          const deepCheck = yield call(canReachHomeFromCell, anyHomePath.cellID, horse.baseID, remainingSteps);
          if (deepCheck === 'HOME') {
            return 'HOME';
          }
          if (deepCheck === 'HOMEPATH') {
            return 'HOMEPATH';
          }
        }
      }
      
      // Use first available option for simulation (skip HOME if it's the only option, as it means we can reach it)
      nextCell = nextCells.find((cell) => cell.cellID !== 'HOME') || nextCells[0];
    }

    // Check if we're moving to HOME
    if (nextCell.cellID === 'HOME') {
      return 'HOME';
    }

    currentCellID = nextCell.cellID;
    
    // Check if we're on a home path (only if not HOME)
    if (nextCell.cellID !== 'HOME') {
      const cellData = cells[nextCell.position]?.[currentCellID];
      if (cellData && cellData.cellType === CellType.HOMEPATH && cellData.baseID === horse.baseID) {
        return 'HOMEPATH'; // Can reach home path
      }
    }
  }

  return null;
}

/**
 * Helper to check if a horse can reach HOME from a specific cell
 */
function * canReachHomeFromCell(cellID: string, baseID: BaseID, remainingSteps: number): Generator<any, 'HOME' | 'HOMEPATH' | null, any> {
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const links: ReturnType<typeof linksSelector> = yield select(linksSelector);
  
  if (remainingSteps <= 0) {
    return null;
  }

  let currentCellID = cellID;
  
  for (let step = 0; step < remainingSteps; step++) {
    const nextCells = links[currentCellID];
    if (!nextCells || nextCells.length === 0) {
      return null;
    }

    // Check if HOME is reachable
    const homeCell = nextCells.find((cell) => cell.cellID === 'HOME');
    if (homeCell) {
      return 'HOME';
    }

    // Check for matching home path
    const matchingHomePath = nextCells.find((cell) => {
      // Skip HOME cells - they don't exist in the cells structure
      if (cell.cellID === 'HOME') {
        return false;
      }
      const cellData = cells[cell.position]?.[cell.cellID];
      if (!cellData) {
        return false;
      }
      return cellData.cellType === CellType.HOMEPATH && baseID === cellData.baseID;
    });

    if (matchingHomePath) {
      currentCellID = matchingHomePath.cellID;
      const cellData = cells[matchingHomePath.position]?.[currentCellID];
      if (cellData && cellData.cellType === CellType.HOMEPATH) {
        return 'HOMEPATH';
      }
    } else {
      // Use first available option (prefer non-HOME cells for simulation)
      const nonHomeCell = nextCells.find((cell) => cell.cellID !== 'HOME');
      currentCellID = nonHomeCell ? nonHomeCell.cellID : nextCells[0].cellID;
      
      // If we're moving to HOME, return immediately
      if (currentCellID === 'HOME') {
        return 'HOME';
      }
    }
  }

  return null;
}

/**
 * Automatically chooses and executes an action when the player doesn't respond in time
 * Prioritizes moves that can reach HOME or HOMEPATH cells
 * @param spawnableHorses - Array of horse IDs that can be spawned
 * @param movableHorses - Array of horse IDs that can be moved
 * @param currentTurnBase - The current player's base information
 */
function * autoChooseAction(spawnableHorses: IHorse['horseID'][], movableHorses: IHorse['horseID'][], currentTurnBase: IBase) {
  const mt = MersenneTwister19937.autoSeed();
  const currentDieRoll: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);

  // Priority 1: Check if any movable horses can reach HOME
  const horsesThatCanReachHome: IHorse['horseID'][] = [];
  const horsesThatCanReachHomePath: IHorse['horseID'][] = [];
  const otherHorses: IHorse['horseID'][] = [];

  if (movableHorses.length > 0) {
    for (const horseID of movableHorses) {
      const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, currentDieRoll);
      if (result === 'HOME') {
        horsesThatCanReachHome.push(horseID);
      } else if (result === 'HOMEPATH') {
        horsesThatCanReachHomePath.push(horseID);
      } else {
        otherHorses.push(horseID);
      }
    }
  }

  // Priority 1: Choose horse that can reach HOME
  if (horsesThatCanReachHome.length > 0) {
    const chosenHorseID = horsesThatCanReachHome[integer(0, horsesThatCanReachHome.length - 1)(mt)];
    const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
    const horse = horses[chosenHorseID];
    
    yield put(addLogEntry({
      player: currentTurnBase.color,
      action: 'Auto-action',
      details: `Automatically chose to move horse ${chosenHorseID.split('_')[1]} (can reach HOME)`,
    }));
    
    yield put(moveHorse(chosenHorseID, horse.position, horse.cellID));
    return;
  }

  // Priority 2: Choose horse that can reach HOMEPATH
  if (horsesThatCanReachHomePath.length > 0) {
    const chosenHorseID = horsesThatCanReachHomePath[integer(0, horsesThatCanReachHomePath.length - 1)(mt)];
    const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
    const horse = horses[chosenHorseID];
    
    yield put(addLogEntry({
      player: currentTurnBase.color,
      action: 'Auto-action',
      details: `Automatically chose to move horse ${chosenHorseID.split('_')[1]} (can reach HOMEPATH)`,
    }));
    
    yield put(moveHorse(chosenHorseID, horse.position, horse.cellID));
    return;
  }

  // Priority 3: Choose between spawn and move (prefer move if available)
  const availableActions = [];
  if (movableHorses.length > 0) availableActions.push('move');
  if (spawnableHorses.length > 0) availableActions.push('spawn');

  // Prefer move if available, otherwise spawn
  const chosenAction = availableActions[0] || (availableActions.length > 0 ? availableActions[integer(0, availableActions.length - 1)(mt)] : null);

  if (chosenAction === 'move' && movableHorses.length > 0) {
    // Double-check that the selected horse is still movable before dispatching
    const currentMovableHorses: IHorse['horseID'][] = yield call(getMovableHorses, currentDieRoll);
    if (currentMovableHorses.length > 0) {
      const chosenHorseID = currentMovableHorses[integer(0, currentMovableHorses.length - 1)(mt)];
      const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
      const horse = horses[chosenHorseID];
      
      yield put(addLogEntry({
        player: currentTurnBase.color,
        action: 'Auto-action',
        details: `Automatically chose to move horse ${chosenHorseID.split('_')[1]}`,
      }));
      
      yield put(moveHorse(chosenHorseID, horse.position, horse.cellID));
      return;
    }
  }

  if (chosenAction === 'spawn' && spawnableHorses.length > 0) {
    // Double-check that there are still spawnable horses
    const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
    const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
    const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
    const currentSpawnableHorses = bases[currentTurn].horseIDs.filter((horseID) => !horses[horseID].isSpawned && !horses[horseID].isRetired);

    if (currentSpawnableHorses.length > 0) {
      const chosenHorseID = currentSpawnableHorses[integer(0, currentSpawnableHorses.length - 1)(mt)];
      
      yield put(addLogEntry({
        player: currentTurnBase.color,
        action: 'Auto-action',
        details: `Automatically chose to spawn horse ${chosenHorseID.split('_')[1]}`,
      }));
      
      yield put(spawnHorse(currentTurnBase.ID, chosenHorseID));
      return;
    }
  }

  // Fallback: try move if spawn failed
  if (movableHorses.length > 0) {
    const currentMovableHorses: IHorse['horseID'][] = yield call(getMovableHorses, currentDieRoll);
    if (currentMovableHorses.length > 0) {
      const chosenHorseID = currentMovableHorses[integer(0, currentMovableHorses.length - 1)(mt)];
      const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
      const horse = horses[chosenHorseID];
      yield put(moveHorse(chosenHorseID, horse.position, horse.cellID));
    }
  }
}

/**
 * Watcher saga that listens for ROLL_DIE_COMPLETE actions
 */
function * watchForRollDieComplete() {
  yield takeLatest(ActionTypes.ROLL_DIE_COMPLETE, rollDieCompleteSaga);
}

/**
 * Builds available actions list from spawnable and movable horses
 */
function * buildAvailableActions(
  spawnableHorses: IHorse['horseID'][],
  movableHorses: IHorse['horseID'][],
  dieValue: Rolls,
  currentTurnBase: IBase
): Generator<any, IAvailableAction[], any> {
  const actions: IAvailableAction[] = [];

  // Check if there's a horse on the spawn cell that hasn't moved yet
  // If so, prevent spawning additional horses until that horse moves
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const walkways: ReturnType<typeof walkwaysSelector> = yield select(walkwaysSelector);
  
  // Find the spawn cell for this base
  const walkway = Object.values(walkways).find((w) => w.baseID === currentTurnBase.ID);
  let spawnCellID: string | null = null;
  if (walkway) {
    const walkwayCells = cells[walkway.position];
    const spawnCell = Object.values(walkwayCells).find(
      (cell) => cell.cellType === CellType.SPAWN && cell.baseID === currentTurnBase.ID
    );
    if (spawnCell) {
      spawnCellID = spawnCell.cellID;
    }
  }
  
  // Check if any same-color horse is still on the spawn cell (hasn't moved yet)
  // If there's a same-color horse, prevent spawning
  // But if there's only an opponent horse, allow spawning (will kick the opponent)
  let hasSameColorHorseOnSpawnCell = false;
  let hasOpponentHorseOnSpawnCell = false;
  if (spawnCellID && walkway) {
    const spawnCellData = cells[walkway.position]?.[spawnCellID];
    if (spawnCellData && spawnCellData.horseIDs && spawnCellData.horseIDs.length > 0) {
      for (const horseIDOnCell of spawnCellData.horseIDs) {
        const horseOnCell = horses[horseIDOnCell];
        if (horseOnCell && horseOnCell.isSpawned && !horseOnCell.isRetired) {
          if (horseOnCell.baseID === currentTurnBase.ID) {
            // Same-color horse on spawn cell - prevent spawning
            hasSameColorHorseOnSpawnCell = true;
            break;
          } else {
            // Opponent horse on spawn cell - allow spawning (will kick it)
            hasOpponentHorseOnSpawnCell = true;
          }
        }
      }
    }
  }

  // Add spawn actions only if no same-color horse is stuck on spawn cell
  // If there's an opponent horse, we can still spawn and kick it
  if (!hasSameColorHorseOnSpawnCell) {
    for (const horseID of spawnableHorses) {
      let label = `Release Horse ${horseID.split('_')[3]}`;
      let description = 'Bring a new horse onto the board';
      
      // If there's an opponent horse on spawn cell, indicate that spawning will kick it
      if (hasOpponentHorseOnSpawnCell) {
        label = `Release Horse ${horseID.split('_')[3]} (Kick Opponent)`;
        description = 'Bring a new horse onto the board and kick opponent horse on spawn cell';
      }
      
      actions.push({
        type: 'spawn',
        horseID,
        label,
        description,
      });
    }
  }

  // Add move actions with priority information and blocking detection
  // Get the current dice values to check if it's a pair
  const roll1: ReturnType<typeof currentDieRoll1Selector> = yield select(currentDieRoll1Selector);
  const roll2: ReturnType<typeof currentDieRoll2Selector> = yield select(currentDieRoll2Selector);
  const isPair = roll1 === roll2;
  
  // Loop through all movable horses - for each horse, create actions
  // When double dice are rolled, each horse will have 2 actions: one for 1 die, one for 2 dice
  if (process.env.NODE_ENV === 'development') {
    console.log(`[buildAvailableActions] Processing ${movableHorses.length} movable horses, isPair: ${isPair}, dieValue: ${dieValue}, roll1: ${roll1}, roll2: ${roll2}`);
  }
  
  for (const horseID of movableHorses) {
    const horse = horses[horseID];
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[buildAvailableActions] Processing horse ${horseID}, steps: ${horse.steps}, cellID: ${horse.cellID}`);
    }
    
    // Check if horse is on HOME cell itself
    if (horse.cellID === 'HOME') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[buildAvailableActions] Skipping ${horseID}: on HOME cell (cannot move)`);
      }
      continue; // Skip this horse - cannot move from HOME
    }
    
    // NEW RULE: Check if horse is on a cell that only leads to HOME (cannot move)
    // Check the links to see if the only next cell is HOME
    const links: ReturnType<typeof linksSelector> = yield select(linksSelector);
    const nextCells = links[horse.cellID!];
    if (nextCells && nextCells.length > 0) {
      // Check if the only next cell is HOME
      const onlyHome = nextCells.length === 1 && nextCells[0].cellID === 'HOME';
      if (onlyHome) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[buildAvailableActions] Skipping ${horseID}: on cell (${horse.cellID}) that only leads to HOME`);
        }
        continue; // Skip this horse - cannot move from cells that only lead to HOME
      }
    }
    
    // Also check the specific final home path cells as a safety measure
    const finalHomePathCells = ['WEST_0_6', 'WEST_1_6', 'EAST_1_0', 'SOUTH_0_0'];
    if (finalHomePathCells.includes(horse.cellID!)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[buildAvailableActions] Skipping ${horseID}: on final home path cell (${horse.cellID}) that only leads to HOME`);
      }
      continue; // Skip this horse - cannot move from these cells
    }
    
    // NEW RULE: Check if horse is currently in a home path cell
    const currentCellData = cells[horse.position]?.[horse.cellID];
    const isHorseInHomePath = currentCellData && 
      currentCellData.cellType === CellType.HOMEPATH && 
      currentCellData.baseID === horse.baseID;
    
    // If horse is in home path, enforce sequential movement rules:
    // - Can only move 1 step at a time
    // - Can move if:
    //   1. Roll ANY double dice (1:1, 2:2, 3:3, 4:4, 5:5, or 6:6), OR
    //   2. Dice sum equals (current home path index + 1)
    if (isHorseInHomePath) {
      // Calculate home path index from cell's row/column
      // For NORTH/SOUTH: use row; for EAST/WEST: use column
      const homePathIndex = horse.position === 'NORTH' || horse.position === 'SOUTH'
        ? currentCellData.row
        : currentCellData.column;
      
      // Get dice sum
      const dieSum = roll1 + roll2;
      const nextHomePathIndex = homePathIndex + 1;
      
      // Check if can move: double dice OR dice sum equals next index
      // Note: isDieRollValid is checked at the beginning of buildAvailableActions
      const canMoveInHomePath = isPair || (dieSum === nextHomePathIndex);
      
      if (!canMoveInHomePath) {
        // Cannot move in home path
        if (process.env.NODE_ENV === 'development') {
          console.log(`[buildAvailableActions] Skipping ${horseID}: in home path at index ${homePathIndex}, need double dice or sum=${nextHomePathIndex}, but got sum=${dieSum}, isPair=${isPair}`);
        }
        continue; // Skip this horse
      }
      
      // In home path with valid roll - can move 1 step
      // The action creation logic below will handle creating the 1-step action
    }
    
    // Special case: Check if horse is on spawn cell with opponent horse
    // If so, create kick action for the opponent on the spawn cell
    if (horse.steps === 0 && horse.cellID && spawnCellID && horse.cellID === spawnCellID) {
      const spawnCellData = cells[horse.position]?.[spawnCellID];
      if (spawnCellData && spawnCellData.horseIDs && spawnCellData.horseIDs.length > 0) {
        // Check if there's an opponent horse on the same spawn cell
        for (const otherHorseID of spawnCellData.horseIDs) {
          if (otherHorseID !== horseID) {
            const otherHorse = horses[otherHorseID];
            if (otherHorse && otherHorse.baseID !== horse.baseID) {
              // Found opponent horse on spawn cell - can kick it
              // Create kick action for moving 1 step (or any valid step) to kick the opponent
              if (isPair) {
                const singleDieValue = roll1;
                if (horse.steps + singleDieValue <= WINNING_MOVES) {
                  actions.push({
                    type: 'move',
                    horseID,
                    label: `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die, Kick Blocking Horse)`,
                    description: `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} and kick opponent horse on spawn cell using one die`,
                    stepsToUse: singleDieValue,
                    blockingHorseID: otherHorseID,
                  });
                }
                if (horse.steps + dieValue <= WINNING_MOVES) {
                  actions.push({
                    type: 'move',
                    horseID,
                    label: `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice, Kick Blocking Horse)`,
                    description: `Move ${dieValue} spaces and kick opponent horse on spawn cell using both dice`,
                    blockingHorseID: otherHorseID,
                  });
                }
              } else {
                // Not a pair - create single kick action
                if (horse.steps + dieValue <= WINNING_MOVES) {
                  actions.push({
                    type: 'move',
                    horseID,
                    label: `Move Horse ${horseID.split('_')[3]} (Kick Blocking Horse)`,
                    description: `Move ${dieValue} spaces and kick opponent horse on spawn cell`,
                    blockingHorseID: otherHorseID,
                  });
                }
              }
              // Found opponent, break out of loop (no need to check other horses on spawn cell)
              // Don't continue - still need to process normal move actions
              break;
            }
          }
        }
      }
    }
    
    // Check for blocking horses (same color or opponent)
    const blockingInfo: { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
      yield call(findBlockingHorse, horseID, dieValue);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[buildAvailableActions] Blocking check for ${horseID} with dieValue ${dieValue}:`, blockingInfo);
    }

    if (isPair) {
      // Double dice rolled - show 2 actions: one for 1 die, one for 2 dice
      const singleDieValue = roll1; // Both dice are the same, use one value
      const horse = horses[horseID];
      
      // Action 1: Move using 1 die
      // NEW RULE: If in home path, can only move 1 step (regardless of die value)
      // Works for ANY double: 1:1, 2:2, 3:3, 4:4, 5:5, 6:6
      if (isHorseInHomePath) {
        // In home path: only allow 1-step moves (regardless of which double was rolled)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[buildAvailableActions] Horse ${horseID} is in home path, checking 1-step move. horse.steps: ${horse.steps}, WINNING_MOVES: ${WINNING_MOVES}`);
        }
        
        if (horse.steps + 1 <= WINNING_MOVES) {
          const blockingInfoOneStep: { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
            yield call(findBlockingHorse, horseID, 1 as Rolls);
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[buildAvailableActions] Blocking check for ${horseID} with 1 step in home path:`, blockingInfoOneStep);
          }
          
          // Check if we can move: no blocker, or can kick opponent at step 1, or blocker is before step 1
          const canMove = !blockingInfoOneStep || 
            (blockingInfoOneStep.stepsBeforeBlocking + 1 === 1 && !blockingInfoOneStep.isSameColor) ||
            (blockingInfoOneStep.stepsBeforeBlocking + 1 > 1); // Blocker is after step 1, can move to step 1
          
          if (canMove) {
            // Can move 1 step (either no blocker, can kick blocker at step 1, or blocker is after step 1)
            const resultOneStep: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, 1 as Rolls);
            let labelOneStep = `Move Horse ${horseID.split('_')[3]} (1 step - 1 die, Home Path)`;
            let descriptionOneStep = `Move 1 space in home path using one die`;
            
            if (resultOneStep === 'HOME') {
              labelOneStep = `Move Horse ${horseID.split('_')[3]} (1 step - 1 die, Can Reach Home!)`;
              descriptionOneStep = `Move 1 space in home path - This horse can reach HOME!`;
            }
            
            if (blockingInfoOneStep && blockingInfoOneStep.stepsBeforeBlocking + 1 === 1 && !blockingInfoOneStep.isSameColor) {
              // Can kick at step 1
              if (process.env.NODE_ENV === 'development') {
                console.log(`[buildAvailableActions] Creating kick action for ${horseID} in home path`);
              }
              actions.push({
                type: 'kick',
                horseID,
                label: `Move Horse ${horseID.split('_')[3]} (1 step - 1 die, Kick Blocking Horse)`,
                description: `Move 1 space in home path and kick opponent horse using one die`,
                blockingHorseID: blockingInfoOneStep.blockingHorseID,
                stepsToUse: 1,
              });
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log(`[buildAvailableActions] Creating move action for ${horseID} in home path`);
              }
              actions.push({
                type: 'move',
                horseID,
                label: labelOneStep,
                description: descriptionOneStep,
                stepsToUse: 1,
              });
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildAvailableActions] Cannot create action for ${horseID} in home path: blocked by same-color horse at step 1`);
            }
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[buildAvailableActions] Cannot create action for ${horseID} in home path: would overshoot home (${horse.steps} + 1 > ${WINNING_MOVES})`);
          }
        }
      } else if (horse.steps + singleDieValue <= WINNING_MOVES) {
        // Not in home path: normal logic
          // Check for blocking to determine if action should be shown
          const blockingInfoOneDie: { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
            yield call(findBlockingHorse, horseID, singleDieValue as Rolls);
          
          // Don't show action if it would overshoot an opponent blocker (can't move over opponent)
          if (blockingInfoOneDie) {
            const blockingStep = blockingInfoOneDie.stepsBeforeBlocking + 1;
            
            // Debug logging
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildAvailableActions] 1-die blocking check for ${horseID}:`, {
                singleDieValue,
                blockingStep,
                stepsBeforeBlocking: blockingInfoOneDie.stepsBeforeBlocking,
                isSameColor: blockingInfoOneDie.isSameColor,
                blockingHorseID: blockingInfoOneDie.blockingHorseID,
                canKick: singleDieValue === blockingStep && !blockingInfoOneDie.isSameColor,
              });
            }
            
            if (singleDieValue > blockingStep && !blockingInfoOneDie.isSameColor) {
              // Would overshoot opponent blocker - don't show this action
              if (process.env.NODE_ENV === 'development') {
                console.log(`[buildAvailableActions] Skipped 1-die action for ${horseID}: would overshoot opponent blocker (${singleDieValue} > ${blockingStep})`);
              }
            } else {
              // Can show action: either no blocker, can move before blocker, can kick blocker, or blocker is same color
              const resultOneDie: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, singleDieValue as Rolls);
              let labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die)`;
              let descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die`;
              
              if (singleDieValue === blockingStep && !blockingInfoOneDie.isSameColor) {
                // Can kick opponent - create kick action
                labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die, Kick Blocking Horse)`;
                descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} and kick opponent horse using one die`;
                
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[buildAvailableActions] Creating 1-die kick action for ${horseID}:`, {
                    blockingHorseID: blockingInfoOneDie.blockingHorseID,
                    stepsToUse: singleDieValue,
                  });
                }
                
                actions.push({
                  type: 'kick',
                  horseID,
                  label: labelOneDie,
                  description: descriptionOneDie,
                  blockingHorseID: blockingInfoOneDie.blockingHorseID,
                  stepsToUse: singleDieValue,
                });
              } else if (singleDieValue < blockingStep) {
                // Can move before blocker
                descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die (avoiding blocker)`;
                
                if (resultOneDie === 'HOME') {
                  labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die, Can Reach Home!)`;
                  descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die - This horse can reach HOME!`;
                } else if (resultOneDie === 'HOMEPATH') {
                  labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die, Can Enter Home Path)`;
                  descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die - This horse can enter the home path`;
                }
                
                actions.push({
                  type: 'move',
                  horseID,
                  label: labelOneDie,
                  description: descriptionOneDie,
                  stepsToUse: singleDieValue,
                });
              } else {
                // singleDieValue > blockingStep or same color - skip this action
                // Note: If singleDieValue === blockingStep && isSameColor, we skip it
                // The move logic will handle blocking same-color horses
              }
              
              // Only add HOME/HOMEPATH actions if we haven't already added a kick action
              if (!(singleDieValue === blockingStep && !blockingInfoOneDie.isSameColor)) {
                if (resultOneDie === 'HOME') {
                  labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die, Can Reach Home!)`;
                  descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die - This horse can reach HOME!`;
                  
                  actions.push({
                    type: 'move',
                    horseID,
                    label: labelOneDie,
                    description: descriptionOneDie,
                    stepsToUse: singleDieValue,
                  });
                } else if (resultOneDie === 'HOMEPATH') {
                  labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die, Can Enter Home Path)`;
                  descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die - This horse can enter the home path`;
                  
                  actions.push({
                    type: 'move',
                    horseID,
                    label: labelOneDie,
                    description: descriptionOneDie,
                    stepsToUse: singleDieValue,
                  });
                }
              }
              
              // Debug log for development
              if (process.env.NODE_ENV === 'development') {
                console.log(`[buildAvailableActions] Added 1-die action for ${horseID}: ${labelOneDie}`);
              }
            }
          } else {
            // No blocking - show normal move action
            const resultOneDie: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, singleDieValue as Rolls);
            let labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die)`;
            let descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die`;
            
            if (resultOneDie === 'HOME') {
              labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die, Can Reach Home!)`;
              descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die - This horse can reach HOME!`;
            } else if (resultOneDie === 'HOMEPATH') {
              labelOneDie = `Move Horse ${horseID.split('_')[3]} (${singleDieValue} step${singleDieValue > 1 ? 's' : ''} - 1 die, Can Enter Home Path)`;
              descriptionOneDie = `Move ${singleDieValue} space${singleDieValue > 1 ? 's' : ''} using one die - This horse can enter the home path`;
            }
            
            actions.push({
              type: 'move',
              horseID,
              label: labelOneDie,
              description: descriptionOneDie,
              stepsToUse: singleDieValue,
            });
            
            // Debug log for development
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildAvailableActions] Added 1-die action for ${horseID}: ${labelOneDie}`);
            }
          }
          
      } else {
        // Debug log for development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[buildAvailableActions] Skipped 1-die action for ${horseID}: would overshoot home (${horse.steps} + ${singleDieValue} > ${WINNING_MOVES})`);
        }
      }
      
      // Action 2: Move using 2 dice (sum)
      // NEW RULE: If horse is in home path, skip 2-dice action (can only move 1 step)
      if (isHorseInHomePath) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[buildAvailableActions] Skipping 2-dice action for ${horseID}: in home path (can only move 1 step)`);
        }
      } else if (horse.steps + dieValue <= WINNING_MOVES) {
          // Check for blocking to determine if action should be shown
          const blockingInfoTwoDice: { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
            yield call(findBlockingHorse, horseID, dieValue);
          
          // Don't show action if it would overshoot an opponent blocker (can't move over opponent)
          if (blockingInfoTwoDice) {
            const blockingStep = blockingInfoTwoDice.stepsBeforeBlocking + 1;
            
            // Debug logging
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildAvailableActions] 2-dice blocking check for ${horseID}:`, {
                dieValue,
                blockingStep,
                stepsBeforeBlocking: blockingInfoTwoDice.stepsBeforeBlocking,
                isSameColor: blockingInfoTwoDice.isSameColor,
                blockingHorseID: blockingInfoTwoDice.blockingHorseID,
                canKick: dieValue === blockingStep && !blockingInfoTwoDice.isSameColor,
              });
            }
            
            if (dieValue > blockingStep && !blockingInfoTwoDice.isSameColor) {
              // Would overshoot opponent blocker - don't show this action
              if (process.env.NODE_ENV === 'development') {
                console.log(`[buildAvailableActions] Skipped 2-dice action for ${horseID}: would overshoot opponent blocker (${dieValue} > ${blockingStep})`);
              }
            } else {
              // Can show action: either no blocker, can move before blocker, can kick blocker, or blocker is same color
              const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, dieValue);
              let label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice)`;
              let description = `Move ${dieValue} spaces using both dice`;

              if (dieValue === blockingStep && !blockingInfoTwoDice.isSameColor) {
                // Can kick opponent - create kick action
                label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice, Kick Blocking Horse)`;
                description = `Move ${dieValue} spaces and kick opponent horse using both dice`;
                
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[buildAvailableActions] Creating 2-dice kick action for ${horseID}:`, {
                    blockingHorseID: blockingInfoTwoDice.blockingHorseID,
                  });
                }
                
                actions.push({
                  type: 'kick',
                  horseID,
                  label,
                  description,
                  blockingHorseID: blockingInfoTwoDice.blockingHorseID,
                });
              } else if (dieValue < blockingStep) {
                // Can move before blocker
                description = `Move ${dieValue} spaces using both dice (avoiding blocker)`;
                
                if (result === 'HOME') {
                  label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice, Can Reach Home!)`;
                  description = `Move ${dieValue} spaces using both dice - This horse can reach HOME!`;
                } else if (result === 'HOMEPATH') {
                  label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice, Can Enter Home Path)`;
                  description = `Move ${dieValue} spaces using both dice - This horse can enter the home path`;
                }
                
                actions.push({
                  type: 'move',
                  horseID,
                  label,
                  description,
                });
              } else {
                // dieValue > blockingStep or same color - skip this action
                // Note: If dieValue === blockingStep && isSameColor, we skip it
                // The move logic will handle blocking same-color horses
              }
              
              // Only add HOME/HOMEPATH actions if we haven't already added a kick action
              if (!(dieValue === blockingStep && !blockingInfoTwoDice.isSameColor)) {
                if (result === 'HOME') {
                  label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice, Can Reach Home!)`;
                  description = `Move ${dieValue} spaces using both dice - This horse can reach HOME!`;
                  
                  actions.push({
                    type: 'move',
                    horseID,
                    label,
                    description,
                  });
                } else if (result === 'HOMEPATH') {
                  label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice, Can Enter Home Path)`;
                  description = `Move ${dieValue} spaces using both dice - This horse can enter the home path`;
                  
                  actions.push({
                    type: 'move',
                    horseID,
                    label,
                    description,
                  });
                }
              }

              // Debug log for development
              if (process.env.NODE_ENV === 'development') {
                console.log(`[buildAvailableActions] Added 2-dice action for ${horseID}: ${label}`);
              }
            }
          } else {
            // No blocking - show normal move action
            const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, dieValue);
            let label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice)`;
            let description = `Move ${dieValue} spaces using both dice`;

            if (result === 'HOME') {
              label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice, Can Reach Home!)`;
              description = `Move ${dieValue} spaces using both dice - This horse can reach HOME!`;
            } else if (result === 'HOMEPATH') {
              label = `Move Horse ${horseID.split('_')[3]} (${dieValue} steps - 2 dice, Can Enter Home Path)`;
              description = `Move ${dieValue} spaces using both dice - This horse can enter the home path`;
            }

            actions.push({
              type: 'move',
              horseID,
              label,
              description,
            });

            // Debug log for development
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildAvailableActions] Added 2-dice action for ${horseID}: ${label}`);
            }
          }
      } else {
        // Debug log for development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[buildAvailableActions] Skipped 2-dice action for ${horseID}: would overshoot home (${horse.steps} + ${dieValue} > ${WINNING_MOVES})`);
        }
      }
    } else {
      // Not a pair - normal move action
      // NEW RULE: If horse is in home path, check if dice sum equals next index
      if (isHorseInHomePath) {
        // Calculate home path index
        const homePathIndex = horse.position === 'NORTH' || horse.position === 'SOUTH'
          ? currentCellData.row
          : currentCellData.column;
        const nextHomePathIndex = homePathIndex + 1;
        const dieSum = roll1 + roll2;
        
        // Check if dice sum equals next index
        if (dieSum === nextHomePathIndex) {
          // Can move 1 step with dice sum matching next index
          if (horse.steps + 1 <= WINNING_MOVES) {
            const blockingInfoOneStep: { blockingHorseID: IHorse['horseID'], blockingCellID: string, stepsBeforeBlocking: number, isSameColor: boolean } | null = 
              yield call(findBlockingHorse, horseID, 1 as Rolls);
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`[buildAvailableActions] Horse ${horseID} in home path at index ${homePathIndex}, dice sum ${dieSum} equals next index ${nextHomePathIndex}`);
            }
            
            const canMove = !blockingInfoOneStep || 
              (blockingInfoOneStep.stepsBeforeBlocking + 1 === 1 && !blockingInfoOneStep.isSameColor) ||
              (blockingInfoOneStep.stepsBeforeBlocking + 1 > 1);
            
            if (canMove) {
              const resultOneStep: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, 1 as Rolls);
              let labelOneStep = `Move Horse ${horseID.split('_')[3]} (1 step, Home Path Index ${nextHomePathIndex})`;
              let descriptionOneStep = `Move 1 space in home path (dice sum ${dieSum} = index ${nextHomePathIndex})`;
              
              if (resultOneStep === 'HOME') {
                labelOneStep = `Move Horse ${horseID.split('_')[3]} (1 step, Can Reach Home!)`;
                descriptionOneStep = `Move 1 space in home path - This horse can reach HOME!`;
              }
              
              if (blockingInfoOneStep && blockingInfoOneStep.stepsBeforeBlocking + 1 === 1 && !blockingInfoOneStep.isSameColor) {
                actions.push({
                  type: 'kick',
                  horseID,
                  label: `Move Horse ${horseID.split('_')[3]} (1 step, Kick Blocking Horse)`,
                  description: `Move 1 space in home path and kick opponent horse`,
                  blockingHorseID: blockingInfoOneStep.blockingHorseID,
                  stepsToUse: 1,
                });
              } else {
                actions.push({
                  type: 'move',
                  horseID,
                  label: labelOneStep,
                  description: descriptionOneStep,
                  stepsToUse: 1,
                });
              }
            }
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[buildAvailableActions] Skipping non-pair action for ${horseID}: in home path at index ${homePathIndex}, dice sum ${dieSum} does not equal next index ${nextHomePathIndex}`);
          }
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`[buildAvailableActions] Not a pair for ${horseID}, blockingInfo:`, blockingInfo);
      }
      
      if (!isHorseInHomePath && blockingInfo) {
        const blockingStep = blockingInfo.stepsBeforeBlocking + 1;
        
        // Check if we can kick the blocking horse
        if (dieValue === blockingStep && !blockingInfo.isSameColor) {
          // Can kick opponent - create kick action
          const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, dieValue);
          let label = `Move Horse ${horseID.split('_')[3]} (Kick Blocking Horse)`;
          let description = `Move ${dieValue} spaces and kick opponent horse`;

          if (result === 'HOME') {
            label = `Move Horse ${horseID.split('_')[3]} (Kick Blocking Horse, Can Reach Home!)`;
            description = `Move ${dieValue} spaces, kick opponent horse, and reach HOME!`;
          } else if (result === 'HOMEPATH') {
            label = `Move Horse ${horseID.split('_')[3]} (Kick Blocking Horse, Can Enter Home Path)`;
            description = `Move ${dieValue} spaces, kick opponent horse, and enter the home path`;
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[buildAvailableActions] Creating non-pair kick action for ${horseID}:`, {
              blockingHorseID: blockingInfo.blockingHorseID,
              dieValue,
              blockingStep,
            });
          }
          
          actions.push({
            type: 'kick',
            horseID,
            label,
            description,
            blockingHorseID: blockingInfo.blockingHorseID,
          });
        } else if (dieValue > blockingStep && !blockingInfo.isSameColor) {
          // Would overshoot opponent blocker - don't show this action
          if (process.env.NODE_ENV === 'development') {
            console.log(`[buildAvailableActions] Skipped non-pair action for ${horseID}: would overshoot opponent blocker (${dieValue} > ${blockingStep})`);
          }
        } else {
          // Blocking horse found but can't kick - no actions available (blocked by sum of both dice)
          // Don't add any action
          if (process.env.NODE_ENV === 'development') {
            console.log(`[buildAvailableActions] Skipped non-pair action for ${horseID}: blocked (same color or can't kick, dieValue: ${dieValue}, blockingStep: ${blockingStep})`);
          }
        }
      } else if (!isHorseInHomePath) {
        // No blocking - normal move action
        // (Only if not in home path - home path horses need double dice)
        const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, dieValue);
        let label = `Move Horse ${horseID.split('_')[3]}`;
        let description = `Move ${dieValue} spaces`;

        if (result === 'HOME') {
          label = `Move Horse ${horseID.split('_')[3]} (Can Reach Home!)`;
          description = `Move ${dieValue} spaces - This horse can reach HOME!`;
        } else if (result === 'HOMEPATH') {
          label = `Move Horse ${horseID.split('_')[3]} (Can Enter Home Path)`;
          description = `Move ${dieValue} spaces - This horse can enter the home path`;
        }

        actions.push({
          type: 'move',
          horseID,
          label,
          description,
        });
      }
    }
  }

  // Debug log: Show all actions created
  if (process.env.NODE_ENV === 'development') {
    console.log(`[buildAvailableActions] Total actions created: ${actions.length}`, actions.map(a => ({
      type: a.type,
      horseID: a.horseID,
      label: a.label,
      blockingHorseID: a.blockingHorseID,
      stepsToUse: a.stepsToUse,
    })));
    const kickActions = actions.filter(a => a.type === 'kick');
    const moveActions = actions.filter(a => a.type === 'move');
    console.log(`[buildAvailableActions] Kick actions: ${kickActions.length}`, kickActions);
    console.log(`[buildAvailableActions] Move actions: ${moveActions.length}`, moveActions.map(a => ({
      horseID: a.horseID,
      label: a.label,
      stepsToUse: a.stepsToUse,
    })));
  }

  return actions;
}

/**
 * Handles when a spawnable roll is rolled with immediate spawn condition (no horses spawned or no moves available)
 */
function * handleRollSpawnableImmediateSpawn(
  roll1: Rolls,
  roll2: Rolls,
  currentTurnBase: IBase,
  spawnableHorses: IHorse['horseID'][]
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  const dieSum: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);

  if (autoActionsEnabled) {
    // Auto-actions enabled - immediately spawn
    yield put(spawnHorse(currentTurnBase.ID, spawnableHorses[0]));
    yield take([LudoActionTypes.SPAWN_HORSE_SUCCESS, LudoActionTypes.MOVE_HORSE_SUCCESS]);
  } else {
    // Auto-actions disabled - show action selection UI
    const actions: IAvailableAction[] = yield call(buildAvailableActions, spawnableHorses, [], dieSum as Rolls, currentTurnBase);
    yield put(setAvailableActions(actions, dieSum as Rolls));
    yield put(markCurrentBase(true));
    
    // Wait for user to select an action
    yield take([LudoActionTypes.SPAWN_HORSE_SUCCESS, LudoActionTypes.MOVE_HORSE_SUCCESS]);
    yield put(clearAvailableActions());
    yield put(markCurrentBase(false));
  }
}

/**
 * Handles when a spawnable roll is rolled with choice between spawn and move
 */
function * handleRollSpawnableWithChoice(
  roll1: Rolls,
  roll2: Rolls,
  spawnableHorses: IHorse['horseID'][],
  movableHorses: IHorse['horseID'][],
  currentTurnBase: IBase
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  const dieSum: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);

  if (autoActionsEnabled) {
    // Auto-actions enabled - choose action automatically
    yield call(autoChooseAction, spawnableHorses, movableHorses, currentTurnBase);
    
    // Wait for action to complete
    yield take([LudoActionTypes.SPAWN_HORSE_SUCCESS, LudoActionTypes.MOVE_HORSE_SUCCESS]);
  } else {
    // Auto-actions disabled - show action selection UI
    yield call(buildAndHandleActions, spawnableHorses, movableHorses, dieSum as Rolls, currentTurnBase, true);
  }
}

/**
 * Handles when a spawnable roll is rolled (1-6, 6-1, or doubles)
 */
function * handleRollSpawnable(
  roll1: Rolls,
  roll2: Rolls,
  spawnableHorses: IHorse['horseID'][],
  movableHorses: IHorse['horseID'][],
  spawnedHorseIDs: IHorse['horseID'][],
  currentTurnBase: IBase
): Generator<any, void, any> {
  // Mark base as spawnable
  yield put(markCurrentBase(true));

  if (spawnedHorseIDs.length === 0 && movableHorses.length === 0) {
    // No horses spawned yet - must spawn
    yield call(handleRollSpawnableImmediateSpawn, roll1, roll2, currentTurnBase, spawnableHorses);
  } else {
    // Has spawned horses - can choose between spawn or move
    yield call(handleRollSpawnableWithChoice, roll1, roll2, spawnableHorses, movableHorses, currentTurnBase);
  }
}

/**
 * Helper function to enable die, recalculate highlighting, and optionally auto-roll
 * Used for bonus turns after spawnable rolls or successful moves/spawns
 */
function * enableDieAndRecalculateHighlighting(shouldAutoRoll: boolean = true): Generator<any, void, any> {
  yield put(enableDie());
  
  // Small delay to ensure all state updates are processed
  yield delay(100);
  
  // Recalculate and highlight reachable cells for the bonus turn
  yield put(clearHighlightedCells());
  const result: { reachableCells: Set<string>; cellsByHorse: Map<string, Array<{ horseID: any; moveType: 'spawn' | 'kick' | 'move' }>> } = yield call(calculateReachableCells);
  if (result.reachableCells.size > 0) {
    yield put(setHighlightedCells(result.reachableCells, result.cellsByHorse));
  }
  
  if (shouldAutoRoll) {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  if (autoActionsEnabled) {
    // Small delay before auto-rolling for the bonus turn
    yield delay(DICE_BONUS_TURN_DELAY);
    // Automatically roll the dice for the bonus turn
    yield put(rollDie());
    }
  }
}

/**
 * Helper function to build actions, check if any are available, and handle action selection
 * Returns true if actions were set and user selection was handled, false if no valid moves
 */
function * buildAndHandleActions(
  spawnableHorses: IHorse['horseID'][],
  movableHorses: IHorse['horseID'][],
  dieValue: Rolls,
  currentTurnBase: IBase,
  shouldMarkBase: boolean = false
): Generator<any, boolean, any> {
  const actions: IAvailableAction[] = yield call(buildAvailableActions, spawnableHorses, movableHorses, dieValue, currentTurnBase);
  
  // Check if any actions are available after blocking detection
  if (actions.length === 0) {
    // All horses are blocked - pass turn automatically
    if (shouldMarkBase) {
      yield put(markCurrentBase(false));
    }
    yield call(handleNoValidMoves);
    return false;
  }
  
  yield put(setAvailableActions(actions, dieValue));
  if (shouldMarkBase) {
    yield put(markCurrentBase(true));
  }
  
  // Wait for user to select an action
  const actionTypes = spawnableHorses.length > 0 
    ? [LudoActionTypes.SPAWN_HORSE_SUCCESS, LudoActionTypes.MOVE_HORSE_SUCCESS]
    : [LudoActionTypes.MOVE_HORSE_SUCCESS];
  yield take(actionTypes);
  
  yield put(clearAvailableActions());
  if (shouldMarkBase) {
    yield put(markCurrentBase(false));
  }
  return true;
  }
  
/**
 * Handles bonus turn after rolling a spawnable combination (1-6, 6-1, or doubles)
 */
function * handleBonusTurnAfterSpawnable(): Generator<any, void, any> {
  yield call(enableDieAndRecalculateHighlighting);
}

/**
 * Automatically moves a single horse (only one option available)
 */
function * handleSingleHorseMove(horseID: IHorse['horseID'], horses: { [key: string]: IHorse }): Generator<any, void, any> {
  const horse = horses[horseID];
  yield put(moveHorse(horseID, horse.position, horse.cellID));
}

/**
 * Selects and moves a horse with priority (HOME > HOMEPATH > random)
 */
function * selectAndMoveHorseWithPriority(
  movableHorses: IHorse['horseID'][],
  dieValue: Rolls,
  horses: { [key: string]: IHorse },
  playerColor: string
): Generator<any, void, any> {
  const mt = MersenneTwister19937.autoSeed();

  // Prioritize horses that can reach HOME or HOMEPATH
  const horsesThatCanReachHome: IHorse['horseID'][] = [];
  const horsesThatCanReachHomePath: IHorse['horseID'][] = [];

  for (const horseID of movableHorses) {
    const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, horseID, dieValue);
    if (result === 'HOME') {
      horsesThatCanReachHome.push(horseID);
    } else if (result === 'HOMEPATH') {
      horsesThatCanReachHomePath.push(horseID);
    }
  }

  // Priority 1: Choose horse that can reach HOME
  let chosenHorseID: IHorse['horseID'];
  if (horsesThatCanReachHome.length > 0) {
    chosenHorseID = horsesThatCanReachHome[integer(0, horsesThatCanReachHome.length - 1)(mt)];
  } else if (horsesThatCanReachHomePath.length > 0) {
    // Priority 2: Choose horse that can reach HOMEPATH
    chosenHorseID = horsesThatCanReachHomePath[integer(0, horsesThatCanReachHomePath.length - 1)(mt)];
  } else {
    // Priority 3: Random selection
    chosenHorseID = movableHorses[integer(0, movableHorses.length - 1)(mt)];
  }

  const horse = horses[chosenHorseID];
  const details = horsesThatCanReachHome.length > 0
    ? `Automatically moved horse ${chosenHorseID.split('_')[1]} ${dieValue} spaces (can reach HOME)`
    : horsesThatCanReachHomePath.length > 0
    ? `Automatically moved horse ${chosenHorseID.split('_')[1]} ${dieValue} spaces (can reach HOMEPATH)`
    : `Automatically moved horse ${chosenHorseID.split('_')[1]} ${dieValue} spaces`;

  yield put(addLogEntry({
    player: playerColor,
    action: 'Auto-moved horse',
    details,
  }));

  yield put(moveHorse(chosenHorseID, horse.position, horse.cellID));
}

/**
 * Handles when multiple horses can be moved (requires user choice or auto-action)
 */
function * handleMultipleHorsesMove(
  movableHorses: IHorse['horseID'][],
  dieValue: Rolls,
  horses: { [key: string]: IHorse }
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);

  if (autoActionsEnabled) {
    // Multiple movable horses - wait for user input with timeout
    const timeoutDuration: ReturnType<typeof autoActionTimeoutSelector> = yield select(autoActionTimeoutSelector);
    const { timeout } = yield race({
      userAction: take(LudoActionTypes.MOVE_HORSE_SUCCESS),
      timeout: delay(timeoutDuration),
    });

    if (timeout) {
      // Timeout won - auto select a movable horse (prioritizing HOME/HOMEPATH)
      const currentMovableHorses: IHorse['horseID'][] = yield call(getMovableHorses, dieValue);
      if (currentMovableHorses.length > 0) {
        const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
        const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
        const playerColor = bases[currentTurn].color;
        yield call(selectAndMoveHorseWithPriority, currentMovableHorses, dieValue, horses, playerColor);
      }
    }
  } else {
    // Auto-actions disabled - show action selection UI
    const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
    const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
    const currentTurnBase = bases[currentTurn];
    
    yield call(buildAndHandleActions, [], movableHorses, dieValue, currentTurnBase);
  }
}

/**
 * Handles non-spawnable roll with spawned horses available
 */
function * handleNonSpawnableRoll(
  spawnedHorseIDs: IHorse['horseID'][],
  movableHorses: IHorse['horseID'][],
  dieValue: Rolls,
  horses: { [key: string]: IHorse }
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);

  if (autoActionsEnabled) {
    // Auto-actions enabled - auto-move if only one horse option
    if (spawnedHorseIDs.length === 1) {
      yield call(handleSingleHorseMove, spawnedHorseIDs[0], horses);
    } else if (movableHorses.length === 1) {
      yield call(handleSingleHorseMove, movableHorses[0], horses);
    } else if (movableHorses.length > 1) {
      // Multiple options - requires choice
      yield call(handleMultipleHorsesMove, movableHorses, dieValue, horses);
    }
  } else {
    // Auto-actions disabled - show action selection UI even for single options
    if (movableHorses.length > 0) {
      const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
      const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
      const currentTurnBase = bases[currentTurn];
      
      yield call(buildAndHandleActions, [], movableHorses, dieValue, currentTurnBase);
    } else {
      // No movable horses at all - pass turn
      yield call(handleNoValidMoves);
    }
  }
}

/**
 * Handles when no valid moves are available
 */
function * handleNoValidMoves(): Generator<any, void, any> {
  // Always wait to show the dice result before passing turn
  // This allows players to see the roll result whether they have no spawned horses
  // or their horses are blocked and cannot move
  yield delay(NO_MOVE_DELAY);
  
  yield put(invalidateDieRoll());
  yield put(nextTurn());
  // Note: enableDie() and auto-roll will be handled by passTurnToSaga
}

/**
 * Helper function to check if dice roll allows spawning
 * Spawn conditions: (1,6), (6,1), or doubles (1-1, 2-2, 3-3, 4-4, 5-5, 6-6)
 */
function canSpawn(roll1: Rolls, roll2: Rolls): boolean {
  // Check for (1,6) or (6,1)
  if ((roll1 === Rolls.ONE && roll2 === Rolls.SIX) || (roll1 === Rolls.SIX && roll2 === Rolls.ONE)) {
    return true;
  }
  // Check for doubles
  if (roll1 === roll2) {
    return true;
  }
  return false;
}

/**
 * Main saga that handles what happens after a dice roll is complete
 * Implements the core Ludo game logic for turn progression and auto-actions
 * @param action - The roll die complete action with both dice values
 */
function * rollDieCompleteSaga(action: ReturnType<typeof rollDieComplete>): Generator<any, void, any> {
  const { roll1, roll2 } = action.data!;
  const dieSum = roll1 + roll2;
  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
  const currentTurnBase = bases[currentTurn];
  const spawnedHorseIDs = currentTurnBase.horseIDs.filter((horseID) => horses[horseID].isSpawned && !horses[horseID].isRetired);
  const movableHorses: IHorse['horseID'][] = yield call(getMovableHorses, dieSum as Rolls);
  const spawnableHorses = bases[currentTurn].horseIDs.filter((horseID) => !horses[horseID].isSpawned && !horses[horseID].isRetired);

  if (canSpawn(roll1, roll2)) {
    // Rolled a spawnable combination - can spawn and will get bonus turn
    if (spawnableHorses.length > 0 || movableHorses.length > 0) {
      yield call(handleRollSpawnable, roll1, roll2, spawnableHorses, movableHorses, spawnedHorseIDs, currentTurnBase);
      // Bonus turn will be handled after action completes (in moveHorseSuccessSaga or spawnHorseSaga)
    } else {
      // Rolled spawnable combination but no valid actions - still get bonus turn
      yield put(invalidateDieRoll());
      yield call(handleBonusTurnAfterSpawnable);
    }
  } else if (spawnedHorseIDs.length > 0) {
    yield call(handleNonSpawnableRoll, spawnedHorseIDs, movableHorses, dieSum as Rolls, horses);
  } else {
    yield call(handleNoValidMoves);
  }
}

/**
 * Saga that handles bonus turns after spawning a horse
 * If the player rolled a spawnable combination, grant a bonus turn
 */
function * spawnHorseSuccessSaga() {
  // Invalidate the die roll first (action has been chosen)
  yield put(invalidateDieRoll());
  
  // Get the dice values that were used for spawning
  const roll1: ReturnType<typeof currentDieRoll1Selector> = yield select(currentDieRoll1Selector);
  const roll2: ReturnType<typeof currentDieRoll2Selector> = yield select(currentDieRoll2Selector);
  
  // Check if this was a spawnable combination that grants a bonus turn
  if (canSpawn(roll1, roll2)) {
    // Player gets a bonus turn - enable die and recalculate highlighting
    yield call(enableDieAndRecalculateHighlighting);
  } else {
    // Not a spawnable combination - pass turn to next player
    yield put(nextTurn());
    yield put(enableDie());
  }
}

/**
 * Watcher saga that listens for SPAWN_HORSE_SUCCESS actions
 * Handles bonus turns after spawning
 */
function * watchForSpawnHorseSuccess() {
  yield takeLatest(LudoActionTypes.SPAWN_HORSE_SUCCESS, spawnHorseSuccessSaga);
}

/**
 * Watcher saga that listens for MOVE_HORSE_SUCCESS actions
 * Handles automatic die rolling for bonus turns in auto-play mode
 */
function * watchForMoveHorseSuccess() {
  yield takeLatest(LudoActionTypes.MOVE_HORSE_SUCCESS, moveHorseSuccessSaga);
}

/**
 * Watcher saga that listens for PASS_TURN_TO actions
 * Automatically rolls the die for the next player in auto-play mode
 */
function * watchForPassTurnTo() {
  yield takeLatest(LudoActionTypes.PASS_TURN_TO, passTurnToSaga);
}

/**
 * Saga that handles turn changes - enables die and auto-rolls in auto-play mode
 */
function * passTurnToSaga() {
  yield put(enableDie());
  
  // Small delay to ensure any state updates are processed
  yield delay(DICE_STATE_UPDATE_DELAY);
  
  // In auto-play mode, automatically roll for the new player only if they have spawned horses
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  if (autoActionsEnabled) {
    // Check if current player has any spawned horses before auto-rolling
    const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
    const horses: ReturnType<typeof horsesSelector> = yield select(horsesSelector);
    const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
    
    // Check if the current player has any horses that are spawned (not in base)
    const currentTurnBase = bases[currentTurn];
    const hasSpawnedHorses = currentTurnBase.horseIDs.some((horseID) => {
      const horse = horses[horseID];
      return horse.isSpawned && !horse.isRetired;
    });
    
    if (hasSpawnedHorses) {
    yield delay(DICE_BONUS_TURN_DELAY);
    yield put(rollDie());
    }
  }
}

/**
 * Saga that handles bonus turns after a successful horse move
 * If the player got a bonus turn (rolled spawnable combination, reached home, or captured), grant bonus turn
 */
function * moveHorseSuccessSaga(action: { type: string; data?: { bonusChance: boolean; horseID: string; currentDieRoll: Rolls } }) {
  const { bonusChance } = action.data!;
  
  // Invalidate the die roll first (action has been chosen)
  yield put(invalidateDieRoll());
  
  if (bonusChance) {
    // Player got a bonus turn - enable die and recalculate highlighting
    // Dice will be clickable now because isDieRollValid is false
    yield call(enableDieAndRecalculateHighlighting);
  } else {
    // No bonus - re-enable die for next player (already in next turn)
    yield put(enableDie());
  }
}

/**
 * Array of all dice container sagas to be registered with the Redux store
 * These sagas handle asynchronous dice operations and game logic
 */
export const sagas = [
  watchForRollDie,          // Watches for die roll requests
  watchForSetDieResult,     // Watches for set die result requests
  watchForRollDieComplete,  // Watches for die roll completions and handles game logic
  watchForSpawnHorseSuccess, // Watches for successful spawns and handles bonus turns
  watchForMoveHorseSuccess,  // Watches for successful moves and handles bonus turns
  watchForPassTurnTo,       // Watches for turn changes and auto-rolls in auto-play mode
];
