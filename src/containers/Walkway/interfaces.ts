/**
 * Walkway Container Interfaces
 *
 * Type definitions for the walkway container component,
 * particularly for context menu interactions during development.
 */

import { CellType } from 'containers/Ludo/state/interfaces'; // Cell type enums
import { WalkwayPosition } from 'state/interfaces';           // Position enums

/**
 * Options passed to context menu when right-clicking on a cell
 * Used during development for board design and cell configuration
 */
export interface IContextMenuOptions {
  /** Unique identifier of the cell that was clicked */
  cellID: string,
  /** Type of the cell (normal, star, spawn, homepath) */
  cellType: CellType;
  /** Base ID that this cell belongs to */
  baseID: string,
  /** Column position of the cell in the grid */
  column: number,
  /** Cardinal position of the walkway (north, south, east, west) */
  position: WalkwayPosition,
  /** Row position of the cell in the grid */
  row: number,
  /** Mouse X coordinate for menu positioning */
  x: number,
  /** Mouse Y coordinate for menu positioning */
  y: number,
}
