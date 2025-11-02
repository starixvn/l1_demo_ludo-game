/**
 * StepLogs Container Zustand Store
 *
 * Zustand store for StepLogs state management, replacing Redux.
 * Handles game action logging and auto-play settings.
 */

import create from "zustand";

import { ILogEntry, IState } from "./interfaces";

interface StepLogsState extends IState {
  // Actions
  addLogEntry: (entry: Omit<ILogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;
  setMaxLogs: (maxLogs: number) => void;
  setAutoActionsEnabled: (enabled: boolean) => void;
  setAutoActionTimeout: (timeout: number) => void;
}

/**
 * Initial state for the StepLogs store
 */
const initialState: Omit<
  StepLogsState,
  | "addLogEntry"
  | "clearLogs"
  | "setMaxLogs"
  | "setAutoActionsEnabled"
  | "setAutoActionTimeout"
> = {
  logs: [], // Start with empty log history
  maxLogs: 1000, // Store up to 1000 log entries (increased for export)
  autoActionsEnabled: true, // Enable automatic actions by default
  autoActionTimeout: 200, // Default 200ms timeout for auto-actions
};

/**
 * StepLogs Zustand store
 * Manages game action logging and auto-play configuration
 */
export const stepLogsStore = create<StepLogsState>((set, get) => ({
  ...initialState,

  /**
   * Add a new log entry to the game action log
   */
  addLogEntry: (entry: Omit<ILogEntry, "id" | "timestamp">) => {
    set((state: StepLogsState) => {
      // Create complete log entry with generated ID and timestamp
      const newEntry: ILogEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random()}`, // Unique ID using timestamp + random
        timestamp: Date.now(), // Current timestamp
      };

      // Add new entry to beginning of logs array (most recent first)
      const newLogs = [newEntry, ...state.logs];

      // Limit log entries to prevent memory issues
      if (newLogs.length > state.maxLogs) {
        newLogs.splice(state.maxLogs); // Remove oldest entries beyond limit
      }

      return {
        logs: newLogs,
      };
    });
  },

  /**
   * Clear all log entries from the game action log
   */
  clearLogs: () => {
    set({ logs: [] });
  },

  /**
   * Set the maximum number of log entries to keep
   */
  setMaxLogs: (maxLogs: number) => {
    set((state: StepLogsState) => ({
      maxLogs,
      logs: state.logs.slice(0, maxLogs), // Trim logs if necessary
    }));
  },

  /**
   * Enable or disable automatic actions during gameplay
   */
  setAutoActionsEnabled: (enabled: boolean) => {
    set({ autoActionsEnabled: enabled });
  },

  /**
   * Set the timeout duration for automatic actions
   */
  setAutoActionTimeout: (timeout: number) => {
    set({ autoActionTimeout: Math.max(50, timeout) }); // Minimum 50ms timeout
  },
}));

/**
 * Selectors for accessing StepLogs state
 */
export const stepLogsSelectors = {
  getLogs: () => stepLogsStore.getState().logs,
  getMaxLogs: () => stepLogsStore.getState().maxLogs,
  getAutoActionsEnabled: () => stepLogsStore.getState().autoActionsEnabled,
  getAutoActionTimeout: () => stepLogsStore.getState().autoActionTimeout,
};

/**
 * Hook for using StepLogs selectors in components
 */
export const useStepLogsSelectors = () => ({
  logs: stepLogsSelectors.getLogs(),
  maxLogs: stepLogsSelectors.getMaxLogs(),
  autoActionsEnabled: stepLogsSelectors.getAutoActionsEnabled(),
  autoActionTimeout: stepLogsSelectors.getAutoActionTimeout(),
});
