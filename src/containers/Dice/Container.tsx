import classnames from "classnames";
import React from "react";

import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import { getStyleObject } from "containers/utils";
import { DICE_SIZE } from "globalConstants";
import { BaseColors } from "state/interfaces";

import { rollDie } from "./state/actions";
import { CONFIGURATIONS } from "./state/constants";
import {
  currentDieRoll1Selector,
  currentDieRoll2Selector,
  isDieRollAllowedSelector,
  isDieRollValidSelector,
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
    const { baseColor, isDieRollAllowed, autoActionsEnabled, isDieRollValid } =
      this.props;
    const shouldHighlight = isDieRollAllowed && !autoActionsEnabled;
    const dieClassNames = isDieRollAllowed
      ? shouldHighlight
        ? [styles.Die, styles.Highlighted]
        : styles.Die
      : [styles.Die, styles.Disabled];

    return (
      <div className={styles.Container}>
        <div
          className={classnames(dieClassNames)}
          style={getStyleObject(DICE_SIZE, DICE_SIZE, baseColor)}
          onClick={this.handleDieClick}
        >
          {this.renderDots(this.props.currentDieRoll1, isDieRollValid)}
        </div>
        <div
          className={classnames(dieClassNames)}
          style={getStyleObject(DICE_SIZE, DICE_SIZE, baseColor)}
          onClick={this.handleDieClick}
        >
          {this.renderDots(this.props.currentDieRoll2, isDieRollValid)}
        </div>
      </div>
    );
  }

  private renderDots = (rollValue: number, isValid: boolean) => {
    const elements: any[] = [];
    const configurationForCurrentRoll = CONFIGURATIONS[rollValue];

    if (!configurationForCurrentRoll) {
      return null;
    }

    for (let i = 0; i < configurationForCurrentRoll.length; i++) {
      const isVisible = Boolean(configurationForCurrentRoll[i]);
      const classNames = isVisible
        ? styles.Dot
        : [styles.Dot, styles.Invisible];
      elements.push(<div className={classnames(classNames)} key={i} />);
    }

    return elements;
  };
}

export const Dice = connect(
  mapStateToProps,
  mapDispatchToProps
)(DiceBare) as unknown as React.ComponentClass<IPublicProps>;
