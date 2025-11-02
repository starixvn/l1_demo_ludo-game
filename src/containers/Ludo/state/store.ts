/**
 * Ludo Game Container Zustand Store
 *
 * Zustand store for Ludo game state management, replacing Redux.
 * Handles all game logic, coin movement, turn management, and game state.
 */

import create from "zustand";
import axios from "axios";

import { WINNING_MOVES } from "globalConstants";
import { WalkwayPosition } from "state/interfaces";
import { diceStore } from "containers/Dice/state/store";
import { stepLogsStore } from "containers/StepLogs/state/store";

import {
  BaseID,
  IState,
  IServerGameData,
  ICoin,
  IBase,
  ICell,
} from "./interfaces";
import { Rolls } from "containers/Dice/state/interfaces";

interface LudoState extends IState {
  // Actions
  getInitialGameData: () => Promise<void>;
  getInitialGameDataSuccess: (gameData: IState) => void;
  spawnCoin: (baseID: IBase["ID"], coinID: ICoin["coinID"]) => void;
  spawnCoinSuccess: (
    cellID: ICell["cellID"],
    coinID: ICoin["coinID"],
    position: WalkwayPosition,
    baseID: IBase["ID"]
  ) => void;
  moveCoin: (
    coinID: ICoin["coinID"],
    walkwayPosition: WalkwayPosition,
    cellID: ICell["cellID"]
  ) => void;
  moveCoinSuccess: (
    bonusChance: boolean,
    coinID: ICoin["coinID"],
    currentDieRoll: Rolls
  ) => void;
  liftCoin: (
    cellID: ICell["cellID"],
    coinID: ICoin["coinID"],
    walkwayPosition: WalkwayPosition
  ) => void;
  placeCoin: (
    cellID: ICell["cellID"],
    coinID: ICoin["coinID"],
    walkwayPosition: WalkwayPosition
  ) => void;
  nextTurn: () => void;
  passTurnTo: (baseID: IBase["ID"]) => void;
  markCurrentBase: (spawnable: boolean) => void;
  disqualifyCoin: (
    coinID: ICoin["coinID"],
    walkwayPosition: WalkwayPosition,
    cellID: ICell["cellID"]
  ) => void;
  homeCoin: (coinID: ICoin["coinID"]) => void;
  setPlayers: (playerCount: number) => void;
  enableBase: (baseID: BaseID) => void;
  markWinner: (baseID: BaseID) => void;
}

/**
 * Initial state for the Ludo game store
 */
const initialState: IState = {
  bases: {}, // Will contain all player bases
  cells: {}, // Will contain all board cells organized by position
  coins: {}, // Will contain all game coins
  currentTurn: BaseID.BASE_3, // Default starting turn (can be configured)
  links: {}, // Will contain cell connectivity information
  relationships: [], // Will contain relationships between board entities
  walkways: {}, // Will contain all walkway segments
};

/**
 * Ludo Zustand store
 * Manages all Ludo game state and logic
 */
