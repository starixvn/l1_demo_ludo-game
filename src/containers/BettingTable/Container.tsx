/**
 * Betting Table Component
 *
 * Displays a grid of betting options with odds for various game outcomes.
 * Based on the current game state, calculates and displays betting odds.
 */

import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";
import classnames from "classnames";

import {
  currentDieRoll1Selector,
  currentDieRoll2Selector,
  isDieRollAllowedSelector,
  isDieRollValidSelector,
} from "containers/Dice/state/selectors";
import {
  basesSelector,
  horsesSelector,
  currentTurnSelector,
  availableActionsSelector,
  cellsSelector,
  walkwaysSelector,
  linksSelector,
} from "containers/Ludo/state/selectors";
import { getBaseHexColor } from "containers/utils";
import { BOARD_DIMENSION } from "globalConstants";

import styles from "./Container.module.css";

interface IStateProps {
  currentDieRoll1: ReturnType<typeof currentDieRoll1Selector>;
  currentDieRoll2: ReturnType<typeof currentDieRoll2Selector>;
  isDieRollAllowed: ReturnType<typeof isDieRollAllowedSelector>;
  isDieRollValid: ReturnType<typeof isDieRollValidSelector>;
  bases: ReturnType<typeof basesSelector>;
  horses: ReturnType<typeof horsesSelector>;
  currentTurn: ReturnType<typeof currentTurnSelector>;
  availableActions: ReturnType<typeof availableActionsSelector>;
  cells: ReturnType<typeof cellsSelector>;
  walkways: ReturnType<typeof walkwaysSelector>;
  links: ReturnType<typeof linksSelector>;
}

interface IProps extends IStateProps {}

interface IBetCoin {
  id: number;
  x: number; // Random X position (0-100%)
  y: number; // Random Y position (0-100%)
}

interface ILocalState {
  bets: Map<BettingOption, IBetCoin[]>; // Track coins for each betting option
}

/**
 * Betting option types
 */
enum BettingOption {
  ODD = "Odd",
  EVEN = "Even",
  BIG = "Big",
  SMALL = "Small",
  MOVE = "Move",
  NO_MOVE = "No Move",
  KICK = "Kick",
  NO_KICK = "No Kick",
  RELEASE = "Release",
  NO_RELEASE = "No Release",
  GO_STABLE = "Go Stable",
  NO_STABLE = "No Stable",
}

/**
 * Calculate odds for a betting option
 * Returns the odds string and whether the outcome is determined
 */
function calculateBettingOdds(probability: number): {
  odds: string;
  isDetermined: boolean;
} {
  // Handle edge cases - outcome is already determined
  if (probability <= 0) {
    // Impossible outcome - betting is closed
    return { odds: "Closed", isDetermined: true };
  }
  if (probability >= 1) {
    // Guaranteed outcome - betting is closed
    return { odds: "Closed", isDetermined: true };
  }
  // Calculate odds with 2% house margin
  // Formula: odds = (1 - probability) / probability * (1 - houseMargin)
  // Example: 50% probability → base odds 1:1 → with 2% margin → 1:0.98
  // If player bets 100, they get 198 back (100 bet + 98 profit)
  const HOUSE_MARGIN = 0.02; // 2% house margin
  const baseOdds = (1 - probability) / probability;
  const oddsWithMargin = baseOdds * (1 - HOUSE_MARGIN);
  const rounded = Math.round(oddsWithMargin * 100) / 100;
  return { odds: `1:${rounded}`, isDetermined: false };
}

/**
 * Calculate probability for Odd/Even
 * Don't lock betting options while user is choosing action after roll
 */
function calculateOddEvenProbability(
  roll1: number,
  roll2: number,
  isDieRollValid: boolean,
  isOdd: boolean
): number {
  // Always calculate probability, don't lock based on isDieRollValid
  // Before rolling: 50% chance for odd or even
  return 0.5;
}

/**
 * Calculate probability for Big/Small (sum > 7 or <= 7)
 * Don't lock betting options while user is choosing action after roll
 */
