/**
 * Walkway Container Component
 *
 * A development tool for creating and editing Ludo game board walkways.
 * Allows designers to visually place cells, set cell types (normal, spawn, homepath),
 * and link cells together to define valid movement paths.
 *
 * In production, this would be replaced with pre-configured walkway data.
 */

import React from "react";
import { connect } from "react-redux"; // Redux connection
import { createStructuredSelector } from "reselect"; // Optimized state selection

import { flatArray } from "common/utils"; // Array flattening utility
import { Horse } from "containers/Base/components/Horse"; // Horse component for rendering
import {
  CellType,
  IWalkway,
} from "containers/Ludo/state/interfaces"; // Game data types
import {
  basesSelector,
  cellsSelector,
  horsesSelector,
  currentTurnSelector,
  highlightedCellsSelector,
  highlightedCellsByHorseSelector,
  linksSelector,
} from "containers/Ludo/state/selectors"; // State selectors
import { getStyleObject } from "containers/utils"; // Styling utilities
import { calculateCellOdds } from "containers/utils/oddsCalculator"; // Odds calculator
import {
  HORSE_SIZE,
  WALKWAY_LENGTH,
  WALKWAY_WIDTH,
  WALKWAY_VERTICAL_HEIGHT,
} from "globalConstants"; // Size constants
import { BaseColors, WalkwayPosition } from "state/interfaces"; // Position enums and colors
import { createSelector } from "reselect"; // For creating memoized selectors
import { isDieRollAllowedSelector, isDieRollValidSelector } from "containers/Dice/state/selectors"; // Dice selectors

import { Cell } from "./components/Cell"; // Cell component
import { generateCellID } from "./utils"; // Cell ID generation utility

import styles from "./Container.module.css"; // Component styles

/**
 * Public props for the Walkway component
 */
interface IPublicProps {
  /** Configuration for this walkway segment */
  walkway: IWalkway;
  /** Whether to show debug text (walkway ID, cell IDs, etc.) */
  showDebugText?: boolean;
}

/**
 * Props from Redux state
 */
interface IStateProps {
  bases: ReturnType<typeof basesSelector>; // All player bases
  cells: ReturnType<typeof cellsSelector>; // All game board cells
  horses: ReturnType<typeof horsesSelector>; // All horses in the game
  links: ReturnType<typeof linksSelector>; // Cell connectivity links
  currentTurn: ReturnType<typeof currentTurnSelector>; // Whose turn it is
  highlightedCells: ReturnType<typeof highlightedCellsSelector>; // Cells to highlight
  highlightedCellsByHorse: ReturnType<typeof highlightedCellsByHorseSelector>; // Map of cellID to horses that can reach it
  currentTurnBaseColor?: BaseColors; // Color of the current player for highlighting
  isDieRollAllowed: ReturnType<typeof isDieRollAllowedSelector>; // Whether dice can be rolled
  isDieRollValid: ReturnType<typeof isDieRollValidSelector>; // Whether current roll is valid
}

/**
 * Props for Redux dispatch actions
 */
interface IDispatchProps {
  // No dispatch props needed - horses are not clickable, actions must be chosen from action panel
}

/** Combined component props */
interface IProps extends IPublicProps, IStateProps, IDispatchProps {}


/**
 * Maps Redux state to component props
 */
const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector, // Get all player bases
  cells: cellsSelector, // Get all board cells
  horses: horsesSelector, // Get all horses
  currentTurn: currentTurnSelector, // Get current player turn
  links: linksSelector, // Get cell connectivity links
  highlightedCells: highlightedCellsSelector, // Get highlighted cells
  highlightedCellsByHorse: highlightedCellsByHorseSelector, // Get cell-to-horse mapping
  currentTurnBaseColor: createSelector(
    [basesSelector, currentTurnSelector],
    (
      bases: ReturnType<typeof basesSelector>,
      currentTurn: ReturnType<typeof currentTurnSelector>
    ) => bases[currentTurn]?.color
  ), // Get current player's base color for highlighting
  isDieRollAllowed: isDieRollAllowedSelector, // Get whether dice can be rolled
  isDieRollValid: isDieRollValidSelector, // Get whether current roll is valid
});

/**
 * Maps Redux dispatch actions to component props
 */
const mapDispatchToProps = {};

/**
 * Global tracking for popovers across all walkways
 * These are reset when highlighting changes (detected via componentDidUpdate)
 */
let globalSeenHorseMoveTypes = new Set<string>();
let globalSeenMoveHorses = new Set<string>();

/**
 * Walkway container component class
 * Renders a segment of the game board walkway with interactive cells
 */
class WalkwayBare extends React.PureComponent<IProps> {
  componentDidMount() {
    // Clear tracking on mount to ensure fresh state for first render
    // This handles the case when the component mounts after highlighting is already set
    globalSeenHorseMoveTypes.clear();
    globalSeenMoveHorses.clear();
  }

