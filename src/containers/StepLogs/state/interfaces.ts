/**
 * StepLogs Container Interfaces
 *
 * Defines the data structures for game action logging and auto-play settings.
 * Used to track game events, display them to users, and control automatic gameplay.
 */

/**
 * Represents a single logged game action or event
 * Used to track and display the history of game moves and events
 */
export interface ILogEntry {
  /** Unique identifier for this log entry */
  id: string;
  /** Unix timestamp when the action occurred */
  timestamp: number;
  /** Color/name of the player who performed the action */
  player: string;
  /** Brief description of the action (e.g., "Rolled 6", "Moved coin") */
  action: string;
  /** Optional detailed information about the action */
  details?: string;
  /** Whether this log entry should be visually highlighted */
  highlight?: boolean;
}

/**
 * State structure for the StepLogs container
 * Manages game action history and auto-play configuration
 */
export interface IState {
  /** Array of logged game actions, ordered by timestamp (newest first) */
  logs: ILogEntry[];
  /** Maximum number of log entries to keep in memory */
  maxLogs: number;
  /** Whether automatic actions are enabled during gameplay */
  autoActionsEnabled: boolean;
  /** Timeout in milliseconds before auto-actions are triggered */
  autoActionTimeout: number; // in milliseconds
}
