import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import {
  clearLogs,
  setAutoActionsEnabled,
  setAutoActionTimeout,
} from "./state/actions";
import {
  autoActionsEnabledSelector,
  autoActionTimeoutSelector,
  logsSelector,
} from "./state/selectors";

import styles from "./Container.module.css";

interface IStateProps {
  logs: ReturnType<typeof logsSelector>;
  autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector>;
  autoActionTimeout: ReturnType<typeof autoActionTimeoutSelector>;
}

interface IDispatchProps {
  clearLogs: typeof clearLogs;
  setAutoActionsEnabled: typeof setAutoActionsEnabled;
  setAutoActionTimeout: typeof setAutoActionTimeout;
}

interface IPublicProps {}

interface IProps extends IPublicProps, IStateProps, IDispatchProps {}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  logs: logsSelector,
  autoActionsEnabled: autoActionsEnabledSelector,
  autoActionTimeout: autoActionTimeoutSelector,
});

const mapDispatchToProps = {
  clearLogs,
  setAutoActionsEnabled,
  setAutoActionTimeout,
};

class StepLogsBare extends React.PureComponent<IProps> {
  render() {
    const { logs, autoActionsEnabled, autoActionTimeout } = this.props;

    return (
      <div className={styles.Container}>
        <div className={styles.Header}>
          <h3>Game Log</h3>
          <div className={styles.ControlsGroup}>
            <div className={styles.TimeoutControl}>
              <label className={styles.TimeoutLabel}>Auto Timeout:</label>
              <input
                type="number"
                className={styles.TimeoutInput}
                value={autoActionTimeout}
                onChange={(e) =>
                  this.props.setAutoActionTimeout(Number(e.target.value))
                }
                min="50"
                max="10000"
                step="50"
              />
              <span className={styles.TimeoutUnit}>ms</span>
            </div>
            <div className={styles.ButtonGroup}>
              <button
                className={
                  autoActionsEnabled ? styles.StopButton : styles.ContinueButton
                }
                onClick={() =>
                  this.props.setAutoActionsEnabled(!autoActionsEnabled)
                }
              >
                {autoActionsEnabled ? "Stop Auto" : "Continue Auto"}
              </button>
              <button
                className={styles.ClearButton}
                onClick={this.props.clearLogs}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        <div className={styles.LogsContainer}>
          {logs.length === 0 ? (
            <div className={styles.EmptyMessage}>No game events yet</div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`${styles.LogEntry} ${
                  log.highlight ? styles.HighlightedLogEntry : ""
                }`}
              >
                <div className={styles.Timestamp}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div className={styles.Player}>{log.player}:</div>
                <div className={styles.Action}>{log.action}</div>
                {log.details && (
                  <div className={styles.Details}>{log.details}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
}

export const StepLogs = connect(
  mapStateToProps,
  mapDispatchToProps
)(StepLogsBare) as unknown as React.ComponentClass<IPublicProps>;