function calculateBigSmallProbability(
  roll1: number,
  roll2: number,
  isDieRollValid: boolean,
  isBig: boolean
): number {
  // Always calculate probability, don't lock based on isDieRollValid
  // Before rolling: calculate probability
  // Big (sum > 7): 15/36 = 0.4167
  // Small (sum <= 7): 21/36 = 0.5833
  return isBig ? 15 / 36 : 21 / 36;
}

/**
 * Check if a dice roll is spawnable (doubles or 1:6)
 */
function isSpawnableRoll(roll1: number, roll2: number): boolean {
  // Check for (1,6) or (6,1)
  if ((roll1 === 1 && roll2 === 6) || (roll1 === 6 && roll2 === 1)) {
    return true;
  }
  // Check for doubles
  if (roll1 === roll2) {
    return true;
  }
  return false;
}

/**
 * Calculate probability for Move/No Move
 * Move = any horse can be moved, spawned, or kicked
 * No Move = no actions available
 *
 * Checks all 36 possible dice combinations to determine probability.
 * Locks betting if outcome is certain (all or no combinations allow movement).
 */
function calculateMoveProbability(
  isDieRollValid: boolean,
  availableActions: Array<{ type: string }> | null | undefined,
  horses: {
    [horseID: string]: {
      isSpawned: boolean;
      isRetired: boolean;
      steps: number;
    };
  },
  bases: { [baseID: string]: { horseIDs: string[] } },
  currentTurn: string,
  isMove: boolean
): number {
  // Check all 36 dice combinations (both before and after rolling)
  // Don't lock betting options while user is choosing action after roll
  const currentBase = bases[currentTurn];
  if (!currentBase) {
    return isMove ? 0.5 : 0.5; // Default if base not found
  }

  const WINNING_MOVES = 62; // Total steps needed to win

  // Get all horses for current player
  const playerHorses = currentBase.horseIDs
    .map((horseID) => horses[horseID])
    .filter((horse) => horse && !horse.isRetired);

  const spawnedHorses = playerHorses.filter((horse) => horse.isSpawned);
  const unspawnedHorses = playerHorses.filter((horse) => !horse.isSpawned);

  let combinationsWithMoves = 0;

  // Check all 36 possible dice combinations
  for (let roll1 = 1; roll1 <= 6; roll1++) {
    for (let roll2 = 1; roll2 <= 6; roll2++) {
      const sum = roll1 + roll2;
      const isPair = roll1 === roll2;
      let canMove = false;

      // Check if spawnable and there are unspawned horses
      if (isSpawnableRoll(roll1, roll2) && unspawnedHorses.length > 0) {
        canMove = true;
      }

      // Check if any spawned horse can move with the sum
      if (!canMove && spawnedHorses.length > 0) {
        for (const horse of spawnedHorses) {
          if (horse.steps + sum <= WINNING_MOVES) {
            canMove = true;
            break;
          }
        }
      }

      // Check if pair and any spawned horse can move with single die value
      if (!canMove && isPair && spawnedHorses.length > 0) {
        for (const horse of spawnedHorses) {
          if (horse.steps + roll1 <= WINNING_MOVES) {
            canMove = true;
            break;
          }
        }
      }

      if (canMove) {
        combinationsWithMoves++;
      }
    }
  }

  const probability = combinationsWithMoves / 36;
  return isMove ? probability : 1 - probability;
}

/**
 * Calculate probability for Release/No Release
 * Release = a horse can be spawned/released from base (requires spawnable roll: doubles or 1:6)
 * No Release = no horse can be spawned
 *
 * Checks all 36 possible dice combinations to determine probability.
 * Locks betting if outcome is certain (all or no combinations allow release, or no unspawned horses,
 * or if a horse is already on the spawn cell).
 */
