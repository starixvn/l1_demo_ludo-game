/**
 * Ludo Game State Reducer
 *
 * This Redux reducer manages all state changes for the Ludo game.
 * It handles actions dispatched from the UI and updates the game state accordingly.
 * Each case corresponds to a specific game event or user interaction.
 */

import { Actions, ActionTypes } from './actions';
import { IState } from './interfaces';
import { DEFAULT_STARTING_BASE, WINNING_MOVES } from 'globalConstants';

/**
 * Initial state for the Ludo game
 * Sets up empty dictionaries for all game entities
 */
const initialState: IState = {
  bases: {},        // Will contain all player bases
  cells: {},        // Will contain all board cells organized by position
  horses: {},        // Will contain all game horses
  currentTurn: DEFAULT_STARTING_BASE, // Default starting turn (can be configured)
  links: {},        // Will contain cell connectivity information
  relationships: [], // Will contain relationships between board entities
  walkways: {},     // Will contain all walkway segments
  availableActions: null, // No actions available initially
  availableActionsDieValue: null, // No die value initially
  highlightedCells: null, // No cells highlighted initially
  highlightedCellsByHorse: null, // No cell-to-horse mapping initially
  hoveredHorseID: null, // No horse hovered initially
};

/**
 * Main reducer function that handles all Ludo game state updates
 * @param state - Current game state
 * @param action - Action dispatched to update the state
 * @returns New game state after applying the action
 */