export const ludoStore = create<LudoState>((set, get) => ({
  ...initialState,

  /**
   * Load initial game data from the server
   */
  getInitialGameData: async () => {
    try {
      const response = await axios.get("/initialGameData.json");
      const gameData: IServerGameData = response.data;

      // Convert arrays to dictionaries for efficient lookups
      const bases: { [baseID: string]: IBase } = {};
      gameData.bases.forEach((base) => {
        bases[base.ID] = base;
      });

      const coins: { [coinID: string]: ICoin } = {};
      gameData.coins.forEach((coin) => {
        coins[coin.coinID] = coin;
      });

      const walkways: { [walkwayID: string]: any } = {};
      gameData.walkways.forEach((walkway) => {
        walkways[walkway.ID] = walkway;
      });

      const state: IState = {
        bases,
        cells: gameData.cells,
        coins,
        currentTurn: BaseID.BASE_3, // Default starting turn
        links: gameData.links,
        relationships: gameData.relationships,
        walkways,
      };

      get().getInitialGameDataSuccess(state);
    } catch (error) {
      console.error("Failed to load initial game data:", error);
    }
  },

  /**
   * Handle successful loading of initial game data
   */
  getInitialGameDataSuccess: (gameData: IState) => {
    set({
      bases: gameData.bases,
      cells: gameData.cells,
      coins: gameData.coins,
      links: gameData.links,
      relationships: gameData.relationships,
      walkways: gameData.walkways,
    });
  },

  /**
   * Spawn a coin from base onto the board
   */
  spawnCoin: (baseID: IBase["ID"], coinID: ICoin["coinID"]) => {
    const state = get();
    //const coin = state.coins[coinID];

    // Find the spawn cell for this base
    const spawnCell = (
      Object.values(state.cells) as { [cellID: string]: ICell }[]
    ).reduce((acc: ICell[], positionCells) => {
      const spawnCells = Object.values(positionCells).filter(
        (cell: ICell) => cell.cellType === "SPAWN" && cell.baseID === baseID
      );
      return acc.concat(spawnCells);
    }, [])[0];

    if (spawnCell) {
      // Spawn the coin
      stepLogsStore.getState().addLogEntry({
        player: state.bases[baseID].color,
        action: "Spawning coin",
        details: `Spawning coin ${coinID} at cell ${spawnCell.cellID}`,
      });
      
      get().spawnCoinSuccess(
        spawnCell.cellID,
        coinID,
        spawnCell.position,
        baseID
      );
    } else {
      // Log error if spawn cell not found
      console.error(`No spawn cell found for base ${baseID}`);
      stepLogsStore.getState().addLogEntry({
        player: state.bases[baseID].color,
        action: "Spawn failed",
        details: `Could not find spawn cell for base ${baseID}`,
      });
    }
  },

  /**
   * Handle successful coin spawning
   */
  spawnCoinSuccess: (
    cellID: ICell["cellID"],
    coinID: ICoin["coinID"],
    position: WalkwayPosition,
    baseID: IBase["ID"]
  ) => {
    set((state: LudoState) => ({
      cells: {
        ...state.cells,
        [position]: {
          ...state.cells[position],
          [cellID]: {
            ...state.cells[position][cellID],
            coinIDs: [...state.cells[position][cellID].coinIDs, coinID],
          },
        },
      },
      coins: {
        ...state.coins,
        [coinID]: {
          ...state.coins[coinID],
          cellID,
          isSpawned: true,
          position,
        },
      },
    }));
  },

  /**
   * Move a coin to a new position
   */
  moveCoin: (
    coinID: ICoin["coinID"],
    walkwayPosition: WalkwayPosition,
    cellID: ICell["cellID"]
  ) => {
    const state = get();
    const coin = state.coins[coinID];

    // Lift coin from current position
    get().liftCoin(coin.cellID, coinID, coin.position);

    // Place coin at new position
    get().placeCoin(cellID, coinID, walkwayPosition);

    // Check for bonus turn (rolling 6, reaching home, or capturing)
    const bonusChance = checkBonusChance(
      coinID,
      walkwayPosition,
      cellID,
      state
    );

    // Mark move as successful
    const currentDieRoll = diceStore.getState().roll;
    get().moveCoinSuccess(bonusChance, coinID, currentDieRoll);
  },

  /**
   * Handle successful coin movement
   */
  moveCoinSuccess: (
    bonusChance: boolean,
    coinID: ICoin["coinID"],
    currentDieRoll: Rolls
  ) => {
    set((state: LudoState) => ({
      coins: {
        ...state.coins,
        [coinID]: {
          ...state.coins[coinID],
          steps: state.coins[coinID].steps + currentDieRoll,
        },
      },
    }));

    // Handle bonus turn logic
    if (bonusChance) {
      // If rolled 6, don't advance turn - player gets another roll
      diceStore.getState().enableDie();
      const autoActionsEnabled = stepLogsStore.getState().autoActionsEnabled;
      if (autoActionsEnabled) {
        // Auto-roll after a short delay
        setTimeout(async () => {
          await diceStore.getState().rollDie();
        }, stepLogsStore.getState().autoActionTimeout);
      }
    } else {
      // Non-6 roll: invalidate roll and advance to next turn
      diceStore.getState().invalidateDieRoll();
      get().nextTurn();
      
      // Auto-roll for next player if autoActionsEnabled
      const autoActionsEnabled = stepLogsStore.getState().autoActionsEnabled;
      if (autoActionsEnabled) {
        setTimeout(async () => {
          diceStore.getState().enableDie();
          await diceStore.getState().rollDie();
        }, stepLogsStore.getState().autoActionTimeout);
      } else {
        diceStore.getState().enableDie();
      }
    }
  },

  /**
   * Lift a coin from its current cell (UI interaction)
   */
  liftCoin: (
    cellID: ICell["cellID"],
    coinID: ICoin["coinID"],
    walkwayPosition: WalkwayPosition
  ) => {
    set((state: LudoState) => {
      const coinIDsInCell = [...state.cells[walkwayPosition][cellID].coinIDs];
      const index = coinIDsInCell.findIndex(
        (coinIDInCell) => coinIDInCell === coinID
      );
      coinIDsInCell.splice(index, 1);

      return {
        cells: {
          ...state.cells,
          [walkwayPosition]: {
            ...state.cells[walkwayPosition],
            [cellID]: {
              ...state.cells[walkwayPosition][cellID],
              coinIDs: coinIDsInCell,
            },
          },
        },
      };
    });
  },

  /**
   * Place a coin at a new cell position
   */
  placeCoin: (
    cellID: ICell["cellID"],
    coinID: ICoin["coinID"],
    walkwayPosition: WalkwayPosition
  ) => {
    set((state: LudoState) => ({
      cells: {
        ...state.cells,
        [walkwayPosition]: {
          ...state.cells[walkwayPosition],
          [cellID]: {
            ...state.cells[walkwayPosition][cellID],
            coinIDs: [...state.cells[walkwayPosition][cellID].coinIDs, coinID],
          },
        },
      },
      coins: {
        ...state.coins,
        [coinID]: {
          ...state.coins[coinID],
          cellID,
          position: walkwayPosition,
        },
      },
    }));
  },

  /**
   * Advance to the next player's turn
   */
  nextTurn: () => {
    const state = get();
    const currentBase = state.bases[state.currentTurn];
    const nextBaseID = currentBase.nextTurn;
    get().passTurnTo(nextBaseID);
  },

  /**
   * Pass turn to a specific player
   */
  passTurnTo: (baseID: IBase["ID"]) => {
    set({ currentTurn: baseID });
  },

  /**
   * Mark the current base as spawnable
   */
  markCurrentBase: (spawnable: boolean) => {
    set((state: LudoState) => ({
      bases: {
        ...state.bases,
        [state.currentTurn]: {
          ...state.bases[state.currentTurn],
          spawnable,
        },
      },
    }));
  },

  /**
   * Send a coin back to its base (disqualify)
   */
  disqualifyCoin: (
    coinID: ICoin["coinID"],
    walkwayPosition: WalkwayPosition,
    cellID: ICell["cellID"]
  ) => {
    set((state: LudoState) => {
      const coinIDsInCell = [...state.cells[walkwayPosition][cellID].coinIDs];
      const coinIndexToDelete = coinIDsInCell.findIndex(
        (coinIDInCell) => coinIDInCell === coinID
      );
      coinIDsInCell.splice(coinIndexToDelete, 1);

      return {
        cells: {
          ...state.cells,
          [walkwayPosition]: {
            ...state.cells[walkwayPosition],
            [cellID]: {
              ...state.cells[walkwayPosition][cellID],
              coinIDs: coinIDsInCell,
            },
          },
        },
        coins: {
          ...state.coins,
          [coinID]: {
            ...state.coins[coinID],
            isSpawned: false,
            steps: 0,
          },
        },
      };
    });
  },

  /**
   * Mark a coin as having reached home
   */
  homeCoin: (coinID: ICoin["coinID"]) => {
    set((state: LudoState) => ({
      coins: {
        ...state.coins,
        [coinID]: {
          ...state.coins[coinID],
          isRetired: true,
          steps: WINNING_MOVES,
        },
      },
    }));
  },

  /**
   * Set the number of players in the game
   */
  setPlayers: (playerCount: number) => {
    const state = get();
    
    // Ensure bases are loaded before enabling
    if (!state.bases || Object.keys(state.bases).length === 0) {
      console.warn("Cannot set players: Game data not loaded yet");
      return;
    }
    
    // First, disable all bases
    const updatedBases = { ...state.bases };
    Object.keys(updatedBases).forEach((baseID) => {
      updatedBases[baseID] = {
        ...updatedBases[baseID],
        enabled: false,
      };
    });
    
    // Determine the first enabled base for setting currentTurn
    let firstEnabledBase: BaseID | null = null;
    
    // Enable bases based on player count
    if (playerCount >= 1 && updatedBases[BaseID.BASE_1]) {
      updatedBases[BaseID.BASE_1] = {
        ...updatedBases[BaseID.BASE_1],
        enabled: true,
      };
      if (!firstEnabledBase) firstEnabledBase = BaseID.BASE_1;
    }
    if (playerCount >= 2 && updatedBases[BaseID.BASE_2]) {
      updatedBases[BaseID.BASE_2] = {
        ...updatedBases[BaseID.BASE_2],
        enabled: true,
      };
      if (!firstEnabledBase) firstEnabledBase = BaseID.BASE_2;
    }
    if (playerCount >= 3 && updatedBases[BaseID.BASE_3]) {
      updatedBases[BaseID.BASE_3] = {
        ...updatedBases[BaseID.BASE_3],
        enabled: true,
      };
      if (!firstEnabledBase) firstEnabledBase = BaseID.BASE_3;
    }
    if (playerCount >= 4 && updatedBases[BaseID.BASE_4]) {
      updatedBases[BaseID.BASE_4] = {
        ...updatedBases[BaseID.BASE_4],
        enabled: true,
      };
      if (!firstEnabledBase) firstEnabledBase = BaseID.BASE_4;
    }
    
    set({
      bases: updatedBases,
      // Set currentTurn to the first enabled player
      currentTurn: firstEnabledBase || state.currentTurn,
    });
    
    // Enable the dice for the current player's turn
    diceStore.getState().enableDie();
  },

  /**
   * Enable a specific base for gameplay
   */
  enableBase: (baseID: BaseID) => {
    set((state: LudoState) => ({
      bases: {
        ...state.bases,
        [baseID]: {
          ...state.bases[baseID],
          enabled: true,
        },
      },
    }));
  },

  /**
   * Mark a player as the winner
   */
  markWinner: (baseID: BaseID) => {
    set((state: LudoState) => ({
      bases: {
        ...state.bases,
        [baseID]: {
          ...state.bases[baseID],
          hasWon: true,
        },
      },
    }));
  },
}));

