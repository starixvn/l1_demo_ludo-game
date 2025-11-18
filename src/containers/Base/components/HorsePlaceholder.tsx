/**
 * Horse Placeholder Component
 *
 * A wrapper component that provides a visual container for horses.
 * Shows a colored circle background where horses can be placed.
 * Can conditionally show or hide the actual horse inside.
 */

import React from "react";

import { getStyleObject } from "containers/utils"; // Utility for creating style objects
import { HORSE_PLACEHOLDER_SIZE, HORSE_SIZE } from "globalConstants"; // Size constants
import { BaseColors } from "state/interfaces"; // Available player colors

import { Horse } from "./Horse"; // The actual horse component

import styles from "./HorsePlaceholder.module.css"; // CSS module for styling

/**
 * Props for the HorsePlaceholder component
 */
interface IHorsePlaceholderProps {
  /** Color of the placeholder (matches the player's base color) */
  baseColor: BaseColors;
  /** Whether to hide the horse inside the placeholder */
  isHorseHidden: boolean;
  /** Whether the horse is being hovered (for action selection highlighting) */
  isHovered?: boolean;
  /** Optional horse ID to pass to the Horse component */
  horseID?: string;
  /** Callback function when the horse/placeholder is clicked (disabled - actions must be chosen from action panel) */
  onHorseClicked?: () => void;
}

/**
 * HorsePlaceholder component - provides a visual slot for horses
 * Used in bases and other areas where horses need to be positioned
 */
export class HorsePlaceholder extends React.PureComponent<IHorsePlaceholderProps> {
  render() {
    const { baseColor, isHorseHidden, isHovered = false, horseID } = this.props;

    return (
      <div
        className={styles.Container} // Container with centering
        style={getStyleObject(HORSE_PLACEHOLDER_SIZE, HORSE_PLACEHOLDER_SIZE)} // Placeholder size
      >
        <div
          className={styles.Circle} // Colored circle background
          style={getStyleObject(HORSE_SIZE, HORSE_SIZE, BaseColors.DEFAULT)} // Circle size and color
        >
          {isHorseHidden ? null : ( // Hide horse if specified
            <Horse
              baseColor={baseColor} // Pass color to horse
              horseID={horseID} // Pass horse ID to extract and display number
              isHovered={isHovered} // Whether this horse is being hovered
              // onHorseClicked removed - horses are not clickable, actions must be chosen from action panel
            />
          )}
        </div>
      </div>
    );
  }
}
