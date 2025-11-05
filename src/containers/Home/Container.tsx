import React from "react";

import { IRelationship } from "containers/Ludo/state/interfaces";
import {
  basesSelector,
  cellsSelector,
  linksSelector,
} from "containers/Ludo/state/selectors";
import { getStyleObject } from "containers/utils";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import { Cell } from "containers/Walkway/components/Cell";
import { WalkwayPosition } from "state/interfaces";

import styles from "./Container.module.css";

interface IStateProps {
  bases: ReturnType<typeof basesSelector>;
  cells: ReturnType<typeof cellsSelector>;
  links: ReturnType<typeof linksSelector>;
}

interface IPublicProps {
  baseIDs: IRelationship["baseIDs"];
  /** Whether to show debug text (cell IDs, base IDs, etc.) */
  showDebugText?: boolean;
}

interface IProps extends IStateProps, IPublicProps {}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector,
  cells: cellsSelector,
  links: linksSelector,
});

class HomeBare extends React.PureComponent<IProps> {
  render() {
    const { cells, links, bases } = this.props;

    // Filter cells that have notRenderInWalkway = true
    const homeCells: any[] = [];
    Object.values(cells).forEach((positionCells: any) => {
      Object.values(positionCells).forEach((cell: any) => {
        if (cell.notRenderInWalkway) {
          homeCells.push(cell);
        }
      });
    });

    return (
      <div className={styles.Container} style={getStyleObject(1, 3)}>
        {homeCells.map((cell: any, index: number) => {
          // Get next link cell IDs for this cell
          const cellLinks = links[cell.cellID] || [];
          const nextLinkCellIDs = cellLinks.map((link: any) => link.cellID);

          const cellBase = bases[cell.baseID];
          const cellColor = cellBase?.color;

          return (
            <div
              key={cell.cellID}
              className={styles.HomeCell}
              style={this.getCellStyle(cell)}
            >
              <Cell
                row={cell.cellID === "NORTH_6_1" ? 6 : 0} // NORTH_6_1 should show index 6
                column={cell.cellID === "SOUTH_0_1" ? 0 : 0} // SOUTH_0_1 should show index 6 (7-1-0=6)
                walkwayPosition={
                  cell.cellID === "NORTH_6_1"
                    ? WalkwayPosition.NORTH
                    : cell.cellID === "SOUTH_0_1"
                    ? WalkwayPosition.SOUTH
                    : WalkwayPosition.NORTH
                }
                baseID={cell.baseID}
                cellType={cell.cellType}
                color={cellColor}
                nextLinkCellIDs={nextLinkCellIDs}
                showDebugText={this.props.showDebugText}
                index={cell.index}
                onContextMenuOpened={() => {}} // No context menu for home cells
              >
                {cell.coinIDs.length > 0 && (
                  <span className={styles.CoinCount}>
                    {cell.coinIDs.length}
                  </span>
                )}
              </Cell>
            </div>
          );
        })}
      </div>
    );
  }

  private getCellStyle = (cell: any): React.CSSProperties => {
    // Position the cells appropriately within the 1x3 home container
    // YELLOW (NORTH_6_1) at top, RED (SOUTH_0_1) at bottom
    const basePositioning = {
      position: "absolute" as const,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
    };

    if (cell.cellID === "NORTH_6_1") {
      return {
        ...basePositioning,
        top: 0,
        left: 0,
      };
    } else if (cell.cellID === "SOUTH_0_1") {
      return {
        ...basePositioning,
        bottom: 0,
        left: 0,
      };
    }

    return basePositioning;
  };
}

export const Home = connect(mapStateToProps)(
  HomeBare
) as unknown as React.ComponentClass<IPublicProps>;
