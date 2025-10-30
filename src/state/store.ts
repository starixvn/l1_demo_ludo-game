/**
 * Redux Store Configuration
 *
 * Sets up the central Redux store with reducers, middleware, and sagas.
 * Includes Redux DevTools integration and support for batched actions.
 */

import {
  applyMiddleware,
  combineReducers,
  compose,
  createStore,
  Store,
} from 'redux';
import { enableBatching } from 'redux-batched-actions';  // Enables batching multiple actions
import createSagaMiddleware from 'redux-saga';           // Saga middleware for async operations

import { IApplicationState } from './interfaces';         // Global state interface
import { reducers } from './reducers';                    // Combined reducers
import sagas from './sagas';                              // Root saga

/**
 * Redux DevTools composer with tracing enabled for debugging
 * Falls back to regular compose in production or when DevTools not available
 */
const composeEnhancers = typeof window === 'object' && (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
  ? (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
      trace: true,  // Enable action tracing in DevTools
  })
  : compose;

/**
 * Factory function to create and configure the Redux store
 * @returns Configured Redux store instance
 */
export const prepareStore = (): Store<IApplicationState> => {
  // Combine all reducers and enable action batching for performance
  const allReducers = enableBatching(combineReducers({
      ...reducers,
  }));

  // Create saga middleware for handling async operations
  const sagaMiddleware = createSagaMiddleware();
  const middleware = [sagaMiddleware];

  // Apply middleware with DevTools integration
  const enhancer = composeEnhancers(applyMiddleware(...middleware));

  // Create the store with reducers, no preloaded state, and enhancers
  const store: Store<IApplicationState> = createStore(
      allReducers,
      undefined,  // No preloaded state
      enhancer,
  );

  // Start the root saga
  sagaMiddleware.run(sagas);

  return store;
};

// Create the singleton store instance
export const store: Store<IApplicationState> = prepareStore();

// Convenience export for dispatching actions
export const dispatch = store.dispatch;
