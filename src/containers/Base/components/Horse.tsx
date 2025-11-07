/**
 * Horse Component
 *
 * Renders a single game horse/piece in the Ludo game.
 * Horses are the pieces that players move around the board.
 * Each horse belongs to a specific player (represented by baseColor).
 */

import React from "react";

import { getStyleObject } from "containers/utils"; // Utility for creating style objects
import { HORSE_SIZE } from "globalConstants"; // Default horse size constant
import { BaseColors } from "state/interfaces"; // Available player colors

import styles from "./Horse.module.css"; // CSS module for horse styling

/**
 * Props for the Horse component
 */
interface IProps {
  /** The color of the horse (matches the player's base color) */
  baseColor: BaseColors;
  /** Optional custom size for the horse (defaults to HORSE_SIZE) */
  horseSize?: number;
  /** Whether the horse is currently jumping (for animation) */
  isJumping?: boolean;
  /** Callback function when the horse is clicked (disabled - actions must be chosen from action panel) */
  onHorseClicked?: () => void;
}

/**
 * Horse component - represents a single game piece
 * Uses PureComponent for performance optimization since horse props rarely change
 */
export class Horse extends React.PureComponent<IProps> {
  render() {
    // Use default horse size if not specified
    const { horseSize = HORSE_SIZE, isJumping = false } = this.props;

    const style = getStyleObject(
      horseSize * 0.8,
      horseSize * 0.8,
      this.props.baseColor
    );
    // Override backgroundColor with color so the Unicode character uses the player's color
    const finalStyle = {
      ...style,
      backgroundColor: "transparent",
      color: style.backgroundColor, // Use the background color as text color for the Unicode character
    };

    // Combine base class with jumping animation class if needed
    const className = isJumping
      ? `${styles.Container} ${styles.Jumping}`
      : styles.Container;

    return (
      <div
        className={className} // CSS module classes for styling and animation
        style={finalStyle} // Dynamic size and color
        // onClick removed - horses are not clickable, actions must be chosen from action panel
      >
        &#9822;
      </div>
    );
  }
}
