/**
 * Ludo Game State Management Actions
 *
 * This file defines all Redux actions for the Ludo game container.
 * Actions represent different game events and state changes that can occur during gameplay.
 */

import { Rolls } from 'containers/Dice/state/interfaces';
import { IReduxAction, WalkwayPosition } from 'state/interfaces';

import { IBase, ICell, IHorse, IState, IWalkway, BaseID } from './interfaces';

/**
 * Action Types for Ludo Game State Management
 * All action types are prefixed with 'ludo/' to avoid conflicts with other containers
 */
export enum ActionTypes {
  // Game Initialization Actions
  GET_INITIAL_GAME_DATA = 'ludo/GET_INITIAL_GAME_DATA',           // Request to load initial game state
  GET_INITIAL_GAME_DATA_SUCCESS = 'ludo/GET_INITIAL_GAME_DATA_SUCCESS', // Game data loaded successfully

  // Horse Movement Actions
  SPAWN_HORSE = 'ludo/SPAWN_HORSE',                               // Move horse from base to starting position (requires rolling 6)
  SPAWN_HORSE_SUCCESS = 'ludo/SPAWN_HORSE_SUCCESS',               // Horse successfully spawned on board
  MOVE_HORSE = 'ludo/MOVE_HORSE',                                 // Move horse along the walkway
  MOVE_HORSE_SUCCESS = 'ludo/MOVE_HORSE_SUCCESS',                 // Horse movement completed successfully
  MOVE_HORSE_FAILURE = 'ludo/MOVE_HORSE_FAILURE',                 // Horse movement failed (invalid move)
  LIFT_HORSE = 'ludo/LIFT_HORSE',                                 // Pick up horse from current position (UI interaction)
  PLACE_HORSE = 'ludo/PLACE_HORSE',                               // Place horse at target position (UI interaction)
  DISQUALIFY_HORSE = 'ludo/DISQUALIFY_HORSE',                     // Send horse back to base (when hit by opponent)
  HOME_HORSE = 'ludo/HOME_HORSE',                                 // Move horse to home position (game completion)

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

  // Horse Animation Actions
  START_HORSE_JUMP = 'ludo/START_HORSE_JUMP',                   // Start horse jumping animation
  STOP_HORSE_JUMP = 'ludo/STOP_HORSE_JUMP',                     // Stop horse jumping animation

