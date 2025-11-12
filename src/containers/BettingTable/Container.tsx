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
 */
function calculateBettingOdds(probability: number): string {
  if (probability <= 0) {
    return "1:0";
  }
  if (probability >= 1) {
    return "1:∞";
  }
  const oddsMultiplier = (1 - probability) / probability;
  const rounded = Math.round(oddsMultiplier * 100) / 100;
  return `1:${rounded}`;
}

/**
 * Calculate probability for Odd/Even
 */
function calculateOddEvenProbability(
  roll1: number | null,
  roll2: number | null,
  isOdd: boolean
): number {
  if (roll1 !== null && roll2 !== null) {
    // If dice are already rolled, check if sum is odd/even
    const sum = roll1 + roll2;
    return (sum % 2 === (isOdd ? 1 : 0)) ? 1.0 : 0.0;
  }
  // Before rolling: 50% chance for odd or even
  return 0.5;
}

/**
 * Calculate probability for Big/Small (sum > 7 or <= 7)
 */
function calculateBigSmallProbability(
  roll1: number | null,
  roll2: number | null,
  isBig: boolean
): number {
  if (roll1 !== null && roll2 !== null) {
    const sum = roll1 + roll2;
    return (isBig ? sum > 7 : sum <= 7) ? 1.0 : 0.0;
  }
  // Before rolling: calculate probability
  // Big (sum > 7): 15/36 = 0.4167
  // Small (sum <= 7): 21/36 = 0.5833
  return isBig ? 15 / 36 : 21 / 36;
}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  currentDieRoll1: currentDieRoll1Selector,
  currentDieRoll2: currentDieRoll2Selector,
  isDieRollAllowed: isDieRollAllowedSelector,
  isDieRollValid: isDieRollValidSelector,
  bases: basesSelector,
  horses: horsesSelector,
  currentTurn: currentTurnSelector,
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
      (prevProps.isDieRollValid !== this.props.isDieRollValid && this.props.isDieRollValid)
    ) {
      this.setState({ bets: new Map<BettingOption, IBetCoin[]>() });
      this.nextCoinId = 0; // Reset coin ID counter
    }
  }

  private handleBetClick = (option: BettingOption, event: React.MouseEvent<HTMLButtonElement>) => {
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
    // Go Stable and No Stable are locked (disabled but show odds)
    return option === BettingOption.GO_STABLE || option === BettingOption.NO_STABLE;
  };

  private getBettingOdds = (option: BettingOption): string => {
    const { currentDieRoll1, currentDieRoll2 } = this.props;
    const roll1 = currentDieRoll1;
    const roll2 = currentDieRoll2;

    let probability = 0.5; // Default

    switch (option) {
      case BettingOption.ODD:
        probability = calculateOddEvenProbability(roll1, roll2, true);
        break;
      case BettingOption.EVEN:
        probability = calculateOddEvenProbability(roll1, roll2, false);
        break;
      case BettingOption.BIG:
        probability = calculateBigSmallProbability(roll1, roll2, true);
        break;
      case BettingOption.SMALL:
        probability = calculateBigSmallProbability(roll1, roll2, false);
        break;
      case BettingOption.MOVE:
      case BettingOption.NO_MOVE:
      case BettingOption.KICK:
      case BettingOption.NO_KICK:
      case BettingOption.RELEASE:
      case BettingOption.NO_RELEASE:
      case BettingOption.GO_STABLE:
      case BettingOption.NO_STABLE:
        // TODO: Calculate based on game state and available actions
        // For now, use a default probability that gives odds around 1:1.96
        probability = 0.338; // This gives approximately 1:1.96 odds
        break;
      default:
        probability = 0.5;
    }

    return calculateBettingOdds(probability);
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
                  <div className={styles.BetOdds}>{odds}</div>
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

