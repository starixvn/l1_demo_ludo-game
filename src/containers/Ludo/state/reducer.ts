/**
 * Ludo Game State Reducer
 *
 * This Redux reducer manages all state changes for the Ludo game.
 * It handles actions dispatched from the UI and updates the game state accordingly.
 * Each case corresponds to a specific game event or user interaction.
 */

import { WINNING_MOVES } from 'globalConstants';

import { Actions, ActionTypes } from './actions';
import { BaseID, IState } from './interfaces';

/**
 * Initial state for the Ludo game
 * Sets up empty dictionaries for all game entities
 */
const initialState: IState = {
  bases: {},        // Will contain all player bases
  cells: {},        // Will contain all board cells organized by position
  coins: {},        // Will contain all game coins
  currentTurn: BaseID.BASE_3, // Default starting turn (can be configured)
  links: {},        // Will contain cell connectivity information
  relationships: [], // Will contain relationships between board entities
  walkways: {},     // Will contain all walkway segments
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
     * Sets up all bases, cells, coins, and board relationships
     */
    case ActionTypes.GET_INITIAL_GAME_DATA_SUCCESS: {
      const {
        bases,
        cells,
        coins,
        relationships,
        walkways,
        links,
        currentTurn,
      } = action.data!.gameData;
      return {
        ...state,
        bases,        // Initialize all player bases
        cells,        // Set up the game board cells
        coins,        // Initialize all coins in their starting positions
        links,        // Set up cell connectivity for movement validation
        relationships, // Define relationships between board entities
        walkways,     // Initialize walkway segments
        currentTurn: currentTurn || state.currentTurn, // Reset current turn or keep existing
      };
    }

    /**
     * Successfully spawn a coin from base onto the board
     * Updates both the coin's state and the cell it occupies
     */
    case ActionTypes.SPAWN_COIN_SUCCESS: {
      const { cellID, coinID, position } = action.data!;
      return {
        ...state,
        cells: {
          ...state.cells,
          [position]: {
            ...state.cells[position],
            [cellID]: {
              ...state.cells[position][cellID],
              coinIDs: [
                ...state.cells[position][cellID].coinIDs, // Add coin to cell's coin list
                coinID,
              ],
            },
          },
        },
        coins: {
          ...state.coins,
          [coinID]: {
            ...state.coins[coinID],
            cellID,       // Update coin's current cell
            isSpawned: true, // Mark coin as spawned
            position,     // Update coin's walkway position
          },
        },
      };
    }

    /**
     * Remove a coin from its current cell (when player picks it up to move)
     * This is part of the UI interaction for coin movement
     */
    case ActionTypes.LIFT_COIN: {
      const { cellID, coinID, walkwayPosition } = action.data!;
      const coinIDsInCell = [...state.cells[walkwayPosition][cellID].coinIDs];
      const index = coinIDsInCell.findIndex((coinIDInCell) => coinIDInCell === coinID);
      coinIDsInCell.splice(index, 1); // Remove the coin from the cell
      return {
        ...state,
        cells: {
          ...state.cells,
          [walkwayPosition]: {
            ...state.cells[walkwayPosition],
            [cellID]: {
              ...state.cells[walkwayPosition][cellID],
              coinIDs: coinIDsInCell, // Update cell with coin removed
            },
          },
        },
      };
    }

    /**
     * Place a coin at a new cell position (completes the coin movement)
     * Updates both the coin's position and the cell it now occupies
     */
    case ActionTypes.PLACE_COIN: {
      const { cellID, coinID, walkwayPosition } = action.data!;
      return {
        ...state,
        cells: {
          ...state.cells,
          [walkwayPosition]: {
            ...state.cells[walkwayPosition],
            [cellID]: {
              ...state.cells[walkwayPosition][cellID],
              coinIDs: [
                ...state.cells[walkwayPosition][cellID].coinIDs, // Add coin to new cell
                coinID,
              ],
            },
          },
        },
        coins: {
          ...state.coins,
          [coinID]: {
            ...state.coins[coinID],
            cellID,              // Update coin's cell
            position: walkwayPosition, // Update coin's position
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
     * Send a coin back to its base (when hit by an opponent's coin)
     * Resets the coin's progress and removes it from the board
     */
    case ActionTypes.DISQUALIFY_COIN: {
      const { coinID, walkwayPosition, cellID } = action.data!;

      const coinIDsInCell = [...state.cells[walkwayPosition][cellID].coinIDs];
      const coinIndexToDelete = coinIDsInCell.findIndex((coinIDInCell) => coinIDInCell === coinID);
      coinIDsInCell.splice(coinIndexToDelete, 1); // Remove coin from cell
      return {
        ...state,
        cells: {
          ...state.cells,
          [walkwayPosition]: {
            ...state.cells[walkwayPosition],
            [cellID]: {
              ...state.cells[walkwayPosition][cellID],
              coinIDs: coinIDsInCell, // Update cell without disqualified coin
            },
          },
        },
        coins: {
          ...state.coins,
          [coinID]: {
            ...state.coins[coinID],
            isSpawned: false, // Coin is no longer on board
            steps: 0,         // Reset progress
          },
        },
      };
    }

    /**
     * Mark a coin as having reached home (completed the game)
     * Sets the coin as retired and gives it the winning number of steps
     */
    case ActionTypes.HOME_COIN: {
      const { coinID } = action.data!;
      return {
        ...state,
        coins: {
          ...state.coins,
          [coinID]: {
            ...state.coins[coinID],
            isRetired: true,     // Coin has finished the game
            steps: WINNING_MOVES, // Set to winning step count
          },
        },
      };
    }

    /**
     * Update a coin's step count after a successful move
     * Adds the die roll value to the coin's total steps taken
     */
    case ActionTypes.MOVE_COIN_SUCCESS: {
      const { currentDieRoll, coinID } = action.data!;
      return {
        ...state,
        coins: {
          ...state.coins,
          [coinID]: {
            ...state.coins[coinID],
            steps: state.coins[coinID].steps + currentDieRoll, // Add die roll to steps
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
    default:
      return state;
  }
};
