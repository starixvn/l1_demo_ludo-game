import classnames from "classnames";
import React from "react";

import { getStyleObject } from "containers/utils";
import { DICE_SIZE } from "globalConstants";
import { BaseColors } from "state/interfaces";

import { diceStore } from "./state/store";
import { CONFIGURATIONS } from "./state/constants";

import styles from "./Container.module.css";

interface IPublicProps {
  baseColor: BaseColors;
}

interface IProps extends IPublicProps {}

class DiceBare extends React.PureComponent<IProps> {
  private autoRollTimeout: NodeJS.Timeout | null = null;
  private wasDieRollAllowed: boolean = true;
  private unsubscribe?: () => void;

  componentDidMount() {
    this.startAutoRollTimer();
    
    // Subscribe to store changes to trigger re-renders
    this.unsubscribe = diceStore.subscribe(() => {
      // Force re-render when store changes
      this.forceUpdate();
    });
  }

  componentDidUpdate() {
    // Start timer when die becomes rollable again
    const isDieRollAllowed = diceStore.getState().isDieRollAllowed;
    if (isDieRollAllowed && !this.wasDieRollAllowed) {
      this.startAutoRollTimer();
    }
    // Clear timer when die is no longer rollable
    if (!isDieRollAllowed && this.wasDieRollAllowed) {
      this.clearAutoRollTimer();
    }
    this.wasDieRollAllowed = isDieRollAllowed;
  }

  componentWillUnmount() {
    this.clearAutoRollTimer();
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private startAutoRollTimer = () => {
    this.clearAutoRollTimer(); // Clear any existing timer
    if (diceStore.getState().isDieRollAllowed) {
      this.autoRollTimeout = setTimeout(() => {
        diceStore.getState().rollDie();
      }, 200); // 0.2 second delay
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
    diceStore.getState().rollDie();
  };

  render() {
    const { baseColor } = this.props;
    const state = diceStore.getState();
    const currentDieRoll = state.roll;
    const isDieRollAllowed = state.isDieRollAllowed;
    const dieClassNames = isDieRollAllowed
      ? styles.Die
      : [styles.Die, styles.Disabled];
    return (
      <div className={styles.Container}>
        <div
          className={classnames(dieClassNames)}
          style={getStyleObject(DICE_SIZE, DICE_SIZE, baseColor)}
          onClick={this.handleDieClick}
        >
          {this.renderDots(currentDieRoll)}
        </div>
      </div>
    );
  }

  private renderDots = (currentDieRoll: number) => {
    const elements: any[] = [];
    const configurationForCurrentRoll =
      CONFIGURATIONS[currentDieRoll];

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

export const Dice = DiceBare;
