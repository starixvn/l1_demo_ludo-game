/**
 * Base Container Component
 *
 * Represents a player's starting base where coins begin the game.
 * Shows 4 coin placeholders that can spawn coins when the player rolls a 6.
 * The base becomes "spawnable" when the player rolls a 6 on the die.
 */

import classnames from "classnames"; // Utility for conditional CSS classes
import React from "react";

import { diceStore } from "containers/Dice/state/store"; // Dice Zustand store
import { IBase, ICoin } from "containers/Ludo/state/interfaces"; // Game data types
import { ludoStore } from "containers/Ludo/state/store"; // Ludo Zustand store
import { getStyleObject } from "containers/utils"; // Styling utilities
import { BASE_SIZE, INNER_BASE_SIZE } from "globalConstants"; // Size constants

import { CoinPlaceholder } from "./components/CoinPlaceholder"; // Coin placeholder component

import styles from "./Container.module.css"; // Component styles

/**
 * Public props for the Base component
 */
interface IPublicProps {
  /** Unique identifier for this base (BASE_1, BASE_2, etc.) */
  baseID: IBase["ID"];
  /** Whether this base is enabled/active in the current game */
  enabled: boolean;
  /** Whether the player of this base has won the game */
  hasWon: boolean;
  /** Whether to show debug text (base ID, color, etc.) */
  showDebugText?: boolean;
}

/** Combined component props */
interface IProps extends IPublicProps {}

/**
 * Base container component class
 * Renders a player's base with coin placeholders that can spawn coins
 */
class BaseBare extends React.PureComponent<IProps> {
  private unsubscribe?: () => void;

  componentDidMount() {
    // Subscribe to store changes to trigger re-renders
    this.unsubscribe = ludoStore.subscribe(() => {
      // Force re-render when store changes
      this.forceUpdate();
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  /**
   * Renders the base with outer and inner containers
   * Shows coin placeholders that change appearance based on game state
   */
  render() {
    const { baseID, enabled, hasWon } = this.props;
    const state = ludoStore.getState();
    const bases = state.bases;
    const coins = state.coins;
    const base = bases[baseID];

    // Add special styling when base is spawnable (player rolled a 6)
    const spawnableClass = base.spawnable ? styles.Spawnable : null;

    // Count coins in different states for display
    const coinsInBase = base.coinIDs.filter(
      (coinID: ICoin["coinID"]) =>
        coins[coinID] && !coins[coinID].isSpawned && !coins[coinID].isRetired
    ).length;
    const coinsSpawned = base.coinIDs.filter(
      (coinID: ICoin["coinID"]) =>
        coins[coinID] && coins[coinID].isSpawned && !coins[coinID].isRetired
    ).length;
    const coinsHome = base.coinIDs.filter(
      (coinID: ICoin["coinID"]) => coins[coinID] && coins[coinID].isRetired
    ).length;

    return (
      <div
        className={styles.OuterContainer}
        style={getStyleObject(BASE_SIZE, BASE_SIZE, base.color)} // Colored outer border
      >
        {/* Base information display */}
        {this.props.showDebugText !== false && (
          <div className={styles.BaseInfo}>
            <div className={styles.BaseID}>{baseID.replace("_", " ")}</div>
            <div className={styles.BaseColor}>{base.color}</div>
            <div className={styles.BaseStatus}>
              {!enabled && "DISABLED"}
              {hasWon && "WINNER!"}
              {enabled && !hasWon && base.spawnable && "SPAWN READY"}
            </div>
            <div className={styles.CoinStatus}>
              {coinsInBase > 0 && <span>In Base: {coinsInBase}</span>}
              {coinsSpawned > 0 && <span>On Board: {coinsSpawned}</span>}
              {coinsHome > 0 && <span>Home: {coinsHome}</span>}
            </div>
          </div>
        )}

        <div
          className={classnames(styles.InnerContainer, spawnableClass)}
          style={getStyleObject(INNER_BASE_SIZE, INNER_BASE_SIZE)} // Inner area sizing
        >
          {
            // Render 4 coin placeholders (one for each coin in the base)
            base.coinIDs.map((coinID: ICoin["coinID"], index: number) => {
              const coin = coins[coinID];
              return (
                <CoinPlaceholder
                  key={index}
                  baseColor={base.color} // Coin color matches base color
                  // Hide coin if base is disabled OR coin is already spawned/retired
                  isCoinHidden={!enabled || coin.isSpawned || coin.isRetired}
                  onCoinClicked={() => this.onCoinClicked(base, coin)}
                />
              );
            })
          }
        </div>
      </div>
    );
  }

  /**
   * Handles coin click events for spawning
   * Only allows spawning if base is spawnable and die roll is valid
   */
  private onCoinClicked = (base: IBase, coin: ICoin) => {
    // Check if player can spawn (rolled 6) and die roll is still valid
    if (base.spawnable && diceStore.getState().isDieRollValid) {
      ludoStore.getState().spawnCoin(base.ID, coin.coinID); // Dispatch spawn action
    }
  };
}

/**
 * Base component with Zustand state management
 */
export const Base = BaseBare;
