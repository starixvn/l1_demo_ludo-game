/**
 * Root Saga Configuration
 *
 * Combines all feature-specific sagas into a single root saga for Redux-Saga middleware.
 * Each saga handles asynchronous operations for different parts of the application.
 */

import {
  all,
  fork,
} from 'redux-saga/effects';

import { sagas as dieSagas } from 'containers/Dice/state/sagas';     // Dice-related async operations
import { sagas as ludoSagas } from 'containers/Ludo/state/sagas';     // Ludo game async operations

import { ISaga } from './interfaces';

/**
 * Array of all saga functions to be executed by the root saga
 * Spread operator flattens saga arrays from different containers
 */
const sagas: ISaga[] = [
  ...ludoSagas,  // Ludo game logic sagas (coin spawning, movement validation, etc.)
  ...dieSagas,   // Dice sagas (rolling, auto-actions, turn management)
];

/**
 * Root saga generator function
 * Starts all sagas concurrently using fork() and all() effects
 * Each saga runs independently and handles its own domain of async operations
 */
export default function * root() {
  yield all(sagas.map((saga) => fork(saga)));
}
