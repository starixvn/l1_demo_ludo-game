import React from "react";
import { connect } from "react-redux";
import { createStructuredSelector } from "reselect";

import {
  clearLogs,
  setAutoActionTimeout,
} from "./state/actions";
import {
  autoActionTimeoutSelector,
  logsSelector,
} from "./state/selectors";

import styles from "./Container.module.css";

interface IStateProps {
  logs: ReturnType<typeof logsSelector>;
  autoActionTimeout: ReturnType<typeof autoActionTimeoutSelector>;
}

interface IDispatchProps {
  clearLogs: typeof clearLogs;
  setAutoActionTimeout: typeof setAutoActionTimeout;
}

interface IPublicProps {}

interface IProps extends IPublicProps, IStateProps, IDispatchProps {}

const mapStateToProps = createStructuredSelector<any, IStateProps>({
  logs: logsSelector,
  autoActionTimeout: autoActionTimeoutSelector,
});

const mapDispatchToProps = {
  clearLogs,
  setAutoActionTimeout,
};

class StepLogsBare extends React.PureComponent<IProps> {
  private handleExportLogs = () => {
    const { logs } = this.props;
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs.map((log) => ({
        ...log,
        timestamp: new Date(log.timestamp).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ludo-game-logs-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  render() {
    const { logs, autoActionTimeout } = this.props;

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
                className={styles.ExportButton}
                onClick={this.handleExportLogs}
                disabled={logs.length === 0}
              >
                Export Logs
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
