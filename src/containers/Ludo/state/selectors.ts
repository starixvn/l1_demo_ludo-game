import { createSelector } from 'reselect';

import { IApplicationState } from 'state/interfaces';

import { IState } from './interfaces';

export const ludoStateSelector = (state: IApplicationState): IState => state.ludo;

export const basesSelector = createSelector(
  [ludoStateSelector],
  (state) => state.bases,
);

export const relationshipsSelector = createSelector(
  [ludoStateSelector],
  (state) => state.relationships,
);

export const walkwaysSelector = createSelector(
  [ludoStateSelector],
  (state) => state.walkways,
);

export const cellsSelector = createSelector(
  [ludoStateSelector],
  (state) => state.cells,
);

export const linksSelector = createSelector(
  [ludoStateSelector],
  (state) => state.links,
);

export const horsesSelector = createSelector(
  [ludoStateSelector],
  (state) => state.horses,
);

export const currentTurnSelector = createSelector(
  [ludoStateSelector],
  (state) => state.currentTurn,
);

export const availableActionsSelector = createSelector(
  [ludoStateSelector],
  (state) => state.availableActions,
);

export const availableActionsDieValueSelector = createSelector(
  [ludoStateSelector],
  (state) => state.availableActionsDieValue,
);

export const highlightedCellsSelector = createSelector(
  [ludoStateSelector],
  (state) => state.highlightedCells,
);

export const highlightedCellsByHorseSelector = createSelector(
  [ludoStateSelector],
  (state) => state.highlightedCellsByHorse,
);

export const hoveredHorseIDSelector = createSelector(
  [ludoStateSelector],
  (state) => state.hoveredHorseID,
);