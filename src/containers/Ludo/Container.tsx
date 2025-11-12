/**
 * Ludo Game Container Component
 *
 * The main container component for the entire Ludo game application.
 * Handles game initialization, player configuration, and orchestrates all game components.
 * This is the root component that brings together bases, walkways, players, and UI elements.
 */

import React from "react";
import { connect } from "react-redux"; // Redux connection
import { createStructuredSelector } from "reselect"; // Optimized state selection

import { Base } from "containers/Base/Container"; // Player base components
import { Home } from "containers/Home/Container"; // Home/finish area components
import { Player } from "containers/Player/Container"; // Player info panels
import { StepLogs } from "containers/StepLogs/Container"; // Game action log
import { Walkway } from "containers/Walkway/Container"; // Game board walkway
import { ActionSelection } from "containers/ActionSelection/Container"; // Action selection UI
import { BettingTable } from "containers/BettingTable/Container"; // Betting table
import { getStyleObject } from "containers/utils"; // Styling utilities
import { loadGameStateFromFile } from "common/utils"; // Game state loading utility
import { BOARD_SIZE } from "globalConstants"; // Board dimensions

import {
  clearAvailableActions,
  clearHighlightedCells,
  getInitialGameData,
  getInitialGameDataSuccess,
  setPlayers,
} from "./state/actions"; // Ludo actions
import {
  disableDie,
  enableDie,
  invalidateDieRoll,
} from "containers/Dice/state/actions"; // Dice actions
import {
  clearLogs,
  setAutoActionsEnabled,
} from "containers/StepLogs/state/actions"; // StepLogs actions
import { autoActionsEnabledSelector } from "containers/StepLogs/state/selectors"; // StepLogs selectors
import { BaseID, BoardEntities } from "./state/interfaces"; // Game data types
import {
  availableActionsSelector,
  basesSelector,
  currentTurnSelector,
  relationshipsSelector,
  walkwaysSelector,
} from "./state/selectors"; // State selectors

import styles from "./Container.module.css"; // Component styles

/**
 * Props dispatched to Redux actions
 */
interface IDispatchProps {
  clearAvailableActions: typeof clearAvailableActions; // Clear available actions UI
  clearHighlightedCells: typeof clearHighlightedCells; // Clear highlighted cells
  getInitialGameData: typeof getInitialGameData; // Initialize game data
  getInitialGameDataSuccess: typeof getInitialGameDataSuccess; // Load saved game state
  setPlayers: typeof setPlayers; // Configure number of players
  clearLogs: typeof clearLogs; // Clear game logs
  disableDie: typeof disableDie; // Disable die
  enableDie: typeof enableDie; // Enable die
  invalidateDieRoll: typeof invalidateDieRoll; // Invalidate die roll
  setAutoActionsEnabled: typeof setAutoActionsEnabled; // Set auto-actions enabled state
}

/**
 * Props from Redux state
 */
interface IStateProps {
  bases: ReturnType<typeof basesSelector>; // All player bases
  relationships: ReturnType<typeof relationshipsSelector>; // Board entity relationships
  walkways: ReturnType<typeof walkwaysSelector>; // Walkway configurations
  currentTurn: ReturnType<typeof currentTurnSelector>; // Whose turn it is
  autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector>; // Whether auto-actions are enabled
  availableActions: ReturnType<typeof availableActionsSelector>; // Available actions for selection
}

/** Public props (none in this case) */
interface IPublicProps {}

/** Combined props for the component */
interface IProps extends IPublicProps, IStateProps, IDispatchProps {}

/** Local component state */
interface IState {
  showPlayerConfiguration: boolean; // Whether to show player setup screen
  showDebugText: boolean; // Whether to show debug text (cell IDs, base IDs, etc.)
  showGameLog: boolean; // Whether to show the game log panel
  isPaused: boolean; // Whether the game is paused
  previousAutoActionsEnabled: boolean; // Store auto-actions state before pausing
}

/**
 * Maps Redux state to component props using reselect for performance
 */
const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector, // Get all player bases
  currentTurn: currentTurnSelector, // Get current player's turn
  relationships: relationshipsSelector, // Get board entity relationships
  walkways: walkwaysSelector, // Get walkway configurations
  autoActionsEnabled: autoActionsEnabledSelector, // Get auto-actions enabled state
  availableActions: availableActionsSelector, // Get available actions for selection
});

