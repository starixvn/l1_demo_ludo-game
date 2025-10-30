/**
 * Dice Container Selectors
 *
 * Reselect selectors for efficiently accessing dice state from the Redux store.
 * These selectors are memoized for performance.
 */

import { createSelector } from 'reselect';

import { IApplicationState } from 'state/interfaces';

import { IState } from './interfaces';

/** Base selector for accessing the dice state slice */
export const diceStateSelector = (state: IApplicationState): IState => state.dice;

/** Selector for the current die roll value */
export const currentDieRollSelector = createSelector(
  [diceStateSelector],
  (state) => state.roll,
);

/** Selector for whether the die can currently be rolled */
export const isDieRollAllowedSelector = createSelector(
  [diceStateSelector],
  (state) => state.isDieRollAllowed,
);

/** Selector for whether the current die roll is still valid for use */
export const isDieRollValidSelector = createSelector(
  [diceStateSelector],
  (state) => state.isDieRollValid,
);
