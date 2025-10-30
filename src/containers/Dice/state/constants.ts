/**
 * Dice Container Constants
 *
 * Contains visual configurations and constants for dice rendering and gameplay.
 */

import { Rolls } from './interfaces';

/** Redux state slice name for the dice container */
export const NAME = 'dice';

/**
 * Visual dot configurations for each die face
 * Each array represents a 3x3 grid where 1 = dot present, 0 = empty
 * Used for rendering the dice UI component
 */
export const CONFIGURATIONS: { [key: number]: number[] } = {
  [Rolls.ONE]: [  // Single dot in center
    0, 0, 0,
    0, 1, 0,
    0, 0, 0,
  ],
  [Rolls.TWO]: [  // Two dots in diagonal corners
    0, 0, 1,
    0, 0, 0,
    1, 0, 0,
  ],
  [Rolls.THREE]: [ // Three dots forming diagonal
    0, 0, 1,
    0, 1, 0,
    1, 0, 0,
  ],
  [Rolls.FOUR]: [ // Four dots in corners
    1, 0, 1,
    0, 0, 0,
    1, 0, 1,
  ],
  [Rolls.FIVE]: [ // Five dots (four corners + center)
    1, 0, 1,
    0, 1, 0,
    1, 0, 1,
  ],
  [Rolls.SIX]: [ // Six dots (two rows of three)
    1, 1, 1,
    0, 0, 0,
    1, 1, 1,
  ],
};

/** Array of all possible die roll values for random selection */
export const allPossibleRolls = [Rolls.ONE, Rolls.TWO, Rolls.THREE, Rolls.FOUR, Rolls.FIVE, Rolls.SIX];
