/**
 * Ludo Game Container Component
 *
 * The main container component for the entire Ludo game application.
 * Handles game initialization, player configuration, and orchestrates all game components.
 * This is the root component that brings together bases, walkways, players, and UI elements.
 */

import React from "react";

import { Base } from "containers/Base/Container"; // Player base components
import { Home } from "containers/Home/Container"; // Home/finish area components
import { Player } from "containers/Player/Container"; // Player info panels
import { StepLogs } from "containers/StepLogs/Container"; // Game action log
import { Walkway } from "containers/Walkway/Container"; // Game board walkway
import { getStyleObject } from "containers/utils"; // Styling utilities
import { BOARD_SIZE } from "globalConstants"; // Board dimensions
import { ContextMenu } from "services/contextMenu/Container"; // Right-click menu

import { ludoStore } from "./state/store"; // Ludo Zustand store
import { BaseID, BoardEntities, IRelationship } from "./state/interfaces"; // Game data types

import styles from "./Container.module.css"; // Component styles

/** Public props (none in this case) */
interface IPublicProps {}

/** Combined props for the component */
interface IProps extends IPublicProps {}

/** Local component state */
interface IState {
  showPlayerConfiguration: boolean; // Whether to show player setup screen
  showDebugText: boolean; // Whether to show debug text (cell IDs, base IDs, etc.)
}

/**
 * Main Ludo container component class
 * Manages game initialization and renders the complete game interface
 */
class LudoBare extends React.PureComponent<IProps, IState> {
  private unsubscribe?: () => void;

  /** Initial state shows player configuration screen */
  state: IState = {
    showPlayerConfiguration: true,
    showDebugText: false, // Hide debug text by default
  };

  /**
   * Load initial game data when component mounts and subscribe to store changes
   */
  componentDidMount() {
    ludoStore.getState().getInitialGameData();

    // Subscribe to store changes to trigger re-renders
    this.unsubscribe = ludoStore.subscribe(() => {
      // Force re-render when store changes
      this.forceUpdate();
    });
  }

  /**
   * Unsubscribe from store changes when component unmounts
   */
  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  /**
   * Renders the complete Ludo game interface
   */
  render() {
    const { currentTurn } = ludoStore.getState();

    return (
      <div className={styles.Container}>
        {/* Main game area with board and players */}
        <div className={styles.GameContainer}>
          {/* Left side players (Base 1 & 3) */}
          <div className={styles.PlayerContainer}>
            <Player
              baseID={BaseID.BASE_1} // Red player
              placement="top" // Position at top of container
              disabled={currentTurn !== BaseID.BASE_1} // Disable if not their turn
            />
            <Player
              baseID={BaseID.BASE_3} // Yellow player
              placement="bottom" // Position at bottom of container
              disabled={currentTurn !== BaseID.BASE_3} // Disable if not their turn
            />
          </div>

          {/* Main game board */}
          <div
            className={styles.Board}
            style={getStyleObject(BOARD_SIZE, BOARD_SIZE)} // Size the board
          >
            {this.renderBoardEntities()} {/* Render bases, walkways, homes */}
          </div>

          {/* Right side players (Base 2 & 4) */}
          <div className={styles.PlayerContainer}>
            <Player
              baseID={BaseID.BASE_2} // Blue player
              placement="top"
              disabled={currentTurn !== BaseID.BASE_2}
            />
            <Player
              baseID={BaseID.BASE_4} // Green player
              placement="bottom"
              disabled={currentTurn !== BaseID.BASE_4}
            />
          </div>
        </div>

        {/* Debug text toggle checkbox - shown at all times */}
        <div className={styles.SidePanel}>
          <label className={styles.CheckboxLabel}>
            <input
              type="checkbox"
              checked={this.state.showDebugText}
              onChange={(e) =>
                this.setState({ showDebugText: e.target.checked })
              }
              className={styles.Checkbox}
            />
            <span>Show Debug Text</span>
          </label>
          {/* Game log panel (shown only during gameplay) */}
          {!this.state.showPlayerConfiguration && <StepLogs />}
        </div>

        {/* Player configuration screen (shown before game starts) */}
        {this.state.showPlayerConfiguration ? (
          <div className={styles.GameConfiguration}>
            <button className={styles.Button} onClick={() => this.startGame(2)}>
              2 Players
            </button>
            <button className={styles.Button} onClick={() => this.startGame(3)}>
              3 Players
            </button>
            <button className={styles.Button} onClick={() => this.startGame(4)}>
              4 Players
            </button>
          </div>
        ) : null}

        {/* Development-only context menu */}
        {process.env.NODE_ENV === "development" ? <ContextMenu /> : null}
      </div>
    );
  }

  /**
   * Renders all board entities (bases, walkways, homes) based on relationships
   * Dynamically creates the appropriate components for each board entity
   */
  private renderBoardEntities = () => {
    const { bases, relationships, walkways } = ludoStore.getState();

    if (!relationships || relationships.length === 0) {
      return null; // Don't render anything if data hasn't loaded yet
    }

    return relationships.map((relationship: IRelationship, index: number) => {
      const base = bases[relationship.ID]; // Get base data if applicable
      const walkway = walkways[relationship.ID]; // Get walkway data if applicable

      switch (relationship.type) {
        case BoardEntities.BASE:
          if (!base) return null; // Skip if base data not found
          return (
            <Base
              baseID={base.ID} // Player base identifier
              key={index} // React key for list rendering
              enabled={base.enabled} // Whether base is active
              hasWon={base.hasWon} // Whether player has won
              showDebugText={this.state.showDebugText} // Whether to show debug text
            />
          );
        case BoardEntities.HOME:
          return (
            <Home
              baseIDs={relationship.baseIDs} // Which bases this home belongs to
              key={index}
            />
          );
        case BoardEntities.WALKWAY:
          if (!walkway) return null; // Skip if walkway data not found
          return (
            <Walkway
              walkway={walkway} // Walkway configuration
              key={index}
              showDebugText={this.state.showDebugText} // Whether to show debug text
            />
          );
        default:
          return null; // Unknown entity type
      }
    });
  };

  /**
   * Starts the game with the specified number of players
   * Hides the configuration screen and initializes the game state
   */
  private startGame = (playerCount: number) => {
    ludoStore.getState().setPlayers(playerCount); // Set number of players in state
    this.setState({
      showPlayerConfiguration: false, // Hide configuration screen
    });
  };
}

/**
 * Ludo component with Zustand state management
 */
export const Ludo = LudoBare;
