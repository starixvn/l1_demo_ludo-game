import classnames from "classnames";
import React from "react";

import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import { getStyleObject, getBaseHexColor } from "containers/utils";
import { DICE_SIZE } from "globalConstants";
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
import {
  autoActionsEnabledSelector,
  autoActionTimeoutSelector,
} from "containers/StepLogs/state/selectors";

import styles from "./Container.module.css";

interface IStateProps {
  currentDieRoll1: ReturnType<typeof currentDieRoll1Selector>;
  currentDieRoll2: ReturnType<typeof currentDieRoll2Selector>;
  isDieRollAllowed: ReturnType<typeof isDieRollAllowedSelector>;
  isDieRollValid: ReturnType<typeof isDieRollValidSelector>;
  isRolling: ReturnType<typeof isRollingSelector>;
  autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector>;
  autoActionTimeout: ReturnType<typeof autoActionTimeoutSelector>;
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
  autoActionsEnabled: autoActionsEnabledSelector,
  autoActionTimeout: autoActionTimeoutSelector,
});

const mapDispatchToProps = {
  rollDie,
};

class DiceBare extends React.PureComponent<IProps> {
  private autoRollTimeout: NodeJS.Timeout | null = null;

  componentDidMount() {
    this.startAutoRollTimer();
  }

  componentDidUpdate(prevProps: IProps) {
    // Start timer when die becomes rollable again (only if auto-actions are enabled)
    if (!prevProps.isDieRollAllowed && this.props.isDieRollAllowed) {
      this.startAutoRollTimer();
    }
    // Clear timer when die is no longer rollable or when auto-actions are disabled
    if (
      (prevProps.isDieRollAllowed && !this.props.isDieRollAllowed) ||
      (prevProps.autoActionsEnabled && !this.props.autoActionsEnabled)
    ) {
      this.clearAutoRollTimer();
    }
  }

  componentWillUnmount() {
    this.clearAutoRollTimer();
  }

  private startAutoRollTimer = () => {
    this.clearAutoRollTimer(); // Clear any existing timer
    // Only start auto-roll timer if die is rollable AND auto-actions are enabled
    if (this.props.isDieRollAllowed && this.props.autoActionsEnabled) {
      console.log(
        "Starting auto-roll timer with timeout:",
        this.props.autoActionTimeout
      );
      this.autoRollTimeout = setTimeout(() => {
        // Double-check: props may have changed during the timeout period
        // This is especially important with longer timeouts
        if (
          this.props.isDieRollAllowed &&
          this.props.autoActionsEnabled &&
          this.autoRollTimeout !== null
        ) {
          this.props.rollDie();
        }
      }, this.props.autoActionTimeout);
    }
  };

  private clearAutoRollTimer = () => {
    if (this.autoRollTimeout) {
      clearTimeout(this.autoRollTimeout);
      this.autoRollTimeout = null;
    }
  };

  private handleDieClick = () => {
    this.clearAutoRollTimer(); // Clear the auto-roll timer when manually clicked
    this.props.rollDie();
  };

  render() {
    const { baseColor, isDieRollAllowed, autoActionsEnabled, isDieRollValid, isRolling } =
      this.props;
    const shouldHighlight = isDieRollAllowed && !autoActionsEnabled;
    const isRolled = !isDieRollAllowed && isDieRollValid;
    
    let containerClassNames;
    if (isDieRollAllowed) {
      containerClassNames = shouldHighlight
        ? [styles.Highlighted]
        : [];
    } else if (isRolled) {
      containerClassNames = [styles.Rolled];
    } else {
      containerClassNames = [styles.Disabled];
    }

    // Get the face value to show (use current roll value, animation will handle the visual)
    const face1 = this.props.currentDieRoll1;
    const face2 = this.props.currentDieRoll2;

    return (
      <div className={styles.Container}>
        <div className={classnames(containerClassNames)}>
          <div
            className={styles.DiceContainer}
            onClick={this.handleDieClick}
            style={{ backgroundColor: baseColor ? getBaseHexColor(baseColor) : undefined }}
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
            onClick={this.handleDieClick}
            style={{ backgroundColor: baseColor ? getBaseHexColor(baseColor) : undefined }}
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
    const backgroundColor = baseColor ? getBaseHexColor(baseColor) : '#fff';
    
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
