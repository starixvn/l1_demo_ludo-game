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
  moveCoin,
  nextTurn,
  spawnCoin,
  setAvailableActions,
  clearAvailableActions,
  IAvailableAction,
  ActionTypes as LudoActionTypes,
} from 'containers/Ludo/state/actions';
import { rollDie } from './actions';
import { BaseID, CellType, IBase, ICoin } from 'containers/Ludo/state/interfaces';
import { getMovableCoins, calculateReachableCells } from 'containers/Ludo/state/sagas';
import { clearHighlightedCells, setHighlightedCells } from 'containers/Ludo/state/actions';
import { basesSelector, cellsSelector, coinsSelector, currentTurnSelector, linksSelector } from 'containers/Ludo/state/selectors';
import { addLogEntry } from 'containers/StepLogs/state/actions';
import { autoActionsEnabledSelector, autoActionTimeoutSelector } from 'containers/StepLogs/state/selectors';
import { DICE_BONUS_TURN_DELAY, DICE_STATE_UPDATE_DELAY } from 'globalConstants';

import { currentDieRoll1Selector, currentDieRoll2Selector, currentDieRollSumSelector } from './selectors';

import { enableDie, invalidateDieRoll, rollDieComplete, ActionTypes } from './actions';
import { Rolls } from './interfaces';
import { ActionTypes as StepLogsActionTypes } from 'containers/StepLogs/state/actions';

/**
 * Watcher saga that listens for ROLL_DIE actions and triggers the roll die saga
 */
function * watchForRollDie() {
  yield takeLatest(ActionTypes.ROLL_DIE, rollDieSaga);
}

/**
 * Saga that handles the dice rolling process
 * Generates two random die rolls and logs the action
 */
function * rollDieSaga() {
  // Generate random die rolls using Mersenne Twister for better randomness
  const mt = MersenneTwister19937.autoSeed();
  const dieRoll1: Rolls = integer(Rolls.ONE, Rolls.SIX)(mt);
  const dieRoll2: Rolls = integer(Rolls.ONE, Rolls.SIX)(mt);

  // Get current player info for logging
  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const playerColor = bases[currentTurn].color;

  // Log the dice roll action
  yield put(addLogEntry({
    player: playerColor,
    action: `Rolled ${dieRoll1}-${dieRoll2}`,
    details: `Dice roll: ${dieRoll1}-${dieRoll2} (sum: ${dieRoll1 + dieRoll2})`,
  }));

  // Dispatch the roll completion action
  yield put(rollDieComplete(dieRoll1, dieRoll2));
}

/**
 * Checks if a coin can reach HOME or HOMEPATH after moving the specified number of steps
 * @param coinID - The coin to check
 * @param stepsToTake - Number of steps to simulate
 * @returns 'HOME' if coin can reach HOME, 'HOMEPATH' if it can reach HOMEPATH, null otherwise
 */
function * canReachHome(coinID: ICoin['coinID'], stepsToTake: Rolls): Generator<any, 'HOME' | 'HOMEPATH' | null, any> {
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const cells: ReturnType<typeof cellsSelector> = yield select(cellsSelector);
  const links: ReturnType<typeof linksSelector> = yield select(linksSelector);
  
  const coin = coins[coinID];
  if (!coin || !coin.isSpawned || coin.isRetired) {
    return null;
  }

  // Simulate the path the coin would take
  let currentCellID = coin.cellID;
  
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
    
    // Try to find a home path cell that matches this coin's base
    const matchingHomePath = nextCells.find((cell) => {
      // Skip HOME cells - they don't exist in the cells structure
      if (cell.cellID === 'HOME') {
        return false;
      }
      const cellData = cells[cell.position]?.[cell.cellID];
      if (!cellData) {
        return false;
      }
      return cellData.cellType === CellType.HOMEPATH && coin.baseID === cellData.baseID;
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
        return cellData.cellType === CellType.HOMEPATH && coin.baseID === cellData.baseID;
      });
      if (anyHomePath) {
        // Check if we can reach HOME from this position
        const remainingSteps = stepsToTake - step - 1;
        if (remainingSteps > 0) {
          const deepCheck = yield call(canReachHomeFromCell, anyHomePath.cellID, coin.baseID, remainingSteps);
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
      if (cellData && cellData.cellType === CellType.HOMEPATH && cellData.baseID === coin.baseID) {
        return 'HOMEPATH'; // Can reach home path
      }
    }
  }

  return null;
}