  componentDidUpdate(prevProps: IProps) {
    // Reset global tracking when highlighting changes (new roll happened)
    // This handles subsequent highlighting changes after the first render
    // Check both the Set reference and the highlightedCellsByHorse to catch all changes
    const highlightingChanged =
      prevProps.highlightedCells !== this.props.highlightedCells ||
      prevProps.highlightedCellsByHorse !== this.props.highlightedCellsByHorse;

    if (highlightingChanged) {
      globalSeenHorseMoveTypes.clear();
      globalSeenMoveHorses.clear();
    }
  }

  /**
   * Renders the walkway container with appropriate dimensions
   */
  render() {
    // Determine if this walkway should be rendered horizontally or vertically
    const isHorizontal = this.isHorizontalWalkway();
    const { walkway } = this.props;

    return (
      <div
        className={styles.Container}
        style={
          isHorizontal
            ? getStyleObject(WALKWAY_LENGTH, WALKWAY_WIDTH) // Horizontal walkway dimensions
            : getStyleObject(WALKWAY_WIDTH, WALKWAY_VERTICAL_HEIGHT) // Vertical walkway dimensions
        }
      >
        {/* Walkway ID display */}
        {this.props.showDebugText !== false && (
          <div className={styles.WalkwayID}>{walkway.ID.replace("_", " ")}</div>
        )}
        {
          this.renderCells() // Render all cells in this walkway
        }
      </div>
    );
  }

