/**
 * Context Menu Component
 *
 * Renders a right-click context menu at a specific screen position.
 * Used during development for board editing and configuration options.
 * Displays a list of clickable menu items that execute callback functions.
 */

import React from 'react';

import { IState } from '../interfaces'; // Context menu state types

import styles from './ContextMenu.module.css'; // Component styles

/**
 * Props for the ContextMenu component
 */
interface IProps {
  /** Array of menu items to display */
  menuContents: IState['menuContents'];
  /** Screen coordinates where the menu should appear */
  position: IState['position'];
}

/**
 * ContextMenu component - renders a positioned menu with clickable options
 * Used primarily for development tools like board cell editing
 */
export class ContextMenu extends React.PureComponent<IProps> {
  render() {
    const { menuContents, position } = this.props;

    return (
      <div
        className={styles.Container}
        style={{
          left: `${position.x}px`,  // Position horizontally
          top: `${position.y}px`,   // Position vertically
        }}
      >
        {
          // Render each menu item as a clickable div
          menuContents.map((menuContent, index) => (
            <div
              className={styles.MenuItem}
              onClick={() => menuContent.action()} // Execute the menu item's action
              key={index}
            >
              { menuContent.label } // Display the menu item text
            </div>
          ))
        }
      </div>
    );
  }
}
