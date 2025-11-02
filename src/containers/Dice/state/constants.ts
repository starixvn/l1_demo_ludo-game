/**
 * Dice Container Constants
 *
 * Constants used by the dice functionality, including die face configurations.
 */

/**
 * Die face configurations for each possible roll (1-6)
 * Each array represents the 7 dots on a standard die face:
 * [center, top-left, top-right, middle-left, middle-right, bottom-left, bottom-right]
 * true = dot visible, false = dot hidden
 */
export const CONFIGURATIONS: boolean[][] = [
  [], // Index 0 - not used
  [false, false, false, false, true, false, false], // 1 - center dot
  [false, true, false, false, false, false, true], // 2 - top-right and bottom-left
  [false, true, false, false, true, false, true], // 3 - top-right, center, bottom-left
  [true, false, true, false, false, true, false], // 4 - top-left, top-right, bottom-right, bottom-left
  [true, false, true, false, true, true, false], // 5 - all except middle-left and bottom-left
  [true, true, true, false, false, true, true], // 6 - all except middle positions
];
