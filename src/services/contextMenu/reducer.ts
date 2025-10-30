/**
 * Context Menu Service Reducer
 *
 * Manages the state of the right-click context menu.
 * Controls menu visibility, position, and content for development tools.
 */

import { Actions, ActionTypes } from './actions';
import { IState } from './interfaces';

/**
 * Initial state for the context menu
 * Menu starts hidden with no content and at origin position
 */
const initialState: IState = {
  menuContents: [], // No menu items initially
  position: {
    x: 0,          // Start at origin
    y: 0,
  },
  visible: false,   // Menu is hidden by default
};

/**
 * Main reducer function for context menu state management
 * @param state - Current context menu state
 * @param action - Action to process
 * @returns New context menu state after applying the action
 */
export const reducer = (state: IState = initialState, action: Actions): IState => {
  switch (action.type) {
    /**
     * Show the context menu with specified content and position
     * Updates menu contents, position, and sets visibility to true
     */
    case ActionTypes.SHOW_CONTEXT_MENU:
      return {
        ...state,
        menuContents: action.data!.menuContents, // Set menu items to display
        position: {
          x: action.data!.x, // Set horizontal position
          y: action.data!.y, // Set vertical position
        },
        visible: true, // Make menu visible
      }

    /**
     * Hide the context menu and reset to initial state
     * Clears all menu content and positions menu at origin
     */
    case ActionTypes.HIDE_CONTEXT_MENU:
      return initialState; // Reset to initial hidden state

    default:
      return state;
  }
}
