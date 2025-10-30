/**
 * Cell Component
 *
 * Represents a single cell/space on the Ludo game board walkway.
 * Cells can contain coins, have different types (normal, star, spawn, etc.),
 * and handle user interactions like right-click context menus.
 */

import classnames from "classnames"; // Utility for conditional CSS classes
import React from "react";

import { CellType, ICell } from "containers/Ludo/state/interfaces"; // Cell type definitions
import { getStyleObject } from "containers/utils"; // Style utility
import { CELL_SIZE, STAR_BASE64 } from "globalConstants"; // Size and star image constants
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
  /** Whether this cell displays a star (special bonus cell) */
  isStar: boolean;
  /** Type of cell (spawn, star, homepath, normal) */
  cellType: CellType;
  /** Optional background color for the cell */
  color?: BaseColors;

  /** Callback when right-click context menu is opened */
  onContextMenuOpened: (options: IContextMenuOptions) => void;
  /** Callback to highlight valid next moves when hovering */
  onHighlightNextCells: (cellID: ICell["cellID"]) => void;
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
      cellType, // Type of cell (normal, star, spawn, etc.)
      row, // Row position
      walkwayPosition, // Which walkway this cell belongs to
      baseID, // Base ID this cell belongs to
      isStar, // Whether to show star background
    } = this.props;

    // Generate the cell ID for display
    const cellID = generateCellID(walkwayPosition, row, column);

    // Get child components (usually coins)
    const children = React.Children.map(this.props.children, (child) => child);
    // Apply special styling when multiple coins are present
    const mutipleCoinClassName =
      children && children?.length > 1 ? styles.MultipleCoins : null;

    return (
      <div
        className={classnames(styles.Container, mutipleCoinClassName)} // Base styles + multiple coin handling
        style={{
          ...getStyleObject(CELL_SIZE, CELL_SIZE, color), // Size and color styling
          backgroundImage: isStar ? `url(${STAR_BASE64})` : undefined, // Star image if applicable
        }}
        // Data attributes for event handling and identification
        data-id={cellID} // Unique cell identifier
        data-base-id={baseID} // Base identifier
        data-row={row}
        data-column={column}
        data-position={walkwayPosition}
        data-cell-type={cellType}
        onContextMenu={(event) => this.handleContextMenu(event)} // Right-click menu
        onMouseEnter={(event) => this.highlightNextCells(event)} // Hover highlighting
      >
        {/* Display cell information for debugging/development */}
        <div className={styles.CellInfo}>
          <div className={styles.CellID}>{cellID}</div>
          <div className={styles.BaseID}>{baseID}</div>
        </div>
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

  /**
   * Handles mouse enter events to highlight valid next moves
   * Called when user hovers over a cell to show possible moves
   */
  private highlightNextCells = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    const target = event.target as HTMLDivElement;
    const cellID = target.getAttribute("data-id");

    if (cellID) {
      this.props.onHighlightNextCells(cellID); // Trigger highlighting of valid moves
    }
  };
}
