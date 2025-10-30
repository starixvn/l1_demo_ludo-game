/**
 * Context Menu Service Actions
 *
 * Redux actions for managing the right-click context menu system.
 * Used primarily during development for board editing and configuration.
 */

import { IReduxAction } from 'state/interfaces';

import { IMenuContent } from './interfaces';

/**
 * Action Types for Context Menu State Management
 * All action types are prefixed with 'contextMenu/' to avoid conflicts
 */
export enum ActionTypes {
  SHOW_CONTEXT_MENU = 'contextMenu/SHOW_CONTEXT_MENU', // Display context menu at specific position
  HIDE_CONTEXT_MENU = 'contextMenu/HIDE_CONTEXT_MENU', // Hide the context menu
}

/**
 * Action creator to show the context menu
 * @param x - X coordinate for menu position
 * @param y - Y coordinate for menu position
 * @param menuContents - Array of menu items to display
 */
export const showContextMenu = (x: number, y: number, menuContents: IMenuContent[]): IReduxAction<ActionTypes.SHOW_CONTEXT_MENU, { menuContents: IMenuContent[], x: number, y: number }> => ({
  data: {
    menuContents, // Menu items to show
    x,           // Horizontal position
    y,           // Vertical position
  },
  type: ActionTypes.SHOW_CONTEXT_MENU,
});

/**
 * Action creator to hide the context menu
 */
export const hideContextMenu = (): IReduxAction<ActionTypes.HIDE_CONTEXT_MENU, void> => ({
  type: ActionTypes.HIDE_CONTEXT_MENU,
});

/**
 * Union type of all possible context menu actions
 * Used by the reducer to ensure type safety when handling actions
 */
export type Actions =
  | ReturnType<typeof showContextMenu>
  | ReturnType<typeof hideContextMenu>
  ;
