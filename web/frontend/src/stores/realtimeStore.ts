/**
 * 实时数据状态管理
 *
 * 存储 WebSocket 推送的实时数据：
 * - tick 行情
 * - 订单
 * - 成交
 * - 持仓
 * - 账户
 * - 日志
 * - 合约
 */

import { create } from 'zustand';

export interface TickData {
  vt_symbol: string;
  symbol: string;
  exchange: string;
  name: string;
  last_price: number;
  volume: number;
  open_interest: number;
  open_price: number;
  high_price: number;
  low_price: number;
  pre_close: number;
  bid_price_1: number;
  bid_volume_1: number;
  ask_price_1: number;
  ask_volume_1: number;
  datetime: string;
}

export interface OrderData {
  vt_orderid: string;
  vt_symbol: string;
  symbol: string;
  exchange: string;
  direction: string;
  offset: string;
  price: number;
  volume: number;
  traded: number;
  status: string;
  datetime: string;
}

export interface TradeData {
  vt_tradeid: string;
  vt_orderid: string;
  vt_symbol: string;
  symbol: string;
  exchange: string;
  direction: string;
  offset: string;
  price: number;
  volume: number;
  datetime: string;
}

export interface PositionData {
  vt_symbol: string;
  symbol: string;
  exchange: string;
  direction: string;
  volume: number;
  frozen: number;
  price: number;
  pnl: number;
}

export interface AccountData {
  vt_accountid: string;
  accountid: string;
  balance: number;
  available: number;
  frozen: number;
}

export interface LogData {
  time: string;
  level: string;
  msg: string;
  source: string;
}

export interface ContractData {
  vt_symbol: string;
  symbol: string;
  exchange: string;
  name: string;
  product: string;
  size: number;
  pricetick: number;
  min_volume: number;
  gateway_name: string;
}

export interface BacktestProgress {
  task_id: string;
  progress: number;
  message: string;
}

interface RealtimeState {
  // 数据存储
  ticks: Record<string, TickData>;
  orders: Record<string, OrderData>;
  trades: TradeData[];
  positions: Record<string, PositionData>;
  accounts: Record<string, AccountData>;
  logs: LogData[];
  contracts: Record<string, ContractData>;

  // 连接状态
  connectionState: 'connected' | 'connecting' | 'disconnected';
  backtestProgress: Record<string, BacktestProgress>;

  // 操作方法
  updateTick: (vtSymbol: string, tick: TickData) => void;
  updateOrder: (vtOrderId: string, order: OrderData) => void;
  addTrade: (trade: TradeData) => void;
  updatePosition: (vtSymbol: string, position: PositionData) => void;
  updateAccount: (vtAccountId: string, account: AccountData) => void;
  addLog: (log: LogData) => void;
  updateContract: (vtSymbol: string, contract: ContractData) => void;
  setConnectionState: (state: 'connected' | 'connecting' | 'disconnected') => void;
  setBacktestProgress: (taskId: string, progress: number, message: string) => void;

  // 批量更新
  setTicks: (ticks: Record<string, TickData>) => void;
  setOrders: (orders: Record<string, OrderData>) => void;
  setTrades: (trades: TradeData[]) => void;
  setPositions: (positions: Record<string, PositionData>) => void;
  setAccounts: (accounts: Record<string, AccountData>) => void;
  setContracts: (contracts: Record<string, ContractData>) => void;

  // 清空数据
  clearAll: () => void;
  clearLogs: () => void;
  clearTrades: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  // 初始状态
  ticks: {},
  orders: {},
  trades: [],
  positions: {},
  accounts: {},
  logs: [],
  contracts: {},
  connectionState: 'disconnected',
  backtestProgress: {},

  // 单个更新
  updateTick: (vtSymbol, tick) =>
    set((state) => ({
      ticks: { ...state.ticks, [vtSymbol]: tick },
    })),

  updateOrder: (vtOrderId, order) =>
    set((state) => ({
      orders: { ...state.orders, [vtOrderId]: order },
    })),

  addTrade: (trade) =>
    set((state) => ({
      trades: [trade, ...state.trades].slice(0, 1000), // 限制最多1000条
    })),

  updatePosition: (vtSymbol, position) =>
    set((state) => ({
      positions: { ...state.positions, [vtSymbol]: position },
    })),

  updateAccount: (vtAccountId, account) =>
    set((state) => ({
      accounts: { ...state.accounts, [vtAccountId]: account },
    })),

  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 500), // 限制最多500条
    })),

  updateContract: (vtSymbol, contract) =>
    set((state) => ({
      contracts: { ...state.contracts, [vtSymbol]: contract },
    })),

  setConnectionState: (connectionState) => set({ connectionState }),

  setBacktestProgress: (taskId, progress, message) =>
    set((state) => ({
      backtestProgress: {
        ...state.backtestProgress,
        [taskId]: { task_id: taskId, progress, message },
      },
    })),

  // 批量更新
  setTicks: (ticks) => set({ ticks }),
  setOrders: (orders) => set({ orders }),
  setTrades: (trades) => set({ trades }),
  setPositions: (positions) => set({ positions }),
  setAccounts: (accounts) => set({ accounts }),
  setContracts: (contracts) => set({ contracts }),

  // 清空数据
  clearAll: () =>
    set({
      ticks: {},
      orders: {},
      trades: [],
      positions: {},
      accounts: {},
      logs: [],
      contracts: {},
      backtestProgress: {},
    }),

  clearLogs: () => set({ logs: [] }),
  clearTrades: () => set({ trades: [] }),
}));
