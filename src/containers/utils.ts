/**
 * Container Utility Functions
 *
 * Utility functions specifically for container components in the Ludo game.
 * Handles styling calculations and color conversions.
 */

import { BaseColors } from 'state/interfaces';           // Player color enums

import { BASE_COLORS, CELL_DIMENSION } from 'globalConstants'; // Color mappings and dimensions

/**
 * Creates a CSS style object for dynamic sizing and coloring of game elements
 * Used for cells, coins, and other components that need dynamic dimensions
 * @param cellCountLengthwise - Number of cells in the lengthwise direction
 * @param cellCountWidthwise - Number of cells in the widthwise direction
 * @param baseColor - Optional player color for background
 * @returns CSS properties object with calculated dimensions and color
 */
export const getStyleObject = (
  cellCountLengthwise: number,
  cellCountWidthwise: number,
  baseColor?: BaseColors,
): React.CSSProperties => ({
  backgroundColor: baseColor && getBaseHexColor(baseColor), // Set background color if provided
  height: `${cellCountWidthwise * CELL_DIMENSION}px`,       // Calculate height based on cell count
  width: `${cellCountLengthwise * CELL_DIMENSION}px`,       // Calculate width based on cell count
});

/**
 * Converts a BaseColors enum value to its corresponding hex color string
 * @param color - The BaseColors enum value
 * @returns Hex color string (e.g., "#FF0000" for red)
 */
export const getBaseHexColor = (color: BaseColors) => BASE_COLORS[color];