function calculateReleaseProbability(
  isDieRollValid: boolean,
  availableActions: Array<{ type: string }> | null | undefined,
  horses: {
    [horseID: string]: {
      isSpawned: boolean;
      isRetired: boolean;
      cellID: string;
      steps: number;
    };
  },
  bases: { [baseID: string]: { horseIDs: string[]; ID: string } },
  currentTurn: string,
  cells: {
    [position: string]: {
      [cellID: string]: {
        cellID: string;
        cellType: string;
        baseID: string;
      };
    };
  },
  walkways: {
    [key: string]: {
      baseID: string;
      position: string;
    };
  },
  isRelease: boolean
): number {
  // Check all 36 dice combinations (both before and after rolling)
  // Don't lock betting options while user is choosing action after roll
  const currentBase = bases[currentTurn];
  if (!currentBase) {
    return isRelease ? 0.5 : 0.5; // Default if base not found
  }

  // Find the spawn cell for this base
  const walkway = Object.values(walkways).find(
    (w) => w.baseID === currentBase.ID
  );
  let spawnCellID: string | null = null;
  if (walkway) {
    const walkwayCells = cells[walkway.position];
    if (walkwayCells) {
      const spawnCell = Object.values(walkwayCells).find(
        (cell) => cell.cellType === "SPAWN" && cell.baseID === currentBase.ID
      );
      if (spawnCell) {
        spawnCellID = spawnCell.cellID;
      }
    }
  }

  // Check if any spawned horse is still on the spawn cell (hasn't moved yet)
  let hasHorseOnSpawnCell = false;
  if (spawnCellID) {
    for (const horseID of currentBase.horseIDs) {
      const horse = horses[horseID];
      if (
        horse &&
        horse.isSpawned &&
        !horse.isRetired &&
        horse.cellID === spawnCellID &&
        horse.steps === 0
      ) {
        hasHorseOnSpawnCell = true;
        break;
      }
    }
  }

  // If a horse is on the spawn cell, release is impossible (locked)
  if (hasHorseOnSpawnCell) {
    return isRelease ? 0.0 : 1.0; // No Release = 100%
  }

  // Get all unspawned horses for current player
  const unspawnedHorses = currentBase.horseIDs.filter(
    (horseID) =>
      horses[horseID] &&
      !horses[horseID].isSpawned &&
      !horses[horseID].isRetired
  );

  // If no unspawned horses, release is impossible
  if (unspawnedHorses.length === 0) {
    return isRelease ? 0.0 : 1.0; // No Release = 100%
  }

  // Count spawnable combinations (doubles or 1:6)
  let spawnableCombinations = 0;

  // Check all 36 possible dice combinations
  for (let roll1 = 1; roll1 <= 6; roll1++) {
    for (let roll2 = 1; roll2 <= 6; roll2++) {
      if (isSpawnableRoll(roll1, roll2)) {
        spawnableCombinations++;
      }
    }
  }

  // Spawnable combinations: doubles (6) + (1,6) or (6,1) (2) = 8 out of 36
  const probability = spawnableCombinations / 36; // 8/36 ≈ 0.2222
  return isRelease ? probability : 1 - probability;
}

/**
 * Check if a horse can reach home path with given steps
 * Uses BFS-like simulation to check if horse can reach a HOMEPATH cell matching its baseID
 */
