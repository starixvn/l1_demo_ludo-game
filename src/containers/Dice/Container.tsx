import classnames from "classnames";
import React from "react";

import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import { hexToRgba } from "common/utils";
import { getBaseHexColor } from "containers/utils";
import { BaseColors } from "state/interfaces";
import { BaseID } from "containers/Ludo/state/interfaces";

import { rollDie, setDieResult } from "./state/actions";
import { CONFIGURATIONS } from "./state/constants";
import { Rolls } from "./state/interfaces";
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
  setDieResult: typeof setDieResult;
}

interface IPublicProps {
  baseColor: BaseColors;
  baseID?: BaseID;
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
  setDieResult,
};

interface ILocalState {
  die1Value: number;
  die2Value: number;
  showInputs: boolean;
}

class DiceBare extends React.PureComponent<IProps, ILocalState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      die1Value: 1,
      die2Value: 1,
      showInputs: false,
    };
  }

  componentDidUpdate(prevProps: IProps, prevState: ILocalState) {
    // Auto-apply when values change and inputs are visible
    if (this.state.showInputs && 
        (prevState.die1Value !== this.state.die1Value || prevState.die2Value !== this.state.die2Value)) {
      const { die1Value, die2Value } = this.state;
      // Validate values are between 1 and 6
      if (die1Value >= 1 && die1Value <= 6 && die2Value >= 1 && die2Value <= 6) {
        this.props.setDieResult(die1Value as Rolls, die2Value as Rolls);
      }
    }

    // Hide inputs when dice becomes non-clickable
    if (prevProps.isDieRollAllowed && !this.props.isDieRollAllowed) {
      this.setState({ showInputs: false });
    }
  }

  private handleDieClick = () => {
    this.props.rollDie();
  };

  private handleSetResultClick = () => {
    // Apply the result with current values
    const { die1Value, die2Value } = this.state;
    if (die1Value >= 1 && die1Value <= 6 && die2Value >= 1 && die2Value <= 6) {
      this.props.setDieResult(die1Value as Rolls, die2Value as Rolls);
    }
  };

  private handleDie1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 6) {
      this.setState({ die1Value: value });
    }
  };

  private handleDie2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 6) {
      this.setState({ die2Value: value });
    }
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
        <div className={styles.DiceWrapper}>
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
        {isClickable && (
          <div className={styles.SetResultContainer}>
            <div className={styles.SetResultInputs}>
              <input
                type="number"
                min="1"
                max="6"
                value={this.state.die1Value}
                onChange={this.handleDie1Change}
                className={styles.SetResultInput}
                disabled={isRolling}
              />
              <span className={styles.SetResultSeparator}>-</span>
              <input
                type="number"
                min="1"
                max="6"
                value={this.state.die2Value}
                onChange={this.handleDie2Change}
                className={styles.SetResultInput}
                disabled={isRolling}
              />
            </div>
            <button
              onClick={this.handleSetResultClick}
              className={styles.SetResultButton}
              disabled={isRolling}
            >
              Set Result
            </button>
          </div>
        )}
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
