/**
 * Ludo Game Data Structures and Interfaces
 *
 * This file defines all the TypeScript interfaces and types used throughout the Ludo game.
 * These structures represent the game state, board entities, and player data.
 */

import { BaseColors, WalkwayPosition } from 'state/interfaces';

/**
 * Represents a single game horse/piece that players control
 */
export interface IHorse {
  /** Whether this horse has completed the game (reached home) */
  isRetired: boolean;
  /** Whether this horse has been spawned from base onto the board */
  isSpawned: boolean;
  /** Unique identifier for this horse */
  horseID: string;
  /** Color of this horse (matches its base color) */
  color: BaseColors;
  /** ID of the base this horse belongs to */
  baseID: IBase['ID'];
  /** Number of steps this horse has taken along the walkway */
  steps: number;
  /** ID of the cell this horse is currently occupying */
  cellID: ICell['cellID'];
  /** Position on the walkway where this horse is located */
  position: WalkwayPosition;
  /** Whether this horse is currently jumping (for animation) */
  isJumping?: boolean;
  /** Whether this horse is currently flying to base (for kick animation) */
  isFlyingToBase?: boolean;
}

/**
 * Enumeration of possible player bases in the Ludo game
 * Each base represents one player and has 4 horses
 */
export enum BaseID {
  BASE_1 = 'BASE_1', // Player 1 (typically red)
  BASE_2 = 'BASE_2', // Player 2 (typically blue)
  BASE_3 = 'BASE_3', // Player 3 (typically yellow)
  BASE_4 = 'BASE_4', // Player 4 (typically green)
}

/**
 * Represents a player's base/home area where horses start and can be sent back to
 */
export interface IBase {
  /** Array of horse IDs that belong to this base */
  horseIDs: IHorse['horseID'][];
  /** Color associated with this base/player */
  color: BaseColors;
  /** Unique identifier for this base */
  ID: BaseID;
  /** ID of the next base in turn order */
  nextTurn: BaseID;
  /** Whether this base can currently spawn new horses (has rolled a 6) */
  spawnable: boolean;
  /** Whether this player has won the game */
  hasWon: boolean;
  /** Whether this base is enabled/participating in the current game */
  enabled: boolean;
}

/**
 * Represents a position on the game walkway/path that horses travel along
 */
export interface IWalkway {
  /** Position coordinate on the walkway */
  position: WalkwayPosition;
  /** Unique identifier for this walkway segment */
  ID: string;
  /** ID of the base this walkway segment belongs to */
  baseID: IBase['ID'];
}

/**
 * Types of entities that can exist on the Ludo game board
 */
export enum BoardEntities {
  BASE = 'BASE',      // Starting area for each player
  WALKWAY = 'WALKWAY', // The path horses travel along
  HOME = 'HOME',      // Final destination area
}

/**
 * Different types of cells that can exist on the game board
 */
export enum CellType {
  SPAWN = 'SPAWN',      // Cells where horses spawn from base
  HOMEPATH = 'HOMEPATH', // Cells on the path to home
  NORMAL = 'NORMAL',    // Regular walkway cells
}

/**
 * Represents a single cell/space on the Ludo game board
 */
export interface ICell {
  /** Unique identifier for this cell */
  cellID: string;
  /** Column position on the board grid */
  column: number;
  /** Walkway position coordinate */
  position: WalkwayPosition;
  /** Row position on the board grid */
  row: number;
  /** Type of cell (spawn, homepath, normal) */
  cellType: CellType;
  /** ID of the base this cell belongs to */
  baseID: IBase['ID'];
  /** Array of horse IDs currently occupying this cell */
  horseIDs: IHorse['horseID'][];
  /** Index value for NORMAL cells (for debugging) */
  index?: number;
  /** Whether this cell should not be rendered in the walkway (rendered in Home instead) */
  notRenderInWalkway?: boolean;
}

/**
 * Defines relationships between different board entities
 */
export interface IRelationship {
  /** Unique identifier for this relationship */
  ID: string;
  /** Type of board entity this relationship refers to */
  type: BoardEntities;
  /** Array of base IDs involved in this relationship (optional) */
  baseIDs?: IBase['ID'][];
}

/**
 * Main game state interface containing all game data
 * This represents the complete state of a Ludo game at any point in time
 */
export interface IState {
  /** Dictionary of all player bases, keyed by baseID */
  bases: { [baseID: string]: IBase };
  /** Dictionary of all walkway segments, keyed by walkwayID */
  walkways: { [walkwayID: string]: IWalkway };
  /** Array of relationships between board entities */
  relationships: IServerGameData['relationships'];
  /** Nested structure of cells organized by walkway position */
  cells: IServerGameData['cells'];
  /** Links between cells for pathfinding */
  links: IServerGameData['links'];
  /** Dictionary of all horses in the game, keyed by horseID */
  horses: { [horseID: string]: IHorse };
  /** ID of the base whose turn it currently is */
  currentTurn: BaseID;
  /** Available actions for the player to choose from (null when no action selection needed) */
  availableActions: IAvailableAction[] | null;
  /** Current die roll value associated with available actions */
  availableActionsDieValue: number | null;
  /** Set of cell IDs that should be highlighted as reachable for current player */
  highlightedCells: Set<string> | null;
  /** Map of cellID to array of horses that can reach it with their move types */
  highlightedCellsByHorse: Map<string, Array<{ horseID: IHorse['horseID']; moveType: 'spawn' | 'kick' | 'move' }>> | null;
  /** ID of horse being hovered in action selection (for highlighting) */
  hoveredHorseID: IHorse['horseID'] | null;
}

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
 * Data structure received from the server when initializing a new game
 * Contains arrays of all game entities before they are converted to dictionaries
 */
export interface IServerGameData {
  /** Array of all player bases */
  bases: IBase[];
  /** Array of all horses in the game */
  horses: IHorse[];
  /** Array of all walkway segments */
  walkways: IWalkway[];
  /** Array of relationships between board entities */
  relationships: IRelationship[];
  /** Nested structure of cells: walkwayPosition -> cellID -> cellData */
  cells: {
    [walkwayPosition: string]: {
      [cellID: string]: ICell;
    };
  };
  /** Links between cells for determining valid moves and paths */
  links: { [cellID: string]: Pick<ICell, 'position' | 'cellID'>[] };
}

/**
 * Represents a movement pathway for a horse from one cell to another
 * Used for validating and executing horse movements
 */
export interface IPathway {
  /** Starting position of the movement */
  from: {
    /** ID of the cell the horse is moving from */
    cellID: ICell['cellID'];
    /** Walkway position the horse is moving from */
    walkwayPosition: WalkwayPosition;
  };
  /** Ending position of the movement */
  to: {
    /** ID of the cell the horse is moving to */
    cellID: ICell['cellID'];
    /** Walkway position the horse is moving to */
    walkwayPosition: WalkwayPosition;
  };
  /** ID of the horse being moved */
  horseID: IHorse['horseID'];
}
