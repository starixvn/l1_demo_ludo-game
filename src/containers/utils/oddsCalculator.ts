/**
 * Odds Calculator Utility
 *
 * Calculates the betting odds of reaching each cell on the board
 * based on all possible dice roll combinations before rolling.
 * Returns odds in the format "1:X" where X represents total payout.
 */

import { Rolls } from 'containers/Dice/state/interfaces';
import { BaseID, IHorse, IBase, ICell } from 'containers/Ludo/state/interfaces';
import { CellType } from 'containers/Ludo/state/interfaces';
import { WINNING_MOVES } from 'globalConstants';

/**
 * Represents betting odds in the format 1:X
 * where X is the total payout (stake + winnings)
 */
export interface BettingOdds {
  /** Cell ID this odds applies to */
  cellID: string;
  /** Probability of reaching this cell (0.0 to 1.0) */
  probability: number;
  /** Odds ratio in the format "1:X" where X is total payout */
  oddsRatio: string;
  /** Whether this cell is reachable (has non-zero probability) */
  isPossible: boolean;
}

/**
 * All possible dice roll combinations (36 total)
 * Each combination has probability 1/36
 */
const DICE_COMBINATIONS: Array<{ roll1: Rolls; roll2: Rolls; probability: number }> = [];
for (let d1 = 1; d1 <= 6; d1++) {
  for (let d2 = 1; d2 <= 6; d2++) {
    DICE_COMBINATIONS.push({
      roll1: d1 as Rolls,
      roll2: d2 as Rolls,
      probability: 1 / 36,
    });
  }
}

/**
 * Checks if a dice roll allows spawning (1-6, 6-1, or doubles)
 */
function canSpawn(roll1: Rolls, roll2: Rolls): boolean {
  if ((roll1 === Rolls.ONE && roll2 === Rolls.SIX) || (roll1 === Rolls.SIX && roll2 === Rolls.ONE)) {
    return true;
  }
  if (roll1 === roll2) {
    return true;
  }
  return false;
}

/**
 * Checks if a horse can reach a specific cell with given steps
 * Uses BFS to find if the cell is reachable
 */
function canReachCell(
  horse: IHorse,
  targetCellID: string,
  steps: number,
  cells: { [position: string]: { [cellID: string]: ICell } },
  links: { [cellID: string]: Pick<ICell, 'position' | 'cellID'>[] },
  horses: { [horseID: string]: IHorse }
): boolean {
  if (!horse.isSpawned || !horse.cellID) {
    return false; // Can't move if not spawned
  }

  if (horse.steps + steps > WINNING_MOVES) {
    return false; // Would overshoot
  }

  // BFS to find if target cell is reachable
  const visited = new Set<string>();
  const queue: Array<{ cellID: string; stepsRemaining: number }> = [
    { cellID: horse.cellID, stepsRemaining: steps }
  ];

  while (queue.length > 0) {
    const { cellID, stepsRemaining } = queue.shift()!;

    if (stepsRemaining === 0) {
      if (cellID === targetCellID) {
        return true;
      }
      continue;
    }

    if (visited.has(cellID)) {
      continue;
    }
    visited.add(cellID);

    const nextCells = links[cellID];
    if (!nextCells || nextCells.length === 0) {
      continue;
    }

    for (const nextCell of nextCells) {
      // Check for blocking horse
      const cellData = cells[nextCell.position]?.[nextCell.cellID];
      if (cellData && cellData.horseIDs && cellData.horseIDs.length > 0) {
        // Check if we can kick (only if opponent and exact step match)
        const blockingHorse = horses[cellData.horseIDs[0]];
        if (blockingHorse && blockingHorse.baseID === horse.baseID) {
          // Same color - cannot move through
          continue;
        }
        // Different color - can kick if exact step match
        if (stepsRemaining === 1 && nextCell.cellID === targetCellID) {
          return true; // Can kick to reach target
        }
        // Cannot move through blocking horse
        continue;
      }

      if (nextCell.cellID === 'HOME') {
        if (stepsRemaining === 1 && targetCellID === 'HOME') {
          return true;
        }
        continue;
      }

      queue.push({ cellID: nextCell.cellID, stepsRemaining: stepsRemaining - 1 });
    }
  }

  return false;
}

/**
 * Checks if a horse can spawn to a specific spawn cell
 */
