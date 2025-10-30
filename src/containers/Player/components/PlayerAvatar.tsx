/**
 * Player Avatar Component
 *
 * Displays a visual representation of a player using an SVG icon.
 * The avatar shows a simple face/head shape in the player's color.
 * Used to identify players in the UI.
 */

import React from 'react';

import { getBaseHexColor } from 'containers/utils';        // Utility to get hex color from BaseColors enum
import { BaseColors } from 'state/interfaces';            // Available player colors

import styles from './PlayerAvatar.module.css';           // CSS module for styling

/**
 * Props for the PlayerAvatar component
 */
interface IProps {
  /** The color representing this player */
  baseColor: BaseColors;
}

/**
 * PlayerAvatar component - renders a colored avatar icon for each player
 * Uses SVG to draw a simple face-like shape in the player's color
 */
export class PlayerAvatar extends React.PureComponent<IProps> {
  render() {
    const { baseColor } = this.props;
    // Convert enum color to hex value for SVG styling
    const color = getBaseHexColor(baseColor);

    return (
      <div className={styles.Container}>
        {/* SVG avatar icon - simple face/head shape */}
        <svg width='100' height='100' xmlns='http://www.w3.org/2000/svg'>
        <g>
          <title>Player Avatar</title>
          {/* Main head circle in player color */}
          <ellipse ry='50' rx='50' cy='50' cx='50' strokeWidth='0' stroke={color} fill={color}/>
          {/* Smaller circle for additional shape detail */}
          <ellipse cy='56.25' cx='59.25' strokeWidth='0' stroke={color} fill={color}/>
          {/* White circle for face/eye area */}
          <ellipse ry='25' rx='25' cy='37.796875' cx='51.75' strokeWidth='0' stroke='#FFFFFF' fill='#FFFFFF'/>
          {/* White oval for mouth area */}
          <ellipse ry='12.5' rx='27.5' cy='80' cx='52' strokeWidth='0' stroke='#FFFFFF' fill='#FFFFFF'/>
        </g>
        </svg>
      </div>
    );
  }
}
