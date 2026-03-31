// ============ 操作日志 ============
export interface OperationLog {
  id: number;
  timestamp: number;
  username: string;
  operation: string;
  target_type: string;
  target_id: string;
  details: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

// ============ 策略 ============
export interface StrategyInstance {
  strategy_name: string;
  class_name: string;
  vt_symbol: string;
  author: string;
  parameters: Record<string, any>;
  variables: Record<string, any>;
  inited: boolean;
  trading: boolean;
  lock?: {
    locked: boolean;
    holder: string | null;
  };
}

// ============ 交易 ============
export interface Order {
  vt_orderid: string;
  symbol: string;
  exchange: string;
  direction: string;
  offset: string;
  type: string;
  volume: number;
  price: number;
  traded: number;
  status: string;
  datetime: string;
  reference: string;
}

export interface Trade {
  vt_tradeid: string;
  vt_orderid: string;
  symbol: string;
  exchange: string;
  direction: string;
  offset: string;
  volume: number;
  price: number;
  datetime: string;
}

export interface Position {
  vt_symbol: string;
  symbol: string;
  exchange: string;
  direction: string;
  volume: number;
  frozen: number;
  price: number;
  pnl: number;
  yd_volume: number;
}

export interface Account {
  vt_accountid: string;
  gateway_name: string;
  accountid: string;
  balance: number;
  frozen: number;
  available: number;
}

// ============ 行情 ============
export interface Contract {
  symbol: string;
  exchange: string;
  vt_symbol: string;
  gateway_name: string;
  name: string;
  product: string;
  size: number;
  pricetick: number;
  min_volume: number;
}

export interface Tick {
  vt_symbol: string;
  symbol: string;
  exchange: string;
  last_price: number;
  volume: number;
  open_interest: number;
  datetime: string;
  bid_price_1: number;
  bid_volume_1: number;
  ask_price_1: number;
  ask_volume_1: number;
}

// ============ 回测 ============
export interface BacktestResult {
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  trades?: any[];
}

export type BacktestTaskType = 'backtest' | 'optimize' | 'download';
export type BacktestTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BacktestTask {
  task_id: string;
  task_type: BacktestTaskType;
  status: BacktestTaskStatus;
  class_name: string;
  vt_symbol: string;
  interval: string;
  start_date: string;
  end_date: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: number;
  progress_message?: string;
  error_message?: string;
  result?: BacktestResult;
}

// ============ 系统 ============
export interface SystemStatus {
  engine_ready: boolean;
  gateways: string[];
  exchanges: string[];
  apps: string[];
}
