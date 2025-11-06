/**
 * Cell Component
 *
 * Represents a single cell/space on the Ludo game board walkway.
 * Cells can contain horses, have different types (normal, spawn, homepath, etc.),
 * and handle user interactions.
 */

import classnames from "classnames"; // Utility for conditional CSS classes
import React from "react";

import { hexToRgba } from "common/utils"; // Color conversion utility
import { CellType } from "containers/Ludo/state/interfaces"; // Cell type definitions
import { getBaseHexColor, getStyleObject } from "containers/utils"; // Style utility
import { CELL_DIMENSION, CELL_SIZE, WALKWAY_LENGTH } from "globalConstants"; // Size constants
import { BaseColors, WalkwayPosition } from "state/interfaces"; // Color and position types

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
  /** Color to use for highlighting (current player's base color) */
  highlightColor?: BaseColors;
  /** Index value for NORMAL cells (for debugging) */
  index?: number;
  /** Whether to show the popover (only for first cell of each horse/moveType) */
  showPopover?: boolean;
  /** Text to display in the popover */
  popoverText?: string;

}

/**
 * Cell component - represents a single board space
 * Handles rendering horses, special cell types, and user interactions
 */
interface IBetHorse {
  id: number;
  x: number; // Random X position (0-100%)
  y: number; // Random Y position (0-100%)
}

interface ICellState {
  betHorses: IBetHorse[];
}

export class Cell extends React.PureComponent<ICellProps, ICellState> {
  private nextBetHorseId: number = 0;

  constructor(props: ICellProps) {
    super(props);
    this.state = {
      betHorses: [],
    };
  }

  componentDidUpdate(prevProps: ICellProps) {
    // Clear bet horses when highlighting changes from true to false (indicating a new roll)
    // This happens when the cell is no longer highlighted after a dice roll
    if (prevProps.isHighlighted && !this.props.isHighlighted) {
      // New roll has happened, clear all bet horses
      this.setState({ betHorses: [] });
    }
  }

  private handleCellClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only allow clicks on highlighted cells (for placing bets)
    if (!this.props.isHighlighted) {
      return;
    }

    // Prevent event bubbling
    event.stopPropagation();

    // Generate random position within the cell (5% to 95% to avoid edges)
    const x = Math.random() * 80 + 10; // 10% to 90%
    const y = Math.random() * 80 + 10; // 10% to 90%

    // Create a new bet horse with unique ID and random position
    const horseId = this.nextBetHorseId++;
    const newHorse: IBetHorse = {
      id: horseId,
      x,
      y,
    };

    // Add horse to state (horses will persist until next roll)
    this.setState((prevState) => ({
      betHorses: [...prevState.betHorses, newHorse],
    }));
  };

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

    // Get child components (usually horses)
    const children = React.Children.map(this.props.children, (child) => child);
    // Apply special styling when multiple horses are present
    const mutipleHorseClassName =
      children && children?.length > 1 ? styles.MultipleHorses : null;

    // Use utility function for hex to rgba conversion

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

    // Add highlighting style if cell is highlighted
    // Use the current player's base color for highlighting
    if (this.props.isHighlighted && this.props.highlightColor) {
      const highlightHexColor = getBaseHexColor(this.props.highlightColor);
      const highlightRgba = hexToRgba(highlightHexColor, 0.8);
      const highlightRgbaInset = hexToRgba(highlightHexColor, 0.4);
      cellStyle = {
        ...cellStyle,
        boxShadow: `0 0 10px 3px ${highlightRgba}, inset 0 0 10px 2px ${highlightRgbaInset}`,
        animation: "highlightPulse 1.5s ease-in-out infinite",
        cursor: "pointer", // Show pointer cursor for clickable highlighted cells
      };
    } else {
      // Add cursor style for non-highlighted cells
      cellStyle = {
        ...cellStyle,
        cursor: "default",
      };
    }

    return (
      <div
        className={classnames(styles.Container, mutipleHorseClassName)} // Base styles + multiple horse handling
        style={cellStyle}
        // Data attributes for event handling and identification
        data-id={cellID} // Unique cell identifier
        data-base-id={baseID} // Base identifier
        data-row={row}
        data-column={column}
        data-position={walkwayPosition}
        data-cell-type={cellType}
        onClick={this.props.isHighlighted ? this.handleCellClick : undefined} // Click handler for placing bets
      >
        {/* Popover for highlighted cells - display immediately for first cell of each horse/moveType */}
        {this.props.isHighlighted &&
          this.props.showPopover &&
          this.props.popoverText && (
            <div
              className={classnames(
                styles.Popover,
                // Position popover at bottom for yellow spawn cells
                this.props.cellType === CellType.SPAWN &&
                  this.props.color === BaseColors.YELLOW &&
                  styles.PopoverBottom
              )}
              style={
                this.props.highlightColor
                  ? (() => {
                      // Convert hex to rgba with 0.8 opacity
                      const hexColor = getBaseHexColor(
                        this.props.highlightColor
                      );
                      const rgbaColor = hexToRgba(hexColor, 0.8);
                      return {
                        backgroundColor: rgbaColor,
                        // Use CSS variable for arrow color (set on element so ::after can inherit)
                        "--popover-arrow-color": rgbaColor,
                      } as React.CSSProperties & {
                        "--popover-arrow-color": string;
                      };
                    })()
                  : undefined
              }
            >
              {this.props.popoverText}
            </div>
          )}
        {/* Horse/dollar icons when bets are placed - multiple horses can appear */}
        {this.state.betHorses.map((horse) => {
          const iconSize = CELL_DIMENSION * 0.3; // 20% of cell size
          return (
            <div
              key={horse.id}
              className={styles.BetHorseIcon}
              style={{
                left: `${horse.x}%`,
                top: `${horse.y}%`,
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                fontSize: `${iconSize * 0.6}px`, // Font size relative to icon size
              }}
            >
              $
            </div>
          );
        })}
        {/* Display cell information for debugging/development */}
        {this.props.showDebugText !== false && (
          <div className={styles.CellInfo}>
            <div className={styles.CellID}>{cellID}</div>
            <div className={styles.BaseID}>{baseID}</div>
            {this.props.index !== undefined && (
              <div className={styles.Index}>Index: {this.props.index}</div>
            )}
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
          children // Render child components (horses)
        }
      </div>
    );
  }

}
