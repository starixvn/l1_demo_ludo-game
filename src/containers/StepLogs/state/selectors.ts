/**
 * StepLogs Container Selectors
 *
 * Reselect selectors for efficiently accessing StepLogs state from the Redux store.
 * These selectors are memoized for performance and used throughout the application.
 */

import { createSelector } from 'reselect';

import { IApplicationState } from 'state/interfaces';

import { IState } from './interfaces';

/** Base selector for accessing the StepLogs state slice */
export const stepLogsStateSelector = (state: IApplicationState): IState => state.stepLogs;

/** Selector for the current game action logs */
export const logsSelector = createSelector(
  [stepLogsStateSelector],
  (state) => state.logs,
);

/** Selector for the maximum number of logs to keep */
export const maxLogsSelector = createSelector(
  [stepLogsStateSelector],
  (state) => state.maxLogs,
);

/** Selector for whether automatic actions are enabled */
export const autoActionsEnabledSelector = createSelector(
  [stepLogsStateSelector],
  (state) => state.autoActionsEnabled,
);

/** Selector for the timeout duration for automatic actions */
export const autoActionTimeoutSelector = createSelector(
  [stepLogsStateSelector],
  (state) => state.autoActionTimeout,
);
