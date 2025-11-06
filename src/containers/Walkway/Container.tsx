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
import { Coin } from "containers/Base/components/Coin"; // Coin component for rendering
import {
  CellType,
  ICell,
  IServerGameData,
  IWalkway,
} from "containers/Ludo/state/interfaces"; // Game data types
import {
  basesSelector,
  cellsSelector,
  coinsSelector,
  currentTurnSelector,
  highlightedCellsSelector,
  highlightedCellsByCoinSelector,
  linksSelector,
} from "containers/Ludo/state/selectors"; // State selectors
import { getStyleObject } from "containers/utils"; // Styling utilities
import {
  COIN_SIZE,
  WALKWAY_LENGTH,
  WALKWAY_WIDTH,
  WALKWAY_VERTICAL_HEIGHT,
} from "globalConstants"; // Size constants
import { hideContextMenu, showContextMenu } from "services/contextMenu/service"; // Context menu service
import { BaseColors, WalkwayPosition } from "state/interfaces"; // Position enums and colors
import { createSelector } from "reselect"; // For creating memoized selectors

import { Cell } from "./components/Cell"; // Cell component
import { IContextMenuOptions } from "./interfaces"; // Context menu types
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
  coins: ReturnType<typeof coinsSelector>; // All coins in the game
  links: ReturnType<typeof linksSelector>; // Cell connectivity links
  currentTurn: ReturnType<typeof currentTurnSelector>; // Whose turn it is
  highlightedCells: ReturnType<typeof highlightedCellsSelector>; // Cells to highlight
  highlightedCellsByCoin: ReturnType<typeof highlightedCellsByCoinSelector>; // Map of cellID to coins that can reach it
  currentTurnBaseColor?: BaseColors; // Color of the current player for highlighting
}

/**
 * Props for Redux dispatch actions
 */
interface IDispatchProps {
  // No dispatch props needed - coins are not clickable, actions must be chosen from action panel
}

/** Combined component props */
interface IProps extends IPublicProps, IStateProps, IDispatchProps {}

/**
 * Global storage for cell configurations during development
 * In production, this would be loaded from pre-configured data
 */
const cells: IServerGameData["cells"] = {};

/**
 * Global storage for cell links during development
 * Stores which cells are connected for valid movement paths
 */
const cellLinks: { [cellID: string]: Set<ICell["cellID"]> } = {};

/**
 * Maps Redux state to component props
 */
const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector, // Get all player bases
  cells: cellsSelector, // Get all board cells
  coins: coinsSelector, // Get all coins
  currentTurn: currentTurnSelector, // Get current player turn
  links: linksSelector, // Get cell connectivity links
  highlightedCells: highlightedCellsSelector, // Get highlighted cells
  highlightedCellsByCoin: highlightedCellsByCoinSelector, // Get cell-to-coin mapping
  currentTurnBaseColor: createSelector(
    [basesSelector, currentTurnSelector],
    (
      bases: ReturnType<typeof basesSelector>,
      currentTurn: ReturnType<typeof currentTurnSelector>
    ) => bases[currentTurn]?.color
  ), // Get current player's base color for highlighting
});

/**
 * Maps Redux dispatch actions to component props
 */
const mapDispatchToProps = {};

/**
 * Global tracking for popovers across all walkways
 * These are reset when highlighting changes (detected via componentDidUpdate)
 */
let globalSeenCoinMoveTypes = new Set<string>();
let globalSeenMoveCoins = new Set<string>();

/**
 * Walkway container component class
 * Renders a segment of the game board walkway with interactive cells
 */
class WalkwayBare extends React.PureComponent<IProps> {
  componentDidMount() {
    // Clear tracking on mount to ensure fresh state for first render
    // This handles the case when the component mounts after highlighting is already set
    globalSeenCoinMoveTypes.clear();
    globalSeenMoveCoins.clear();
  }

