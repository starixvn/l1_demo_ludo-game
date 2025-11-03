/**
 * StepLogs Container State Reducer
 *
 * Manages the state for game action logging and auto-play settings.
 * Handles adding log entries, clearing logs, and configuring auto-play behavior.
 */

import { AUTO_ACTION_TIMEOUT } from 'globalConstants';

import { Actions, ActionTypes } from './actions';
import { ILogEntry, IState } from './interfaces';

/**
 * Initial state for the StepLogs container
 * Sets up default values for logging and auto-play settings
 */
const initialState: IState = {
  logs: [],                      // Start with empty log history
  maxLogs: 1000,                // Store up to 1000 log entries (increased for export)
  autoActionsEnabled: false,     // Disable automatic actions by default
  autoActionTimeout: AUTO_ACTION_TIMEOUT,       // Default timeout for auto-actions from globalConstants
};

/**
 * Main reducer function for StepLogs state management
 * @param state - Current StepLogs state
 * @param action - Action to process
 * @returns New StepLogs state after applying the action
 */
export const reducer = (state: IState = initialState, action: Actions): IState => {
  switch (action.type) {
    /**
     * Add a new log entry to the game action log
     * Generates a unique ID and timestamp for the entry
     */
    case ActionTypes.ADD_LOG_ENTRY: {
      const { entry } = action.data!;

      // Create complete log entry with generated ID and timestamp
      const newEntry: ILogEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random()}`, // Unique ID using timestamp + random
        timestamp: Date.now(),                 // Current timestamp
      };

      // Add new entry to beginning of logs array (most recent first)
      const newLogs = [newEntry, ...state.logs];

      // Limit log entries to prevent memory issues
      if (newLogs.length > state.maxLogs) {
        newLogs.splice(state.maxLogs); // Remove oldest entries beyond limit
      }

      return {
        ...state,
        logs: newLogs,
      };
    }

    /**
     * Clear all log entries from the game action log
     */
    case ActionTypes.CLEAR_LOGS: {
      return {
        ...state,
        logs: [], // Reset to empty array
      };
    }

    /**
     * Set the maximum number of log entries to keep
     * Also trims existing logs if they exceed the new limit
     */
    case ActionTypes.SET_MAX_LOGS: {
      const { maxLogs } = action.data!;
      return {
        ...state,
        maxLogs,                      // Update the limit
        logs: state.logs.slice(0, maxLogs), // Trim logs if necessary
      };
    }

    /**
     * Enable or disable automatic actions during gameplay
     */
    case ActionTypes.SET_AUTO_ACTIONS_ENABLED: {
      const { enabled } = action.data!;
      return {
        ...state,
        autoActionsEnabled: enabled, // Update auto-actions setting
      };
    }

    /**
     * Set the timeout duration for automatic actions
     * Enforces a minimum timeout of 50ms to prevent too rapid actions
     */
    case ActionTypes.SET_AUTO_ACTION_TIMEOUT: {
      const { timeout } = action.data!;
      return {
        ...state,
        autoActionTimeout: Math.max(50, timeout), // Minimum 50ms timeout
      };
    }
    default:
      return state;
  }
};