  /**
   * Renders all cells in this walkway segment
   * Creates a 2D grid of Cell components with appropriate styling and horse placement
   */
  private renderCells = () => {
    const {
      walkway: { position }, // Walkway configuration
      cells: cellConfigurations, // All cell configurations
      bases, // Player base data
      horses, // All horse data
      links, // Cell connectivity links
      currentTurn, // Current player turn
      isDieRollAllowed, // Whether dice can be rolled
    } = this.props;

    // Calculate odds whenever dice rolling is allowed (includes paused games)
    const shouldShowOdds = isDieRollAllowed;
    const cellOdds = shouldShowOdds
      ? calculateCellOdds(horses, bases, currentTurn, cellConfigurations, links)
      : [];

    // 2D array to hold cell components organized by row/column
    const cellComponents: any[][] = [[]];

    // Get all cells that belong to this walkway position
    const cellConfigurationsForWalkway = Object.values(
      cellConfigurations[position]
    );

    // Use global tracking for popovers across all walkways
    // For "move" type, track by horseID only (one popover per horse for all move cells)
    // For "spawn" and "kick" types, track by (horseID, moveType) combination

    // Process each cell configuration and create Cell components
    cellConfigurationsForWalkway.forEach((cellConfiguration, index) => {
      // Skip cells that should not be rendered in walkway
      if (cellConfiguration.notRenderInWalkway) {
        return;
      }

      const { row, column, position } = cellConfiguration;
      const cellID = generateCellID(position, row, column);
      const cellType = cellConfigurations[position][cellID].cellType;

      // Initialize row array if it doesn't exist
      cellComponents[cellConfiguration.row] =
        cellComponents[cellConfiguration.row] || [];

      // Get next link cell IDs for this cell (for UI verification)
      const cellLinks = links[cellID] || [];
      const nextLinkCellIDs = cellLinks.map((link) => link.cellID);

      // Check if this cell should be highlighted
      const isHighlighted = this.props.highlightedCells?.has(cellID) || false;

      // Determine if we should show a popover for this cell
      // For "move" type: show one popover per horse (first move cell encountered for each horse)
      // For "spawn" and "kick" types: show one popover per (horseID, moveType) combination
      let showPopover = false;
      let popoverText = "";

      if (isHighlighted && this.props.highlightedCellsByHorse) {
        const horseMoveTypes = this.props.highlightedCellsByHorse.get(cellID);
        if (horseMoveTypes && horseMoveTypes.length > 0) {
          // Check all horses to find the first one that should show a popover
          // For "move" type: show one popover per horse (first move cell encountered for each horse)
          // For "spawn" and "kick" types: show one popover per (horseID, moveType) combination
          // Important: We iterate through all horses and mark them as seen when appropriate,
          // but only show one popover per cell (the first horse that should show one)
          for (const { horseID, moveType } of horseMoveTypes) {
            let shouldShow = false;

            if (moveType === "move") {
              // For "move" type, check if this horse has already shown a move popover
              // If not, this is the first move cell for this horse, so show the popover
              if (!globalSeenMoveHorses.has(horseID)) {
                // Mark the horse as seen immediately, even if we don't show the popover on this cell
                // This ensures that if multiple horses share this cell as their first move cell,
                // we still track that each horse has been processed
                globalSeenMoveHorses.add(horseID);
                // Only show popover if we haven't already decided to show one for this cell
                if (!showPopover) {
                  shouldShow = true;
                  popoverText = "Place bet on cells";
                }
              }
            } else {
              // For "spawn" and "kick" types, use the original logic
              const key = `${horseID}_${moveType}`;
              if (!globalSeenHorseMoveTypes.has(key)) {
                globalSeenHorseMoveTypes.add(key);
                // Only show popover if we haven't already decided to show one for this cell
                if (!showPopover) {
                  // For spawn moves, check if there's already a horse of the same color in the spawn cell
                  // If so, don't show the popover because spawning is not valid
                  if (moveType === "spawn" && cellType === CellType.SPAWN) {
                    const horse = horses[horseID];
                    const hasSameColorHorse = cellConfiguration.horseIDs.some(
                      (existingHorseID) => {
                        const existingHorse = horses[existingHorseID];
                        return existingHorse && existingHorse.baseID === horse.baseID;
                      }
                    );
                    // Don't show popover if same color horse already exists in spawn cell
                    if (hasSameColorHorse) {
                      // Mark as seen but don't show popover
                      continue;
                    }
                  }
                  shouldShow = true;
                  // Determine popover text based on move type
                  if (moveType === "spawn") {
                    popoverText = "Place bet on spawn horse";
                  } else if (moveType === "kick") {
                    popoverText = "Place bet on kick blocking horse";
                  }
                }
              }
            }

            // If this horse should show a popover, mark it
            // We only show one popover per cell, but we still mark all horses as seen
            if (shouldShow) {
              showPopover = true;
              // Don't break - continue to mark other horses as seen even if we don't show their popover
              // This ensures that if horse2's first move cell comes after horse1's first move cell,
              // horse2 will still be able to show its popover on its own first move cell
            }
          }
        }
      }

      // Get the base that this cell belongs to (use cell's baseID, not walkway's baseID)
      const cellBase = bases[cellConfiguration.baseID];

      // Get odds for this cell (if available and possible)
      const cellOddsObj = cellOdds.find(odds => odds.cellID === cellID);
      const cellOddsValue = cellOddsObj ? cellOddsObj.probability : undefined;
      const cellBettingOdds = cellOddsObj && cellOddsObj.isPossible ? cellOddsObj.oddsRatio : undefined;

      // Create Cell component at the correct grid position
      cellComponents[cellConfiguration.row][cellConfiguration.column] = (
        <Cell
          key={index}
          column={column}
          row={row}
          walkwayPosition={position}
          baseID={cellConfiguration.baseID} // Base ID this cell belongs to
          // Color special cells (spawn/homepath/normal) with base color of the cell's base
          color={
            [CellType.HOMEPATH, CellType.SPAWN, CellType.NORMAL].includes(
              cellType
            ) && cellBase
              ? cellBase.color
              : undefined
          }
          cellType={cellType}
          nextLinkCellIDs={nextLinkCellIDs} // Next link cell IDs for verification
          showDebugText={this.props.showDebugText} // Whether to show debug text
          isHighlighted={isHighlighted} // Whether this cell is highlighted
          highlightColor={this.props.currentTurnBaseColor} // Color to use for highlighting (current player's color)
          index={cellConfiguration.index} // Index value for debugging
          showPopover={showPopover} // Whether to show popover (only for first cell of each horse/moveType)
          popoverText={popoverText} // Text to display in popover
          odds={cellOddsValue} // Probability of reaching this cell (0.0 to 1.0)
          bettingOdds={cellBettingOdds} // Betting odds ratio (1:X format)
        >
          {
            // Render horses that are currently on this cell
            cellConfiguration.horseIDs.map((horseID, index) => (
              <Horse
                baseColor={horses[horseID].color} // Horse color matches its base
                horseID={horseID} // Pass horse ID to display number
                // Smaller horses if multiple horses on same cell
                horseSize={
                  cellConfiguration.horseIDs.length > 1
                    ? HORSE_SIZE / 2
                    : HORSE_SIZE
                }
                isJumping={horses[horseID].isJumping || false} // Whether horse is jumping for animation
                // onHorseClicked removed - horses are not clickable, actions must be chosen from action panel
                key={index}
              />
            ))
          }
        </Cell>
      );
    });

    // Flatten the 2D array into a 1D array of components for rendering
    return flatArray(cellComponents);
  };

  /**
   * Determines if this walkway should be rendered horizontally
   * East and West walkways are horizontal, North and South are vertical
   */
  private isHorizontalWalkway = () =>
    [
      WalkwayPosition.EAST, // East walkway runs horizontally
      WalkwayPosition.WEST, // West walkway runs horizontally
    ].includes(this.props.walkway.position);




  /**
   * Handles horse click events during gameplay
   * DISABLED - Actions must be chosen from action panel
   */
  // private onHorseClicked removed - horses are not clickable, actions must be chosen from action panel
}

/**
 * Connected Walkway component with Redux state and actions
 * Exports the component with proper TypeScript typing
 */
export const Walkway = connect(
  mapStateToProps,
  mapDispatchToProps
)(WalkwayBare) as unknown as React.ComponentClass<IPublicProps>;
