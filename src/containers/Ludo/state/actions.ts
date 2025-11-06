/**
 * Ludo Game State Management Actions
 *
 * This file defines all Redux actions for the Ludo game container.
 * Actions represent different game events and state changes that can occur during gameplay.
 */

import { Rolls } from 'containers/Dice/state/interfaces';
import { IReduxAction, WalkwayPosition } from 'state/interfaces';

import { IBase, ICell, ICoin, IState, IWalkway, BaseID } from './interfaces';

/**
 * Action Types for Ludo Game State Management
 * All action types are prefixed with 'ludo/' to avoid conflicts with other containers
 */
export enum ActionTypes {
  // Game Initialization Actions
  GET_INITIAL_GAME_DATA = 'ludo/GET_INITIAL_GAME_DATA',           // Request to load initial game state
  GET_INITIAL_GAME_DATA_SUCCESS = 'ludo/GET_INITIAL_GAME_DATA_SUCCESS', // Game data loaded successfully

  // Coin Movement Actions
  SPAWN_COIN = 'ludo/SPAWN_COIN',                               // Move coin from base to starting position (requires rolling 6)
  SPAWN_COIN_SUCCESS = 'ludo/SPAWN_COIN_SUCCESS',               // Coin successfully spawned on board
  MOVE_COIN = 'ludo/MOVE_COIN',                                 // Move coin along the walkway
  MOVE_COIN_SUCCESS = 'ludo/MOVE_COIN_SUCCESS',                 // Coin movement completed successfully
  MOVE_COIN_FAILURE = 'ludo/MOVE_COIN_FAILURE',                 // Coin movement failed (invalid move)
  LIFT_COIN = 'ludo/LIFT_COIN',                                 // Pick up coin from current position (UI interaction)
  PLACE_COIN = 'ludo/PLACE_COIN',                               // Place coin at target position (UI interaction)
  DISQUALIFY_COIN = 'ludo/DISQUALIFY_COIN',                     // Send coin back to base (when hit by opponent)
  HOME_COIN = 'ludo/HOME_COIN',                                 // Move coin to home position (game completion)

  // Turn Management Actions
  NEXT_TURN = 'ludo/NEXT_TURN',                                 // Advance to next player's turn
  PASS_TURN_TO = 'ludo/PASS_TURN_TO',                           // Pass turn to specific player

  // Game State Actions
  MARK_CURRENT_BASE = 'ludo/MARK_CURRENT_BASE',                 // Mark which player's base is currently active
  MARK_WINNER = 'ludo/MARK_WINNER',                             // Mark a player as winner

  // Player Setup Actions
  SET_PLAYERS = 'ludo/SET_PLAYERS',                             // Set number of players in game
  ENABLE_BASE = 'ludo/ENABLE_BASE',                             // Enable a specific player's base for gameplay

  // Action Selection UI Actions
  SET_AVAILABLE_ACTIONS = 'ludo/SET_AVAILABLE_ACTIONS',         // Set available actions for player to choose from
  CLEAR_AVAILABLE_ACTIONS = 'ludo/CLEAR_AVAILABLE_ACTIONS',     // Clear available actions UI

  // Cell Highlighting Actions
  SET_HIGHLIGHTED_CELLS = 'ludo/SET_HIGHLIGHTED_CELLS',         // Set cells to highlight as reachable
  CLEAR_HIGHLIGHTED_CELLS = 'ludo/CLEAR_HIGHLIGHTED_CELLS',     // Clear cell highlighting
}

/**
 * Action Creators - Functions that create Redux action objects
 * Each action creator returns a properly typed action with the correct payload
 */

/**
 * Request initial game data from the server/API
 * This is typically called when the game first loads
 */
export const getInitialGameData = (): IReduxAction<ActionTypes.GET_INITIAL_GAME_DATA, void> => ({
  type: ActionTypes.GET_INITIAL_GAME_DATA,
});

