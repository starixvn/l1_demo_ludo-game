export interface ILogEntry {
  id: string;
  timestamp: number;
  player: string;
  action: string;
  details?: string;
}

export interface IState {
  logs: ILogEntry[];
  maxLogs: number;
  autoActionsEnabled: boolean;
}
