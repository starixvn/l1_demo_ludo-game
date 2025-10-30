/**
 * Context Menu Service Selectors
 *
 * Reselect selectors for efficiently accessing context menu state from the Redux store.
 * These selectors are memoized for performance and used throughout the application.
 */

import { createSelector } from 'reselect';

import { IApplicationState } from 'state/interfaces';

import { IState } from './interfaces';

/** Base selector for accessing the context menu state slice */
export const contextMenuStateSelector = (state: IApplicationState): IState => state.contextMenu;

/** Selector for whether the context menu is currently visible */
export const isContextMenuVisibleSelector = createSelector(
  [contextMenuStateSelector],
  (state) => state.visible,
);

/** Selector for the current position of the context menu */
export const contextMenuPositionSelector = createSelector(
  [contextMenuStateSelector],
  (state) => state.position,
);

/** Selector for the menu contents (array of menu items) */
export const menuContentsSelector = createSelector(
  [contextMenuStateSelector],
  (state) => state.menuContents,
);