/**
 * Check if a move should result in a bonus turn
 */
function checkBonusChance(
  coinID: ICoin["coinID"],
  walkwayPosition: WalkwayPosition,
  cellID: ICell["cellID"],
  state: IState
): boolean {
  // Simplified logic - in a real implementation, this would check:
  // 1. If coin reached home
  // 2. If coin captured an opponent's coin
  // 3. If die roll was 6
  return false;
}

/**
 * Selectors for accessing Ludo state
 */
export const ludoSelectors = {
  getBases: () => ludoStore.getState().bases,
  getCells: () => ludoStore.getState().cells,
  getCoins: () => ludoStore.getState().coins,
  getCurrentTurn: () => ludoStore.getState().currentTurn,
  getLinks: () => ludoStore.getState().links,
  getRelationships: () => ludoStore.getState().relationships,
  getWalkways: () => ludoStore.getState().walkways,
};

/**
 * Hook for using Ludo selectors in components
 */
export const useLudoSelectors = () => ({
  bases: ludoSelectors.getBases(),
  cells: ludoSelectors.getCells(),
  coins: ludoSelectors.getCoins(),
  currentTurn: ludoSelectors.getCurrentTurn(),
  links: ludoSelectors.getLinks(),
  relationships: ludoSelectors.getRelationships(),
  walkways: ludoSelectors.getWalkways(),
});