  componentDidUpdate(prevProps: IProps) {
    // Reset global tracking when highlighting changes (new roll happened)
    // This handles subsequent highlighting changes after the first render
    // Check both the Set reference and the highlightedCellsByCoin to catch all changes
    const highlightingChanged =
      prevProps.highlightedCells !== this.props.highlightedCells ||
      prevProps.highlightedCellsByCoin !== this.props.highlightedCellsByCoin;

    if (highlightingChanged) {
      globalSeenCoinMoveTypes.clear();
      globalSeenMoveCoins.clear();
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
   * Creates a 2D grid of Cell components with appropriate styling and coin placement
   */
  private renderCells = () => {
    const {
      walkway: { position }, // Walkway configuration
      cells: cellConfigurations, // All cell configurations
      bases, // Player base data
      coins, // All coin data
      links, // Cell connectivity links
    } = this.props;

    // 2D array to hold cell components organized by row/column
    const cellComponents: any[][] = [[]];

    // Get all cells that belong to this walkway position
    const cellConfigurationsForWalkway = Object.values(
      cellConfigurations[position]
    );

    // Use global tracking for popovers across all walkways
    // For "move" type, track by coinID only (one popover per coin for all move cells)
    // For "spawn" and "kick" types, track by (coinID, moveType) combination

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
      // For "move" type: show one popover per coin (first move cell encountered for each coin)
      // For "spawn" and "kick" types: show one popover per (coinID, moveType) combination
      let showPopover = false;
      let popoverText = "";

      if (isHighlighted && this.props.highlightedCellsByCoin) {
        const coinMoveTypes = this.props.highlightedCellsByCoin.get(cellID);
        if (coinMoveTypes && coinMoveTypes.length > 0) {
          // Check all coins to find the first one that should show a popover
          // For "move" type: show one popover per coin (first move cell encountered for each coin)
          // For "spawn" and "kick" types: show one popover per (coinID, moveType) combination
          // Important: We iterate through all coins and mark them as seen when appropriate,
          // but only show one popover per cell (the first coin that should show one)
          for (const { coinID, moveType } of coinMoveTypes) {
            let shouldShow = false;

            if (moveType === "move") {
              // For "move" type, check if this coin has already shown a move popover
              // If not, this is the first move cell for this coin, so show the popover
              if (!globalSeenMoveCoins.has(coinID)) {
                // Mark the coin as seen immediately, even if we don't show the popover on this cell
                // This ensures that if multiple coins share this cell as their first move cell,
                // we still track that each coin has been processed
                globalSeenMoveCoins.add(coinID);
                // Only show popover if we haven't already decided to show one for this cell
                if (!showPopover) {
                  shouldShow = true;
                  popoverText = "Place bet on cells";
                }
              }
            } else {
              // For "spawn" and "kick" types, use the original logic
              const key = `${coinID}_${moveType}`;
              if (!globalSeenCoinMoveTypes.has(key)) {
                globalSeenCoinMoveTypes.add(key);
                // Only show popover if we haven't already decided to show one for this cell
                if (!showPopover) {
                  shouldShow = true;
                  // Determine popover text based on move type
                  if (moveType === "spawn") {
                    popoverText = "Place bet on spawn coin";
                  } else if (moveType === "kick") {
                    popoverText = "Place bet on kick blocking coin";
                  }
                }
              }
            }

            // If this coin should show a popover, mark it
            // We only show one popover per cell, but we still mark all coins as seen
            if (shouldShow) {
              showPopover = true;
              // Don't break - continue to mark other coins as seen even if we don't show their popover
              // This ensures that if coin2's first move cell comes after coin1's first move cell,
              // coin2 will still be able to show its popover on its own first move cell
            }
          }
        }
      }

      // Get the base that this cell belongs to (use cell's baseID, not walkway's baseID)
      const cellBase = bases[cellConfiguration.baseID];

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
          showPopover={showPopover} // Whether to show popover (only for first cell of each coin/moveType)
          popoverText={popoverText} // Text to display in popover
          onContextMenuOpened={this.onContextMenuOpened} // Right-click menu handler
        >
          {
            // Render coins that are currently on this cell
            cellConfiguration.coinIDs.map((coinID, index) => (
              <Coin
                baseColor={coins[coinID].color} // Coin color matches its base
                // Smaller coins if multiple coins on same cell
                coinSize={
                  cellConfiguration.coinIDs.length > 1
                    ? COIN_SIZE / 2
                    : COIN_SIZE
                }
                // onCoinClicked removed - coins are not clickable, actions must be chosen from action panel
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
   * Handles right-click context menu for cell editing (development tool)
   * Shows options to change cell type or link cells together
   */
  private onContextMenuOpened = (options: IContextMenuOptions) => {
    const {
      walkway: { baseID },
    } = this.props;
    const { cellID, cellType, column, position, row, x, y } = options;

    // Create cell info object for the clicked cell
    const cellInfo: ICell = {
      baseID,
      cellID,
      cellType,
      coinIDs: [], // No coins during development
      column,
      position,
      row,
    };

    // Show context menu with cell editing options
    showContextMenu(
      x,
      y, // Mouse position for menu placement
      [
        {
          action: () =>
            this.markCells({ ...cellInfo, cellType: CellType.NORMAL }),
          label: CellType.NORMAL, // Change to normal walkway cell
        },
        {
          action: () =>
            this.markCells({ ...cellInfo, cellType: CellType.SPAWN }),
          label: CellType.SPAWN, // Change to spawn cell (where coins enter)
        },
        {
          action: () =>
            this.markCells({ ...cellInfo, cellType: CellType.HOMEPATH }),
          label: CellType.HOMEPATH, // Change to home path cell
        },
        {
          action: () => this.linkCells(cellInfo),
          label: "Link", // Link this cell to another cell
        },
      ]
    );
  };

  /**
   * Marks a cell with a specific type (development tool)
   * Updates the global cells configuration for board design
   */
  private markCells = (cellInfo: ICell) => {
    // Ensure position exists in cells configuration
    cells[cellInfo.position] = cells[cellInfo.position] || {};
    // Store cell configuration
    cells[cellInfo.position][cellInfo.cellID] = cellInfo;
    hideContextMenu(); // Close the context menu
    console.log(JSON.stringify(cells)); // Debug output of cell configuration
  };

  /**
   * Initiates cell linking process (development tool)
   * Allows clicking on another cell to create a movement path
   */
  private linkCells = (cellInfo: ICell) => {
    hideContextMenu(); // Close context menu

    // Set up click handler for linking cells
    const onClick = (event: MouseEvent) => {
      const element = event.target as HTMLDivElement;
      const cellID = element.getAttribute("data-id") as string;

      // Confirm the link creation
      const shouldLink = window.confirm(
        `Link ${cellInfo.cellID} to ${cellID} ?`
      );

      if (shouldLink) {
        // Create or update the link set for this cell
        cellLinks[cellInfo.cellID] = cellLinks[cellInfo.cellID] || new Set();
        cellLinks[cellInfo.cellID].add(cellID);
      }

      // Clean up event listener
      document.removeEventListener("click", onClick);
      // Make links available globally for debugging
      (window as any).cellLinks = cellLinks;
    };

    // Listen for the next click to complete the link
    document.addEventListener("click", onClick);
  };

  /**
   * Handles coin click events during gameplay
   * DISABLED - Actions must be chosen from action panel
   */
  // private onCoinClicked removed - coins are not clickable, actions must be chosen from action panel
}

/**
 * Connected Walkway component with Redux state and actions
 * Exports the component with proper TypeScript typing
 */
export const Walkway = connect(
  mapStateToProps,
  mapDispatchToProps
)(WalkwayBare) as unknown as React.ComponentClass<IPublicProps>;
