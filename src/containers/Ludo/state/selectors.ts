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

export const replaySelector = createSelector(
  [ludoStateSelector],
  (state) => state.replay,
);

/** Reverse index lookup: index(number) -> { cellID, position } */
export const cellIndexLookupSelector = createSelector(
  [cellsSelector],
  (cells) => {
    const map = new Map<number, { cellID: string; position: string }>();
    for (const position of Object.keys(cells)) {
      const byId = (cells as any)[position] as Record<string, { index?: number; cellID: string }>;
      for (const cellID of Object.keys(byId)) {
        const cell = byId[cellID] as any;
        if (typeof cell.index === 'number') {
          map.set(cell.index, { cellID, position });
        }
      }
    }
    return map;
  }
);