function canReachHomePath(
  horse: {
    cellID: string;
    baseID: string;
    steps: number;
  },
  stepsToTake: number,
  cells: {
    [position: string]: {
      [cellID: string]: {
        cellID: string;
        cellType: string;
        baseID: string;
      };
    };
  },
  links: {
    [cellID: string]: Array<{
      cellID: string;
      position: string;
    }>;
  },
  WINNING_MOVES: number
): boolean {
  // Check if horse would overshoot home
  if (horse.steps + stepsToTake > WINNING_MOVES) {
    return false;
  }

  // Use BFS to find all reachable cells within the step count
  // This ensures we check all possible paths, not just one
  const visited = new Map<string, number>(); // cellID -> minimum steps to reach
  const queue: Array<{ cellID: string; position: string; steps: number }> = [
    { cellID: horse.cellID, position: "", steps: 0 },
  ];

  // Find the position of the starting cell
  for (const position in cells) {
    if (cells[position][horse.cellID]) {
      queue[0].position = position;
      break;
    }
  }

  // Track if we've found our own home path - HOME is only valid if reached through our home path
  let foundOwnHomePath = false;

  while (queue.length > 0) {
    const { cellID, position, steps } = queue.shift()!;

    if (steps > stepsToTake) {
      continue; // Exceeded step count
    }

    // Check if we've already visited this cell with fewer or equal steps
    const prevSteps = visited.get(cellID);
    if (prevSteps !== undefined && prevSteps <= steps) {
      continue; // Already visited with better path
    }
    visited.set(cellID, steps);

    // Check if this is a home path cell matching the horse's base
    if (cellID !== "HOME") {
      const cellData = cells[position]?.[cellID];
      if (
        cellData &&
        cellData.cellType === "HOMEPATH" &&
        cellData.baseID === horse.baseID
      ) {
        foundOwnHomePath = true; // Found our own home path
        return true; // Found a reachable home path cell with same base color!
      }
    }

    // Check if this is HOME - only valid if we can reach it through our own home path
    // We'll check this after exploring, but for now continue exploring
    if (cellID === "HOME") {
      // Only return true if we've already found our own home path
      // This ensures we can only reach HOME through our own home path, not others'
      if (foundOwnHomePath) {
        return true; // Can reach HOME through our own home path
      }
      // Otherwise, continue exploring to see if we can find our home path
    }

    // Continue BFS if we haven't reached max steps
    if (steps < stepsToTake) {
      const nextCells = links[cellID];
      if (nextCells && nextCells.length > 0) {
        for (const nextCell of nextCells) {
          // Skip other players' home paths - horses can only enter their own home path
          if (nextCell.cellID !== "HOME") {
            const nextCellData = cells[nextCell.position]?.[nextCell.cellID];
            if (
              nextCellData &&
              nextCellData.cellType === "HOMEPATH" &&
              nextCellData.baseID !== horse.baseID
            ) {
              continue; // Skip other players' home paths
            }
          }

          // Skip if already visited with better path
          const nextPrevSteps = visited.get(nextCell.cellID);
          if (nextPrevSteps === undefined || nextPrevSteps > steps + 1) {
            queue.push({
              cellID: nextCell.cellID,
              position: nextCell.position,
              steps: steps + 1,
            });
          }
        }
      }
    }
  }

  return false; // Cannot reach home path with same base color
}

/**
 * Calculate probability for Go Stable/No Stable
 * Go Stable = a horse can reach home path in the next roll
 * No Stable = no horse can reach home path
 *
 * Only enabled if at least one horse can possibly reach home path.
 * Locks if no horse can reach home path with any dice combination.
 */
function calculateGoStableProbability(
  horses: {
    [horseID: string]: {
      isSpawned: boolean;
      isRetired: boolean;
      cellID: string;
      baseID: string;
      steps: number;
    };
  },
  bases: { [baseID: string]: { horseIDs: string[] } },
  currentTurn: string,
  cells: {
    [position: string]: {
      [cellID: string]: {
        cellID: string;
        cellType: string;
        baseID: string;
      };
    };
  },
  links: {
    [cellID: string]: Array<{
      cellID: string;
      position: string;
    }>;
  },
  isGoStable: boolean
): number {
  const currentBase = bases[currentTurn];
  if (!currentBase) {
    return isGoStable ? 0.0 : 1.0; // Default: No Stable
  }

  const WINNING_MOVES = 62; // Total steps needed to win

  // Get all spawned horses for current player
  const spawnedHorses = currentBase.horseIDs
    .map((horseID) => horses[horseID])
    .filter((horse) => horse && horse.isSpawned && !horse.isRetired);

  // If no spawned horses, cannot go stable
  if (spawnedHorses.length === 0) {
    return isGoStable ? 0.0 : 1.0; // No Stable = 100%
  }

  let combinationsWithHomePath = 0;

  // Check all 36 possible dice combinations
  for (let roll1 = 1; roll1 <= 6; roll1++) {
    for (let roll2 = 1; roll2 <= 6; roll2++) {
      const sum = roll1 + roll2;
      const isPair = roll1 === roll2;
      let canReach = false;

      // Check if any spawned horse can reach home path with the sum
      for (const horse of spawnedHorses) {
        if (canReachHomePath(horse, sum, cells, links, WINNING_MOVES)) {
          canReach = true;
          break;
        }
      }

      // Check if pair and any horse can reach with single die value
      if (!canReach && isPair) {
        for (const horse of spawnedHorses) {
          if (canReachHomePath(horse, roll1, cells, links, WINNING_MOVES)) {
            canReach = true;
            break;
          }
        }
      }

      if (canReach) {
        combinationsWithHomePath++;
      }
    }
  }

  // If no combinations allow reaching home path, lock (No Stable = 100%)
  if (combinationsWithHomePath === 0) {
    return isGoStable ? 0.0 : 1.0;
  }

  const probability = combinationsWithHomePath / 36;
  return isGoStable ? probability : 1 - probability;
}

