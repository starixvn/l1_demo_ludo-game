import { createSelector } from 'reselect';

import { IApplicationState } from 'state/interfaces';

import { IState } from './interfaces';

export const stepLogsStateSelector = (state: IApplicationState): IState => state.stepLogs;

export const logsSelector = createSelector(
  [stepLogsStateSelector],
  (state) => state.logs,
);

export const maxLogsSelector = createSelector(
  [stepLogsStateSelector],
  (state) => state.maxLogs,
);

export const autoActionsEnabledSelector = createSelector(
  [stepLogsStateSelector],
  (state) => state.autoActionsEnabled,
);
