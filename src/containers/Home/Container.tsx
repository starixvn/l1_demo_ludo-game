import React from "react";

import { IRelationship } from "containers/Ludo/state/interfaces";
import {
  basesSelector,
  cellsSelector,
  linksSelector,
} from "containers/Ludo/state/selectors";
import { getBaseHexColor, getStyleObject } from "containers/utils";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

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
    const { cells, links } = this.props;

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

          return (
            <div
              key={cell.cellID}
              className={styles.HomeCell}
              style={this.getCellStyle(cell)}
              data-cell-id={cell.cellID}
            >
              {/* Display cell information for debugging/development */}
              {this.props.showDebugText !== false && (
                <div className={styles.CellInfo}>
                  <div className={styles.CellID}>{cell.cellID}</div>
                  <div className={styles.BaseID}>{cell.baseID}</div>
                  {cell.index !== undefined && (
                    <div className={styles.Index}>Index: {cell.index}</div>
                  )}
                  {nextLinkCellIDs && nextLinkCellIDs.length > 0 && (
                    <div className={styles.NextLinks}>
                      → {nextLinkCellIDs.join(", ")}
                    </div>
                  )}
                </div>
              )}
              {cell.coinIDs.length > 0 && (
                <span className={styles.CoinCount}>{cell.coinIDs.length}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Helper function to convert hex to rgba with opacity
  private hexToRgba = (hex: string, opacity: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex; // Return original if invalid hex
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  private getCellStyle = (cell: any): React.CSSProperties => {
    const { bases } = this.props;
    const baseStyle = getStyleObject(1, 1); // 1x1 cell size

    // For HOMEPATH cells, apply base color with 0.5 opacity (same as walkway homepath cells)
    let cellStyle: React.CSSProperties;
    if (cell.cellType === "HOMEPATH") {
      const cellBase = bases[cell.baseID];
      if (cellBase && cellBase.color) {
        const hexColor = getBaseHexColor(cellBase.color);
        cellStyle = {
          ...baseStyle,
          backgroundColor: this.hexToRgba(hexColor, 0.5), // Apply color with 0.5 opacity
        };
      } else {
        cellStyle = baseStyle;
      }
    } else {
      cellStyle = baseStyle;
    }

    // Position the cells appropriately within the 1x3 home container
    // YELLOW (NORTH_6_1) at top, RED (SOUTH_0_1) at bottom
    if (cell.cellID === "NORTH_6_1") {
      return {
        ...cellStyle,
        position: "absolute",
        top: 0,
        left: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
      };
    } else if (cell.cellID === "SOUTH_0_1") {
      return {
        ...cellStyle,
        position: "absolute",
        bottom: 0,
        left: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
      };
    }

    return cellStyle;
  };
}

export const Home = connect(mapStateToProps)(
  HomeBare
) as unknown as React.ComponentClass<IPublicProps>;
