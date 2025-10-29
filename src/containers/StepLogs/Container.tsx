import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import { clearLogs, setAutoActionsEnabled } from "./state/actions";
import { autoActionsEnabledSelector, logsSelector } from "./state/selectors";

import styles from "./Container.module.css";

interface IStateProps {
  logs: ReturnType<typeof logsSelector>;
  autoActionsEnabled: ReturnType<typeof autoActionsEnabledSelector>;
}

interface IDispatchProps {
  clearLogs: typeof clearLogs;
  setAutoActionsEnabled: typeof setAutoActionsEnabled;
}

interface IPublicProps {}

interface IProps extends IPublicProps, IStateProps, IDispatchProps {}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  logs: logsSelector,
  autoActionsEnabled: autoActionsEnabledSelector,
});

const mapDispatchToProps = {
  clearLogs,
  setAutoActionsEnabled,
};

class StepLogsBare extends React.PureComponent<IProps> {
  render() {
    const { logs, autoActionsEnabled } = this.props;

    return (
      <div className={styles.Container}>
        <div className={styles.Header}>
          <h3>Game Log</h3>
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
        <div className={styles.LogsContainer}>
          {logs.length === 0 ? (
            <div className={styles.EmptyMessage}>No game events yet</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={styles.LogEntry}>
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
