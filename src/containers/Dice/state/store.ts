/**
 * Dice Container Zustand Store
 *
 * Zustand store for dice functionality, replacing Redux state management.
 * Handles die rolling, turn management, and game logic.
 */

import { integer, MersenneTwister19937 } from "random-js";
import create, { SetState, GetState } from "zustand";

import { ludoStore } from "containers/Ludo/state/store";
import { stepLogsStore } from "containers/StepLogs/state/store";

import { Rolls } from "./interfaces";

// Import types from Ludo store
import { ICoin, IBase, ICell } from "containers/Ludo/state/interfaces";

interface DiceState {
  // State
  roll: Rolls;
  isDieRollAllowed: boolean;
  isDieRollValid: boolean;

  // Actions
  rollDie: () => Promise<void>;
  rollDieComplete: (value: Rolls) => void;
  enableDie: () => void;
  disableDie: () => void;
  invalidateDieRoll: () => void;
}

/**
 * Initial state for the dice store
 */
const initialState = {
  isDieRollAllowed: true, // Die can be rolled initially
  isDieRollValid: false, // No roll has been made yet
  roll: Rolls.ONE, // Default roll value
};

/**
 * Dice Zustand store
 * Manages dice state and handles die rolling logic with game integration
 */
export const diceStore = create<DiceState>(
  (set: SetState<DiceState>, get: GetState<DiceState>) => ({
    ...initialState,

    /**
     * Request to roll the die - generates random roll and handles game logic
     */
    rollDie: async () => {
      // Generate random die roll using Mersenne Twister for better randomness
      const mt = MersenneTwister19937.autoSeed();
      const dieRoll: Rolls = integer(Rolls.ONE, Rolls.SIX)(mt);

      // Get current player info for logging
      const currentTurn = ludoStore.getState().currentTurn;
      const bases = ludoStore.getState().bases;
      const playerColor = bases[currentTurn].color;

      // Log the die roll action
      stepLogsStore.getState().addLogEntry({
        player: playerColor,
        action: `Rolled ${dieRoll}`,
        details: `Dice roll: ${dieRoll}`,
      });

      // Complete the roll
      get().rollDieComplete(dieRoll);
    },

    /**
     * Action dispatched when the die roll is complete
     * Handles the complex game logic for turn progression and auto-actions
     * @param value - The final value shown on the die (1-6)
     */
    rollDieComplete: async (value: Rolls) => {
      set({
        isDieRollAllowed: false, // Can't roll again until turn advances
        isDieRollValid: true, // This roll can be used for moves
        roll: value, // Set the rolled value
      });

      // Handle game logic after roll completion
      await handleRollDieCompleteLogic(value);
    },

    /**
     * Enable the die for rolling (when it becomes player's turn)
     */
    enableDie: () => {
      set({ isDieRollAllowed: true });
    },

    /**
     * Disable the die (after rolling or when turn passes)
     */
    disableDie: () => {
      set({ isDieRollAllowed: false });
    },

    /**
     * Mark the current die roll as used/invalid
     * Prevents using the same roll for multiple moves
     */
    invalidateDieRoll: () => {
      set({ isDieRollValid: false });
    },
  })
);

/**
 * Selectors for accessing dice state
 */
export const diceSelectors = {
  getCurrentDieRoll: () => diceStore.getState().roll,
  isDieRollAllowed: () => diceStore.getState().isDieRollAllowed,
  isDieRollValid: () => diceStore.getState().isDieRollValid,
};

/**
 * Hook for using dice selectors in components
 */
export const useDiceSelectors = () => ({
  currentDieRoll: diceSelectors.getCurrentDieRoll(),
  isDieRollAllowed: diceSelectors.isDieRollAllowed(),
  isDieRollValid: diceSelectors.isDieRollValid(),
});

/**
 * Handle the complex game logic after a die roll is complete
 * This replicates the Redux saga logic for turn progression and auto-actions
 */