/**
 * Helper to check if a coin can reach HOME from a specific cell
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
 * @param spawnableCoins - Array of coin IDs that can be spawned
 * @param movableCoins - Array of coin IDs that can be moved
 * @param currentTurnBase - The current player's base information
 */
function * autoChooseAction(spawnableCoins: ICoin['coinID'][], movableCoins: ICoin['coinID'][], currentTurnBase: IBase) {
  const mt = MersenneTwister19937.autoSeed();
  const currentDieRoll: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);

  // Priority 1: Check if any movable coins can reach HOME
  const coinsThatCanReachHome: ICoin['coinID'][] = [];
  const coinsThatCanReachHomePath: ICoin['coinID'][] = [];
  const otherCoins: ICoin['coinID'][] = [];

  if (movableCoins.length > 0) {
    for (const coinID of movableCoins) {
      const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, coinID, currentDieRoll);
      if (result === 'HOME') {
        coinsThatCanReachHome.push(coinID);
      } else if (result === 'HOMEPATH') {
        coinsThatCanReachHomePath.push(coinID);
      } else {
        otherCoins.push(coinID);
      }
    }
  }

  // Priority 1: Choose coin that can reach HOME
  if (coinsThatCanReachHome.length > 0) {
    const chosenCoinID = coinsThatCanReachHome[integer(0, coinsThatCanReachHome.length - 1)(mt)];
    const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
    const coin = coins[chosenCoinID];
    
    yield put(addLogEntry({
      player: currentTurnBase.color,
      action: 'Auto-action',
      details: `Automatically chose to move coin ${chosenCoinID.split('_')[1]} (can reach HOME)`,
    }));
    
    yield put(moveCoin(chosenCoinID, coin.position, coin.cellID));
    return;
  }

  // Priority 2: Choose coin that can reach HOMEPATH
  if (coinsThatCanReachHomePath.length > 0) {
    const chosenCoinID = coinsThatCanReachHomePath[integer(0, coinsThatCanReachHomePath.length - 1)(mt)];
    const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
    const coin = coins[chosenCoinID];
    
    yield put(addLogEntry({
      player: currentTurnBase.color,
      action: 'Auto-action',
      details: `Automatically chose to move coin ${chosenCoinID.split('_')[1]} (can reach HOMEPATH)`,
    }));
    
    yield put(moveCoin(chosenCoinID, coin.position, coin.cellID));
    return;
  }

  // Priority 3: Choose between spawn and move (prefer move if available)
  const availableActions = [];
  if (movableCoins.length > 0) availableActions.push('move');
  if (spawnableCoins.length > 0) availableActions.push('spawn');

  // Prefer move if available, otherwise spawn
  const chosenAction = availableActions[0] || (availableActions.length > 0 ? availableActions[integer(0, availableActions.length - 1)(mt)] : null);

  if (chosenAction === 'move' && movableCoins.length > 0) {
    // Double-check that the selected coin is still movable before dispatching
    const currentMovableCoins: ICoin['coinID'][] = yield call(getMovableCoins, currentDieRoll);
    if (currentMovableCoins.length > 0) {
      const chosenCoinID = currentMovableCoins[integer(0, currentMovableCoins.length - 1)(mt)];
      const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
      const coin = coins[chosenCoinID];
      
      yield put(addLogEntry({
        player: currentTurnBase.color,
        action: 'Auto-action',
        details: `Automatically chose to move coin ${chosenCoinID.split('_')[1]}`,
      }));
      
      yield put(moveCoin(chosenCoinID, coin.position, coin.cellID));
      return;
    }
  }

  if (chosenAction === 'spawn' && spawnableCoins.length > 0) {
    // Double-check that there are still spawnable coins
    const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
    const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
    const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
    const currentSpawnableCoins = bases[currentTurn].coinIDs.filter((coinID) => !coins[coinID].isSpawned && !coins[coinID].isRetired);

    if (currentSpawnableCoins.length > 0) {
      const chosenCoinID = currentSpawnableCoins[integer(0, currentSpawnableCoins.length - 1)(mt)];
      
      yield put(addLogEntry({
        player: currentTurnBase.color,
        action: 'Auto-action',
        details: `Automatically chose to spawn coin ${chosenCoinID.split('_')[1]}`,
      }));
      
      yield put(spawnCoin(currentTurnBase.ID, chosenCoinID));
      return;
    }
  }

  // Fallback: try move if spawn failed
  if (movableCoins.length > 0) {
    const currentMovableCoins: ICoin['coinID'][] = yield call(getMovableCoins, currentDieRoll);
    if (currentMovableCoins.length > 0) {
      const chosenCoinID = currentMovableCoins[integer(0, currentMovableCoins.length - 1)(mt)];
      const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
      const coin = coins[chosenCoinID];
      yield put(moveCoin(chosenCoinID, coin.position, coin.cellID));
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
 * Waits for user action or auto-action timeout, then triggers auto-action if timeout occurs
 * @param spawnableCoins - Coins that can be spawned
 * @param movableCoins - Coins that can be moved
 * @param currentTurnBase - Current player's base
 * @param actionTypes - Action types to wait for (for spawn/move choice or just move)
 */
function * waitForUserOrAutoAction(
  spawnableCoins: ICoin['coinID'][],
  movableCoins: ICoin['coinID'][],
  currentTurnBase: IBase,
  actionTypes: string[] = [LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);

  if (autoActionsEnabled) {
    // Race between user input and configurable timeout
    const timeoutDuration: ReturnType<typeof autoActionTimeoutSelector> = yield select(autoActionTimeoutSelector);
    const { timeout } = yield race({
      userAction: take(actionTypes),
      timeout: delay(timeoutDuration),
    });

    if (timeout) {
      // Timeout won - auto choose an action
      yield call(autoChooseAction, spawnableCoins, movableCoins, currentTurnBase);
      yield take(actionTypes);
    }
  } else {
    // Auto-actions disabled - wait for user input or auto-actions being re-enabled
    yield call(waitForUserOrAutoActionReenable, spawnableCoins, movableCoins, currentTurnBase, actionTypes);
  }
}

/**
 * Waits for user action when auto-actions are disabled, but can trigger if re-enabled
 */
function * waitForUserOrAutoActionReenable(
  spawnableCoins: ICoin['coinID'][],
  movableCoins: ICoin['coinID'][],
  currentTurnBase: IBase,
  actionTypes: string[]
): Generator<any, void, any> {
  while (true) {
    const action: any = yield take([
      ...actionTypes,
      StepLogsActionTypes.SET_AUTO_ACTIONS_ENABLED,
    ]);

    if (action.type === StepLogsActionTypes.SET_AUTO_ACTIONS_ENABLED) {
      // Check if auto-actions are now enabled
      const newAutoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
      if (newAutoActionsEnabled) {
        // Auto-actions were re-enabled - start the timeout
        const timeoutDuration: ReturnType<typeof autoActionTimeoutSelector> = yield select(autoActionTimeoutSelector);
        const { timeout } = yield race({
          userAction: take(actionTypes),
          timeout: delay(timeoutDuration),
        });

        if (timeout) {
          // Timeout won - auto choose an action
          yield call(autoChooseAction, spawnableCoins, movableCoins, currentTurnBase);
          yield take(actionTypes);
        }
        break; // Exit the loop
      }
      // If still disabled, continue waiting
    } else {
      // User performed an action - exit the loop
      break;
    }
  }
}

/**
 * Handles when a 6 is rolled with immediate spawn condition (no coins spawned or no moves available)
 */
function * handleRollSixImmediateSpawn(
  currentTurnBase: IBase,
  spawnableCoins: ICoin['coinID'][]
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  const currentDieRoll: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);

  if (autoActionsEnabled) {
    // Auto-actions enabled - immediately spawn
    yield put(spawnCoin(currentTurnBase.ID, spawnableCoins[0]));
    yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
  } else {
    // Auto-actions disabled - show action selection UI
    const actions: IAvailableAction[] = yield call(buildAvailableActions, spawnableCoins, [], currentDieRoll, currentTurnBase);
    yield put(setAvailableActions(actions, currentDieRoll));
    yield put(markCurrentBase(true));
    
    // Wait for user to select an action
    yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
    yield put(clearAvailableActions());
    yield put(markCurrentBase(false));
  }
}

/**
 * Builds available actions list from spawnable and movable coins
 */
function * buildAvailableActions(
  spawnableCoins: ICoin['coinID'][],
  movableCoins: ICoin['coinID'][],
  dieValue: Rolls,
  currentTurnBase: IBase
): Generator<any, IAvailableAction[], any> {
  const actions: IAvailableAction[] = [];

  // Add spawn actions
  for (const coinID of spawnableCoins) {
    actions.push({
      type: 'spawn',
      coinID,
      label: `Spawn Coin ${coinID.split('_')[1]}`,
      description: 'Bring a new coin onto the board',
    });
  }

  // Add move actions with priority information
  for (const coinID of movableCoins) {
    const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, coinID, dieValue);
    let label = `Move Coin ${coinID.split('_')[1]}`;
    let description = `Move ${dieValue} spaces`;

    if (result === 'HOME') {
      label = `Move Coin ${coinID.split('_')[1]} (Can Reach Home!)`;
      description = `Move ${dieValue} spaces - This coin can reach HOME!`;
    } else if (result === 'HOMEPATH') {
      label = `Move Coin ${coinID.split('_')[1]} (Can Enter Home Path)`;
      description = `Move ${dieValue} spaces - This coin can enter the home path`;
    }

    actions.push({
      type: 'move',
      coinID,
      label,
      description,
    });
  }

  return actions;
}

