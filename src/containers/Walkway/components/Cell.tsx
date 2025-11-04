/**
 * Cell Component
 *
 * Represents a single cell/space on the Ludo game board walkway.
 * Cells can contain coins, have different types (normal, spawn, homepath, etc.),
 * and handle user interactions like right-click context menus.
 */

import classnames from "classnames"; // Utility for conditional CSS classes
import React from "react";

import { CellType } from "containers/Ludo/state/interfaces"; // Cell type definitions
import { getBaseHexColor, getStyleObject } from "containers/utils"; // Style utility
import { CELL_SIZE, WALKWAY_LENGTH } from "globalConstants"; // Size constants
import { BaseColors, WalkwayPosition } from "state/interfaces"; // Color and position types

import { IContextMenuOptions } from "../interfaces"; // Context menu options type
import { generateCellID } from "../utils"; // Utility to generate cell IDs

import styles from "./Cell.module.css"; // CSS module for cell styling

/**
 * Props for the Cell component
 */
interface ICellProps {
  /** Row position on the board grid */
  row: number;
  /** Column position on the board grid */
  column: number;
  /** Cardinal direction of the walkway this cell belongs to */
  walkwayPosition: WalkwayPosition;
  /** Base ID this cell belongs to */
  baseID: string;
  /** Type of cell (spawn, homepath, normal) */
  cellType: CellType;
  /** Optional background color for the cell */
  color?: BaseColors;
  /** Next link cell IDs for this cell (for verifying movement paths) */
  nextLinkCellIDs?: string[];
  /** Whether to show debug text (cell ID, base ID, etc.) */
  showDebugText?: boolean;
  /** Whether this cell is highlighted as reachable */
  isHighlighted?: boolean;

  /** Callback when right-click context menu is opened */
  onContextMenuOpened: (options: IContextMenuOptions) => void;
}

/**
 * Cell component - represents a single board space
 * Handles rendering coins, special cell types, and user interactions
 */
export class Cell extends React.PureComponent<ICellProps> {
  render() {
    const {
      color, // Background color of the cell
      column, // Column position
      cellType, // Type of cell (normal, spawn, homepath, etc.)
      row, // Row position
      walkwayPosition, // Which walkway this cell belongs to
      baseID, // Base ID this cell belongs to
      nextLinkCellIDs, // Next link cell IDs for verification
    } = this.props;

    // Generate the cell ID for display
    const cellID = generateCellID(walkwayPosition, row, column);

    // Determine the index for homepath cells based on walkway position
    // NORTH/SOUTH are vertical, so use row; EAST/WEST are horizontal, so use column
    // SOUTH indices are reversed to match logical progression (opposite of NORTH)
    // EAST indices are reversed to match logical progression (opposite of WEST)
    const homePathIndex =
      cellType === CellType.HOMEPATH
        ? walkwayPosition === WalkwayPosition.NORTH ||
          walkwayPosition === WalkwayPosition.SOUTH
          ? walkwayPosition === WalkwayPosition.SOUTH
            ? WALKWAY_LENGTH - 1 - row
            : row
          : walkwayPosition === WalkwayPosition.EAST
          ? WALKWAY_LENGTH - 1 - column
          : column
        : undefined;

    // Get child components (usually coins)
    const children = React.Children.map(this.props.children, (child) => child);
    // Apply special styling when multiple coins are present
    const mutipleCoinClassName =
      children && children?.length > 1 ? styles.MultipleCoins : null;

    // Helper function to convert hex to rgba with opacity
    const hexToRgba = (hex: string, opacity: number): string => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return hex; // Return original if invalid hex
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    // For SPAWN and NORMAL cells, don't apply background color (we'll show a circle instead)
    // For HOMEPATH cells, apply background color with 0.5 opacity
    // For other cells, apply normal background color
    let cellStyle: React.CSSProperties;
    if (cellType === CellType.SPAWN || cellType === CellType.NORMAL) {
      cellStyle = getStyleObject(CELL_SIZE, CELL_SIZE); // Only size, no background color
    } else if (cellType === CellType.HOMEPATH && color) {
      const baseStyle = getStyleObject(CELL_SIZE, CELL_SIZE);
      const hexColor = getBaseHexColor(color);
      cellStyle = {
        ...baseStyle,
        backgroundColor: hexToRgba(hexColor, 0.5), // Apply color with 0.5 opacity
      };
    } else {
      cellStyle = getStyleObject(CELL_SIZE, CELL_SIZE, color); // Size and color styling
    }

    return (
      <div
        className={classnames(
          styles.Container,
          mutipleCoinClassName,
          this.props.isHighlighted && styles.Highlighted
        )} // Base styles + multiple coin handling + highlighting
        style={cellStyle}
        // Data attributes for event handling and identification
        data-id={cellID} // Unique cell identifier
        data-base-id={baseID} // Base identifier
        data-row={row}
        data-column={column}
        data-position={walkwayPosition}
        data-cell-type={cellType}
        onContextMenu={(event) => this.handleContextMenu(event)} // Right-click menu
      >
        {/* Display cell information for debugging/development */}
        {this.props.showDebugText !== false && (
          <div className={styles.CellInfo}>
            <div className={styles.CellID}>{cellID}</div>
            <div className={styles.BaseID}>{baseID}</div>
            {nextLinkCellIDs && nextLinkCellIDs.length > 0 && (
              <div className={styles.NextLinks}>
                → {nextLinkCellIDs.join(", ")}
              </div>
            )}
          </div>
        )}
        {/* Display index for homepath cells */}
        {cellType === CellType.HOMEPATH && homePathIndex !== undefined && (
          <div className={styles.HomePathIndex}>{homePathIndex}</div>
        )}
        {/* Display circle border for spawn and normal cells */}
        {cellType === CellType.SPAWN && color && (
          <div
            className={styles.SpawnCircle}
            style={{ borderColor: getBaseHexColor(color) }}
          />
        )}
        {cellType === CellType.NORMAL && color && (
          <div
            className={styles.NormalCircle}
            style={{ borderColor: getBaseHexColor(color) }}
          />
        )}
        {
          children // Render child components (coins)
        }
      </div>
    );
  }

  /**
   * Handles right-click context menu events
   * Extracts cell information from data attributes and passes to parent
   */
  private handleContextMenu = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    event.preventDefault(); // Prevent browser context menu
    const target = event.target as HTMLDivElement;

    // Extract cell information from data attributes
    this.props.onContextMenuOpened({
      cellID: target.getAttribute("data-id")!,
      cellType: target.getAttribute("data-cell-type") as CellType,
      baseID: target.getAttribute("data-base-id")!,
      column: Number(target.getAttribute("data-column")),
      position: target.getAttribute("data-position") as WalkwayPosition,
      row: Number(target.getAttribute("data-row")),
      x: event.clientX, // Mouse position for menu placement
      y: event.clientY,
    });
  };

}
