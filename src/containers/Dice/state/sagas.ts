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

import { currentDieRollSelector } from './selectors';

import { enableDie, invalidateDieRoll, rollDieComplete, ActionTypes } from './actions';
import { Rolls } from './interfaces';

function * watchForRollDie() {
  yield takeLatest(ActionTypes.ROLL_DIE, rollDieSaga);
}

function * rollDieSaga() {
  const mt = MersenneTwister19937.autoSeed();
  const dieRoll: Rolls = integer(Rolls.ONE, Rolls.SIX)(mt);
  yield put(rollDieComplete(dieRoll));
}

function * autoChooseAction(spawnableCoins: ICoin['coinID'][], movableCoins: ICoin['coinID'][], currentTurnBase: IBase) {
  const mt = MersenneTwister19937.autoSeed();

  // Randomly choose between spawn and move options
  const availableActions = [];
  if (spawnableCoins.length > 0) availableActions.push('spawn');
  if (movableCoins.length > 0) availableActions.push('move');

  const chosenAction = availableActions[integer(0, availableActions.length - 1)(mt)];

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

function * watchForRollDieComplete() {
  yield takeLatest(ActionTypes.ROLL_DIE_COMPLETE, rollDieCompleteSaga);
}

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

      // Race between user input and 0.2s timeout
      const { timeout } = yield race({
        userAction: take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]),
        timeout: delay(200), // 0.2 seconds
      });

      if (timeout) {
        // Timeout won - auto choose an action
        yield call(autoChooseAction, spawnableCoins, movableCoins, currentTurnBase);
        yield take([LudoActionTypes.SPAWN_COIN_SUCCESS, LudoActionTypes.MOVE_COIN_SUCCESS]);
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
      // Multiple movable coins - wait for user input with timeout
      const { timeout } = yield race({
        userAction: take(LudoActionTypes.MOVE_COIN_SUCCESS),
        timeout: delay(200), // 0.2 seconds
      });

      if (timeout) {
        // Timeout won - auto select a movable coin
        const currentMovableCoins: ICoin['coinID'][] = yield call(getMovableCoins, value);
        if (currentMovableCoins.length > 0) {
          const mt = MersenneTwister19937.autoSeed();
          const randomMoveCoin = currentMovableCoins[integer(0, currentMovableCoins.length - 1)(mt)];
          const coin = coins[randomMoveCoin];
          yield put(moveCoin(randomMoveCoin, coin.position, coin.cellID));
        }
      }
    }
  } else {
    yield put(invalidateDieRoll());
    yield put(nextTurn());
    yield put(enableDie());
  }
}

export const sagas = [
  watchForRollDie,
  watchForRollDieComplete,
];
