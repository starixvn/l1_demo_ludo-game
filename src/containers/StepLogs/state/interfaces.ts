export interface ILogEntry {
  id: string;
  timestamp: number;
  player: string;
  action: string;
  details?: string;
  highlight?: boolean;
}

export interface IState {
  logs: ILogEntry[];
  maxLogs: number;
  autoActionsEnabled: boolean;
  autoActionTimeout: number; // in milliseconds
}
