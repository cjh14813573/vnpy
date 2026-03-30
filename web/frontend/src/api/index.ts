import client from './client';

// ============ 认证 ============
export const authApi = {
  login: (data: { username: string; password: string; remember_me?: boolean }) =>
    client.post('/api/auth/login', data),
  logout: () => client.post('/api/auth/logout'),
  me: () => client.get('/api/auth/me'),
  refresh: () => client.post('/api/auth/refresh'),
  changePassword: (data: { old_password: string; new_password: string }) =>
    client.put('/api/auth/password', data),
};

// ============ 系统管理 ============
export const systemApi = {
  status: () => client.get('/api/system/status'),
  gateways: () => client.get('/api/system/gateways'),
  gatewaySetting: (name: string) => client.get(`/api/system/gateways/${name}/setting`),
  connect: (data: { gateway_name: string; setting: Record<string, any> }) =>
    client.post('/api/system/gateways/connect', data),
  apps: () => client.get('/api/system/apps'),
  exchanges: () => client.get('/api/system/exchanges'),
  logs: () => client.get('/api/system/logs'),
};

// ============ 行情 ============
export const marketApi = {
  contracts: () => client.get('/api/market/contracts'),
  contract: (vtSymbol: string) => client.get(`/api/market/contracts/${vtSymbol}`),
  ticks: () => client.get('/api/market/ticks'),
  tick: (vtSymbol: string) => client.get(`/api/market/ticks/${vtSymbol}`),
  subscribe: (data: { vt_symbol: string; gateway_name: string }) =>
    client.post('/api/market/subscribe', data),
  history: (data: { vt_symbol: string; start: string; end: string; interval: string; gateway_name?: string }) =>
    client.post('/api/market/history', data),
};

// ============ 交易 ============
export const tradingApi = {
  sendOrder: (data: Record<string, any>) => client.post('/api/trading/order', data),
  cancelOrder: (data: { vt_orderid: string; gateway_name?: string }) =>
    client.post('/api/trading/order/cancel', data),
  orders: () => client.get('/api/trading/orders'),
  activeOrders: () => client.get('/api/trading/orders/active'),
  trades: () => client.get('/api/trading/trades'),
  positions: () => client.get('/api/trading/positions'),
  accounts: () => client.get('/api/trading/accounts'),
};

// ============ 策略 ============
export const strategyApi = {
  classes: () => client.get('/api/strategy/classes'),
  classParams: (name: string) => client.get(`/api/strategy/classes/${name}/params`),
  classCode: (name: string) => client.get(`/api/strategy/classes/${name}/code`),
  instances: () => client.get('/api/strategy/instances'),
  instance: (name: string) => client.get(`/api/strategy/instances/${name}`),
  add: (data: Record<string, any>) => client.post('/api/strategy/instances', data),
  edit: (name: string, data: Record<string, any>) =>
    client.put(`/api/strategy/instances/${name}`, data),
  remove: (name: string) => client.delete(`/api/strategy/instances/${name}`),
  init: (name: string) => client.post(`/api/strategy/instances/${name}/init`),
  start: (name: string) => client.post(`/api/strategy/instances/${name}/start`),
  stop: (name: string) => client.post(`/api/strategy/instances/${name}/stop`),
  initAll: () => client.post('/api/strategy/instances/init-all'),
  startAll: () => client.post('/api/strategy/instances/start-all'),
  stopAll: () => client.post('/api/strategy/instances/stop-all'),
  variables: (name: string) => client.get(`/api/strategy/instances/${name}/variables`),
  logs: (name: string) => client.get(`/api/strategy/instances/${name}/logs`),
  trades: (name: string) => client.get(`/api/strategy/instances/${name}/trades`),
};

// ============ 回测 ============
export const backtestApi = {
  classes: () => client.get('/api/backtest/classes'),
  // 异步任务接口
  createTask: (data: Record<string, any>) => client.post('/api/backtest/tasks', data),
  tasks: (params?: Record<string, any>) => client.get('/api/backtest/tasks', { params }),
  task: (id: string) => client.get(`/api/backtest/tasks/${id}`),
  cancelTask: (id: string) => client.delete(`/api/backtest/tasks/${id}`),
  taskResult: (id: string) => client.get(`/api/backtest/tasks/${id}/result`),
  taskChart: (id: string) => client.get(`/api/backtest/tasks/${id}/chart`),
  // 优化任务
  createOptimizeTask: (data: Record<string, any>) => client.post('/api/backtest/optimize-tasks', data),
  // 旧接口（已废弃）
  run: (data: Record<string, any>) => client.post('/api/backtest/run', data),
  optimize: (data: Record<string, any>) => client.post('/api/backtest/optimize', data),
  result: () => client.get('/api/backtest/result'),
  resultDaily: () => client.get('/api/backtest/result/daily'),
  resultTrades: () => client.get('/api/backtest/result/trades'),
  resultChart: () => client.get('/api/backtest/result/chart'),
};

// ============ 数据管理 ============
export const dataApi = {
  overview: () => client.get('/api/data/overview'),
  download: (data: Record<string, any>) => client.post('/api/data/download', data),
  delete: (data: Record<string, any>) =>
    client.request({ method: 'DELETE', url: '/api/data/delete', data }),
  importCsv: (data: Record<string, any>) => client.post('/api/data/import-csv', data),
  exportCsv: (data: Record<string, any>) => client.post('/api/data/export-csv', data),
};

// ============ 风控设置 ============
export const riskApi = {
  rules: () => client.get('/api/risk/rules'),
  rule: (name: string) => client.get(`/api/risk/rules/${name}`),
  updateRule: (name: string, data: Record<string, any>) => client.put(`/api/risk/rules/${name}`, data),
  events: (limit?: number) => client.get('/api/risk/events', { params: { limit } }),
  status: () => client.get('/api/risk/status'),
  reset: () => client.post('/api/risk/reset'),
};

// ============ 操作日志 ============
export const logsApi = {
  query: (params?: Record<string, any>) => client.get('/api/logs/operations', { params }),
  stats: (days?: number) => client.get('/api/logs/operations/stats', { params: { days } }),
  types: () => client.get('/api/logs/operations/types'),
  cleanup: (maxAgeDays: number) => client.delete('/api/logs/operations/cleanup', { params: { max_age_days: maxAgeDays } }),
};