/**
 * Action dispatched when initial game data has been successfully loaded
 * @param gameData - Complete initial game state
 */
export const getInitialGameDataSuccess = (gameData: IState): IReduxAction<ActionTypes.GET_INITIAL_GAME_DATA_SUCCESS, { gameData: IState }> => ({
  data: { gameData },
  type: ActionTypes.GET_INITIAL_GAME_DATA_SUCCESS,
});

/**
 * Attempt to spawn a coin from the base onto the starting position
 * This requires the player to have rolled a 6 on the die
 * @param baseID - ID of the player's base
 * @param coinID - ID of the coin to spawn
 */
export const spawnCoin = (baseID: IBase['ID'], coinID: ICoin['coinID']): IReduxAction<ActionTypes.SPAWN_COIN, { baseID: IBase['ID'], coinID: ICoin['coinID'] }> => ({
  data: { baseID, coinID },
  type: ActionTypes.SPAWN_COIN,
});

/**
 * Action dispatched when a coin has been successfully spawned
 * @param cellID - ID of the cell where coin was placed
 * @param coinID - ID of the spawned coin
 * @param baseID - ID of the base the coin came from
 * @param position - Position on the walkway where coin was placed
 */
export const spawnCoinSuccess = (
  cellID: ICell['cellID'],
  coinID: ICoin['coinID'],
  baseID: IBase['ID'],
  position: IWalkway['position'],
): IReduxAction<ActionTypes.SPAWN_COIN_SUCCESS, { cellID: ICell['cellID'], coinID: ICoin['coinID'], position: IWalkway['position'] }> => ({
  data: { cellID, coinID, position },
  type: ActionTypes.SPAWN_COIN_SUCCESS,
});

/**
 * Attempt to move a coin to a new position on the walkway
 * @param coinID - ID of the coin to move
 * @param walkwayPosition - Target position on the walkway
 * @param cellID - ID of the target cell
 */
export const moveCoin = (
  coinID: ICoin['coinID'], 
  walkwayPosition: WalkwayPosition, 
  cellID: ICell['cellID'],
  blockingCoinID?: ICoin['coinID'],
  stepsBeforeBlocking?: number,
  stepsToUse?: number
): IReduxAction<ActionTypes.MOVE_COIN, { coinID: ICoin['coinID']; walkwayPosition: WalkwayPosition; cellID: ICell['cellID']; blockingCoinID?: ICoin['coinID']; stepsBeforeBlocking?: number; stepsToUse?: number }> => ({
  data: { cellID, coinID, walkwayPosition, blockingCoinID, stepsBeforeBlocking, stepsToUse },
  type: ActionTypes.MOVE_COIN,
});

/**
 * Place a coin at a specific position (UI interaction)
 * @param cellID - ID of the cell where coin will be placed
 * @param coinID - ID of the coin to place
 * @param walkwayPosition - Position on walkway where coin will be placed
 */
export const placeCoin = (cellID: ICell['cellID'], coinID: ICoin['coinID'], walkwayPosition: WalkwayPosition): IReduxAction<ActionTypes.PLACE_COIN, { coinID: ICoin['coinID']; walkwayPosition: WalkwayPosition; cellID: ICell['cellID']; }> => ({
  data: { cellID, coinID, walkwayPosition },
  type: ActionTypes.PLACE_COIN,
});

/**
 * Lift/pick up a coin from its current position (UI interaction)
 * @param cellID - ID of the cell where coin is currently located
 * @param coinID - ID of the coin to lift
 * @param walkwayPosition - Current position of the coin on walkway
 */
export const liftCoin = (cellID: ICell['cellID'], coinID: ICoin['coinID'], walkwayPosition: WalkwayPosition): IReduxAction<ActionTypes.LIFT_COIN, { coinID: ICoin['coinID']; walkwayPosition: WalkwayPosition; cellID: ICell['cellID']; }> => ({
  data: { cellID, coinID, walkwayPosition },
  type: ActionTypes.LIFT_COIN,
});