async function handleRollDieCompleteLogic(value: Rolls): Promise<void> {
  const currentTurn = ludoStore.getState().currentTurn;
  const bases = ludoStore.getState().bases;
  const coins = ludoStore.getState().coins;
  const currentTurnBase = bases[currentTurn];
  const spawnedCoinIDs = currentTurnBase.coinIDs.filter(
    (coinID: ICoin["coinID"]) =>
      coins[coinID].isSpawned && !coins[coinID].isRetired
  );
  const movableCoins = await getMovableCoins(value);
  const spawnableCoins = bases[currentTurn].coinIDs.filter(
    (coinID: ICoin["coinID"]) =>
      !coins[coinID].isSpawned && !coins[coinID].isRetired
  );

  if (
    value === Rolls.SIX &&
    (spawnableCoins.length > 0 || movableCoins.length > 0)
  ) {
    if (
      (spawnedCoinIDs.length === 0 || movableCoins.length === 0) &&
      spawnableCoins.length > 0
    ) {
      // Auto-spawn if no coins spawned or no movable coins
      ludoStore.getState().spawnCoin(currentTurnBase.ID, spawnableCoins[0]);
      await waitForAction();
    } else {
      // Mark base as active and handle auto-actions
      ludoStore.getState().markCurrentBase(true);

      const autoActionsEnabled = stepLogsStore.getState().autoActionsEnabled;

      if (autoActionsEnabled) {
        await handleAutoActionWithTimeout(
          spawnableCoins,
          movableCoins,
          currentTurnBase
        );
      } else {
        await handleManualActionWithAutoActionToggle(
          spawnableCoins,
          movableCoins,
          currentTurnBase
        );
      }

      ludoStore.getState().markCurrentBase(false);
    }

    // Enable die again
    diceStore.getState().enableDie();

    // Handle bonus turn for rolling a 6
    const autoActionsEnabled = stepLogsStore.getState().autoActionsEnabled;
    if (autoActionsEnabled) {
      await delay(500);
      await diceStore.getState().rollDie();
    }
  } else if (spawnedCoinIDs.length > 0) {
    // Handle movement for non-6 rolls
    if (spawnedCoinIDs.length === 1) {
      const coinID = spawnedCoinIDs[0];
      const coin = coins[coinID];
      ludoStore.getState().moveCoin(coinID, coin.position, coin.cellID);
    } else if (movableCoins.length === 1) {
      const coinID = movableCoins[0];
      const coin = coins[coinID];
      ludoStore.getState().moveCoin(coinID, coin.position, coin.cellID);
    } else if (movableCoins.length > 1) {
      const autoActionsEnabled = stepLogsStore.getState().autoActionsEnabled;

      if (autoActionsEnabled) {
        await handleMultipleCoinsAutoAction(movableCoins, value);
      } else {
        await handleMultipleCoinsManualAction(movableCoins, value);
      }
    }
  } else {
    // No valid moves available - invalidate roll and pass to next player
    diceStore.getState().invalidateDieRoll();
    ludoStore.getState().nextTurn();
    
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
}

/**
 * Wait for a spawn or move action to complete
 * Uses a delay to allow the action to process
 */
async function waitForAction(): Promise<void> {
  const delayDuration = stepLogsStore.getState().autoActionTimeout;
  await delay(delayDuration);
}

/**
 * Handle auto-action with timeout for 6 rolls
 */
async function handleAutoActionWithTimeout(
  spawnableCoins: ICoin["coinID"][],
  movableCoins: ICoin["coinID"][],
  currentTurnBase: IBase
) {
  const timeoutDuration = stepLogsStore.getState().autoActionTimeout;

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      autoChooseAction(spawnableCoins, movableCoins, currentTurnBase);
      resolve();
    }, timeoutDuration);
  });

  await Promise.race([waitForAction(), timeoutPromise]);
}

/**
 * Handle manual action with auto-action toggle waiting
 */
async function handleManualActionWithAutoActionToggle(
  spawnableCoins: ICoin["coinID"][],
  movableCoins: ICoin["coinID"][],
  currentTurnBase: IBase
) {
  // This is a simplified version - in practice we'd need to listen for auto-action toggle changes
  await waitForAction();
}

/**
 * Handle auto-action for multiple movable coins
 */
async function handleMultipleCoinsAutoAction(
  movableCoins: ICoin["coinID"][],
  value: Rolls
) {
  const timeoutDuration = stepLogsStore.getState().autoActionTimeout;

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      autoSelectMovableCoin(movableCoins, value);
      resolve();
    }, timeoutDuration);
  });

  await Promise.race([waitForAction(), timeoutPromise]);
}

/**
 * Handle manual action for multiple movable coins
 */
async function handleMultipleCoinsManualAction(
  movableCoins: ICoin["coinID"][],
  value: Rolls
) {
  await waitForAction();
}

/**
 * Automatically choose an action when timeout occurs
 */
