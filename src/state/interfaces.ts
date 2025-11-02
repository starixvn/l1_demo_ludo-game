/**
 * Global Application Types and Enums
 *
 * Defines common types and enumerations used throughout the Ludo game application.
 * These are shared constants and types that don't belong to any specific module.
 */

/**
 * Available colors for player bases in the Ludo game
 * Each color represents a different player
 */
export enum BaseColors {
  RED = 'RED',      // Player 1
  GREEN = 'GREEN',  // Player 2
  BLUE = 'BLUE',    // Player 3
  YELLOW = 'YELLOW', // Player 4
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
