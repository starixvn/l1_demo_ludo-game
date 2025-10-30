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
  ActionTypes as LudoActionTypes,
} from 'containers/Ludo/state/actions';
import { IBase, ICoin } from 'containers/Ludo/state/interfaces';
import { getMovableCoins } from 'containers/Ludo/state/sagas';
import { basesSelector, coinsSelector, currentTurnSelector } from 'containers/Ludo/state/selectors';
import { addLogEntry } from 'containers/StepLogs/state/actions';
import { autoActionsEnabledSelector, autoActionTimeoutSelector } from 'containers/StepLogs/state/selectors';

import { currentDieRollSelector } from './selectors';

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
 * Generates a random die roll and logs the action
 */
function * rollDieSaga() {
  // Generate random die roll using Mersenne Twister for better randomness
  const mt = MersenneTwister19937.autoSeed();
  const dieRoll: Rolls = integer(Rolls.ONE, Rolls.SIX)(mt);

  // Get current player info for logging
  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const playerColor = bases[currentTurn].color;

  // Log the die roll action
  yield put(addLogEntry({
    player: playerColor,
    action: `Rolled ${dieRoll}`,
    details: `Dice roll: ${dieRoll}`,
  }));

  // Dispatch the roll completion action
  yield put(rollDieComplete(dieRoll));
}

/**
 * Automatically chooses and executes an action when the player doesn't respond in time
 * @param spawnableCoins - Array of coin IDs that can be spawned
 * @param movableCoins - Array of coin IDs that can be moved
 * @param currentTurnBase - The current player's base information
 */
