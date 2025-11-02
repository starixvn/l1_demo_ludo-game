import React from "react";

import { IRelationship } from "containers/Ludo/state/interfaces";
import { ludoStore } from "containers/Ludo/state/store";
import { getBaseHexColor, getStyleObject } from "containers/utils";
import { CELL_DIMENSION, HOME_SIZE } from "globalConstants";
import { BaseColors } from "state/interfaces";

import styles from "./Container.module.css";

interface IPublicProps {
  baseIDs: IRelationship["baseIDs"];
}

interface IProps extends IPublicProps {}

class HomeBare extends React.PureComponent<IProps> {
  render() {
    const { baseIDs } = this.props;
    const bases = ludoStore.getState().bases;
    return (
      <div
        className={styles.Container}
        style={getStyleObject(HOME_SIZE, HOME_SIZE)}
      >
        {baseIDs!.map((baseID, index) => {
          const base = bases[baseID];
          return (
            <div
              key={index}
              className={styles.HomeContainer}
              style={this.getCSS(HOME_SIZE, base.color, index)}
            />
          );
        })}
      </div>
    );
  }

  private getCSS = (
    cellSize: number,
    baseColor: BaseColors,
    index: number
  ): React.CSSProperties => {
    const size = cellSize * CELL_DIMENSION;
    const colorHex = getBaseHexColor(baseColor!);

    const cssProperties = {
      borderColor: `${colorHex} transparent transparent transparent`,
      borderWidth: `${size / 2}px ${size / 2}px 0 ${size / 2}px`,
    };

    switch (index) {
      case 0:
        return cssProperties;
      case 1:
        return {
          ...cssProperties,
          left: `${size / 4}px`,
          top: `${size / 4}px`,
          transform: "rotate(90deg)",
        };
      case 2:
        return {
          ...cssProperties,
          top: `${size / 2}px`,
          transform: "rotate(180deg)",
        };
      case 3:
        return {
          ...cssProperties,
          right: `${size / 4}px`,
          top: `${size / 4}px`,
          transform: "rotate(-90deg)",
        };
      default:
        return {};
    }
  };
}

export const Home = HomeBare;
