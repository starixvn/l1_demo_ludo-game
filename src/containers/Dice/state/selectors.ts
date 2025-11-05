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

/** Selector for the current first die roll value */
export const currentDieRoll1Selector = createSelector(
  [diceStateSelector],
  (state) => state.roll1,
);

/** Selector for the current second die roll value */
export const currentDieRoll2Selector = createSelector(
  [diceStateSelector],
  (state) => state.roll2,
);

/** Selector for the sum of both dice (for movement) */
export const currentDieRollSumSelector = createSelector(
  [diceStateSelector],
  (state) => state.roll1 + state.roll2,
);

/** Selector for the current die roll values (both dice) - kept for backward compatibility */
export const currentDieRollSelector = createSelector(
  [diceStateSelector],
  (state) => state.roll1 + state.roll2,
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

/** Selector for whether the dice are currently rolling (animating) */
export const isRollingSelector = createSelector(
  [diceStateSelector],
  (state) => state.isRolling,
);
