/**
 * Context Menu Service Interfaces
 *
 * Defines the data structures for the right-click context menu system.
 * Used primarily during development for board editing and configuration.
 */

/**
 * Represents a single menu item in the context menu
 */
export interface IMenuContent {
  /** Text label displayed for this menu option */
  label: string;
  /** Function to execute when this menu item is clicked */
  action: () => void;
}

/**
 * State structure for the context menu service
 * Manages the visibility, position, and content of the right-click menu
 */
export interface IState {
  /** Screen coordinates where the menu should appear */
  position: {
    /** X coordinate (horizontal position) */
    x: number,
    /** Y coordinate (vertical position) */
    y: number,
  },
  /** Array of menu items to display in the context menu */
  menuContents: IMenuContent[];
  /** Whether the context menu is currently visible */
  visible: boolean;
}
