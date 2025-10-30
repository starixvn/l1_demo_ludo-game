/**
 * Ludo Game Container Component
 *
 * The main container component for the entire Ludo game application.
 * Handles game initialization, player configuration, and orchestrates all game components.
 * This is the root component that brings together bases, walkways, players, and UI elements.
 */

import React from "react";
import { connect } from "react-redux";                    // Redux connection
import { createStructuredSelector } from "reselect";      // Optimized state selection

import { Base } from "containers/Base/Container";         // Player base components
import { Home } from "containers/Home/Container";         // Home/finish area components
import { Player } from "containers/Player/Container";     // Player info panels
import { StepLogs } from "containers/StepLogs/Container"; // Game action log
import { Walkway } from "containers/Walkway/Container";   // Game board walkway
import { getStyleObject } from "containers/utils";        // Styling utilities
import { BOARD_SIZE } from "globalConstants";             // Board dimensions
import { ContextMenu } from "services/contextMenu/Container"; // Right-click menu

import { getInitialGameData, setPlayers } from "./state/actions"; // Ludo actions
import { BaseID, BoardEntities } from "./state/interfaces"; // Game data types
import {
  basesSelector,
  currentTurnSelector,
  relationshipsSelector,
  walkwaysSelector,
} from "./state/selectors"; // State selectors

import styles from "./Container.module.css";              // Component styles

/**
 * Props dispatched to Redux actions
 */
interface IDispatchProps {
  getInitialGameData: typeof getInitialGameData; // Initialize game data
  setPlayers: typeof setPlayers;                 // Configure number of players
}

/**
 * Props from Redux state
 */
interface IStateProps {
  bases: ReturnType<typeof basesSelector>;           // All player bases
  relationships: ReturnType<typeof relationshipsSelector>; // Board entity relationships
  walkways: ReturnType<typeof walkwaysSelector>;     // Walkway configurations
  currentTurn: ReturnType<typeof currentTurnSelector>; // Whose turn it is
}

/** Public props (none in this case) */
interface IPublicProps {}

/** Combined props for the component */
interface IProps extends IPublicProps, IStateProps, IDispatchProps {}

/** Local component state */
interface IState {
  showPlayerConfiguration: boolean; // Whether to show player setup screen
}

/**
 * Maps Redux state to component props using reselect for performance
 */
const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector,           // Get all player bases
  currentTurn: currentTurnSelector, // Get current player's turn
  relationships: relationshipsSelector, // Get board entity relationships
  walkways: walkwaysSelector,     // Get walkway configurations
});

/**
 * Maps Redux dispatch actions to component props
 */
const mapDispatchToProps = {
  setPlayers,                    // Action to set number of players
  getInitialGameData,           // Action to load initial game data
};

/**
 * Main Ludo container component class
 * Manages game initialization and renders the complete game interface
 */
class LudoBare extends React.PureComponent<IProps, IState> {
  /** Initial state shows player configuration screen */
  state: IState = { showPlayerConfiguration: true };

  /**
   * Load initial game data when component mounts
   */
  componentDidMount() {
    this.props.getInitialGameData();
  }

  /**
   * Renders the complete Ludo game interface
   */
  render() {
    const { currentTurn } = this.props;

    return (
      <div className={styles.Container}>
        {/* Main game area with board and players */}
        <div className={styles.GameContainer}>
          {/* Left side players (Base 1 & 3) */}
          <div className={styles.PlayerContainer}>
            <Player
              baseID={BaseID.BASE_1}                    // Red player
              placement="top"                           // Position at top of container
              disabled={currentTurn !== BaseID.BASE_1} // Disable if not their turn
            />
            <Player
              baseID={BaseID.BASE_3}                    // Yellow player
              placement="bottom"                        // Position at bottom of container
              disabled={currentTurn !== BaseID.BASE_3} // Disable if not their turn
            />
          </div>

          {/* Main game board */}
          <div
            className={styles.Board}
            style={getStyleObject(BOARD_SIZE, BOARD_SIZE)} // Size the board
          >
            {this.renderBoardEntities()}               {/* Render bases, walkways, homes */}
          </div>

          {/* Right side players (Base 2 & 4) */}
          <div className={styles.PlayerContainer}>
            <Player
              baseID={BaseID.BASE_2}                    // Blue player
              placement="top"
              disabled={currentTurn !== BaseID.BASE_2}
            />
            <Player
              baseID={BaseID.BASE_4}                    // Green player
              placement="bottom"
              disabled={currentTurn !== BaseID.BASE_4}
            />
          </div>
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

        {/* Game log panel (shown during gameplay) */}
        {!this.state.showPlayerConfiguration && (
          <div className={styles.SidePanel}>
            <StepLogs />                               {/* Game action history */}
          </div>
        )}

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
    const { bases, relationships, walkways } = this.props;

    return relationships.map((relationship, index) => {
      const base = bases[relationship.ID];          // Get base data if applicable
      const walkway = walkways[relationship.ID];    // Get walkway data if applicable

      switch (relationship.type) {
        case BoardEntities.BASE:
          return (
            <Base
              baseID={base.ID}                       // Player base identifier
              key={index}                            // React key for list rendering
              enabled={base.enabled}                 // Whether base is active
              hasWon={base.hasWon}                   // Whether player has won
            />
          );
        case BoardEntities.HOME:
          return <Home
            baseIDs={relationship.baseIDs}          // Which bases this home belongs to
            key={index}
          />;
        case BoardEntities.WALKWAY:
          return <Walkway
            walkway={walkway!}                      // Walkway configuration
            key={index}
          />;
        default:
          return null;                              // Unknown entity type
      }
    });
  };

  /**
   * Starts the game with the specified number of players
   * Hides the configuration screen and initializes the game state
   */
  private startGame = (playerCount: number) => {
    this.props.setPlayers(playerCount);             // Set number of players in state
    this.setState({
      showPlayerConfiguration: false,              // Hide configuration screen
    });
  };
}

/**
 * Connected Ludo component with Redux state and actions
 * Exports the component with proper TypeScript typing
 */
export const Ludo = connect(
  mapStateToProps,                                 // State mapping
  mapDispatchToProps                               // Dispatch mapping
)(LudoBare) as unknown as React.ComponentClass<IPublicProps>;