function canSpawnToCell(
  horse: IHorse,
  targetCellID: string,
  currentBase: IBase,
  cells: { [position: string]: { [cellID: string]: ICell } }
): boolean {
  if (horse.isSpawned) {
    return false; // Already spawned
  }

  // Find spawn cell for this base
  for (const position in cells) {
    for (const cellID in cells[position]) {
      const cell = cells[position][cellID];
      if (cell.cellID === targetCellID &&
          cell.cellType === CellType.SPAWN &&
          cell.baseID === currentBase.ID) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Converts probability to betting odds in the format "1:X"
 * where X represents the total payout (stake + winnings)
 */
function probabilityToBettingOdds(probability: number): string {
  if (probability <= 0) {
    return "1:0"; // Impossible - no payout
  }
  if (probability >= 1) {
    return "1:∞"; // Certain - infinite payout
  }

  // Calculate odds ratio: (1 - p) / p
  // This gives the multiplier for total payout
  const oddsMultiplier = (1 - probability) / probability;

  // Round to 2 decimal places for readability
  const rounded = Math.round(oddsMultiplier * 100) / 100;

  return `1:${rounded}`;
}

/**
 * Calculates betting odds for all cells based on all possible dice roll combinations
 * Returns an array of BettingOdds objects, each containing probability and betting odds ratio
 * Odds are expressed as "1:X" where X represents the total payout (stake + winnings)
 */
export function calculateCellOdds(
  horses: { [horseID: string]: IHorse },
  bases: { [baseID: string]: IBase },
  currentTurn: BaseID,
  cells: { [position: string]: { [cellID: string]: ICell } },
  links: { [cellID: string]: Pick<ICell, 'position' | 'cellID'>[] }
): BettingOdds[] {
  const probabilityMap = new Map<string, number>();
  const currentBase = bases[currentTurn];

  if (!currentBase) {
    return [];
  }

  // Get all cell IDs
  const allCellIDs = new Set<string>();
  for (const position in cells) {
    for (const cellID in cells[position]) {
      allCellIDs.add(cells[position][cellID].cellID);
    }
  }
  allCellIDs.add('HOME'); // Add HOME as a possible target

  // Initialize probabilities for all cells
  for (const cellID of allCellIDs) {
    probabilityMap.set(cellID, 0);
  }

  // Get current player's horses
  const playerHorses = currentBase.horseIDs
    .map(horseID => horses[horseID])
    .filter(horse => !horse.isRetired);

  // For each dice combination, calculate which cells are reachable
  for (const combo of DICE_COMBINATIONS) {
    const { roll1, roll2, probability } = combo;
    const sum = roll1 + roll2;
    const isPair = roll1 === roll2;

    // Check each cell to see if it's reachable with this roll
    for (const cellID of allCellIDs) {
      let isReachable = false;

      // Check each horse
      for (const horse of playerHorses) {
        // Spawn moves
        if (!horse.isSpawned && canSpawn(roll1, roll2)) {
          if (canSpawnToCell(horse, cellID, currentBase, cells)) {
            isReachable = true;
            break;
          }
        }

        // Normal moves with sum
        if (horse.isSpawned && horse.cellID) {
          if (canReachCell(horse, cellID, sum, cells, links, horses)) {
            isReachable = true;
            break;
          }

          // Pair moves (can use single die value)
          if (isPair) {
            if (canReachCell(horse, cellID, roll1, cells, links, horses)) {
              isReachable = true;
              break;
            }
          }
        }
      }

      // Add probability if reachable
      if (isReachable) {
        const currentProbability = probabilityMap.get(cellID) || 0;
        probabilityMap.set(cellID, currentProbability + probability);
      }
    }
  }

  // Convert probabilities to betting odds
  const bettingOdds: BettingOdds[] = [];
  for (const cellID of allCellIDs) {
    const probability = probabilityMap.get(cellID) || 0;
    bettingOdds.push({
      cellID,
      probability,
      oddsRatio: probabilityToBettingOdds(probability),
      isPossible: probability > 0
    });
  }

  return bettingOdds;
}

/**
 * Example usage and testing of the odds conversion
 * This function demonstrates how probabilities convert to betting odds
 */
export function testOddsConversion(): void {
  // Test various probabilities
  console.log("Probability -> Betting Odds Examples:");
  console.log(`0.0 (impossible) -> ${probabilityToBettingOdds(0.0)}`);
  console.log(`0.1 (10%) -> ${probabilityToBettingOdds(0.1)}`);
  console.log(`0.25 (25%) -> ${probabilityToBettingOdds(0.25)}`);
  console.log(`0.5 (50%) -> ${probabilityToBettingOdds(0.5)}`);
  console.log(`0.75 (75%) -> ${probabilityToBettingOdds(0.75)}`);
  console.log(`1.0 (certain) -> ${probabilityToBettingOdds(1.0)}`);
}