/**
 * Handles when a spawnable roll is rolled with immediate spawn condition (no coins spawned or no moves available)
 */
function * handleRollSpawnableImmediateSpawn(
  roll1: Rolls,
  roll2: Rolls,
  currentTurnBase: IBase,
  spawnableCoins: ICoin['coinID'][]
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  const dieSum: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);

  if (autoActionsEnabled) {
    // Auto-actions enabled - immediately spawn
    yield put(spawnCoin(currentTurnBase.ID, spawnableCoins[0]));
    yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
  } else {
    // Auto-actions disabled - show action selection UI
    const actions: IAvailableAction[] = yield call(buildAvailableActions, spawnableCoins, [], dieSum as Rolls, currentTurnBase);
    yield put(setAvailableActions(actions, dieSum as Rolls));
    yield put(markCurrentBase(true));
    
    // Wait for user to select an action
    yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
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
  spawnableCoins: ICoin['coinID'][],
  movableCoins: ICoin['coinID'][],
  currentTurnBase: IBase
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  const dieSum: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);

  if (autoActionsEnabled) {
    // Auto-actions enabled - choose action automatically
    yield call(autoChooseAction, spawnableCoins, movableCoins, currentTurnBase);
    
    // Wait for action to complete
    yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
  } else {
    // Auto-actions disabled - show action selection UI
    const actions: IAvailableAction[] = yield call(buildAvailableActions, spawnableCoins, movableCoins, dieSum as Rolls, currentTurnBase);
    yield put(setAvailableActions(actions, dieSum as Rolls));
    yield put(markCurrentBase(true));
    
    // Wait for user to select an action
    yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
    yield put(clearAvailableActions());
    yield put(markCurrentBase(false));
  }
}

