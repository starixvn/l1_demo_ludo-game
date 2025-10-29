import { Actions, ActionTypes } from './actions';
import { ILogEntry, IState } from './interfaces';

const initialState: IState = {
  logs: [],
  maxLogs: 1000, // Increased to store more logs for export
  autoActionsEnabled: true,
  autoActionTimeout: 200, // 0.2 seconds default
};

export const reducer = (state: IState = initialState, action: Actions): IState => {
  switch (action.type) {
    case ActionTypes.ADD_LOG_ENTRY: {
      const { entry } = action.data!;
      const newEntry: ILogEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      };

      const newLogs = [newEntry, ...state.logs];
      // Keep only the last maxLogs entries
      if (newLogs.length > state.maxLogs) {
        newLogs.splice(state.maxLogs);
      }

      return {
        ...state,
        logs: newLogs,
      };
    }
    case ActionTypes.CLEAR_LOGS: {
      return {
        ...state,
        logs: [],
      };
    }
    case ActionTypes.SET_MAX_LOGS: {
      const { maxLogs } = action.data!;
      return {
        ...state,
        maxLogs,
        logs: state.logs.slice(0, maxLogs),
      };
    }
    case ActionTypes.SET_AUTO_ACTIONS_ENABLED: {
      const { enabled } = action.data!;
      return {
        ...state,
        autoActionsEnabled: enabled,
      };
    }
    case ActionTypes.SET_AUTO_ACTION_TIMEOUT: {
      const { timeout } = action.data!;
      return {
        ...state,
        autoActionTimeout: Math.max(50, timeout), // Minimum 50ms
      };
    }
    default:
      return state;
  }
};
