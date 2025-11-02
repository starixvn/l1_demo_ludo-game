/**
 * Player Container Component
 *
 * Represents a single player's interface in the Ludo game.
 * Shows the player's avatar, dice (when active), and retired coins that have reached home.
 * Handles player-specific UI state like active/inactive status and positioning.
 */

import classnames from "classnames"; // Utility for conditional CSS classes
import React from "react";

import { Coin } from "containers/Base/components/Coin"; // Coin component for retired coins
import { Dice } from "containers/Dice/Container"; // Dice component for the player
import { IBase, ICoin } from "containers/Ludo/state/interfaces"; // Base data types
import { ludoStore } from "containers/Ludo/state/store"; // Ludo Zustand store
import { PlayerAvatar } from "./components/PlayerAvatar"; // Player avatar component

import styles from "./Container.module.css"; // Component styles

/**
 * Public props for the Player component
 */
interface IPublicProps {
  /** Unique identifier for the player's base */
  baseID: IBase["ID"];
  /** Position on screen (top or bottom of the game board) */
  placement: "top" | "bottom";
  /** Whether this player is currently disabled (not their turn) */
  disabled: boolean;
}

/** Combined component props */
interface IProps extends IPublicProps {}

/**
 * Player container component class
 * Renders the player interface including avatar, dice, and retired coins
 */
class PlayerBare extends React.PureComponent<IProps> {
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
   * Renders the player interface
   * Only renders if the player's base exists and is enabled
   */
  render() {
    const { baseID, placement, disabled } = this.props;
    const state = ludoStore.getState();
    const bases = state.bases;
    const coins = state.coins;

    // Determine CSS classes based on placement and disabled state
    const placementClass =
      placement === "top" ? styles.TopPlacement : styles.BottomPlacement;
    const disabledClass = disabled ? styles.Disabled : null;

    // Get the player's base data
    const base = bases[baseID];

    // Only render if base exists and is enabled
    return base && base.enabled ? (
      <div
        className={classnames(styles.Container, placementClass, disabledClass)}
      >
        {/* Player avatar showing their color */}
        <PlayerAvatar baseColor={base.color} />

        {/* Dice component - only shown when player is active (not disabled) */}
        {!disabled && <Dice baseColor={base.color} />}

        {/* Container for coins that have reached home (retired) */}
        <div className={styles.RetiredCoins}>
          {
            // Filter and display only retired coins for this player
            base.coinIDs
              .filter((coinID: ICoin["coinID"]) => coins[coinID].isRetired)
              .map((coinID: ICoin["coinID"], index: number) => (
                <Coin
                  baseColor={base.color} // Use player's color
                  onCoinClicked={() => null} // Retired coins are not clickable
                  key={index}
                />
              ))
          }
        </div>
      </div>
    ) : null; // Don't render disabled/inactive players
  }
}

/**
 * Player component with Zustand state management
 */
export const Player = PlayerBare;
