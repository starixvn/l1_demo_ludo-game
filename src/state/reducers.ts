/**
 * Global Reducer Composition
 *
 * Combines all feature-specific reducers into a single object for Redux store configuration.
 * Each reducer manages a specific slice of the application state.
 */

import { NAME as dieReducerNAME } from 'containers/Dice/state/constants';
import { reducer as dieReducer } from 'containers/Dice/state/reducer';
import { NAME as ludoReducerName } from 'containers/Ludo/state/constants';
import { reducer as ludoReducer } from 'containers/Ludo/state/reducer';
import { NAME as stepLogsReducerName } from 'containers/StepLogs/state/constants';
import { reducer as stepLogsReducer } from 'containers/StepLogs/state/reducer';

/**
 * Combined reducers object for Redux store
 * Each key represents a state slice, and the value is the corresponding reducer function
 */
export const reducers = {
  [ludoReducerName]: ludoReducer,              // Main Ludo game state (horses, bases, cells)
  [dieReducerNAME]: dieReducer,                 // Dice rolling and turn management
  [stepLogsReducerName]: stepLogsReducer,       // Game action logging and auto-play settings
};
