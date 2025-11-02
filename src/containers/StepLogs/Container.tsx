import React from "react";

import { stepLogsStore } from "./state/store";

import styles from "./Container.module.css";

interface IPublicProps {}

interface IProps extends IPublicProps {}

class StepLogsBare extends React.PureComponent<IProps> {
  private unsubscribe?: () => void;

  componentDidMount() {
    // Subscribe to store changes to trigger re-renders
    this.unsubscribe = stepLogsStore.subscribe(() => {
      // Force re-render when store changes
      this.forceUpdate();
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private handleExportLogs = () => {
    const logs = stepLogsStore.getState().logs;
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs.map((log: any) => ({
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
    const state = stepLogsStore.getState();
    const logs = state.logs;
    const autoActionsEnabled = state.autoActionsEnabled;
    const autoActionTimeout = state.autoActionTimeout;

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
                  stepLogsStore
                    .getState()
                    .setAutoActionTimeout(Number(e.target.value))
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
                  stepLogsStore
                    .getState()
                    .setAutoActionsEnabled(!autoActionsEnabled)
                }
              >
                {autoActionsEnabled ? "Stop Auto" : "Continue Auto"}
              </button>
              <button
                className={styles.ExportButton}
                onClick={this.handleExportLogs}
                disabled={logs.length === 0}
              >
                Export Logs
              </button>
              <button
                className={styles.ClearButton}
                onClick={() => stepLogsStore.getState().clearLogs()}
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
            logs.map((log: any) => (
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

export const StepLogs = StepLogsBare;