/**
 * Handles when a spawnable roll is rolled (1-6, 6-1, or doubles)
 */
function * handleRollSpawnable(
  roll1: Rolls,
  roll2: Rolls,
  spawnableCoins: ICoin['coinID'][],
  movableCoins: ICoin['coinID'][],
  spawnedCoinIDs: ICoin['coinID'][],
  currentTurnBase: IBase
): Generator<any, void, any> {
  // Mark base as spawnable
  yield put(markCurrentBase(true));

  if (spawnedCoinIDs.length === 0 && movableCoins.length === 0) {
    // No coins spawned yet - must spawn
    yield call(handleRollSpawnableImmediateSpawn, roll1, roll2, currentTurnBase, spawnableCoins);
  } else {
    // Has spawned coins - can choose between spawn or move
    yield call(handleRollSpawnableWithChoice, roll1, roll2, spawnableCoins, movableCoins, currentTurnBase);
  }
}

/**
 * Handles when a 6 is rolled and player needs to choose between spawn and move
 */
function * handleRollSixWithChoice(
  spawnableCoins: ICoin['coinID'][],
  movableCoins: ICoin['coinID'][],
  currentTurnBase: IBase
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  const currentDieRoll: ReturnType<typeof currentDieRollSumSelector> = yield select(currentDieRollSumSelector);

  if (autoActionsEnabled) {
    // Auto-actions enabled - use existing logic
    yield put(markCurrentBase(true));
    yield call(waitForUserOrAutoAction, spawnableCoins, movableCoins, currentTurnBase);
    yield put(markCurrentBase(false));
  } else {
    // Auto-actions disabled - show action selection UI
    const actions: IAvailableAction[] = yield call(buildAvailableActions, spawnableCoins, movableCoins, currentDieRoll, currentTurnBase);
    yield put(setAvailableActions(actions, currentDieRoll));
    yield put(markCurrentBase(true));
    
    // Wait for user to select an action
    yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
    
    yield put(clearAvailableActions());
    yield put(markCurrentBase(false));
  }
}

