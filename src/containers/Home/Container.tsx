import React from "react";

import { IRelationship } from "containers/Ludo/state/interfaces";
import {
  basesSelector,
  cellsSelector,
  horsesSelector,
  linksSelector,
} from "containers/Ludo/state/selectors";
import { getStyleObject } from "containers/utils";
import { HORSE_SIZE } from "globalConstants";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import { Horse } from "containers/Base/components/Horse";
import { Cell } from "containers/Walkway/components/Cell";
import { WalkwayPosition } from "state/interfaces";

import styles from "./Container.module.css";

interface IStateProps {
  bases: ReturnType<typeof basesSelector>;
  cells: ReturnType<typeof cellsSelector>;
  horses: ReturnType<typeof horsesSelector>;
  links: ReturnType<typeof linksSelector>;
}

interface IPublicProps {
  baseIDs: IRelationship["baseIDs"];
  /** Whether to show debug text (cell IDs, base IDs, etc.) */
  showDebugText?: boolean;
}

interface IDispatchProps {
  // No dispatch props needed - horses are not clickable, actions must be chosen from action panel
}

interface IProps extends IStateProps, IPublicProps, IDispatchProps {}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector,
  cells: cellsSelector,
  horses: horsesSelector,
  links: linksSelector,
});

const mapDispatchToProps = {};

class HomeBare extends React.PureComponent<IProps> {
  /**
   * Handles horse click events during gameplay
   * DISABLED - Actions must be chosen from action panel
   */
  // private onHorseClicked removed - horses are not clickable, actions must be chosen from action panel

  render() {
    const { cells, links, bases, horses } = this.props;

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
              >
                {
                  // Render horses that are currently on this cell
                  cell.horseIDs.map((horseID: string, index: number) => (
                    <Horse
                      key={horseID}
                      baseColor={horses[horseID].color} // Horse color matches its base
                      // Smaller horses if multiple horses on same cell
                      horseSize={
                        cell.horseIDs.length > 1 ? HORSE_SIZE / 2 : HORSE_SIZE
                      }
                      // onHorseClicked removed - horses are not clickable, actions must be chosen from action panel
                    />
                  ))
                }
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

export const Home = connect(
  mapStateToProps,
  mapDispatchToProps
)(HomeBare) as unknown as React.ComponentClass<IPublicProps>;
