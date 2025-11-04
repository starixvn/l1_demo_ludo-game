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
import { isDieRollValidSelector } from "containers/Dice/state/selectors"; // Die roll validation
import { moveCoin } from "containers/Ludo/state/actions"; // Move coin action
import {
  CellType,
  ICell,
  ICoin,
  IServerGameData,
  IWalkway,
} from "containers/Ludo/state/interfaces"; // Game data types
import {
  basesSelector,
  cellsSelector,
  coinsSelector,
  currentTurnSelector,
  highlightedCellsSelector,
  linksSelector,
} from "containers/Ludo/state/selectors"; // State selectors
import { getStyleObject } from "containers/utils"; // Styling utilities
import { COIN_SIZE, WALKWAY_LENGTH, WALKWAY_WIDTH } from "globalConstants"; // Size constants
import { hideContextMenu, showContextMenu } from "services/contextMenu/service"; // Context menu service
import { WalkwayPosition } from "state/interfaces"; // Position enums

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
  isDieRollValid: ReturnType<typeof isDieRollValidSelector>; // Whether die roll can be used
  currentTurn: ReturnType<typeof currentTurnSelector>; // Whose turn it is
  highlightedCells: ReturnType<typeof highlightedCellsSelector>; // Cells to highlight
}

/**
 * Props for Redux dispatch actions
 */
interface IDispatchProps {
  moveCoin: typeof moveCoin; // Action to move a coin
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
  isDieRollValid: isDieRollValidSelector, // Get die roll validity
  links: linksSelector, // Get cell connectivity links
  highlightedCells: highlightedCellsSelector, // Get highlighted cells
});

/**
 * Maps Redux dispatch actions to component props
 */
const mapDispatchToProps = {
  moveCoin, // Coin movement action
};

/**
 * Walkway container component class
 * Renders a segment of the game board walkway with interactive cells
 */
class WalkwayBare extends React.PureComponent<IProps> {
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
            : getStyleObject(WALKWAY_WIDTH, WALKWAY_LENGTH) // Vertical walkway dimensions
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

    // Process each cell configuration and create Cell components
    cellConfigurationsForWalkway.forEach((cellConfiguration, index) => {
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
                onCoinClicked={() =>
                  this.onCoinClicked(coinID, position, cellID)
                }
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
   * Validates that it's the player's turn and die roll is valid before moving
   */
  private onCoinClicked = (
    coinID: ICoin["coinID"],
    position: WalkwayPosition,
    cellID: ICell["cellID"]
  ) => {
    const { coins, currentTurn } = this.props;
    const coin = coins[coinID];

    // Only allow move if die roll is valid and it's the coin's player's turn
    if (this.props.isDieRollValid && coin.baseID === currentTurn) {
      this.props.moveCoin(coinID, position, cellID); // Dispatch move action
    }
  };
}

/**
 * Connected Walkway component with Redux state and actions
 * Exports the component with proper TypeScript typing
 */
export const Walkway = connect(
  mapStateToProps,
  mapDispatchToProps
)(WalkwayBare) as unknown as React.ComponentClass<IPublicProps>;