/**
 * Handles bonus turn after rolling a spawnable combination (1-6, 6-1, or doubles)
 */
function * handleBonusTurnAfterSpawnable(): Generator<any, void, any> {
  yield put(enableDie());
  
  // Recalculate and highlight reachable cells for the bonus turn
  // Since the player's turn continues (no PASS_TURN_TO action), we need to recalculate highlighting
  yield put(clearHighlightedCells());
  const reachableCells: Set<string> = yield call(calculateReachableCells);
  if (reachableCells.size > 0) {
    yield put(setHighlightedCells(reachableCells));
  }
  
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  if (autoActionsEnabled) {
    // Small delay before auto-rolling for the bonus turn
    yield delay(DICE_BONUS_TURN_DELAY);
    // Automatically roll the dice for the bonus turn
    yield put(rollDie());
  }
}

/**
 * Handles when a 6 is rolled
 */
function * handleRollSix(
  spawnableCoins: ICoin['coinID'][],
  movableCoins: ICoin['coinID'][],
  spawnedCoinIDs: ICoin['coinID'][],
  currentTurnBase: IBase
): Generator<any, void, any> {
  // Immediate spawn if no coins spawned or no moves available
  if ((spawnedCoinIDs.length === 0 || movableCoins.length === 0) && spawnableCoins.length > 0) {
    yield call(handleRollSixImmediateSpawn, currentTurnBase, spawnableCoins);
  } else {
    // Player needs to choose
    yield call(handleRollSixWithChoice, spawnableCoins, movableCoins, currentTurnBase);
  }
  
  // Handle bonus turn after spawnable roll
  yield call(handleBonusTurnAfterSpawnable);
}

/**
 * Automatically moves a single coin (only one option available)
 */
function * handleSingleCoinMove(coinID: ICoin['coinID'], coins: { [key: string]: ICoin }): Generator<any, void, any> {
  const coin = coins[coinID];
  yield put(moveCoin(coinID, coin.position, coin.cellID));
}

/**
 * Selects and moves a coin with priority (HOME > HOMEPATH > random)
 */
function * selectAndMoveCoinWithPriority(
  movableCoins: ICoin['coinID'][],
  dieValue: Rolls,
  coins: { [key: string]: ICoin },
  playerColor: string
): Generator<any, void, any> {
  const mt = MersenneTwister19937.autoSeed();

  // Prioritize coins that can reach HOME or HOMEPATH
  const coinsThatCanReachHome: ICoin['coinID'][] = [];
  const coinsThatCanReachHomePath: ICoin['coinID'][] = [];

  for (const coinID of movableCoins) {
    const result: 'HOME' | 'HOMEPATH' | null = yield call(canReachHome, coinID, dieValue);
    if (result === 'HOME') {
      coinsThatCanReachHome.push(coinID);
    } else if (result === 'HOMEPATH') {
      coinsThatCanReachHomePath.push(coinID);
    }
  }

  // Priority 1: Choose coin that can reach HOME
  let chosenCoinID: ICoin['coinID'];
  if (coinsThatCanReachHome.length > 0) {
    chosenCoinID = coinsThatCanReachHome[integer(0, coinsThatCanReachHome.length - 1)(mt)];
  } else if (coinsThatCanReachHomePath.length > 0) {
    // Priority 2: Choose coin that can reach HOMEPATH
    chosenCoinID = coinsThatCanReachHomePath[integer(0, coinsThatCanReachHomePath.length - 1)(mt)];
  } else {
    // Priority 3: Random selection
    chosenCoinID = movableCoins[integer(0, movableCoins.length - 1)(mt)];
  }

  const coin = coins[chosenCoinID];
  const details = coinsThatCanReachHome.length > 0
    ? `Automatically moved coin ${chosenCoinID.split('_')[1]} ${dieValue} spaces (can reach HOME)`
    : coinsThatCanReachHomePath.length > 0
    ? `Automatically moved coin ${chosenCoinID.split('_')[1]} ${dieValue} spaces (can reach HOMEPATH)`
    : `Automatically moved coin ${chosenCoinID.split('_')[1]} ${dieValue} spaces`;

  yield put(addLogEntry({
    player: playerColor,
    action: 'Auto-moved coin',
    details,
  }));

  yield put(moveCoin(chosenCoinID, coin.position, coin.cellID));
}

