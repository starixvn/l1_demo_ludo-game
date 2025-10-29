import { IReduxAction } from 'state/interfaces';

import { ILogEntry } from './interfaces';

export enum ActionTypes {
  ADD_LOG_ENTRY = 'stepLogs/ADD_LOG_ENTRY',
  CLEAR_LOGS = 'stepLogs/CLEAR_LOGS',
  SET_MAX_LOGS = 'stepLogs/SET_MAX_LOGS',
  SET_AUTO_ACTIONS_ENABLED = 'stepLogs/SET_AUTO_ACTIONS_ENABLED',
  SET_AUTO_ACTION_TIMEOUT = 'stepLogs/SET_AUTO_ACTION_TIMEOUT',
}

export const addLogEntry = (entry: Omit<ILogEntry, 'id' | 'timestamp'>): IReduxAction<ActionTypes.ADD_LOG_ENTRY, { entry: Omit<ILogEntry, 'id' | 'timestamp'> }> => ({
  data: { entry },
  type: ActionTypes.ADD_LOG_ENTRY,
});

export const clearLogs = (): IReduxAction<ActionTypes.CLEAR_LOGS, void> => ({
  type: ActionTypes.CLEAR_LOGS,
});

export const setMaxLogs = (maxLogs: number): IReduxAction<ActionTypes.SET_MAX_LOGS, { maxLogs: number }> => ({
  data: { maxLogs },
  type: ActionTypes.SET_MAX_LOGS,
});

export const setAutoActionsEnabled = (enabled: boolean): IReduxAction<ActionTypes.SET_AUTO_ACTIONS_ENABLED, { enabled: boolean }> => ({
  data: { enabled },
  type: ActionTypes.SET_AUTO_ACTIONS_ENABLED,
});

export const setAutoActionTimeout = (timeout: number): IReduxAction<ActionTypes.SET_AUTO_ACTION_TIMEOUT, { timeout: number }> => ({
  data: { timeout },
  type: ActionTypes.SET_AUTO_ACTION_TIMEOUT,
});

export type Actions =
  | ReturnType<typeof addLogEntry>
  | ReturnType<typeof clearLogs>
  | ReturnType<typeof setMaxLogs>
  | ReturnType<typeof setAutoActionsEnabled>
  | ReturnType<typeof setAutoActionTimeout>;
