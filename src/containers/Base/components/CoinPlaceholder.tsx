/**
 * Coin Placeholder Component
 *
 * A wrapper component that provides a visual container for coins.
 * Shows a colored circle background where coins can be placed.
 * Can conditionally show or hide the actual coin inside.
 */

import React from "react";

import { getStyleObject } from "containers/utils"; // Utility for creating style objects
import { COIN_PLACEHOLDER_SIZE, COIN_SIZE } from "globalConstants"; // Size constants
import { BaseColors } from "state/interfaces"; // Available player colors

import { Coin } from "./Coin"; // The actual coin component

import styles from "./CoinPlaceholder.module.css"; // CSS module for styling

/**
 * Props for the CoinPlaceholder component
 */
interface ICoinPlaceholderProps {
  /** Color of the placeholder (matches the player's base color) */
  baseColor: BaseColors;
  /** Whether to hide the coin inside the placeholder */
  isCoinHidden: boolean;
  /** Callback function when the coin/placeholder is clicked (disabled - actions must be chosen from action panel) */
  onCoinClicked?: () => void;
}

/**
 * CoinPlaceholder component - provides a visual slot for coins
 * Used in bases and other areas where coins need to be positioned
 */
export class CoinPlaceholder extends React.PureComponent<ICoinPlaceholderProps> {
  render() {
    const { baseColor, isCoinHidden } = this.props;

    return (
      <div
        className={styles.Container} // Container with centering
        style={getStyleObject(COIN_PLACEHOLDER_SIZE, COIN_PLACEHOLDER_SIZE)} // Placeholder size
      >
        <div
          className={styles.Circle} // Colored circle background
          style={getStyleObject(COIN_SIZE, COIN_SIZE, BaseColors.DEFAULT)} // Circle size and color
        >
          {isCoinHidden ? null : ( // Hide coin if specified
            <Coin
              baseColor={baseColor} // Pass color to coin
              // onCoinClicked removed - coins are not clickable, actions must be chosen from action panel
            />
          )}
        </div>
      </div>
    );
  }
}