/**
 * Handles when multiple coins can be moved (requires user choice or auto-action)
 */
function * handleMultipleCoinsMove(
  movableCoins: ICoin['coinID'][],
  dieValue: Rolls,
  coins: { [key: string]: ICoin }
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);

  if (autoActionsEnabled) {
    // Multiple movable coins - wait for user input with timeout
    const timeoutDuration: ReturnType<typeof autoActionTimeoutSelector> = yield select(autoActionTimeoutSelector);
    const { timeout } = yield race({
      userAction: take(LudoActionTypes.MOVE_COIN_SUCCESS),
      timeout: delay(timeoutDuration),
    });

    if (timeout) {
      // Timeout won - auto select a movable coin (prioritizing HOME/HOMEPATH)
      const currentMovableCoins: ICoin['coinID'][] = yield call(getMovableCoins, dieValue);
      if (currentMovableCoins.length > 0) {
        const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
        const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
        const playerColor = bases[currentTurn].color;
        yield call(selectAndMoveCoinWithPriority, currentMovableCoins, dieValue, coins, playerColor);
      }
    }
  } else {
    // Auto-actions disabled - show action selection UI
    const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
    const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
    const currentTurnBase = bases[currentTurn];
    
    const actions: IAvailableAction[] = yield call(buildAvailableActions, [], movableCoins, dieValue, currentTurnBase);
    yield put(setAvailableActions(actions, dieValue));
    
    // Wait for user to select an action
    yield take(LudoActionTypes.MOVE_COIN_SUCCESS);
    yield put(clearAvailableActions());
  }
}

/**
 * Handles non-spawnable roll with spawned coins available
 */
function * handleNonSpawnableRoll(
  spawnedCoinIDs: ICoin['coinID'][],
  movableCoins: ICoin['coinID'][],
  dieValue: Rolls,
  coins: { [key: string]: ICoin }
): Generator<any, void, any> {
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);

  if (autoActionsEnabled) {
    // Auto-actions enabled - auto-move if only one coin option
    if (spawnedCoinIDs.length === 1) {
      yield call(handleSingleCoinMove, spawnedCoinIDs[0], coins);
    } else if (movableCoins.length === 1) {
      yield call(handleSingleCoinMove, movableCoins[0], coins);
    } else if (movableCoins.length > 1) {
      // Multiple options - requires choice
      yield call(handleMultipleCoinsMove, movableCoins, dieValue, coins);
    }
  } else {
    // Auto-actions disabled - show action selection UI even for single options
    if (movableCoins.length > 0) {
      const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
      const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
      const currentTurnBase = bases[currentTurn];
      
      const actions: IAvailableAction[] = yield call(buildAvailableActions, [], movableCoins, dieValue, currentTurnBase);
      yield put(setAvailableActions(actions, dieValue));
      
      // Wait for user to select an action
      yield take(LudoActionTypes.MOVE_COIN_SUCCESS);
      yield put(clearAvailableActions());
    }
  }
}

/**
 * Handles when no valid moves are available
 */
function * handleNoValidMoves(): Generator<any, void, any> {
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
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const currentTurnBase = bases[currentTurn];
  const spawnedCoinIDs = currentTurnBase.coinIDs.filter((coinID) => coins[coinID].isSpawned && !coins[coinID].isRetired);
  const movableCoins: ICoin['coinID'][] = yield call(getMovableCoins, dieSum as Rolls);
  const spawnableCoins = bases[currentTurn].coinIDs.filter((coinID) => !coins[coinID].isSpawned && !coins[coinID].isRetired);

  if (canSpawn(roll1, roll2)) {
    // Rolled a spawnable combination - can spawn and will get bonus turn
    if (spawnableCoins.length > 0 || movableCoins.length > 0) {
      yield call(handleRollSpawnable, roll1, roll2, spawnableCoins, movableCoins, spawnedCoinIDs, currentTurnBase);
      // Bonus turn will be handled after action completes (in moveCoinSuccessSaga or spawnCoinSaga)
    } else {
      // Rolled spawnable combination but no valid actions - still get bonus turn
      yield put(invalidateDieRoll());
      yield call(handleBonusTurnAfterSpawnable);
    }
  } else if (roll1 === Rolls.SIX || roll2 === Rolls.SIX) {
    // Rolled a single 6 - can spawn or move, and gets bonus turn
    yield call(handleRollSix, spawnableCoins, movableCoins, spawnedCoinIDs, currentTurnBase);
  } else if (spawnedCoinIDs.length > 0) {
    yield call(handleNonSpawnableRoll, spawnedCoinIDs, movableCoins, dieSum as Rolls, coins);
  } else {
    yield call(handleNoValidMoves);
  }
}

