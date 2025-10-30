/**
 * Coin Component
 *
 * Renders a single game coin/piece in the Ludo game.
 * Coins are the pieces that players move around the board.
 * Each coin belongs to a specific player (represented by baseColor).
 */

import React from 'react';

import { getStyleObject } from 'containers/utils';        // Utility for creating style objects
import { COIN_SIZE } from 'globalConstants';             // Default coin size constant
import { BaseColors } from 'state/interfaces';           // Available player colors

import styles from './Coin.module.css';                  // CSS module for coin styling

/**
 * Props for the Coin component
 */
interface IProps {
  /** The color of the coin (matches the player's base color) */
  baseColor: BaseColors;
  /** Optional custom size for the coin (defaults to COIN_SIZE) */
  coinSize?: number;
  /** Callback function when the coin is clicked */
  onCoinClicked: () => void;
}

/**
 * Coin component - represents a single game piece
 * Uses PureComponent for performance optimization since coin props rarely change
 */
export class Coin extends React.PureComponent<IProps> {
  render() {
    // Use default coin size if not specified
    const { coinSize = COIN_SIZE } = this.props;

    return (
      <div
        className={styles.Container}                                       // CSS module class for styling
        style={getStyleObject(coinSize * 0.8, coinSize * 0.8, this.props.baseColor)} // Dynamic size and color
        onClick={() => this.props.onCoinClicked()}                       // Handle click events
      />
    );
  }
}