function autoChooseAction(
  spawnableCoins: ICoin["coinID"][],
  movableCoins: ICoin["coinID"][],
  currentTurnBase: IBase
) {
  const mt = MersenneTwister19937.autoSeed();

  // Priority 1: Check if any movable coins can reach HOME
  const coinsThatCanReachHome: ICoin["coinID"][] = [];
  const coinsThatCanReachHomePath: ICoin["coinID"][] = [];

  if (movableCoins.length > 0) {
    for (const coinID of movableCoins) {
      const result = canReachHome(coinID, diceStore.getState().roll);
      if (result === "HOME") {
        coinsThatCanReachHome.push(coinID);
      } else if (result === "HOMEPATH") {
        coinsThatCanReachHomePath.push(coinID);
      }
    }
  }

  // Priority 1: Choose coin that can reach HOME
  if (coinsThatCanReachHome.length > 0) {
    const chosenCoinID =
      coinsThatCanReachHome[integer(0, coinsThatCanReachHome.length - 1)(mt)];
    const coins = ludoStore.getState().coins;
    const coin = coins[chosenCoinID];

    stepLogsStore.getState().addLogEntry({
      player: currentTurnBase.color,
      action: "Auto-action",
      details: `Automatically chose to move coin ${
        chosenCoinID.split("_")[1]
      } (can reach HOME)`,
    });

    ludoStore.getState().moveCoin(chosenCoinID, coin.position, coin.cellID);
    return;
  }

  // Priority 2: Choose coin that can reach HOMEPATH
  if (coinsThatCanReachHomePath.length > 0) {
    const chosenCoinID =
      coinsThatCanReachHomePath[
        integer(0, coinsThatCanReachHomePath.length - 1)(mt)
      ];
    const coins = ludoStore.getState().coins;
    const coin = coins[chosenCoinID];

    stepLogsStore.getState().addLogEntry({
      player: currentTurnBase.color,
      action: "Auto-action",
      details: `Automatically chose to move coin ${
        chosenCoinID.split("_")[1]
      } (can reach HOMEPATH)`,
    });

    ludoStore.getState().moveCoin(chosenCoinID, coin.position, coin.cellID);
    return;
  }

  // Priority 3: Choose between spawn and move
  const availableActions = [];
  if (movableCoins.length > 0) availableActions.push("move");
  if (spawnableCoins.length > 0) availableActions.push("spawn");

  const chosenAction =
    availableActions[0] ||
    (availableActions.length > 0
      ? availableActions[integer(0, availableActions.length - 1)(mt)]
      : null);

  if (chosenAction === "move" && movableCoins.length > 0) {
    const chosenCoinID = movableCoins[integer(0, movableCoins.length - 1)(mt)];
    const coins = ludoStore.getState().coins;
    const coin = coins[chosenCoinID];

    stepLogsStore.getState().addLogEntry({
      player: currentTurnBase.color,
      action: "Auto-action",
      details: `Automatically chose to move coin ${chosenCoinID.split("_")[1]}`,
    });

    ludoStore.getState().moveCoin(chosenCoinID, coin.position, coin.cellID);
  } else if (chosenAction === "spawn" && spawnableCoins.length > 0) {
    const chosenCoinID =
      spawnableCoins[integer(0, spawnableCoins.length - 1)(mt)];

    stepLogsStore.getState().addLogEntry({
      player: currentTurnBase.color,
      action: "Auto-action",
      details: `Automatically chose to spawn coin ${
        chosenCoinID.split("_")[1]
      }`,
    });

    ludoStore.getState().spawnCoin(currentTurnBase.ID, chosenCoinID);
  }
}

/**
 * Automatically select a movable coin with priority for HOME/HOMEPATH
 */
