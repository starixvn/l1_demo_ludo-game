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
import {
  autoActionsEnabledSelector,
  autoActionTimeoutSelector,
} from "containers/StepLogs/state/selectors";
import { replaySelector } from "containers/Ludo/state/selectors";

import styles from "./Container.module.css";

interface IStateProps {
  currentDieRoll1: ReturnType<typeof currentDieRoll1Selector>;
  currentDieRoll2: ReturnType<typeof currentDieRoll2Selector>;
  isDieRollAllowed: ReturnType<typeof isDieRollAllowedSelector>;
  isDieRollValid: ReturnType<typeof isDieRollValidSelector>;
  isRolling: ReturnType<typeof isRollingSelector>;
  autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector>;
  autoActionTimeout: ReturnType<typeof autoActionTimeoutSelector>;
  replay: ReturnType<typeof replaySelector>;
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
  replay: replaySelector,
});

const mapDispatchToProps = {
  rollDie,
};

class DiceBare extends React.PureComponent<IProps> {
  private autoRollTimeout: NodeJS.Timeout | null = null;

  componentDidMount() {
    // Only start timer if replay is not active (replay system handles rolling when active)
    const replay = this.props.replay;
    if (!replay?.isActive) {
      this.startAutoRollTimer();
    }
  }

  componentDidUpdate(prevProps: IProps) {
    const prevReplay = prevProps.replay;
    const currentReplay = this.props.replay;

    // Clear timer when replay is paused, completed, or active (replay system handles rolling)
    if (currentReplay?.isActive) {
      // Replay is active - clear timer (replay system handles rolling)
      if (this.autoRollTimeout) {
        if (
          currentReplay.isPaused ||
          currentReplay.cursor >= (currentReplay.steps?.length || 0)
        ) {
          console.log(
            "Clearing auto-roll timer: replay is paused or completed"
          );
        } else {
          console.log(
            "Clearing auto-roll timer: replay is active (replay system handles rolling)"
          );
        }
        this.clearAutoRollTimer();
      }
      return; // Don't start timer if replay is active
    }

    // Reset timer when replay is stopped (transition from active to inactive)
    if (prevReplay?.isActive && !currentReplay?.isActive) {
      // Replay was just stopped - reset timer if conditions are met
      if (this.props.isDieRollAllowed && this.props.autoActionsEnabled) {
        console.log("Resetting auto-roll timer: replay stopped");
        this.startAutoRollTimer();
      }
      return;
    }

    // Start timer when die becomes rollable again (only if auto-actions are enabled)
    // Skip if replay is active (replay system handles rolling)
    if (
      !currentReplay?.isActive &&
      !prevProps.isDieRollAllowed &&
      this.props.isDieRollAllowed
    ) {
      this.startAutoRollTimer();
    }

    // Start timer when auto-actions are enabled while die is already rollable
    // Skip if replay is active (replay system handles rolling)
    if (
      !currentReplay?.isActive &&
      !prevProps.autoActionsEnabled &&
      this.props.autoActionsEnabled &&
      this.props.isDieRollAllowed
    ) {
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

    // Don't start timer if replay is active, paused, or completed
    const replay = this.props.replay;
    if (replay?.isActive) {
      if (replay.isPaused || replay.cursor >= (replay.steps?.length || 0)) {
        // Replay is paused or completed - don't start timer
        return;
      }
      // Replay is active but not paused - replay system handles rolling, don't auto-roll
      return;
    }

    // Only start auto-roll timer if die is rollable AND auto-actions are enabled
    if (this.props.isDieRollAllowed && this.props.autoActionsEnabled) {
      console.log(
        "Starting auto-roll timer with timeout:",
        this.props.autoActionTimeout
      );
      this.autoRollTimeout = setTimeout(() => {
        // Double-check: props may have changed during the timeout period
        // This is especially important with longer timeouts
        const currentReplay = this.props.replay;
        if (
          this.props.isDieRollAllowed &&
          this.props.autoActionsEnabled &&
          this.autoRollTimeout !== null &&
          // Don't roll if replay is active, paused, or completed
          (!currentReplay?.isActive ||
            (!currentReplay.isPaused &&
              currentReplay.cursor < (currentReplay.steps?.length || 0)))
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
    const {
      baseColor,
      isDieRollAllowed,
      autoActionsEnabled,
      isDieRollValid,
      isRolling,
    } = this.props;

    // Dice is only clickable if:
    // 1. Rolling is allowed (isDieRollAllowed)
    // 2. Current roll is NOT valid (isDieRollValid === false) - meaning action has been chosen or no roll yet
    // 3. Not currently rolling
    const isClickable = isDieRollAllowed && !isDieRollValid && !isRolling;
    const shouldHighlight = isClickable && !autoActionsEnabled;
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
