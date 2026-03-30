import { describe, it, expect } from 'vitest';
import { authApi, systemApi, marketApi, tradingApi, strategyApi, backtestApi, dataApi, riskApi, logsApi } from './index';

/**
 * API 接口定义测试
 * 确保所有 API 对象都有预期的结构
 */
describe('API Exports', () => {
  it('should export authApi with required methods', () => {
    expect(authApi).toHaveProperty('login');
    expect(authApi).toHaveProperty('logout');
    expect(authApi).toHaveProperty('me');
    expect(authApi).toHaveProperty('refresh');
    expect(authApi).toHaveProperty('changePassword');
  });

  it('should export systemApi with required methods', () => {
    expect(systemApi).toHaveProperty('status');
    expect(systemApi).toHaveProperty('gateways');
    expect(systemApi).toHaveProperty('connect');
  });

  it('should export marketApi with required methods', () => {
    expect(marketApi).toHaveProperty('contracts');
    expect(marketApi).toHaveProperty('ticks');
    expect(marketApi).toHaveProperty('subscribe');
    expect(marketApi).toHaveProperty('history');
  });

  it('should export tradingApi with required methods', () => {
    expect(tradingApi).toHaveProperty('sendOrder');
    expect(tradingApi).toHaveProperty('cancelOrder');
    expect(tradingApi).toHaveProperty('orders');
    expect(tradingApi).toHaveProperty('trades');
    expect(tradingApi).toHaveProperty('positions');
  });

  it('should export strategyApi with required methods', () => {
    expect(strategyApi).toHaveProperty('classes');
    expect(strategyApi).toHaveProperty('instances');
    expect(strategyApi).toHaveProperty('add');
    expect(strategyApi).toHaveProperty('edit');
    expect(strategyApi).toHaveProperty('init');
    expect(strategyApi).toHaveProperty('start');
    expect(strategyApi).toHaveProperty('stop');
  });

  it('should export backtestApi with required methods', () => {
    expect(backtestApi).toHaveProperty('classes');
    expect(backtestApi).toHaveProperty('createTask');
    expect(backtestApi).toHaveProperty('tasks');
    expect(backtestApi).toHaveProperty('taskResult');
  });

  it('should export dataApi with required methods', () => {
    expect(dataApi).toHaveProperty('overview');
    expect(dataApi).toHaveProperty('download');
    expect(dataApi).toHaveProperty('delete');
  });

  it('should export riskApi with required methods', () => {
    expect(riskApi).toHaveProperty('rules');
    expect(riskApi).toHaveProperty('rule');
    expect(riskApi).toHaveProperty('updateRule');
    expect(riskApi).toHaveProperty('events');
    expect(riskApi).toHaveProperty('status');
  });

  it('should export logsApi with required methods', () => {
    expect(logsApi).toHaveProperty('query');
    expect(logsApi).toHaveProperty('stats');
    expect(logsApi).toHaveProperty('types');
  });
});
