import client, { API_BASE as API_BASE_URL } from './client';
export { API_BASE_URL };

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
  logs: (params?: { level?: string; keyword?: string; source?: string; start_time?: string; end_time?: string; limit?: number }) =>
    client.get('/api/system/logs', { params }),
};

// ============ 行情 ============
export const marketApi = {
  contracts: (params?: { page?: number; page_size?: number; keyword?: string; exchange?: string; product?: string }) =>
    client.get('/api/market/contracts', { params }),
  contract: (vtSymbol: string) => client.get(`/api/market/contracts/${vtSymbol}`),
  contractDetail: (vtSymbol: string) => client.get(`/api/market/contracts/${vtSymbol}/detail`),
  searchContracts: (params: { keyword: string; exchange?: string; product?: string; limit?: number }) =>
    client.get('/api/market/contracts/search', { params }),
  products: () => client.get('/api/market/products'),
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
  // 交易增强功能
  cancelAll: (gatewayName?: string) =>
    client.post('/api/trading/cancel-all', null, { params: gatewayName ? { gateway_name: gatewayName } : undefined }),
  batchOrders: (orders: Record<string, any>[]) => client.post('/api/trading/batch', { orders }),
  // 条件单
  createConditional: (data: Record<string, any>) => client.post('/api/trading/conditional', data),
  conditionalOrders: (status?: string) => client.get('/api/trading/conditional', { params: status ? { status } : undefined }),
  cancelConditional: (orderId: string) => client.post(`/api/trading/conditional/${orderId}/cancel`),
  cancelAllConditional: () => client.post('/api/trading/conditional/cancel-all'),
  // 止盈止损
  createStopLossTakeProfit: (data: Record<string, any>) => client.post('/api/trading/stop-loss-take-profit', data),
  stopLossTakeProfitOrders: (params?: Record<string, any>) => client.get('/api/trading/stop-loss-take-profit', { params }),
  cancelStopLossTakeProfit: (orderId: string) => client.post(`/api/trading/stop-loss-take-profit/${orderId}/cancel`),
};

