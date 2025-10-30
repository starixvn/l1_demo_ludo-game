/**
 * Dice Container State Reducer
 *
 * Manages the state of the die in the Ludo game, controlling when players can roll
 * and tracking the validity of die rolls for movement.
 */

import { Actions, ActionTypes } from './actions';
import { IState, Rolls } from './interfaces';

/**
 * Initial state for the dice container
 * Die starts enabled but with no valid roll
 */
const initialState: IState = {
  isDieRollAllowed: true,  // Die can be rolled initially
  isDieRollValid: false,   // No roll has been made yet
  roll: Rolls.ONE,         // Default roll value
};

/**
 * Reducer function for dice state management
 * @param state - Current dice state
 * @param action - Action to process
 * @returns New dice state
 */
export const reducer = (state: IState = initialState, action: Actions): IState => {
  switch (action.type) {
    /**
     * Die roll has completed - update the roll value and mark it as valid
     * Disable further rolling until the current roll is used or turn passes
     */
    case ActionTypes.ROLL_DIE_COMPLETE: {
      return {
        ...state,
        isDieRollAllowed: false, // Can't roll again until turn advances
        isDieRollValid: true,    // This roll can be used for moves
        roll: action.data!.value, // Set the rolled value
      };
    }

    /**
     * Enable the die for rolling (when it becomes player's turn)
     */
    case ActionTypes.ENABLE_DIE: {
      return {
        ...state,
        isDieRollAllowed: true, // Allow rolling
      };
    }

    /**
     * Disable the die (after rolling or when turn passes)
     */
    case ActionTypes.DISABLE_DIE: {
      return {
        ...state,
        isDieRollAllowed: false, // Prevent rolling
      };
    }

    /**
     * Mark the current die roll as used/invalid
     * Prevents using the same roll for multiple moves
     */
    case ActionTypes.INVALIDATE_DIE_ROLL: {
      return {
        ...state,
        isDieRollValid: false, // Roll has been used
      };
    }
    default:
      return state;
  }
}
