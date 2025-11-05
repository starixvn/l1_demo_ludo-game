import { BaseColors } from 'state/interfaces';
import { BaseID } from 'containers/Ludo/state/interfaces';

// Base size constants (in cells)
export const UNIT_SIZE = 1;                                   // Base unit size: 1 cell
export const WALKWAY_ROW_COUNT = 7;                           // Number of rows/columns in walkway (WALKWAY_LENGTH and BASE_SIZE both use this)
export const WALKWAY_COLUMN_COUNT = 3;                        // Number of columns/rows in walkway (WALKWAY_WIDTH and HOME_SIZE both use this)
export const INNER_BASE_DIMENSION = 4;                        // Inner base dimension (INNER_BASE_SIZE)
export const COIN_PLACEHOLDER_DIMENSION = 2;                  // Coin placeholder dimension

// Pixel dimensions
export const CELL_DIMENSION = 40;                             // Pixels per cell
export const BOARD_SIZE = 15;                                 // Cells (increased to accommodate 7 columns in both WEST and EAST walkways)
export const BOARD_DIMENSION = CELL_DIMENSION * BOARD_SIZE;   // Pixels (680px × 680px)

// Size constants mapped to base constants (for backward compatibility and semantic clarity)
export const CELL_SIZE = UNIT_SIZE;                           // Size of a single cell (1)
export const COIN_SIZE = UNIT_SIZE;                           // Size of a coin (1)
export const DICE_SIZE = UNIT_SIZE;                           // Size of a die (1)

export const BASE_SIZE = WALKWAY_ROW_COUNT - 1;                   // Base size (7) - same as walkway length
export const WALKWAY_LENGTH = WALKWAY_ROW_COUNT;              // Walkway length (7)
export const WALKWAY_WIDTH = WALKWAY_COLUMN_COUNT;           // Walkway width (3)
export const WALKWAY_VERTICAL_HEIGHT = WALKWAY_ROW_COUNT - 1; // Vertical walkway height for NORTH/SOUTH (6)
export const HOME_SIZE = WALKWAY_COLUMN_COUNT;                // Home size (3) - same as walkway width
export const INNER_BASE_SIZE = INNER_BASE_DIMENSION;         // Inner base size (4)
export const COIN_PLACEHOLDER_SIZE = COIN_PLACEHOLDER_DIMENSION; // Coin placeholder size (2)

// Game rules
export const WINNING_MOVES = 56;
export const DEFAULT_STARTING_BASE = BaseID.BASE_3; // Default base that starts the game (BLUE player)
export const BASE_COLORS: { [key: string]: string } = {
  [BaseColors.RED]: '#D22E2E',
  [BaseColors.GREEN]: '#088812',
  [BaseColors.BLUE]: '#17669F',
  [BaseColors.YELLOW]: '#E3DE3B',
}

// Timeout and delay constants (in milliseconds)
export const DICE_AUTO_ROLL_TIMEOUT = 200;          // Auto-roll timer delay when die becomes rollable (200ms)
export const DICE_BONUS_TURN_DELAY = 500;           // Delay before auto-rolling for bonus turns (500ms)
export const DICE_STATE_UPDATE_DELAY = 50;          // Small delay for state updates in dice sagas (50ms)
export const LUDO_MOVE_ANIMATION_DELAY = 100;       // Delay between coin movement steps for animation (100ms)
export const LUDO_STATE_UPDATE_DELAY = 10;          // Small delay for state updates in ludo sagas (10ms)
export const AUTO_ACTION_TIMEOUT = 200;             // Default timeout for auto-actions (200ms)
export const DICE_COUNTDOWN_TIMEOUT = 15;           // Countdown timer duration in seconds when player needs to roll dice (30s)
export const DICE_COUNTDOWN_WARNING_THRESHOLD = 5; // Show warning color when time remaining is <= this value (in seconds)
export const DICE_ROLLING_ANIMATION_DURATION = 1200; // Dice rolling animation duration in milliseconds (1.2 seconds)