/**
 * Maps Redux dispatch actions to component props
 */
const mapDispatchToProps = {
  clearAvailableActions, // Action to clear available actions UI
  clearHighlightedCells, // Action to clear highlighted cells
  setPlayers, // Action to set number of players
  getInitialGameData, // Action to load initial game data
  getInitialGameDataSuccess, // Action to load saved game state
  clearLogs, // Action to clear game logs
  disableDie, // Action to disable die
  enableDie, // Action to enable die
  invalidateDieRoll, // Action to invalidate die roll
  setAutoActionsEnabled, // Action to set auto-actions enabled state
};

/**
 * Main Ludo container component class
 * Manages game initialization and renders the complete game interface
 */
class LudoBare extends React.PureComponent<IProps, IState> {
  /** Initial state shows player configuration screen */
  state: IState = {
    showPlayerConfiguration: false,
    showDebugText: false, // Hide debug text by default
    showGameLog: false, // Hide game log by default
    isPaused: false, // Game is not paused by default
    previousAutoActionsEnabled: false, // Store previous auto-actions state
  };

  /**
   * Load initial game data when component mounts
   * Automatically start the game with 4 players after page loads
   */
  componentDidMount() {
    this.props.getInitialGameData();
    // Auto-start game with 4 players after initial data is loaded
    // Use a small delay to ensure game data is loaded first
    setTimeout(() => {
      this.startGame(4);
    }, 100);
  }

  /**
   * Renders the complete Ludo game interface
   */
  render() {
    const { currentTurn, bases } = this.props;

    return (
      <div className={styles.Container}>
        {/* Main game area with board and players */}
        <div className={styles.GameContainer}>
          {/* Left side players (Base 1 & 3) */}
          <div className={styles.PlayerContainer}>
            <Player
              baseID={BaseID.BASE_1} // Red player
              placement="top" // Position at top of container
              disabled={
                currentTurn !== BaseID.BASE_1 || !bases[BaseID.BASE_1]?.enabled
              } // Disable if not their turn or base not enabled
            />
            <Player
              baseID={BaseID.BASE_3} // Yellow player
              placement="bottom" // Position at bottom of container
              disabled={
                currentTurn !== BaseID.BASE_3 || !bases[BaseID.BASE_3]?.enabled
              } // Disable if not their turn or base not enabled
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
              disabled={
                currentTurn !== BaseID.BASE_2 || !bases[BaseID.BASE_2]?.enabled
              }
            />
            <Player
              baseID={BaseID.BASE_4} // Green player
              placement="bottom"
              disabled={
                currentTurn !== BaseID.BASE_4 || !bases[BaseID.BASE_4]?.enabled
              }
            />
          </div>
        </div>

        {/* Betting Table - displayed below the board */}
        {!this.state.showPlayerConfiguration && <BettingTable />}

        {/* Debug text toggle checkbox - shown at all times */}
        <div className={styles.SidePanel}>
          {/* Reset game button - shown only during gameplay */}
          {!this.state.showPlayerConfiguration && (
            <button
              className={styles.ResetButton}
              onClick={this.handleResetGame}
              title="Reload the page to start fresh"
            >
              Reset Game
            </button>
          )}
          {/* Auto-actions toggle - shown at all times */}
          <label className={styles.CheckboxLabel}>
            <input
              type="checkbox"
              checked={this.props.autoActionsEnabled}
              onChange={(e) =>
                this.props.setAutoActionsEnabled(e.target.checked)
              }
              className={styles.Checkbox}
              disabled={this.state.isPaused}
            />
            <span className={styles.CheckboxLabelText}>Auto Run</span>
          </label>
          {/* Pause Game toggle - shown only during gameplay */}
          {!this.state.showPlayerConfiguration && (
            <label className={styles.CheckboxLabel}>
              <input
                type="checkbox"
                checked={this.state.isPaused}
                onChange={this.handlePauseGame}
                className={styles.Checkbox}
              />
              <span>Pause Game</span>
            </label>
          )}
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
          {/* Game log toggle checkbox - shown only during gameplay */}
          {!this.state.showPlayerConfiguration && (
            <label className={styles.CheckboxLabel}>
              <input
                type="checkbox"
                checked={this.state.showGameLog}
                onChange={(e) =>
                  this.setState({ showGameLog: e.target.checked })
                }
                className={styles.Checkbox}
              />
              <span>Show Game Log</span>
            </label>
          )}
          {/* Game log panel (shown only during gameplay and when enabled) */}
          {!this.state.showPlayerConfiguration && this.state.showGameLog && (
            <StepLogs />
          )}
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
            <button
              className={styles.Button}
              onClick={this.handleLoadGameState}
            >
              Load Game State
            </button>
          </div>
        ) : null}

