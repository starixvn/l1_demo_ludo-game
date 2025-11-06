/**
 * Dice Container State Management Actions
 *
 * This file defines Redux actions for the dice functionality in the Ludo game.
 * The dice controls player movement and determines when players can spawn horses.
 */

import { IReduxAction } from 'state/interfaces';

import { Rolls } from './interfaces';

/**
 * Action Types for Dice State Management
 * All action types are prefixed with 'die/' to avoid conflicts
 */
export enum ActionTypes {
  ROLL_DIE = 'die/ROLL_DIE',                    // Request to roll the die
  ROLL_DIE_COMPLETE = 'die/ROLL_DIE_COMPLETE',   // Die roll completed with result
  ENABLE_DIE = 'die/ENABLE_DIE',                 // Enable die for rolling (player's turn)
  DISABLE_DIE = 'die/DISABLE_DIE',               // Disable die (not player's turn)
  INVALIDATE_DIE_ROLL = 'die/INVALIDATE_DIE_ROLL', // Mark current roll as invalid/used
  START_ROLLING = 'die/START_ROLLING',           // Start dice rolling animation
  STOP_ROLLING = 'die/STOP_ROLLING',             // Stop dice rolling animation
}

/**
 * Action Creators for Dice State Management
 */

/**
 * Request to roll the die - initiates the dice rolling animation/sequence
 */
export const rollDie = (): IReduxAction<ActionTypes.ROLL_DIE, void> => ({
  type: ActionTypes.ROLL_DIE,
});

/**
 * Action dispatched when the dice roll is complete
 * @param roll1 - The final value shown on the first die (1-6)
 * @param roll2 - The final value shown on the second die (1-6)
 */
export const rollDieComplete = (roll1: Rolls, roll2: Rolls): IReduxAction<ActionTypes.ROLL_DIE_COMPLETE, { roll1: Rolls; roll2: Rolls }> => ({
  data: { roll1, roll2 },
  type: ActionTypes.ROLL_DIE_COMPLETE,
});

/**
 * Enable the die for rolling (when it becomes the player's turn)
 */
export const enableDie = (): IReduxAction<ActionTypes.ENABLE_DIE, void> => ({
  type: ActionTypes.ENABLE_DIE,
});

/**
 * Disable the die (when it's not the player's turn or after rolling)
 */
export const disableDie = (): IReduxAction<ActionTypes.DISABLE_DIE, void> => ({
  type: ActionTypes.DISABLE_DIE,
});

/**
 * Mark the current die roll as invalid/used (prevents using the same roll twice)
 */
export const invalidateDieRoll = (): IReduxAction<ActionTypes.INVALIDATE_DIE_ROLL, void> => ({
  type: ActionTypes.INVALIDATE_DIE_ROLL,
});

/**
 * Start the dice rolling animation
 */
export const startRolling = (): IReduxAction<ActionTypes.START_ROLLING, void> => ({
  type: ActionTypes.START_ROLLING,
});

/**
 * Stop the dice rolling animation
 */
export const stopRolling = (): IReduxAction<ActionTypes.STOP_ROLLING, void> => ({
  type: ActionTypes.STOP_ROLLING,
});

/**
 * Union type of all possible dice actions
 * Used by the reducer to ensure type safety when handling dice-related actions
 */
export type Actions =
  | ReturnType<typeof rollDie>
  | ReturnType<typeof rollDieComplete>
  | ReturnType<typeof enableDie>
  | ReturnType<typeof disableDie>
  | ReturnType<typeof invalidateDieRoll>
  | ReturnType<typeof startRolling>
  | ReturnType<typeof stopRolling>
  ;