/**
 * Advance to the next player's turn in the game
 */
export const nextTurn = (): IReduxAction<ActionTypes.NEXT_TURN, void> => ({
  type: ActionTypes.NEXT_TURN,
});

/**
 * Pass the current turn to a specific player/base
 * @param baseID - ID of the base/player to receive the turn
 */
export const passTurnTo = (baseID: IBase['ID']): IReduxAction<ActionTypes.PASS_TURN_TO, { baseID: IBase['ID'] }> => ({
  data: { baseID },
  type: ActionTypes.PASS_TURN_TO,
});

/**
 * Mark which player's base is currently active/spawnable
 * @param spawnable - Whether the current base can spawn new coins
 */
export const markCurrentBase = (spawnable: boolean): IReduxAction<ActionTypes.MARK_CURRENT_BASE, { spawnable: boolean }> => ({
  data: { spawnable },
  type: ActionTypes.MARK_CURRENT_BASE,
});

/**
 * Mark a player as the winner of the game
 * @param baseID - ID of the winning player's base
 */
export const markWinner = (baseID: BaseID): IReduxAction<ActionTypes.MARK_WINNER, { baseID: BaseID }> => ({
  data: { baseID },
  type: ActionTypes.MARK_WINNER,
});

/**
 * Action dispatched when a coin movement has been completed successfully
 * @param bonusChance - Whether the player gets an extra turn
 * @param coinID - ID of the coin that was moved
 * @param currentDieRoll - The die roll value that caused this move
 */
export const moveCoinSuccess = (bonusChance: boolean, coinID: ICoin['coinID'], currentDieRoll: Rolls): IReduxAction<ActionTypes.MOVE_COIN_SUCCESS, { bonusChance: boolean, coinID: ICoin['coinID'], currentDieRoll: Rolls }> => ({
  data: { bonusChance, currentDieRoll, coinID },
  type: ActionTypes.MOVE_COIN_SUCCESS,
});

/**
 * Action dispatched when a coin movement attempt fails
 */
export const moveCoinFailure = (): IReduxAction<ActionTypes.MOVE_COIN_FAILURE, void> => ({
  type: ActionTypes.MOVE_COIN_FAILURE,
});

/**
 * Send a coin back to its base (when hit by an opponent's coin)
 * @param coinID - ID of the coin to disqualify
 * @param walkwayPosition - Current position of the coin
 * @param cellID - ID of the cell where coin is currently located
 */
export const disqualifyCoin = (coinID: ICoin['coinID'], walkwayPosition: WalkwayPosition, cellID: ICell['cellID']): IReduxAction<ActionTypes.DISQUALIFY_COIN, { coinID: ICoin['coinID'], walkwayPosition: WalkwayPosition, cellID: ICell['cellID'] }> => ({
  data: { coinID, walkwayPosition, cellID },
  type: ActionTypes.DISQUALIFY_COIN,
});

/**
 * Move a coin to its home position (completing the game for that coin)
 * @param coinID - ID of the coin that reached home
 */
export const homeCoin = (coinID: ICoin['coinID']): IReduxAction<ActionTypes.HOME_COIN, { coinID: ICoin['coinID'] }> => ({
  data: { coinID },
  type: ActionTypes.HOME_COIN,
});

/**
 * Set the number of players in the current game
 * @param playerCount - Number of players (typically 2-4)
 */
export const setPlayers = (playerCount: number): IReduxAction<ActionTypes.SET_PLAYERS, { playerCount: number }> => ({
  data: { playerCount },
  type: ActionTypes.SET_PLAYERS,
});

/**
 * Enable a specific player's base for gameplay
 * @param baseID - ID of the base to enable
 */
export const enableBase = (baseID: BaseID): IReduxAction<ActionTypes.ENABLE_BASE, { baseID: BaseID }> => ({
  data: { baseID },
  type: ActionTypes.ENABLE_BASE,
});