        {/* Action Selection UI - shows available actions after dice roll */}
        <ActionSelection />
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
      const base = bases[relationship.ID]; // Get base data if applicable
      const walkway = walkways[relationship.ID]; // Get walkway data if applicable

      switch (relationship.type) {
        case BoardEntities.BASE:
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
              showDebugText={this.state.showDebugText} // Whether to show debug text
              key={index}
            />
          );
        case BoardEntities.WALKWAY:
          return (
            <Walkway
              walkway={walkway!} // Walkway configuration
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
    this.props.setPlayers(playerCount); // Set number of players in state
    this.setState({
      showPlayerConfiguration: false, // Hide configuration screen
    });
  };

  /**
   * Loads a previously saved game state from a JSON file
   * Allows players to continue a game from a saved state
   */
  private handleLoadGameState = () => {
    loadGameStateFromFile(
      (restoredState, metadata) => {
        // Restore the game state with proper type casting
        // currentTurn should be a BaseID enum value
        // availableActions, availableActionsDieValue, and highlightedCells should be null when loading a saved game
        this.props.getInitialGameDataSuccess({
          ...restoredState,
          currentTurn: restoredState.currentTurn as BaseID,
          availableActions: null,
          availableActionsDieValue: null,
          highlightedCells: null,
          highlightedCellsByHorse: null,
        });

        // Hide the configuration screen since we're loading an existing game
        this.setState({
          showPlayerConfiguration: false,
        });

        alert(
          `Game state loaded successfully!\nExported at: ${
            metadata.exportedAt || "Unknown"
          }\nTotal logs: ${metadata.totalLogs || 0}`
        );
      },
      (errorMessage) => {
        alert(errorMessage);
      }
    );
  };

  /**
   * Reloads the current page to start fresh
   */
  private handleResetGame = () => {
    // Confirm with user before reloading
    if (
      !window.confirm(
        "Are you sure you want to reload the page? All progress will be lost."
      )
    ) {
      return;
    }

    // Reload the page
    window.location.reload();
  };

  /**
   * Handles pausing/unpausing the game
   * When paused: disables die and auto-actions, stores previous auto-actions state
   * When unpaused: enables die and restores previous auto-actions state
   * Note: Does not enable die if we're in action selection stage to prevent countdown restart
   */
  private handlePauseGame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isPaused = e.target.checked;

    if (isPaused) {
      // Pause the game
      // Store current auto-actions state before pausing
      const previousAutoActionsEnabled = this.props.autoActionsEnabled;
      this.setState({
        isPaused: true,
        previousAutoActionsEnabled,
      });
      // Disable die to prevent any dice rolls
      this.props.disableDie();
      // Disable auto-actions
      this.props.setAutoActionsEnabled(false);
    } else {
      // Unpause the game
      // Restore previous auto-actions state
      this.props.setAutoActionsEnabled(this.state.previousAutoActionsEnabled);
      // Only enable die if we're NOT in action selection stage
      // If we're in action selection (availableActions exists), don't enable die
      // to prevent the countdown timer from restarting
      if (
        !this.props.availableActions ||
        this.props.availableActions.length === 0
      ) {
        // No action selection pending - safe to enable die
        this.props.enableDie();
      }
      // If we're in action selection, the die should remain disabled until action is selected
      this.setState({
        isPaused: false,
      });
    }
  };
}

/**
 * Connected Ludo component with Redux state and actions
 * Exports the component with proper TypeScript typing
 */
export const Ludo = connect(
  mapStateToProps, // State mapping
  mapDispatchToProps // Dispatch mapping
)(LudoBare) as unknown as React.ComponentClass<IPublicProps>;