function autoSelectMovableCoin(movableCoins: ICoin["coinID"][], value: Rolls) {
  const mt = MersenneTwister19937.autoSeed();
  const currentTurn = ludoStore.getState().currentTurn;
  const bases = ludoStore.getState().bases;
  const playerColor = bases[currentTurn].color;

  // Prioritize coins that can reach HOME or HOMEPATH
  const coinsThatCanReachHome: ICoin["coinID"][] = [];
  const coinsThatCanReachHomePath: ICoin["coinID"][] = [];

  for (const coinID of movableCoins) {
    const result = canReachHome(coinID, value);
    if (result === "HOME") {
      coinsThatCanReachHome.push(coinID);
    } else if (result === "HOMEPATH") {
      coinsThatCanReachHomePath.push(coinID);
    }
  }

  let chosenCoinID: ICoin["coinID"];
  if (coinsThatCanReachHome.length > 0) {
    chosenCoinID =
      coinsThatCanReachHome[integer(0, coinsThatCanReachHome.length - 1)(mt)];
  } else if (coinsThatCanReachHomePath.length > 0) {
    chosenCoinID =
      coinsThatCanReachHomePath[
        integer(0, coinsThatCanReachHomePath.length - 1)(mt)
      ];
  } else {
    chosenCoinID = movableCoins[integer(0, movableCoins.length - 1)(mt)];
  }

  const coins = ludoStore.getState().coins;
  const coin = coins[chosenCoinID];
  const details =
    coinsThatCanReachHome.length > 0
      ? `Automatically moved coin ${
          chosenCoinID.split("_")[1]
        } ${value} spaces (can reach HOME)`
      : coinsThatCanReachHomePath.length > 0
      ? `Automatically moved coin ${
          chosenCoinID.split("_")[1]
        } ${value} spaces (can reach HOMEPATH)`
      : `Automatically moved coin ${
          chosenCoinID.split("_")[1]
        } ${value} spaces`;

  stepLogsStore.getState().addLogEntry({
    player: playerColor,
    action: "Auto-moved coin",
    details,
  });

  ludoStore.getState().moveCoin(chosenCoinID, coin.position, coin.cellID);
}

/**
 * Check if a coin can reach HOME or HOMEPATH after moving steps
 */
function canReachHome(
  coinID: ICoin["coinID"],
  stepsToTake: Rolls
): "HOME" | "HOMEPATH" | null {
  const coins = ludoStore.getState().coins;
  const cells = ludoStore.getState().cells;
  const links = ludoStore.getState().links;

  const coin = coins[coinID];
  if (!coin || !coin.isSpawned || coin.isRetired) {
    return null;
  }

  // Simulate the path the coin would take
  let currentCellID = coin.cellID;

  for (let step = 0; step < stepsToTake; step++) {
    const nextCells = links[currentCellID];
    if (!nextCells || nextCells.length === 0) {
      return null; // No path available
    }

    // First, check if any option leads directly to HOME
    const homeCell = nextCells.find(
      (cell: Pick<ICell, "position" | "cellID">) => cell.cellID === "HOME"
    );
    if (homeCell) {
      return "HOME"; // Can reach HOME!
    }

    let nextCell;

    // Try to find a home path cell that matches this coin's base
    const matchingHomePath = nextCells.find(
      (cell: Pick<ICell, "position" | "cellID">) => {
        if (cell.cellID === "HOME") {
          return false;
        }
        const cellData = cells[cell.position]?.[cell.cellID];
        if (!cellData) {
          return false;
        }
        return (
          cellData.cellType === "HOMEPATH" && coin.baseID === cellData.baseID
        );
      }
    );

    if (matchingHomePath) {
      nextCell = matchingHomePath;
      // Continue checking if we can reach HOME from this home path
    } else {
      // Use first available option for simulation (skip HOME if it's the only option)
      nextCell =
        nextCells.find(
          (cell: Pick<ICell, "position" | "cellID">) => cell.cellID !== "HOME"
        ) || nextCells[0];
    }

    // Check if we're moving to HOME
    if (nextCell.cellID === "HOME") {
      return "HOME";
    }

    currentCellID = nextCell.cellID;

    // Check if we're on a home path
    if (nextCell.cellID !== "HOME") {
      const cellData = cells[nextCell.position]?.[currentCellID];
      if (
        cellData &&
        cellData.cellType === "HOMEPATH" &&
        cellData.baseID === coin.baseID
      ) {
        return "HOMEPATH"; // Can reach home path
      }
    }
  }

  return null;
}

/**
 * Get all coins that can be moved with the current die roll
 */
async function getMovableCoins(
  currentDieRoll: Rolls
): Promise<ICoin["coinID"][]> {
  // This is a simplified version - in the actual implementation,
  // this would need to replicate the complex logic from the Ludo sagas
  const currentTurn = ludoStore.getState().currentTurn;
  const bases = ludoStore.getState().bases;
  const coins = ludoStore.getState().coins;
  const currentTurnBase = bases[currentTurn];

  // Get all spawned coins for current player
  const spawnedCoins = currentTurnBase.coinIDs.filter(
    (coinID: ICoin["coinID"]) =>
      coins[coinID].isSpawned && !coins[coinID].isRetired
  );

  // For now, return all spawned coins - in reality this would check if they can actually move
  return spawnedCoins;
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
