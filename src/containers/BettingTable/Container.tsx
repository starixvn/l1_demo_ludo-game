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
 */
function calculateOddEvenProbability(
  roll1: number,
  roll2: number,
  isDieRollValid: boolean,
  isOdd: boolean
): number {
  if (isDieRollValid) {
    // If dice are already rolled, check if sum is odd/even
    const sum = roll1 + roll2;
    return sum % 2 === (isOdd ? 1 : 0) ? 1.0 : 0.0;
  }
  // Before rolling: 50% chance for odd or even
  return 0.5;
}

/**
 * Calculate probability for Big/Small (sum > 7 or <= 7)
 */
function calculateBigSmallProbability(
  roll1: number,
  roll2: number,
  isDieRollValid: boolean,
  isBig: boolean
): number {
  if (isDieRollValid) {
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
    // Go Stable and No Stable are locked (disabled but show odds)

    // Lock options when outcome is already determined (probability = 0 or 1)
    const probability = this.getBettingProbability(option);
    const { isDetermined } = calculateBettingOdds(probability);
    return isDetermined;
  };

  private getBettingProbability = (option: BettingOption): number => {
    const { currentDieRoll1, currentDieRoll2, isDieRollValid } = this.props;
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
      case BettingOption.NO_MOVE:
      case BettingOption.KICK:
      case BettingOption.NO_KICK:
      case BettingOption.RELEASE:
      case BettingOption.NO_RELEASE:
      case BettingOption.GO_STABLE:
      case BettingOption.NO_STABLE:
        // TODO: Calculate based on game state and available actions
        // For now, use a default probability that gives odds around 1:1.96
        return 0.338; // This gives approximately 1:1.96 odds
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