/**
 * Saga that handles bonus turns after spawning a coin
 * If the player rolled a spawnable combination, grant a bonus turn
 */
function * spawnCoinSuccessSaga() {
  // Get the dice values that were used for spawning
  const roll1: ReturnType<typeof currentDieRoll1Selector> = yield select(currentDieRoll1Selector);
  const roll2: ReturnType<typeof currentDieRoll2Selector> = yield select(currentDieRoll2Selector);
  
  // Check if this was a spawnable combination that grants a bonus turn
  if (canSpawn(roll1, roll2)) {
    // Player gets a bonus turn - recalculate highlighting and enable die
    yield put(enableDie());
    
    // Recalculate and highlight reachable cells for the bonus turn
    yield put(clearHighlightedCells());
    const reachableCells: Set<string> = yield call(calculateReachableCells);
    if (reachableCells.size > 0) {
      yield put(setHighlightedCells(reachableCells));
    }
    
    const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
    if (autoActionsEnabled) {
      // Small delay before auto-rolling for the bonus turn
      yield delay(DICE_BONUS_TURN_DELAY);
      // Automatically roll the dice for the bonus turn
      yield put(rollDie());
    }
  } else {
    // Not a spawnable combination - pass turn to next player
    yield put(nextTurn());
    yield put(enableDie());
  }
}

/**
 * Watcher saga that listens for SPAWN_COIN_SUCCESS actions
 * Handles bonus turns after spawning
 */
function * watchForSpawnCoinSuccess() {
  yield takeLatest(LudoActionTypes.SPAWN_COIN_SUCCESS, spawnCoinSuccessSaga);
}

/**
 * Watcher saga that listens for MOVE_COIN_SUCCESS actions
 * Handles automatic die rolling for bonus turns in auto-play mode
 */
function * watchForMoveCoinSuccess() {
  yield takeLatest(LudoActionTypes.MOVE_COIN_SUCCESS, moveCoinSuccessSaga);
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
  
  // In auto-play mode, automatically roll for the new player
  const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
  if (autoActionsEnabled) {
    yield delay(DICE_BONUS_TURN_DELAY);
    yield put(rollDie());
  }
}

/**
 * Saga that handles bonus turns after a successful coin move
 * If the player got a bonus turn (rolled spawnable combination, reached home, or captured), grant bonus turn
 */
function * moveCoinSuccessSaga(action: { type: string; data?: { bonusChance: boolean; coinID: string; currentDieRoll: Rolls } }) {
  const { bonusChance } = action.data!;
  
  if (bonusChance) {
    // Player got a bonus turn - enable die and recalculate highlighting
    yield put(enableDie());
    
    // Recalculate and highlight reachable cells for the bonus turn
    yield put(clearHighlightedCells());
    const reachableCells: Set<string> = yield call(calculateReachableCells);
    if (reachableCells.size > 0) {
      yield put(setHighlightedCells(reachableCells));
    }
    
    // Check if we should auto-roll in auto-play mode
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
 * Array of all dice container sagas to be registered with the Redux store
 * These sagas handle asynchronous dice operations and game logic
 */
export const sagas = [
  watchForRollDie,          // Watches for die roll requests
  watchForRollDieComplete,  // Watches for die roll completions and handles game logic
  watchForSpawnCoinSuccess, // Watches for successful spawns and handles bonus turns
  watchForMoveCoinSuccess,  // Watches for successful moves and handles bonus turns
  watchForPassTurnTo,       // Watches for turn changes and auto-rolls in auto-play mode
];