/**
 * Check if a horse can kick an opponent horse with given steps
 * A horse can kick if:
 * - It can move the exact number of steps
 * - There's a blocking opponent horse at that exact step
 * - The horse won't overshoot home
 */
function canKickOpponent(
  horse: {
    cellID: string;
    baseID: string;
    steps: number;
  },
  stepsToTake: number,
  cells: {
    [position: string]: {
      [cellID: string]: {
        cellID: string;
        cellType: string;
        baseID: string;
        horseIDs: string[];
      };
    };
  },
  links: {
    [cellID: string]: Array<{
      cellID: string;
      position: string;
    }>;
  },
  allHorses: {
    [horseID: string]: {
      baseID: string;
    };
  },
  WINNING_MOVES: number
): boolean {
  // Check if horse would overshoot home
  if (horse.steps + stepsToTake > WINNING_MOVES) {
    return false;
  }

  // Simulate movement step by step
  let currentCellID = horse.cellID;
  const visited = new Set<string>();

  for (let step = 0; step < stepsToTake; step++) {
    if (visited.has(currentCellID)) {
      break; // Avoid infinite loops
    }
    visited.add(currentCellID);

    const nextCells = links[currentCellID];
    if (!nextCells || nextCells.length === 0) {
      return false; // No path available
    }

    // Check if this is the final step
    const isFinalStep = step === stepsToTake - 1;

    if (isFinalStep) {
      // On final step, check if any next cell has an opponent horse we can kick
      for (const nextCell of nextCells) {
        if (nextCell.cellID === "HOME") {
          continue; // Can't kick at home
        }

        const cellData = cells[nextCell.position]?.[nextCell.cellID];
        if (cellData && cellData.horseIDs && cellData.horseIDs.length > 0) {
          // Check if there's an opponent horse on this cell
          const blockingHorseID = cellData.horseIDs[0];
          const blockingHorse = allHorses[blockingHorseID];
          if (blockingHorse && blockingHorse.baseID !== horse.baseID) {
            // Found an opponent horse at the exact step - can kick!
            return true;
          }
        }
      }
    }

    // Move to first available cell for simulation
    currentCellID = nextCells[0].cellID;
  }

  return false;
}

/**
 * Calculate probability for Kick/No Kick
 * Kick = a horse can kick an opponent blocking horse in the next roll
 * No Kick = no horse can kick an opponent
 *
 * Only enabled if at least one horse can possibly kick an opponent.
 * Locks if no horse can kick with any dice combination.
 */
