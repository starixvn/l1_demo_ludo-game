/**
 * Dice Container State Management Actions
 *
 * This file defines Redux actions for the dice functionality in the Ludo game.
 * The dice controls player movement and determines when players can spawn coins.
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
 * Action dispatched when the die roll is complete
 * @param value - The final value shown on the die (1-6)
 */
export const rollDieComplete = (value: Rolls): IReduxAction<ActionTypes.ROLL_DIE_COMPLETE, { value: Rolls }> => ({
  data: { value },
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
 * Union type of all possible dice actions
 * Used by the reducer to ensure type safety when handling dice-related actions
 */
export type Actions =
  | ReturnType<typeof rollDie>
  | ReturnType<typeof rollDieComplete>
  | ReturnType<typeof enableDie>
  | ReturnType<typeof disableDie>
  | ReturnType<typeof invalidateDieRoll>
  ;