// ============ 系统设置 ============
export const settingsApi = {
  getAll: () => client.get('/api/settings'),
  getCategory: (category: string) => client.get(`/api/settings/${category}`),
  updateSetting: (category: string, key: string, value: any) =>
    client.put(`/api/settings/${category}/${key}`, { value }),
  updateCategory: (category: string, data: Record<string, any>) =>
    client.put(`/api/settings/${category}`, data),
  reset: (category?: string) => client.post('/api/settings/reset', null, { params: category ? { category } : undefined }),
  getUserPreferences: () => client.get('/api/settings/user/preferences'),
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
  importCsv: (file: File, vt_symbol: string, interval: string = '1m') => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post(`/api/data/import-csv?vt_symbol=${vt_symbol}&interval=${interval}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportCsv: (vt_symbol: string, interval: string = '1m', start?: string, end?: string) =>
    client.post('/api/data/export-csv', { vt_symbol, interval, start, end }, {
      responseType: 'blob',
    }),
  preview: (vt_symbol: string, interval: string = '1m', limit: number = 10) =>
    client.get(`/api/data/preview?vt_symbol=${vt_symbol}&interval=${interval}&limit=${limit}`),
};

// ============ 风控设置 ============
export const riskApi = {
  rules: () => client.get('/api/risk/rules'),
  rule: (name: string) => client.get(`/api/risk/rules/${name}`),
  updateRule: (name: string, data: Record<string, any>) => client.put(`/api/risk/rules/${name}`, data),
  events: (limit?: number) => client.get('/api/risk/events', { params: { limit } }),
  status: () => client.get('/api/risk/status'),
  reset: () => client.post('/api/risk/reset'),
  // 订单流监控
  orderFlow: (limit?: number, status?: string) => client.get('/api/risk/order-flow', { params: { limit, status } }),
  orderFlowStats: () => client.get('/api/risk/order-flow/stats'),
  checkOrder: (data: Record<string, any>) => client.post('/api/risk/order-flow/check', data),
  // 风险敞口
  getRiskExposure: () => client.get('/api/risk/exposure'),
  getExposureHistory: (params?: { hours?: number; interval?: string }) => client.get('/api/risk/exposure/history', { params }),
  // 风控触发器
  getRiskTriggers: () => client.get('/api/risk/triggers'),
  updateRiskTrigger: (name: string, data: Record<string, any>) => client.put(`/api/risk/triggers/${name}`, data),
  getRiskTriggerStatus: () => client.get('/api/risk/triggers/status'),
  executeRiskAction: (data: Record<string, any>) => client.post('/api/risk/triggers/execute', data),
  getTriggerEvents: (limit?: number) => client.get('/api/risk/triggers/events', { params: { limit } }),
  // VaR分析
  calculateVaR: (data: Record<string, any>) => client.post('/api/risk/var/calculate', data),
  getVaRSensitivity: (params?: Record<string, any>) => client.get('/api/risk/var/sensitivity', { params }),
};

// ============ 模拟交易 ============
export const paperApi = {
  setting: () => client.get('/api/paper/setting'),
  updateSetting: (data: Record<string, any>) => client.put('/api/paper/setting', data),
  clear: () => client.post('/api/paper/clear'),
  positions: () => client.get('/api/paper/positions'),
};

// ============ 算法交易 ============
export const algoApi = {
  templates: () => client.get('/api/algo/templates'),
  template: (name: string) => client.get(`/api/algo/templates/${name}`),
  list: () => client.get('/api/algo/list'),
  start: (data: Record<string, any>) => client.post('/api/algo/start', data),
  stop: (name: string) => client.post(`/api/algo/${name}/stop`),
  stopAll: () => client.post('/api/algo/stop-all'),
  pause: (name: string) => client.post(`/api/algo/${name}/pause`),
  resume: (name: string) => client.post(`/api/algo/${name}/resume`),
  batchImport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post('/api/algo/batch-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  batchTemplate: () => client.get('/api/algo/batch-template'),
};

// ============ 机器学习 ============
export const mlApi = {
  generateFeatures: (params: Record<string, any>) => client.post('/api/ml/features/generate', params),
  previewFeatures: (data: Record<string, any>) => client.post('/api/ml/features/preview', data),
  trainModel: (data: Record<string, any>) => client.post('/api/ml/models/train', data),
  listModels: () => client.get('/api/ml/models'),
  getModelDetail: (name: string) => client.get(`/api/ml/models/${name}`),
  getModelEvaluation: (name: string) => client.get(`/api/ml/models/${name}/evaluation`),
  predict: (name: string, data: Record<string, any>) => client.post(`/api/ml/models/${name}/predict`, data),
  deleteModel: (name: string) => client.delete(`/api/ml/models/${name}`),
  // ML 信号
  subscribeSignals: (data: { model_name: string; vt_symbol: string; interval?: number }) =>
    client.post('/api/ml/signals/subscribe', data),
  unsubscribeSignals: (vt_symbol: string) =>
    client.post('/api/ml/signals/unsubscribe', null, { params: { vt_symbol } }),
  getSignalSubscriptions: () => client.get('/api/ml/signals/subscriptions'),
  getSignalHistory: (params?: { limit?: number; vt_symbol?: string; model_name?: string }) =>
    client.get('/api/ml/signals/history', { params }),
  clearSignalHistory: () => client.delete('/api/ml/signals/history'),
  getSignalStatus: () => client.get('/api/ml/signals/status'),
  // 模型对比与回测
  compareModels: (modelNames: string[]) => client.post('/api/ml/models/compare', { model_names: modelNames }),
  runMLBacktest: (data: Record<string, any>) => client.post('/api/ml/backtest', data),
};

// ============ 策略编辑器 ============
export const editorApi = {
  getTemplates: () => client.get('/api/editor/templates'),
  getStrategyCode: (className: string) => client.get(`/api/editor/strategy/${className}`),
  saveStrategyCode: (className: string, content: string) =>
    client.post(`/api/editor/strategy/${className}/save`, { class_name: className, content }),
  runBacktest: (className: string, params: Record<string, any>) =>
    client.post(`/api/editor/strategy/${className}/run-backtest`, params),
};

// ============ 操作日志 ============
export const logsApi = {
  query: (params?: Record<string, any>) => client.get('/api/logs/operations', { params }),
  stats: (days?: number) => client.get('/api/logs/operations/stats', { params: { days } }),
  types: () => client.get('/api/logs/operations/types'),
  cleanup: (maxAgeDays: number) => client.delete('/api/logs/operations/cleanup', { params: { max_age_days: maxAgeDays } }),
};

// ============ 数据分析 ============
export const analyticsApi = {
  performanceSummary: (params?: { start_date?: string; end_date?: string }) =>
    client.get('/api/analytics/performance/summary', { params }),
  performanceAttribution: (params?: { start_date?: string; end_date?: string }) =>
    client.get('/api/analytics/performance/attribution', { params }),
  monthlyPerformance: (months?: number) =>
    client.get('/api/analytics/performance/monthly', { params: { months } }),
  dailyPerformance: (days?: number) =>
    client.get('/api/analytics/performance/daily', { params: { days } }),
  exportReport: (data: Record<string, any>) =>
    client.post('/api/analytics/report/export', data),
  reportTemplates: () => client.get('/api/analytics/report/templates'),
  benchmarkComparison: (benchmark?: string) =>
    client.get('/api/analytics/benchmark/compare', { params: { benchmark } }),
};
