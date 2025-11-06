/**
 * Dice Container Data Structures
 *
 * Defines the possible die roll values and the state structure for the dice functionality.
 */

/**
 * Enumeration of possible die roll values in Ludo
 * Standard six-sided die with values 1-6
 */
export enum Rolls {
  ONE = 1,   // Die shows 1
  TWO = 2,   // Die shows 2
  THREE = 3, // Die shows 3
  FOUR = 4,  // Die shows 4
  FIVE = 5,  // Die shows 5
  SIX = 6,   // Die shows 6 (allows spawning horses)
}

/**
 * State structure for the dice container
 * Tracks the current die rolls and their validity for use in the game
 */
export interface IState {
  /** The current value shown on the first die */
  roll1: Rolls;
  /** The current value shown on the second die */
  roll2: Rolls;
  /** Whether the player is allowed to roll the dice (their turn and no pending moves) */
  isDieRollAllowed: boolean;
  /** Whether the current die roll is still valid for making moves */
  isDieRollValid: boolean;
  /** Whether the dice is currently rolling (animating) */
  isRolling: boolean;
}
