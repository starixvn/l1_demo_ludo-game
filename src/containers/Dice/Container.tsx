import classnames from "classnames";
import React from "react";

import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import { hexToRgba } from "common/utils";
import { getBaseHexColor } from "containers/utils";
import { BaseColors } from "state/interfaces";

import { rollDie } from "./state/actions";
import { CONFIGURATIONS } from "./state/constants";
import {
  currentDieRoll1Selector,
  currentDieRoll2Selector,
  isDieRollAllowedSelector,
  isDieRollValidSelector,
  isRollingSelector,
} from "./state/selectors";

import styles from "./Container.module.css";

interface IStateProps {
  currentDieRoll1: ReturnType<typeof currentDieRoll1Selector>;
  currentDieRoll2: ReturnType<typeof currentDieRoll2Selector>;
  isDieRollAllowed: ReturnType<typeof isDieRollAllowedSelector>;
  isDieRollValid: ReturnType<typeof isDieRollValidSelector>;
  isRolling: ReturnType<typeof isRollingSelector>;
}

interface IDispatchProps {
  rollDie: typeof rollDie;
}

interface IPublicProps {
  baseColor: BaseColors;
}

interface IProps extends IStateProps, IDispatchProps, IPublicProps {}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  currentDieRoll1: currentDieRoll1Selector,
  currentDieRoll2: currentDieRoll2Selector,
  isDieRollAllowed: isDieRollAllowedSelector,
  isDieRollValid: isDieRollValidSelector,
  isRolling: isRollingSelector,
});

const mapDispatchToProps = {
  rollDie,
};

class DiceBare extends React.PureComponent<IProps> {
  private handleDieClick = () => {
    this.props.rollDie();
  };

  render() {
    const {
      baseColor,
      isDieRollAllowed,
      isDieRollValid,
      isRolling,
    } = this.props;

    // Dice is only clickable if:
    // 1. Rolling is allowed (isDieRollAllowed)
    // 2. Current roll is NOT valid (isDieRollValid === false) - meaning action has been chosen or no roll yet
    // 3. Not currently rolling
    const isClickable = isDieRollAllowed && !isDieRollValid && !isRolling;
    const shouldHighlight = isClickable;
    const isRolled = !isDieRollAllowed && isDieRollValid;

    let containerClassNames;
    if (isClickable) {
      containerClassNames = shouldHighlight ? [styles.Highlighted] : [];
    } else if (isRolled) {
      containerClassNames = [styles.Rolled];
    } else {
      containerClassNames = [styles.Disabled];
    }

    // Get the face value to show (use current roll value, animation will handle the visual)
    const face1 = this.props.currentDieRoll1;
    const face2 = this.props.currentDieRoll2;

    // Calculate highlight styles based on state and base color
    // Note: Background color is applied to dice faces for rotation, and container for edge coverage
    const baseHexColor = baseColor ? getBaseHexColor(baseColor) : undefined;
    // Set background color on container to prevent white edges showing through
    const containerBgStyle = {
      "--dice-bg-color": baseHexColor || "transparent",
    } as React.CSSProperties;
    let dice1Style: React.CSSProperties = { ...containerBgStyle };
    let dice2Style: React.CSSProperties = { ...containerBgStyle };

    if (shouldHighlight && baseHexColor) {
      // Highlighted (clickable) - use base color with yellow tint
      // Convert base color to rgba and blend with yellow for highlight effect
      const highlightColor = hexToRgba(baseHexColor, 0.9);
      dice1Style = {
        ...dice1Style,
        boxShadow: `0 0 15px 5px ${highlightColor}, 0 0 5px`,
        animation: "diceHighlightPulse 1.5s ease-in-out infinite",
      };
      dice2Style = {
        ...dice2Style,
        boxShadow: `0 0 15px 5px ${highlightColor}, 0 0 5px`,
        animation: "diceHighlightPulse 1.5s ease-in-out infinite",
      };
    } else if (isRolled && baseHexColor) {
      // Rolled (action chosen) - use base color with purple tint
      const rolledColor = hexToRgba(baseHexColor, 0.9);
      dice1Style = {
        ...dice1Style,
        boxShadow: `0 0 15px 5px ${rolledColor}, 0 0 5px, inset 0 0 0 3px ${rolledColor}`, // Use inset box-shadow for border to avoid affecting size
        borderRadius: "10%",
        animation: "diceRolledPulse 1.5s ease-in-out infinite",
        pointerEvents: "none" as const,
        cursor: "not-allowed",
      };
      dice2Style = {
        ...dice2Style,
        boxShadow: `0 0 15px 5px ${rolledColor}, 0 0 5px, inset 0 0 0 3px ${rolledColor}`, // Use inset box-shadow for border to avoid affecting size
        borderRadius: "10%",
        animation: "diceRolledPulse 1.5s ease-in-out infinite",
        pointerEvents: "none" as const,
        cursor: "not-allowed",
      };
    }

    return (
      <div className={styles.Container}>
        <div className={classnames(containerClassNames)}>
          <div
            className={styles.DiceContainer}
            onClick={isClickable ? this.handleDieClick : undefined}
            style={dice1Style}
          >
            <div
              className={classnames(styles.Die, isRolling && styles.Rolling)}
              data-face={face1}
            >
              {this.renderDiceFaces(baseColor)}
            </div>
          </div>
        </div>
        <div className={classnames(containerClassNames)}>
          <div
            className={styles.DiceContainer}
            onClick={isClickable ? this.handleDieClick : undefined}
            style={dice2Style}
          >
            <div
              className={classnames(
                styles.Die,
                isRolling && styles.Rolling,
                isRolling && styles.Rolling2
              )}
              data-face={face2}
            >
              {this.renderDiceFaces(baseColor)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderDiceFaces = (baseColor?: BaseColors) => {
    const faces = [1, 2, 3, 4, 5, 6];
    const backgroundColor = baseColor ? getBaseHexColor(baseColor) : "#fff";

    return faces.map((face) => (
      <div
        key={face}
        className={styles.DiceFace}
        data-face={face}
        style={{ backgroundColor }}
      >
        {this.renderDotsForFace(face)}
      </div>
    ));
  };

  private renderDotsForFace = (face: number) => {
    const configuration = CONFIGURATIONS[face];
    if (!configuration) return null;

    const dots = [];
    for (let i = 0; i < 9; i++) {
      const isVisible = Boolean(configuration[i]);
      dots.push(
        <div
          key={i}
          className={classnames(styles.Dot, !isVisible && styles.DotInvisible)}
        />
      );
    }
    return dots;
  };
}

export const Dice = connect(
  mapStateToProps,
  mapDispatchToProps
)(DiceBare) as unknown as React.ComponentClass<IPublicProps>;