export const reducer = (state: IState = initialState, action: Actions): IState => {
  switch (action.type) {
    /**
     * Initialize the game with data from the server
     * Sets up all bases, cells, horses, and board relationships
     */
    case ActionTypes.GET_INITIAL_GAME_DATA_SUCCESS: {
      const {
        bases,
        cells,
        horses,
        relationships,
        walkways,
        links,
        currentTurn,
      } = action.data!.gameData;
      return {
        ...state,
        bases,        // Initialize all player bases
        cells,        // Set up the game board cells
        horses,        // Initialize all horses in their starting positions
        links,        // Set up cell connectivity for movement validation
        relationships, // Define relationships between board entities
        walkways,     // Initialize walkway segments
        currentTurn: currentTurn || state.currentTurn, // Reset current turn or keep existing
        hoveredHorseID: null, // Reset hovered horse on game initialization
      };
    }

    /**
     * Successfully spawn a horse from base onto the board
     * Updates both the horse's state and the cell it occupies
     */
    case ActionTypes.SPAWN_HORSE_SUCCESS: {
      const { cellID, horseID, position } = action.data!;
      return {
        ...state,
        cells: {
          ...state.cells,
          [position]: {
            ...state.cells[position],
            [cellID]: {
              ...state.cells[position][cellID],
              horseIDs: [
                ...state.cells[position][cellID].horseIDs, // Add horse to cell's horse list
                horseID,
              ],
            },
          },
        },
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            cellID,       // Update horse's current cell
            isSpawned: true, // Mark horse as spawned
            position,     // Update horse's walkway position
          },
        },
      };
    }

    /**
     * Remove a horse from its current cell (when player picks it up to move)
     * This is part of the UI interaction for horse movement
     */
    case ActionTypes.LIFT_HORSE: {
      const { cellID, horseID, walkwayPosition } = action.data!;
      const horseIDsInCell = [...state.cells[walkwayPosition][cellID].horseIDs];
      const index = horseIDsInCell.findIndex((horseIDInCell) => horseIDInCell === horseID);
      horseIDsInCell.splice(index, 1); // Remove the horse from the cell
      return {
        ...state,
        cells: {
          ...state.cells,
          [walkwayPosition]: {
            ...state.cells[walkwayPosition],
            [cellID]: {
              ...state.cells[walkwayPosition][cellID],
              horseIDs: horseIDsInCell, // Update cell with horse removed
            },
          },
        },
      };
    }

    /**
     * Place a horse at a new cell position (completes the horse movement)
     * Updates both the horse's position and the cell it now occupies
     */
    case ActionTypes.PLACE_HORSE: {
      const { cellID, horseID, walkwayPosition } = action.data!;
      return {
        ...state,
        cells: {
          ...state.cells,
          [walkwayPosition]: {
            ...state.cells[walkwayPosition],
            [cellID]: {
              ...state.cells[walkwayPosition][cellID],
              horseIDs: [
                ...state.cells[walkwayPosition][cellID].horseIDs, // Add horse to new cell
                horseID,
              ],
            },
          },
        },
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            cellID,              // Update horse's cell
            position: walkwayPosition, // Update horse's position
          },
        },
      };
    }

    /**
     * Change whose turn it is to play
     */
    case ActionTypes.PASS_TURN_TO: {
      const { baseID } = action.data!;
      return {
        ...state,
        currentTurn: baseID, // Set the new active player
      };
    }

    /**
     * Mark the current player's base as spawnable (after rolling a 6)
     */
    case ActionTypes.MARK_CURRENT_BASE: {
      return {
        ...state,
        bases: {
          ...state.bases,
          [state.currentTurn]: {
            ...state.bases[state.currentTurn],
            spawnable: action.data!.spawnable, // Enable/disable spawning for current player
          },
        },
      };
    }

    /**
     * Send a horse back to its base (when hit by an opponent's horse)
     * Starts the flying animation - actual removal happens in COMPLETE_DISQUALIFY_HORSE
     */
    case ActionTypes.DISQUALIFY_HORSE: {
      const { horseID } = action.data!;
      // Just start the flying animation - don't remove the horse yet
      // The saga will handle the animation and then dispatch COMPLETE_DISQUALIFY_HORSE
      return {
        ...state,
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            isFlyingToBase: true, // Start flying animation
          },
        },
      };
    }

    /**
     * Complete horse disqualification after animation
     * Actually removes the horse from the cell and resets its state
     */
    case ActionTypes.COMPLETE_DISQUALIFY_HORSE: {
      const { horseID, walkwayPosition, cellID } = action.data!;

      const horseIDsInCell = [...state.cells[walkwayPosition][cellID].horseIDs];
      const horseIndexToDelete = horseIDsInCell.findIndex((horseIDInCell) => horseIDInCell === horseID);
      horseIDsInCell.splice(horseIndexToDelete, 1); // Remove horse from cell
      return {
        ...state,
        cells: {
          ...state.cells,
          [walkwayPosition]: {
            ...state.cells[walkwayPosition],
            [cellID]: {
              ...state.cells[walkwayPosition][cellID],
              horseIDs: horseIDsInCell, // Update cell without disqualified horse
            },
          },
        },
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            isSpawned: false, // Horse is no longer on board
            steps: 0,         // Reset progress
            isFlyingToBase: false, // Stop flying animation
          },
        },
      };
    }

    /**
     * Mark a horse as having reached home (completed the game)
     * Sets the horse as retired and gives it the winning number of steps
     */
    case ActionTypes.HOME_HORSE: {
      const { horseID } = action.data!;
      return {
        ...state,
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            isRetired: true,     // Horse has finished the game
            steps: WINNING_MOVES, // Set to winning step count
          },
        },
      };
    }

    /**
     * Update a horse's step count after a successful move
     * Adds the die roll value to the horse's total steps taken
     */
    case ActionTypes.MOVE_HORSE_SUCCESS: {
      const { currentDieRoll, horseID } = action.data!;
      return {
        ...state,
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            steps: state.horses[horseID].steps + currentDieRoll, // Add die roll to steps
          },
        },
      };
    }

    /**
     * Enable a specific player's base for gameplay
     */
    case ActionTypes.ENABLE_BASE: {
      const { baseID } = action.data!;
      return {
        ...state,
        bases: {
          ...state.bases,
          [baseID]: {
            ...state.bases[baseID],
            enabled: true, // Mark base as active in the game
          },
        },
      };
    }

    /**
     * Mark a player as the winner of the game
     */
    case ActionTypes.MARK_WINNER: {
      const { baseID } = action.data!;
      return {
        ...state,
        bases: {
          ...state.bases,
          [baseID]: {
            ...state.bases[baseID],
            hasWon: true, // This player has won the game
          },
        },
      };
    }

    /**
     * Set available actions for player to choose from
     */
    case ActionTypes.SET_AVAILABLE_ACTIONS: {
      const { actions, dieValue } = action.data!;
      return {
        ...state,
        availableActions: actions, // Store available actions
        availableActionsDieValue: dieValue, // Store associated die value
      };
    }

    /**
     * Clear available actions UI
     */
    case ActionTypes.CLEAR_AVAILABLE_ACTIONS: {
      return {
        ...state,
        availableActions: null, // Clear available actions
        availableActionsDieValue: null, // Clear die value
        hoveredHorseID: null, // Clear hovered horse when actions are cleared
      };
    }

    /**
     * Set highlighted cells for showing reachable destinations
     */
    case ActionTypes.SET_HIGHLIGHTED_CELLS: {
      const { cellIDs, cellsByHorse } = action.data!;
      return {
        ...state,
        highlightedCells: cellIDs, // Store set of highlighted cell IDs
        highlightedCellsByHorse: cellsByHorse || null, // Store cell-to-horse mapping
      };
    }

    /**
     * Clear cell highlighting
     */
    case ActionTypes.CLEAR_HIGHLIGHTED_CELLS: {
      return {
        ...state,
        highlightedCells: null, // Clear highlighted cells
        highlightedCellsByHorse: null, // Clear cell-to-horse mapping
      };
    }

    /**
     * Set which horse is being hovered (for action selection highlighting)
     */
    case ActionTypes.SET_HOVERED_HORSE: {
      const { horseID } = action.data!;
      return {
        ...state,
        hoveredHorseID: horseID, // Store hovered horse ID
      };
    }

    /**
     * Clear horse hover highlighting
     */
    case ActionTypes.CLEAR_HOVERED_HORSE: {
      return {
        ...state,
        hoveredHorseID: null, // Clear hovered horse ID
      };
    }

    /**
     * Start horse jumping animation
     * Sets the isJumping flag on the specified horse
     */
    case ActionTypes.START_HORSE_JUMP: {
      const { horseID } = action.data!;
      return {
        ...state,
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            isJumping: true,
          },
        },
      };
    }

    /**
     * Stop horse jumping animation
     * Clears the isJumping flag on the specified horse
     */
    case ActionTypes.STOP_HORSE_JUMP: {
      const { horseID } = action.data!;
      return {
        ...state,
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            isJumping: false,
          },
        },
      };
    }

    /**
     * Start horse flying to base animation (when kicked)
     * Sets the isFlyingToBase flag on the specified horse
     */
    case ActionTypes.START_HORSE_FLYING: {
      const { horseID } = action.data!;
      return {
        ...state,
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            isFlyingToBase: true,
          },
        },
      };
    }

    /**
     * Stop horse flying animation
     * Clears the isFlyingToBase flag on the specified horse
     */
    case ActionTypes.STOP_HORSE_FLYING: {
      const { horseID } = action.data!;
      return {
        ...state,
        horses: {
          ...state.horses,
          [horseID]: {
            ...state.horses[horseID],
            isFlyingToBase: false,
          },
        },
      };
    }

    default:
      return state;
  }
};
