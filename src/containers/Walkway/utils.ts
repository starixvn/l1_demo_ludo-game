/**
 * Walkway Container Utilities
 *
 * Utility functions for walkway container operations,
 * particularly for generating unique identifiers for cells.
 */

import { WalkwayPosition } from 'state/interfaces'; // Position enums

/**
 * Generates a unique cell identifier based on walkway position and grid coordinates
 * Used to create consistent, unique IDs for cells across different walkways
 *
 * @param walkwayPosition - Cardinal position of the walkway (NORTH, SOUTH, EAST, WEST)
 * @param row - Row index in the walkway grid
 * @param column - Column index in the walkway grid
 * @returns Unique cell identifier string in format: "POSITION_ROW_COLUMN"
 *
 * @example
 * generateCellID(WalkwayPosition.NORTH, 2, 3) // returns "NORTH_2_3"
 */
export const generateCellID = (walkwayPosition: WalkwayPosition, row: number, column: number) =>
  `${walkwayPosition}_${row}_${column}`;