function * autoChooseAction(spawnableCoins: ICoin['coinID'][], movableCoins: ICoin['coinID'][], currentTurnBase: IBase) {
  const mt = MersenneTwister19937.autoSeed();

  // Determine available actions based on game state
  const availableActions = [];
  if (spawnableCoins.length > 0) availableActions.push('spawn');
  if (movableCoins.length > 0) availableActions.push('move');

  // Randomly select an action
  const chosenAction = availableActions[integer(0, availableActions.length - 1)(mt)];

  // Log the automatic action choice
  yield put(addLogEntry({
    player: currentTurnBase.color,
    action: 'Auto-action',
    details: `Automatically chose to ${chosenAction}`,
  }));

  if (chosenAction === 'spawn') {
    // Double-check that there are still spawnable coins
    const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
    const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
    const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
    const currentSpawnableCoins = bases[currentTurn].coinIDs.filter((coinID) => !coins[coinID].isSpawned && !coins[coinID].isRetired);

    if (currentSpawnableCoins.length > 0) {
      const randomSpawnCoin = currentSpawnableCoins[integer(0, currentSpawnableCoins.length - 1)(mt)];
      yield put(spawnCoin(currentTurnBase.ID, randomSpawnCoin));
    } else {
      // Fallback to move if no spawnable coins
      const currentMovableCoins: ICoin['coinID'][] = yield call(getMovableCoins, yield select(currentDieRollSelector));
      if (currentMovableCoins.length > 0) {
        const randomMoveCoin = currentMovableCoins[integer(0, currentMovableCoins.length - 1)(mt)];
        const coin = coins[randomMoveCoin];
        yield put(moveCoin(randomMoveCoin, coin.position, coin.cellID));
      }
    }
  } else {
    // Double-check that the selected coin is still movable before dispatching
    const currentMovableCoins: ICoin['coinID'][] = yield call(getMovableCoins, yield select(currentDieRollSelector));
    if (currentMovableCoins.length > 0) {
      const randomMoveCoin = currentMovableCoins[integer(0, currentMovableCoins.length - 1)(mt)];
      const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
      const coin = coins[randomMoveCoin];
      yield put(moveCoin(randomMoveCoin, coin.position, coin.cellID));
    } else {
      // Fallback to spawn if no movable coins
      const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
      const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
      const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
      const currentSpawnableCoins = bases[currentTurn].coinIDs.filter((coinID) => !coins[coinID].isSpawned && !coins[coinID].isRetired);

      if (currentSpawnableCoins.length > 0) {
        const randomSpawnCoin = currentSpawnableCoins[integer(0, currentSpawnableCoins.length - 1)(mt)];
        yield put(spawnCoin(currentTurnBase.ID, randomSpawnCoin));
      }
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
 * Main saga that handles what happens after a die roll is complete
 * Implements the core Ludo game logic for turn progression and auto-actions
 * @param action - The roll die complete action with the rolled value
 */
function * rollDieCompleteSaga(action: ReturnType<typeof rollDieComplete>) {
  const { value } = action.data!;
  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
  const coins: ReturnType<typeof coinsSelector> = yield select(coinsSelector);
  const currentTurnBase = bases[currentTurn];
  const spawnedCoinIDs = currentTurnBase.coinIDs.filter((coinID) => coins[coinID].isSpawned && !coins[coinID].isRetired);
  const movableCoins: ICoin['coinID'][] = yield call(getMovableCoins, value);
  const spawnableCoins = bases[currentTurn].coinIDs.filter((coinID) => !coins[coinID].isSpawned && !coins[coinID].isRetired);
  if (value === Rolls.SIX && (spawnableCoins.length > 0 || movableCoins.length > 0)) {
    if ((spawnedCoinIDs.length === 0 || movableCoins.length === 0) && spawnableCoins.length > 0) {
      yield put(spawnCoin(currentTurnBase.ID, spawnableCoins[0]));
      yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
    } else {
      yield put(markCurrentBase(true));

      // Check if auto-actions are enabled
      const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);

      if (autoActionsEnabled) {
        // Race between user input and configurable timeout
        const timeoutDuration: ReturnType<typeof autoActionTimeoutSelector> = yield select(autoActionTimeoutSelector);
        const { timeout } = yield race({
          userAction: take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]),
          timeout: delay(timeoutDuration),
        });

        if (timeout) {
          // Timeout won - auto choose an action
          yield call(autoChooseAction, spawnableCoins, movableCoins, currentTurnBase);
          yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
        }
      } else {
        // Auto-actions disabled - wait for user input or auto-actions being re-enabled
        while (true) {
          const action = yield take([
            LudoActionTypes.SPAWN_COIN_SUCCESS,
            LudoActionTypes.MOVE_COIN_SUCCESS,
            StepLogsActionTypes.SET_AUTO_ACTIONS_ENABLED
          ]);

          if (action.type === StepLogsActionTypes.SET_AUTO_ACTIONS_ENABLED) {
            // Check if auto-actions are now enabled
            const newAutoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
            if (newAutoActionsEnabled) {
              // Auto-actions were re-enabled - start the timeout
              const timeoutDuration: ReturnType<typeof autoActionTimeoutSelector> = yield select(autoActionTimeoutSelector);
              const { timeout } = yield race({
                userAction: take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]),
                timeout: delay(timeoutDuration),
              });

              if (timeout) {
                // Timeout won - auto choose an action
                yield call(autoChooseAction, spawnableCoins, movableCoins, currentTurnBase);
                yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
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

      yield put(markCurrentBase(false));
    }
    yield put(enableDie());
  } else if (spawnedCoinIDs.length > 0) {
    // Automove if only one coin is spawned
    if (spawnedCoinIDs.length === 1) {
      const coinID = spawnedCoinIDs[0];
      const coin = coins[coinID];
      yield put(moveCoin(coinID, coin.position, coin.cellID));
    } else if (movableCoins.length === 1) {
      const coinID = movableCoins[0];
      const coin = coins[coinID];
      yield put(moveCoin(coinID, coin.position, coin.cellID));
    } else if (movableCoins.length > 1) {
      // Check if auto-actions are enabled
      const autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);

      if (autoActionsEnabled) {
        // Multiple movable coins - wait for user input with timeout
        const timeoutDuration: ReturnType<typeof autoActionTimeoutSelector> = yield select(autoActionTimeoutSelector);
        const { timeout } = yield race({
          userAction: take(LudoActionTypes.MOVE_COIN_SUCCESS),
          timeout: delay(timeoutDuration),
        });

        if (timeout) {
          // Timeout won - auto select a movable coin
          const currentMovableCoins: ICoin['coinID'][] = yield call(getMovableCoins, value);
          if (currentMovableCoins.length > 0) {
            const mt = MersenneTwister19937.autoSeed();
            const randomMoveCoin = currentMovableCoins[integer(0, currentMovableCoins.length - 1)(mt)];
            const coin = coins[randomMoveCoin];
            const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
            const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
            const playerColor = bases[currentTurn].color;

            yield put(addLogEntry({
              player: playerColor,
              action: 'Auto-moved coin',
              details: `Automatically moved coin ${randomMoveCoin.split('_')[1]} ${value} spaces`,
            }));

            yield put(moveCoin(randomMoveCoin, coin.position, coin.cellID));
          }
        }
      } else {
        // Auto-actions disabled - wait for user input or auto-actions being re-enabled
        while (true) {
          const action = yield take([
            LudoActionTypes.MOVE_COIN_SUCCESS,
            StepLogsActionTypes.SET_AUTO_ACTIONS_ENABLED
          ]);

          if (action.type === StepLogsActionTypes.SET_AUTO_ACTIONS_ENABLED) {
            // Check if auto-actions are now enabled
            const newAutoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector> = yield select(autoActionsEnabledSelector);
            if (newAutoActionsEnabled) {
              // Auto-actions were re-enabled - start the timeout
              const timeoutDuration: ReturnType<typeof autoActionTimeoutSelector> = yield select(autoActionTimeoutSelector);
              const { timeout } = yield race({
                userAction: take(LudoActionTypes.MOVE_COIN_SUCCESS),
                timeout: delay(timeoutDuration),
              });

              if (timeout) {
                // Timeout won - auto select a movable coin
                const currentMovableCoins: ICoin['coinID'][] = yield call(getMovableCoins, value);
                if (currentMovableCoins.length > 0) {
                  const mt = MersenneTwister19937.autoSeed();
                  const randomMoveCoin = currentMovableCoins[integer(0, currentMovableCoins.length - 1)(mt)];
                  const coin = coins[randomMoveCoin];
                  const currentTurn: ReturnType<typeof currentTurnSelector> = yield select(currentTurnSelector);
                  const bases: ReturnType<typeof basesSelector> = yield select(basesSelector);
                  const playerColor = bases[currentTurn].color;

                  yield put(addLogEntry({
                    player: playerColor,
                    action: 'Auto-moved coin',
                    details: `Automatically moved coin ${randomMoveCoin.split('_')[1]} ${value} spaces`,
                  }));

                  yield put(moveCoin(randomMoveCoin, coin.position, coin.cellID));
                }
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
    }
  } else {
    yield put(invalidateDieRoll());
    yield put(nextTurn());
    yield put(enableDie());
  }
}

/**
 * Array of all dice container sagas to be registered with the Redux store
 * These sagas handle asynchronous dice operations and game logic
 */
export const sagas = [
  watchForRollDie,          // Watches for die roll requests
  watchForRollDieComplete,  // Watches for die roll completions and handles game logic
];
