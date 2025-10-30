/**
 * Context Menu Service Functions
 *
 * Convenience functions for dispatching context menu actions.
 * Provides a simple API for showing and hiding the context menu from anywhere in the app.
 */

import { dispatch } from 'state/store'; // Global dispatch function

import {
  hideContextMenu as hideContextMenuAction, // Import hide action creator
  showContextMenu as showContextMenuAction,  // Import show action creator
} from './actions';
import { IMenuContent } from './interfaces'; // Menu content interface

/**
 * Shows the context menu at the specified position with the given menu items
 * @param x - X coordinate for menu position
 * @param y - Y coordinate for menu position
 * @param menuContents - Array of menu items to display
 */
export const showContextMenu = (x: number, y: number, menuContents: IMenuContent[]) =>
  dispatch(showContextMenuAction(x, y, menuContents));

/**
 * Hides the context menu and resets it to its initial state
 */
export const hideContextMenu = () =>
  dispatch(hideContextMenuAction());
