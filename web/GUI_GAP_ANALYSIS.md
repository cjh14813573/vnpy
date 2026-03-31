# vnpy Web GUI 功能差距分析

## 原始 PyQt5 GUI 功能清单

### 1. 基础交易功能 (vnpy.trader.ui)
| 组件 | 原始GUI | Web版 | 状态 |
|------|---------|-------|------|
| 行情监控 (TickMonitor) | ✅ | ✅ MarketPage | 已完成 |
| 交易下单 (TradingWidget) | ✅ | ✅ TradingPage | 已完成 (含5档行情、快速调价) |
| 委托监控 (OrderMonitor) | ✅ | ✅ TradingPage | 已完成 |
| 成交监控 (TradeMonitor) | ✅ | ✅ TradingPage | 已完成 |
| 持仓监控 (PositionMonitor) | ✅ | ✅ TradingPage/Dashboard | 已完成 |
| 资金账户 (AccountMonitor) | ✅ | ✅ Dashboard | 已完成 |
| 日志监控 (LogMonitor) | ✅ | ✅ LogsPage | 已完成 |
| 合约查询 (ContractManager) | ✅ | ✅ MarketPage | 已完成 |
| 网关连接 (ConnectDialog) | ✅ | ✅ GatewayPage | 已完成 |
| 全局配置 (GlobalDialog) | ✅ | ⚠️ SettingsPage | 部分实现 |

### 2. CTA策略功能 (vnpy_ctastrategy)
| 功能 | 原始GUI | Web版 | 状态 |
|------|---------|-------|------|
| 策略类列表 | ✅ | ✅ StrategyPage | 已完成 |
| 策略实例管理 | ✅ | ✅ StrategyPage | 已完成 |
| 添加策略 | ✅ | ✅ StrategyPage | 已完成 |
| 编辑参数 | ✅ | ✅ StrategyPage | 已完成 |
| 初始化/启动/停止 | ✅ | ✅ StrategyPage | 已完成 |
| 策略详情监控 | ✅ | ✅ StrategyDetailPage | 已完成 |
| 查看策略源码 | ✅ | ✅ StrategyCodeViewer | 已完成 |
| 实时日志输出 | ✅ | ⚠️ | 需增强WebSocket推送 |

### 3. 回测功能 (vnpy_ctabacktester)
| 功能 | 原始GUI | Web版 | 状态 |
|------|---------|-------|------|
| 回测参数配置 | ✅ | ✅ BacktestPage | 已完成 |
| 策略选择 | ✅ | ✅ BacktestPage | 已完成 |
| 合约/周期设置 | ✅ | ✅ BacktestPage | 已完成 |
| 回测任务管理 | ✅ | ✅ BacktestPage | 已完成 |
| 回测进度显示 | ✅ | ✅ BacktestPage | 已完成 |
| 权益曲线图 | ✅ | ✅ BacktestPage | 已完成 (ECharts) |
| 回撤图 | ✅ | ✅ BacktestPage | 已完成 (ECharts) |
| 盈亏分布 | ✅ | ✅ BacktestPage | 已完成 (ECharts) |
| 回测结果统计 | ✅ | ✅ BacktestPage | 已完成 |
| K线图表展示 | ✅ | ✅ KLineChart | 已完成 |
| 成交记录明细 | ✅ | ⚠️ | 基础实现，需增强 |
| 优化参数功能 | ✅ | ❌ | 未实现 |

### 4. 数据管理 (vnpy_datamanager)
| 功能 | 原始GUI | Web版 | 状态 |
|------|---------|-------|------|
| 数据概览统计 | ✅ | ✅ DataPage | 已实现 |
| 合约数据下载 | ✅ | ✅ DataPage | 已实现 |
| 数据删除 | ✅ | ✅ DataPage | 已实现 |
| CSV导入 | ✅ | ✅ DataPage | 已实现 |
| CSV导出 | ✅ | ✅ DataPage | 已实现 |
| K线预览图表 | ✅ | ❌ | 未实现 |

### 5. 风控管理 (vnpy_riskmanager)
| 功能 | 原始GUI | Web版 | 状态 |
|------|---------|-------|------|
| 风控规则配置 | ✅ | ✅ RiskPage | 已实现 |
| 规则开关 | ✅ | ✅ RiskPage | 已实现 |
| 阈值设置 | ✅ | ✅ RiskPage | 已实现 |
| 风控事件日志 | ✅ | ✅ RiskPage | 已实现 |
| 订单流监控 | ✅ | ❌ | 未实现 |

### 6. 模拟交易 (vnpy_paperaccount)
| 功能 | 原始GUI | Web版 | 状态 |
|------|---------|-------|------|
| 模拟账户配置 | ✅ | ✅ PaperPage | 已完成 |
| 滑点设置 | ✅ | ✅ PaperPage | 已完成 |
| 手续费设置 | ✅ | ✅ PaperPage | 已完成 |
| 模拟持仓清零 | ✅ | ✅ PaperPage | 已完成 |
| 实时盈亏计算 | ✅ | ✅ PaperPage | 已完成 |

### 7. 算法交易 (vnpy_algotrading)
| 功能 | 原始GUI | Web版 | 状态 |
|------|---------|-------|------|
| 算法模板管理 | ✅ | ❌ | 未集成 |
| 主动买卖算法 | ✅ | ❌ | 未集成 |
| 被动挂单算法 | ✅ | ❌ | 未集成 |
| TWAP/VWAP | ✅ | ❌ | 未集成 |
| 算法执行监控 | ✅ | ❌ | 未集成 |

### 8. 脚本交易 (vnpy_scripttrader)
| 功能 | 原始GUI | Web版 | 状态 |
|------|---------|-------|------|
| Python脚本执行 | ✅ | ❌ | 未集成 |
| 交互式命令行 | ✅ | ❌ | 未集成 |

## 核心差距总结

### 已完整实现
1. ✅ 行情监控与合约查询
2. ✅ 交易下单与订单管理
3. ✅ CTA策略生命周期管理
4. ✅ 回测任务管理与图表展示（含K线）
5. ✅ 数据导入导出
6. ✅ 风控规则配置
7. ✅ 实时WebSocket推送
8. ✅ 策略编辑器（Monaco）
9. ✅ 机器学习模块
10. ✅ 模拟交易功能（含实时盈亏）
11. ✅ 网关连接管理
12. ✅ 策略源码查看器

### 部分实现/待增强
1. ⚠️ 回测参数优化 - UI框架已就绪，需完善后端逻辑
2. ⚠️ 算法交易 - 仅UI框架，需接入vnpy_algotrading
3. ⚠️ 实时日志 - WebSocket推送频率和展示可优化
4. ⚠️ 全局配置 - 需要更多配置项支持
5. ⚠️ 风控订单流监控

### 未实现的高级功能
1. ❌ 脚本交易/Jupyter集成
2. ❌ 多账户管理
3. ❌ 自定义指标绘制

## 优先级建议

### P0 - 核心功能完善
- 参数优化功能完整实现（后端逻辑）

### P1 - 交易体验增强
- 算法交易模块（TWAP/VWAP/智能路由）
- 一键全撤/条件单/止盈止损
- 风控订单流实时监控

### P2 - 系统增强
- 全局配置完整实现
- 多账户管理
- 实时日志WebSocket优化

### P3 - 高级功能
- 脚本交易/Jupyter集成
- 自定义指标绘制
- 数据库性能优化（分表分区）