  // Replay Actions
  START_REPLAY = 'ludo/START_REPLAY',                           // Begin deterministic replay
  STOP_REPLAY = 'ludo/STOP_REPLAY',                             // Stop deterministic replay
  PAUSE_REPLAY = 'ludo/PAUSE_REPLAY',                           // Pause deterministic replay
  RESUME_REPLAY = 'ludo/RESUME_REPLAY',                         // Resume deterministic replay
  SET_REPLAY_STEPS = 'ludo/SET_REPLAY_STEPS',                   // Provide replay steps (snapshots)
  NEXT_REPLAY_STEP = 'ludo/NEXT_REPLAY_STEP'                    // Advance to next replay step
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
 * Attempt to spawn a horse from the base onto the starting position
 * This requires the player to have rolled a 6 on the die
 * @param baseID - ID of the player's base
 * @param horseID - ID of the horse to spawn
 */
export const spawnHorse = (baseID: IBase['ID'], horseID: IHorse['horseID']): IReduxAction<ActionTypes.SPAWN_HORSE, { baseID: IBase['ID'], horseID: IHorse['horseID'] }> => ({
  data: { baseID, horseID },
  type: ActionTypes.SPAWN_HORSE,
});

/**
 * Action dispatched when a horse has been successfully spawned
 * @param cellID - ID of the cell where horse was placed
 * @param horseID - ID of the spawned horse
 * @param baseID - ID of the base the horse came from
 * @param position - Position on the walkway where horse was placed
 */
export const spawnHorseSuccess = (
  cellID: ICell['cellID'],
  horseID: IHorse['horseID'],
  baseID: IBase['ID'],
  position: IWalkway['position'],
): IReduxAction<ActionTypes.SPAWN_HORSE_SUCCESS, { cellID: ICell['cellID'], horseID: IHorse['horseID'], position: IWalkway['position'] }> => ({
  data: { cellID, horseID, position },
  type: ActionTypes.SPAWN_HORSE_SUCCESS,
});

/**
 * Attempt to move a horse to a new position on the walkway
 * @param horseID - ID of the horse to move
 * @param walkwayPosition - Target position on the walkway
 * @param cellID - ID of the target cell
 */
export const moveHorse = (
  horseID: IHorse['horseID'], 
  walkwayPosition: WalkwayPosition, 
  cellID: ICell['cellID'],
  blockingHorseID?: IHorse['horseID'],
  stepsBeforeBlocking?: number,
  stepsToUse?: number
): IReduxAction<ActionTypes.MOVE_HORSE, { horseID: IHorse['horseID']; walkwayPosition: WalkwayPosition; cellID: ICell['cellID']; blockingHorseID?: IHorse['horseID']; stepsBeforeBlocking?: number; stepsToUse?: number }> => ({
  data: { cellID, horseID, walkwayPosition, blockingHorseID, stepsBeforeBlocking, stepsToUse },
  type: ActionTypes.MOVE_HORSE,
});

/**
 * Place a horse at a specific position (UI interaction)
 * @param cellID - ID of the cell where horse will be placed
 * @param horseID - ID of the horse to place
 * @param walkwayPosition - Position on walkway where horse will be placed
 */
export const placeHorse = (cellID: ICell['cellID'], horseID: IHorse['horseID'], walkwayPosition: WalkwayPosition): IReduxAction<ActionTypes.PLACE_HORSE, { horseID: IHorse['horseID']; walkwayPosition: WalkwayPosition; cellID: ICell['cellID']; }> => ({
  data: { cellID, horseID, walkwayPosition },
  type: ActionTypes.PLACE_HORSE,
});

/**
 * Lift/pick up a horse from its current position (UI interaction)
 * @param cellID - ID of the cell where horse is currently located
 * @param horseID - ID of the horse to lift
 * @param walkwayPosition - Current position of the horse on walkway
 */
export const liftHorse = (cellID: ICell['cellID'], horseID: IHorse['horseID'], walkwayPosition: WalkwayPosition): IReduxAction<ActionTypes.LIFT_HORSE, { horseID: IHorse['horseID']; walkwayPosition: WalkwayPosition; cellID: ICell['cellID']; }> => ({
  data: { cellID, horseID, walkwayPosition },
  type: ActionTypes.LIFT_HORSE,
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
 * @param spawnable - Whether the current base can spawn new horses
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
 * Action dispatched when a horse movement has been completed successfully
 * @param bonusChance - Whether the player gets an extra turn
 * @param horseID - ID of the horse that was moved
 * @param currentDieRoll - The die roll value that caused this move
 */
export const moveHorseSuccess = (bonusChance: boolean, horseID: IHorse['horseID'], currentDieRoll: Rolls): IReduxAction<ActionTypes.MOVE_HORSE_SUCCESS, { bonusChance: boolean, horseID: IHorse['horseID'], currentDieRoll: Rolls }> => ({
  data: { bonusChance, currentDieRoll, horseID },
  type: ActionTypes.MOVE_HORSE_SUCCESS,
});

/**
 * Action dispatched when a horse movement attempt fails
 */
export const moveHorseFailure = (): IReduxAction<ActionTypes.MOVE_HORSE_FAILURE, void> => ({
  type: ActionTypes.MOVE_HORSE_FAILURE,
});

/**
 * Send a horse back to its base (when hit by an opponent's horse)
 * @param horseID - ID of the horse to disqualify
 * @param walkwayPosition - Current position of the horse
 * @param cellID - ID of the cell where horse is currently located
 */
export const disqualifyHorse = (horseID: IHorse['horseID'], walkwayPosition: WalkwayPosition, cellID: ICell['cellID']): IReduxAction<ActionTypes.DISQUALIFY_HORSE, { horseID: IHorse['horseID'], walkwayPosition: WalkwayPosition, cellID: ICell['cellID'] }> => ({
  data: { horseID, walkwayPosition, cellID },
  type: ActionTypes.DISQUALIFY_HORSE,
});

/**
 * Move a horse to its home position (completing the game for that horse)
 * @param horseID - ID of the horse that reached home
 */
export const homeHorse = (horseID: IHorse['horseID']): IReduxAction<ActionTypes.HOME_HORSE, { horseID: IHorse['horseID'] }> => ({
  data: { horseID },
  type: ActionTypes.HOME_HORSE,
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
  /** ID of the horse this action applies to */
  horseID: IHorse['horseID'];
  /** Human-readable label for this action */
  label: string;
  /** Optional description/details about this action */
  description?: string;
  /** For 'kick' and 'move_before' actions: ID of the blocking horse */
  blockingHorseID?: IHorse['horseID'];
  /** For 'move_before' action: number of steps to move before blocking horse */
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
 * @param cellsByHorse - Map of cellID to array of horses that can reach it with their move types
 */
export const setHighlightedCells = (
  cellIDs: Set<string>,
  cellsByHorse?: Map<string, Array<{ horseID: string; moveType: 'spawn' | 'kick' | 'move' }>>
): IReduxAction<ActionTypes.SET_HIGHLIGHTED_CELLS, { cellIDs: Set<string>; cellsByHorse?: Map<string, Array<{ horseID: string; moveType: 'spawn' | 'kick' | 'move' }>> }> => ({
  data: { cellIDs, cellsByHorse },
  type: ActionTypes.SET_HIGHLIGHTED_CELLS,
});

/**
 * Clears all cell highlighting
 */
export const clearHighlightedCells = (): IReduxAction<ActionTypes.CLEAR_HIGHLIGHTED_CELLS, void> => ({
  type: ActionTypes.CLEAR_HIGHLIGHTED_CELLS,
});

/** Replay step schema (matches output/game-states-*.json minimal fields) */
export interface IReplayStep {
  board?: { [key: string]: number[] } | null;
  dice: number[];
  currentPlayer: number; // 0..3 mapping to BaseID
  playerAction: { oldPosition: number; newPosition: number };
  kickedPlayer?: { player: number; position: number } | null;
}

/** Set replay steps parsed from output files */
export const setReplaySteps = (steps: IReplayStep[]): IReduxAction<ActionTypes.SET_REPLAY_STEPS, { steps: IReplayStep[] }> => ({
  data: { steps },
  type: ActionTypes.SET_REPLAY_STEPS,
});

/** Start/Stop/Pause/Resume replay */
export const startReplay = (): IReduxAction<ActionTypes.START_REPLAY, void> => ({ type: ActionTypes.START_REPLAY });
export const stopReplay = (): IReduxAction<ActionTypes.STOP_REPLAY, void> => ({ type: ActionTypes.STOP_REPLAY });
export const pauseReplay = (): IReduxAction<ActionTypes.PAUSE_REPLAY, void> => ({ type: ActionTypes.PAUSE_REPLAY });
export const resumeReplay = (): IReduxAction<ActionTypes.RESUME_REPLAY, void> => ({ type: ActionTypes.RESUME_REPLAY });
export const nextReplayStep = (): IReduxAction<ActionTypes.NEXT_REPLAY_STEP, void> => ({ type: ActionTypes.NEXT_REPLAY_STEP });

/**
 * Start horse jumping animation
 * @param horseID - ID of the horse to animate
 */
export const startHorseJump = (horseID: IHorse['horseID']): IReduxAction<ActionTypes.START_HORSE_JUMP, { horseID: IHorse['horseID'] }> => ({
  data: { horseID },
  type: ActionTypes.START_HORSE_JUMP,
});

/**
 * Stop horse jumping animation
 * @param horseID - ID of the horse to stop animating
 */
export const stopHorseJump = (horseID: IHorse['horseID']): IReduxAction<ActionTypes.STOP_HORSE_JUMP, { horseID: IHorse['horseID'] }> => ({
  data: { horseID },
  type: ActionTypes.STOP_HORSE_JUMP,
});

/**
 * Union type of all possible Ludo game actions
 * This type is used by the reducer to ensure type safety when handling actions
 * Each action type in this union corresponds to one of the action creators above
 */
export type Actions =
  | ReturnType<typeof getInitialGameDataSuccess>
  | ReturnType<typeof spawnHorse>
  | ReturnType<typeof spawnHorseSuccess>
  | ReturnType<typeof moveHorse>
  | ReturnType<typeof liftHorse>
  | ReturnType<typeof placeHorse>
  | ReturnType<typeof nextTurn>
  | ReturnType<typeof passTurnTo>
  | ReturnType<typeof markCurrentBase>
  | ReturnType<typeof moveHorseSuccess>
  | ReturnType<typeof disqualifyHorse>
  | ReturnType<typeof homeHorse>
  | ReturnType<typeof setPlayers>
  | ReturnType<typeof enableBase>
  | ReturnType<typeof markWinner>
  | ReturnType<typeof setAvailableActions>
  | ReturnType<typeof clearAvailableActions>
  | ReturnType<typeof setHighlightedCells>
  | ReturnType<typeof clearHighlightedCells>
  | ReturnType<typeof startHorseJump>
  | ReturnType<typeof stopHorseJump>
  | ReturnType<typeof setReplaySteps>
  | ReturnType<typeof startReplay>
  | ReturnType<typeof stopReplay>
  | ReturnType<typeof pauseReplay>
  | ReturnType<typeof resumeReplay>
  | ReturnType<typeof nextReplayStep>;
