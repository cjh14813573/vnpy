import { describe, it, expect, beforeEach } from 'vitest';
import { useRealtimeStore } from './realtimeStore';

describe('RealtimeStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useRealtimeStore.setState({
      ticks: {},
      orders: {},
      trades: [],
      positions: {},
      accounts: {},
      logs: [],
      contracts: {},
      connectionState: 'disconnected',
      backtestProgress: {},
    });
  });

  it('should update tick data', () => {
    const tick = {
      vt_symbol: 'rb2410.SHFE',
      symbol: 'rb2410',
      exchange: 'SHFE',
      name: '螺纹钢2410',
      last_price: 3500,
      volume: 1000,
      open_interest: 50000,
      open_price: 3480,
      high_price: 3520,
      low_price: 3470,
      pre_close: 3490,
      bid_price_1: 3499,
      bid_volume_1: 100,
      ask_price_1: 3501,
      ask_volume_1: 80,
      datetime: '2024-01-01 09:30:00',
    };

    useRealtimeStore.getState().updateTick('rb2410.SHFE', tick);

    const storedTick = useRealtimeStore.getState().ticks['rb2410.SHFE'];
    expect(storedTick).toEqual(tick);
    expect(storedTick.last_price).toBe(3500);
  });

  it('should update order data', () => {
    const order = {
      vt_orderid: 'CTP.12345',
      vt_symbol: 'rb2410.SHFE',
      symbol: 'rb2410',
      exchange: 'SHFE',
      direction: '多',
      offset: '开',
      price: 3500,
      volume: 10,
      traded: 0,
      status: '已报',
      datetime: '2024-01-01 09:30:00',
    };

    useRealtimeStore.getState().updateOrder('CTP.12345', order);

    const storedOrder = useRealtimeStore.getState().orders['CTP.12345'];
    expect(storedOrder).toEqual(order);
  });

  it('should add trade and limit to 1000', () => {
    const store = useRealtimeStore.getState();

    // 添加 1005 条成交记录
    for (let i = 0; i < 1005; i++) {
      store.addTrade({
        vt_tradeid: `trade${i}`,
        vt_orderid: 'order1',
        vt_symbol: 'rb2410.SHFE',
        symbol: 'rb2410',
        exchange: 'SHFE',
        direction: '多',
        offset: '开',
        price: 3500,
        volume: 1,
        datetime: '2024-01-01 09:30:00',
      });
    }

    const trades = useRealtimeStore.getState().trades;
    expect(trades.length).toBe(1000);
  });

  it('should update position data', () => {
    const position = {
      vt_symbol: 'rb2410.SHFE',
      symbol: 'rb2410',
      exchange: 'SHFE',
      direction: '多',
      volume: 10,
      frozen: 0,
      price: 3500,
      pnl: 1000,
    };

    useRealtimeStore.getState().updatePosition('rb2410.SHFE', position);

    const storedPosition = useRealtimeStore.getState().positions['rb2410.SHFE'];
    expect(storedPosition).toEqual(position);
  });

  it('should add log and limit to 500', () => {
    const store = useRealtimeStore.getState();

    // 添加 505 条日志
    for (let i = 0; i < 505; i++) {
      store.addLog({
        time: '2024-01-01 09:30:00',
        level: 'INFO',
        msg: `Log message ${i}`,
        source: 'test',
      });
    }

    const logs = useRealtimeStore.getState().logs;
    expect(logs.length).toBe(500);
  });

  it('should update connection state', () => {
    useRealtimeStore.getState().setConnectionState('connected');
    expect(useRealtimeStore.getState().connectionState).toBe('connected');

    useRealtimeStore.getState().setConnectionState('disconnected');
    expect(useRealtimeStore.getState().connectionState).toBe('disconnected');
  });

  it('should update backtest progress', () => {
    useRealtimeStore.getState().setBacktestProgress('task123', 50, '正在运行...');

    const progress = useRealtimeStore.getState().backtestProgress['task123'];
    expect(progress).toEqual({
      task_id: 'task123',
      progress: 50,
      message: '正在运行...',
    });
  });

  it('should clear all data', () => {
    const store = useRealtimeStore.getState();

    // 添加一些数据
    store.updateTick('rb2410.SHFE', { last_price: 3500 } as any);
    store.addTrade({ vt_tradeid: '1' } as any);
    store.addLog({ time: 'now', level: 'INFO', msg: 'test', source: 'test' });

    // 清空
    store.clearAll();

    const state = useRealtimeStore.getState();
    expect(Object.keys(state.ticks)).toHaveLength(0);
    expect(state.trades).toHaveLength(0);
    expect(state.logs).toHaveLength(0);
  });
});