function calculateKickProbability(
  horses: {
    [horseID: string]: {
      isSpawned: boolean;
      isRetired: boolean;
      cellID: string;
      baseID: string;
      steps: number;
    };
  },
  bases: { [baseID: string]: { horseIDs: string[] } },
  currentTurn: string,
  cells: {
    [position: string]: {
      [cellID: string]: {
        cellID: string;
        cellType: string;
        baseID: string;
        horseIDs: string[];
      };
    };
  },
  links: {
    [cellID: string]: Array<{
      cellID: string;
      position: string;
    }>;
  },
  isKick: boolean
): number {
  const currentBase = bases[currentTurn];
  if (!currentBase) {
    return isKick ? 0.0 : 1.0; // Default: No Kick
  }

  const WINNING_MOVES = 56;

  // Get all spawned horses for current player
  const spawnedHorses = currentBase.horseIDs
    .map((horseID) => horses[horseID])
    .filter((horse) => horse && horse.isSpawned && !horse.isRetired);

  // If no spawned horses, cannot kick
  if (spawnedHorses.length === 0) {
    return isKick ? 0.0 : 1.0; // No Kick = 100%
  }

  // Prepare all horses map for checking opponents
  const allHorsesMap: {
    [horseID: string]: {
      baseID: string;
    };
  } = {};
  for (const horseID in horses) {
    allHorsesMap[horseID] = {
      baseID: horses[horseID].baseID,
    };
  }

  let combinationsWithKick = 0;

  // Check all 36 possible dice combinations
  for (let roll1 = 1; roll1 <= 6; roll1++) {
    for (let roll2 = 1; roll2 <= 6; roll2++) {
      const sum = roll1 + roll2;
      const isPair = roll1 === roll2;
      let canKick = false;

      // Check if any spawned horse can kick with the sum
      for (const horse of spawnedHorses) {
        if (
          canKickOpponent(horse, sum, cells, links, allHorsesMap, WINNING_MOVES)
        ) {
          canKick = true;
          break;
        }
      }

      // Check if pair and any horse can kick with single die value
      if (!canKick && isPair) {
        for (const horse of spawnedHorses) {
          if (
            canKickOpponent(
              horse,
              roll1,
              cells,
              links,
              allHorsesMap,
              WINNING_MOVES
            )
          ) {
            canKick = true;
            break;
          }
        }
      }

      if (canKick) {
        combinationsWithKick++;
      }
    }
  }

  // If no combinations allow kicking, lock (No Kick = 100%)
  if (combinationsWithKick === 0) {
    return isKick ? 0.0 : 1.0;
  }

  const probability = combinationsWithKick / 36;
  return isKick ? probability : 1 - probability;
}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  currentDieRoll1: currentDieRoll1Selector,
  currentDieRoll2: currentDieRoll2Selector,
  isDieRollAllowed: isDieRollAllowedSelector,
  isDieRollValid: isDieRollValidSelector,
  bases: basesSelector,
  horses: horsesSelector,
  currentTurn: currentTurnSelector,
  availableActions: availableActionsSelector,
  cells: cellsSelector,
  walkways: walkwaysSelector,
  links: linksSelector,
});

class BettingTableBare extends React.PureComponent<IProps, ILocalState> {
  private nextCoinId: number = 0;

  constructor(props: IProps) {
    super(props);
    this.state = {
      bets: new Map<BettingOption, IBetCoin[]>(),
    };
  }

  componentDidUpdate(prevProps: IProps) {
    // Clear bets when turn changes or dice is rolled
    if (
      prevProps.currentTurn !== this.props.currentTurn ||
      (prevProps.isDieRollValid !== this.props.isDieRollValid &&
        this.props.isDieRollValid)
    ) {
      this.setState({ bets: new Map<BettingOption, IBetCoin[]>() });
      this.nextCoinId = 0; // Reset coin ID counter
    }
  }

  private handleBetClick = (
    option: BettingOption,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    // Generate random position within the button (10% to 90% to avoid edges)
    const x = Math.random() * 80 + 10; // 10% to 90%
    const y = Math.random() * 80 + 10; // 10% to 90%

    // Create a new coin with unique ID and random position
    const coinId = this.nextCoinId++;
    const newCoin: IBetCoin = {
      id: coinId,
      x,
      y,
    };

    // Add coin to this option's bet list
    this.setState((prevState) => {
      const newBets = new Map(prevState.bets);
      const existingCoins = newBets.get(option) || [];
      newBets.set(option, [...existingCoins, newCoin]);
      return { bets: newBets };
    });
  };

  private isOptionLocked = (option: BettingOption): boolean => {
    // Lock options when outcome is already determined (probability = 0 or 1)
    const probability = this.getBettingProbability(option);
    const { isDetermined } = calculateBettingOdds(probability);
    return isDetermined;
  };

