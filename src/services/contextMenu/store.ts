/**
 * Context Menu Service Zustand Store
 *
 * Zustand store for ContextMenu state management, replacing Redux.
 * Handles right-click context menu visibility, position, and content.
 */

import create from 'zustand';

import { IMenuContent, IState } from './interfaces';

interface ContextMenuState extends IState {
  // Actions
  showContextMenu: (x: number, y: number, menuContents: IMenuContent[]) => void;
  hideContextMenu: () => void;
}

/**
 * Initial state for the ContextMenu store
 */
const initialState: Omit<ContextMenuState, 'showContextMenu' | 'hideContextMenu'> = {
  menuContents: [], // No menu items initially
  position: {
    x: 0,          // Start at origin
    y: 0,
  },
  visible: false,   // Menu is hidden by default
};

/**
 * ContextMenu Zustand store
 * Manages right-click context menu state
 */
export const contextMenuStore = create<ContextMenuState>((set) => ({
  ...initialState,

  /**
   * Show the context menu with specified content and position
   */
  showContextMenu: (x: number, y: number, menuContents: IMenuContent[]) => {
    set({
      menuContents, // Set menu items to display
      position: {
        x, // Set horizontal position
        y, // Set vertical position
      },
      visible: true, // Make menu visible
    });
  },

  /**
   * Hide the context menu and reset to initial state
   */
  hideContextMenu: () => {
    set(initialState); // Reset to initial hidden state
  },
}));

/**
 * Selectors for accessing ContextMenu state
 */
export const contextMenuSelectors = {
  getPosition: () => contextMenuStore.getState().position,
  getMenuContents: () => contextMenuStore.getState().menuContents,
  isVisible: () => contextMenuStore.getState().visible,
};

/**
 * Hook for using ContextMenu selectors in components
 */
export const useContextMenuSelectors = () => ({
  position: contextMenuSelectors.getPosition(),
  menuContents: contextMenuSelectors.getMenuContents(),
  visible: contextMenuSelectors.isVisible(),
});
