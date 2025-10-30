/**
 * StepLogs Container State Management Actions
 *
 * This file defines Redux actions for managing game action logging and auto-play settings.
 * The StepLogs container tracks game events and controls automatic gameplay behavior.
 */

import { IReduxAction } from 'state/interfaces';

import { ILogEntry } from './interfaces';

/**
 * Action Types for StepLogs State Management
 * All action types are prefixed with 'stepLogs/' to avoid conflicts with other containers
 */
export enum ActionTypes {
  ADD_LOG_ENTRY = 'stepLogs/ADD_LOG_ENTRY',                    // Add a new log entry to the game log
  CLEAR_LOGS = 'stepLogs/CLEAR_LOGS',                         // Clear all log entries
  SET_MAX_LOGS = 'stepLogs/SET_MAX_LOGS',                     // Set maximum number of log entries to keep
  SET_AUTO_ACTIONS_ENABLED = 'stepLogs/SET_AUTO_ACTIONS_ENABLED', // Enable/disable automatic actions
  SET_AUTO_ACTION_TIMEOUT = 'stepLogs/SET_AUTO_ACTION_TIMEOUT', // Set timeout for auto-actions in milliseconds
}

/**
 * Action Creators for StepLogs State Management
 */

/**
 * Add a new log entry to the game action log
 * @param entry - Log entry data (id and timestamp are auto-generated)
 */
export const addLogEntry = (entry: Omit<ILogEntry, 'id' | 'timestamp'>): IReduxAction<ActionTypes.ADD_LOG_ENTRY, { entry: Omit<ILogEntry, 'id' | 'timestamp'> }> => ({
  data: { entry },
  type: ActionTypes.ADD_LOG_ENTRY,
});

/**
 * Clear all log entries from the game action log
 */
export const clearLogs = (): IReduxAction<ActionTypes.CLEAR_LOGS, void> => ({
  type: ActionTypes.CLEAR_LOGS,
});

/**
 * Set the maximum number of log entries to keep in memory
 * @param maxLogs - Maximum number of log entries to retain
 */
export const setMaxLogs = (maxLogs: number): IReduxAction<ActionTypes.SET_MAX_LOGS, { maxLogs: number }> => ({
  data: { maxLogs },
  type: ActionTypes.SET_MAX_LOGS,
});

/**
 * Enable or disable automatic actions during gameplay
 * @param enabled - Whether automatic actions should be enabled
 */
export const setAutoActionsEnabled = (enabled: boolean): IReduxAction<ActionTypes.SET_AUTO_ACTIONS_ENABLED, { enabled: boolean }> => ({
  data: { enabled },
  type: ActionTypes.SET_AUTO_ACTIONS_ENABLED,
});

/**
 * Set the timeout duration for automatic actions in milliseconds
 * @param timeout - Timeout duration in milliseconds
 */
export const setAutoActionTimeout = (timeout: number): IReduxAction<ActionTypes.SET_AUTO_ACTION_TIMEOUT, { timeout: number }> => ({
  data: { timeout },
  type: ActionTypes.SET_AUTO_ACTION_TIMEOUT,
});

/**
 * Union type of all possible StepLogs actions
 * Used by the reducer to ensure type safety when handling actions
 */
export type Actions =
  | ReturnType<typeof addLogEntry>
  | ReturnType<typeof clearLogs>
  | ReturnType<typeof setMaxLogs>
  | ReturnType<typeof setAutoActionsEnabled>
  | ReturnType<typeof setAutoActionTimeout>;