  private getBettingProbability = (option: BettingOption): number => {
    const {
      currentDieRoll1,
      currentDieRoll2,
      isDieRollValid,
      availableActions,
      horses,
      bases,
      currentTurn,
      cells,
      walkways,
      links,
    } = this.props;
    const roll1 = currentDieRoll1;
    const roll2 = currentDieRoll2;

    switch (option) {
      case BettingOption.ODD:
        return calculateOddEvenProbability(roll1, roll2, isDieRollValid, true);
      case BettingOption.EVEN:
        return calculateOddEvenProbability(roll1, roll2, isDieRollValid, false);
      case BettingOption.BIG:
        return calculateBigSmallProbability(roll1, roll2, isDieRollValid, true);
      case BettingOption.SMALL:
        return calculateBigSmallProbability(
          roll1,
          roll2,
          isDieRollValid,
          false
        );
      case BettingOption.MOVE:
        return calculateMoveProbability(
          isDieRollValid,
          availableActions,
          horses,
          bases,
          currentTurn,
          true
        );
      case BettingOption.NO_MOVE:
        return calculateMoveProbability(
          isDieRollValid,
          availableActions,
          horses,
          bases,
          currentTurn,
          false
        );
      case BettingOption.RELEASE:
        return calculateReleaseProbability(
          isDieRollValid,
          availableActions,
          horses,
          bases,
          currentTurn,
          cells,
          walkways,
          true
        );
      case BettingOption.NO_RELEASE:
        return calculateReleaseProbability(
          isDieRollValid,
          availableActions,
          horses,
          bases,
          currentTurn,
          cells,
          walkways,
          false
        );
      case BettingOption.KICK:
        return calculateKickProbability(
          horses,
          bases,
          currentTurn,
          cells,
          links,
          true
        );
      case BettingOption.NO_KICK:
        return calculateKickProbability(
          horses,
          bases,
          currentTurn,
          cells,
          links,
          false
        );
      case BettingOption.GO_STABLE:
        return calculateGoStableProbability(
          horses,
          bases,
          currentTurn,
          cells,
          links,
          true
        );
      case BettingOption.NO_STABLE:
        return calculateGoStableProbability(
          horses,
          bases,
          currentTurn,
          cells,
          links,
          false
        );
      default:
        return 0.5;
    }
  };

  private getBettingOdds = (option: BettingOption): string => {
    const probability = this.getBettingProbability(option);
    const { odds } = calculateBettingOdds(probability);
    return odds;
  };

  render() {
    const { bases, currentTurn } = this.props;
    const currentBase = bases[currentTurn];
    const baseColor = currentBase?.color;
    const baseHexColor = baseColor ? getBaseHexColor(baseColor) : "#dc3545"; // Default to red if no base

    const bettingOptions = [
      [
        BettingOption.ODD,
        BettingOption.EVEN,
        BettingOption.BIG,
        BettingOption.SMALL,
      ],
      [
        BettingOption.MOVE,
        BettingOption.NO_MOVE,
        BettingOption.KICK,
        BettingOption.NO_KICK,
      ],
      [
        BettingOption.RELEASE,
        BettingOption.NO_RELEASE,
        BettingOption.GO_STABLE,
        BettingOption.NO_STABLE,
      ],
    ];

    return (
      <div
        className={styles.Container}
        style={{ width: `${BOARD_DIMENSION}px` }}
      >
        {bettingOptions.map((row, rowIndex) => (
          <div key={rowIndex} className={styles.Row}>
            {row.map((option) => {
              const isLocked = this.isOptionLocked(option);
              const odds = this.getBettingOdds(option);

              const coins = this.state.bets.get(option) || [];
              const hasBet = coins.length > 0;
              const iconSize = 24; // Coin icon size in pixels

              return (
                <button
                  key={option}
                  className={classnames(
                    styles.BetButton,
                    hasBet && styles.BetButtonActive
                  )}
                  onClick={(e) => !isLocked && this.handleBetClick(option, e)}
                  disabled={isLocked}
                  style={{ backgroundColor: baseHexColor }}
                >
                  {/* Display all coins for this betting option */}
                  {coins.map((coin) => (
                    <div
                      key={coin.id}
                      className={styles.CoinIcon}
                      style={{
                        left: `${coin.x}%`,
                        top: `${coin.y}%`,
                        width: `${iconSize}px`,
                        height: `${iconSize}px`,
                        fontSize: `${iconSize * 0.6}px`,
                      }}
                    >
                      $
                    </div>
                  ))}
                  <div className={styles.BetLabel}>{option}</div>
                  {isLocked ? (
                    <svg
                      className={styles.LockIcon}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M18 11H6C4.89543 11 4 11.8954 4 13V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V13C20 11.8954 19.1046 11 18 11Z"
                        stroke="#000000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11"
                        stroke="#000000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <div className={styles.BetOdds}>{odds}</div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
}

export const BettingTable = connect(mapStateToProps)(
  BettingTableBare
) as unknown as React.ComponentClass<{}>;