/**
 * Available action option for player selection UI
 */
export interface IAvailableAction {
  /** Type of action: 'spawn', 'move', 'kick', or 'move_before' */
  type: 'spawn' | 'move' | 'kick' | 'move_before';
  /** ID of the coin this action applies to */
  coinID: ICoin['coinID'];
  /** Human-readable label for this action */
  label: string;
  /** Optional description/details about this action */
  description?: string;
  /** For 'kick' and 'move_before' actions: ID of the blocking coin */
  blockingCoinID?: ICoin['coinID'];
  /** For 'move_before' action: number of steps to move before blocking coin */
  stepsBeforeBlocking?: number;
  /** Optional: steps to use for this move (when using single die instead of sum) */
  stepsToUse?: number;
}

/**
 * Sets available actions that the player can choose from after rolling dice
 * @param actions - Array of available action options
 * @param dieValue - The die roll value that triggered these actions
 */
export const setAvailableActions = (
  actions: IAvailableAction[],
  dieValue: Rolls
): IReduxAction<ActionTypes.SET_AVAILABLE_ACTIONS, { actions: IAvailableAction[]; dieValue: Rolls }> => ({
  data: { actions, dieValue },
  type: ActionTypes.SET_AVAILABLE_ACTIONS,
});

/**
 * Clears the available actions UI (hides the action selection panel)
 */
export const clearAvailableActions = (): IReduxAction<ActionTypes.CLEAR_AVAILABLE_ACTIONS, void> => ({
  type: ActionTypes.CLEAR_AVAILABLE_ACTIONS,
});

/**
 * Sets which cells should be highlighted as reachable for the current player
 * @param cellIDs - Set of cell IDs to highlight
 * @param cellsByCoin - Map of cellID to array of coins that can reach it with their move types
 */
export const setHighlightedCells = (
  cellIDs: Set<string>,
  cellsByCoin?: Map<string, Array<{ coinID: string; moveType: 'spawn' | 'kick' | 'move' }>>
): IReduxAction<ActionTypes.SET_HIGHLIGHTED_CELLS, { cellIDs: Set<string>; cellsByCoin?: Map<string, Array<{ coinID: string; moveType: 'spawn' | 'kick' | 'move' }>> }> => ({
  data: { cellIDs, cellsByCoin },
  type: ActionTypes.SET_HIGHLIGHTED_CELLS,
});

/**
 * Clears all cell highlighting
 */
export const clearHighlightedCells = (): IReduxAction<ActionTypes.CLEAR_HIGHLIGHTED_CELLS, void> => ({
  type: ActionTypes.CLEAR_HIGHLIGHTED_CELLS,
});

/**
 * Union type of all possible Ludo game actions
 * This type is used by the reducer to ensure type safety when handling actions
 * Each action type in this union corresponds to one of the action creators above
 */
export type Actions =
  | ReturnType<typeof getInitialGameDataSuccess>
  | ReturnType<typeof spawnCoin>
  | ReturnType<typeof spawnCoinSuccess>
  | ReturnType<typeof moveCoin>
  | ReturnType<typeof liftCoin>
  | ReturnType<typeof placeCoin>
  | ReturnType<typeof nextTurn>
  | ReturnType<typeof passTurnTo>
  | ReturnType<typeof markCurrentBase>
  | ReturnType<typeof moveCoinSuccess>
  | ReturnType<typeof disqualifyCoin>
  | ReturnType<typeof homeCoin>
  | ReturnType<typeof setPlayers>
  | ReturnType<typeof enableBase>
  | ReturnType<typeof markWinner>
  | ReturnType<typeof setAvailableActions>
  | ReturnType<typeof clearAvailableActions>
  | ReturnType<typeof setHighlightedCells>
  | ReturnType<typeof clearHighlightedCells>
  ;
