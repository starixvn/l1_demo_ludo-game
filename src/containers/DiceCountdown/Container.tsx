/**
 * Dice Countdown Timer Component
 *
 * Displays a countdown timer (30 seconds) when a player needs to roll the dice.
 * Hides when the dice is clicked, or automatically rolls the dice when timer reaches 0.
 */

import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import {
  CELL_DIMENSION,
  DICE_COUNTDOWN_TIMEOUT,
  DICE_COUNTDOWN_WARNING_THRESHOLD,
} from "globalConstants";
import { rollDie } from "containers/Dice/state/actions";
import { isDieRollAllowedSelector } from "containers/Dice/state/selectors";
import { autoActionsEnabledSelector } from "containers/StepLogs/state/selectors";
import { basesSelector } from "containers/Ludo/state/selectors";

import styles from "./Container.module.css";

interface IStateProps {
  isDieRollAllowed: ReturnType<typeof isDieRollAllowedSelector>;
  autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector>;
  bases: ReturnType<typeof basesSelector>;
}

interface IDispatchProps {
  rollDie: typeof rollDie;
}

interface IProps extends IStateProps, IDispatchProps {}

interface ILocalState {
  timeRemaining: number;
  isVisible: boolean;
}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  isDieRollAllowed: isDieRollAllowedSelector,
  autoActionsEnabled: autoActionsEnabledSelector,
  bases: basesSelector,
});

const mapDispatchToProps = {
  rollDie,
};

class DiceCountdownBare extends React.PureComponent<IProps, ILocalState> {
  private countdownInterval: NodeJS.Timeout | null = null;

  constructor(props: IProps) {
    super(props);
    this.state = {
      timeRemaining: DICE_COUNTDOWN_TIMEOUT,
      isVisible: false,
    };
  }

  componentDidMount() {
    this.checkAndStartCountdown();
  }

  componentDidUpdate(prevProps: IProps) {
    // Start countdown when die becomes rollable and auto-actions are disabled
    if (
      !prevProps.isDieRollAllowed &&
      this.props.isDieRollAllowed &&
      !this.props.autoActionsEnabled
    ) {
      this.startCountdown();
    }

    // Hide countdown when die is no longer rollable or auto-actions are enabled
    if (
      (prevProps.isDieRollAllowed && !this.props.isDieRollAllowed) ||
      (!prevProps.autoActionsEnabled && this.props.autoActionsEnabled)
    ) {
      this.stopCountdown();
    }

    // Reset countdown if die becomes rollable again
    if (!prevProps.isDieRollAllowed && this.props.isDieRollAllowed) {
      this.checkAndStartCountdown();
    }
  }

  componentWillUnmount() {
    this.stopCountdown();
  }

  private checkAndStartCountdown = () => {
    if (this.props.isDieRollAllowed && !this.props.autoActionsEnabled) {
      this.startCountdown();
    }
  };

  private startCountdown = () => {
    this.stopCountdown(); // Clear any existing timer
    this.setState({
      timeRemaining: DICE_COUNTDOWN_TIMEOUT,
      isVisible: true,
    });

    this.countdownInterval = setInterval(() => {
      // Check if dice was clicked (isDieRollAllowed became false)
      if (!this.props.isDieRollAllowed || this.props.autoActionsEnabled) {
        this.stopCountdown();
        return;
      }

      this.setState(
        (prevState) => {
          const newTime = prevState.timeRemaining - 1;
          if (newTime <= 0) {
            // Timer reached 0 - automatically roll the dice
            // This will trigger the action panel if needed
            if (this.props.isDieRollAllowed && !this.props.autoActionsEnabled) {
              this.props.rollDie();
            }
            return { timeRemaining: 0, isVisible: false };
          }
          return { timeRemaining: newTime, isVisible: prevState.isVisible };
        },
        () => {
          // After state update, check if timer reached 0
          if (this.state.timeRemaining <= 0) {
            this.stopCountdown();
          }
        }
      );
    }, 1000);
  };

  private stopCountdown = () => {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.setState({ isVisible: false });
  };

  render() {
    // Check if game has started (at least one base is enabled)
    const gameHasStarted = Object.values(this.props.bases).some(
      (base) => base.enabled
    );

    // Hide if game is not running (no bases enabled), auto-actions enabled, or not visible
    if (
      !this.state.isVisible ||
      this.props.autoActionsEnabled ||
      !gameHasStarted
    ) {
      return null;
    }

    const { timeRemaining } = this.state;
    const isWarning = timeRemaining <= DICE_COUNTDOWN_WARNING_THRESHOLD;

    return (
      <div className={styles.Container}>
        <div
          className={`${styles.Countdown} ${isWarning ? styles.Warning : ""}`}
          style={{
            width: CELL_DIMENSION,
            height: CELL_DIMENSION,
          }}
        >
          {timeRemaining}
        </div>
      </div>
    );
  }
}

export const DiceCountdown = connect(
  mapStateToProps,
  mapDispatchToProps
)(DiceCountdownBare) as unknown as React.ComponentClass<{}>;
