/**
 * Global Application State Interfaces
 *
 * Defines the overall structure of the Redux application state and common types
 * used throughout the Ludo game application.
 */

import { ForkEffect } from 'redux-saga/effects';

import { IState as IDiceState } from 'containers/Dice/state/interfaces';
import { IState as ILudoState } from 'containers/Ludo/state/interfaces';
import { IState as IStepLogsState } from 'containers/StepLogs/state/interfaces';

/**
 * Available colors for player bases in the Ludo game
 * Each color represents a different player
 */
export enum BaseColors {
  RED = 'RED',      // Player 1
  GREEN = 'GREEN',  // Player 2
  BLUE = 'BLUE',    // Player 3
  YELLOW = 'YELLOW', // Player 4
  DEFAULT = 'WHITE'
}

/**
 * Cardinal directions representing positions on the Ludo board
 * Used for walkway positioning and cell orientation
 */
export enum WalkwayPosition {
  NORTH = 'NORTH',  // Top side of board
  EAST = 'EAST',    // Right side of board
  WEST = 'WEST',    // Left side of board
  SOUTH = 'SOUTH',  // Bottom side of board
}

/**
 * Complete application state structure
 * Contains state slices for all major features of the Ludo game
 */
export interface IApplicationState {
  ludo: ILudoState;           // Main Ludo game state (horses, bases, cells)
  dice: IDiceState;           // Dice rolling and turn management state
  stepLogs: IStepLogsState;   // Game action logging and auto-play settings
}

/**
 * Generic Redux action interface
 * All actions in the app follow this structure
 */
export interface IReduxAction<T = any, D = any> {
  type: T;      // Action type string
  data?: D;     // Optional payload data
}

/**
 * Saga function interface
 * Defines the shape of Redux-Saga generator functions
 */
export interface ISaga {
  (): IterableIterator<ForkEffect>; // Generator function that yields ForkEffects
}
