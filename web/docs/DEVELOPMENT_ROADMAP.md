# vnpy Web 前端开发路线图

## 版本信息
- 制定日期: 2026-03-31
- 当前版本: v0.2.0
- 文档状态: 进行中

---

## 一、当前功能状态总览

### 已实现功能 ✅

| 模块 | 功能点 | 状态 |
|------|--------|------|
| **交易** | 手动下单、五档盘口、快速价格、合约选择 | ✅ 完成 |
| **行情** | WebSocket 实时推送、K线图表、行情订阅 | ✅ 完成 |
| **策略** | 策略管理、参数编辑、启停控制、策略锁 | ✅ 完成 |
| **回测** | 异步回测、参数优化、结果图表、进度推送 | ✅ 完成 |
| **风控** | 规则配置、事件日志、订单流监控 | ✅ 完成 |
| **数据** | 数据概览、下载、删除 | ✅ 完成 |
| **算法** | 算法模板、启停控制 | ✅ 完成 |
| **模拟** | 滑点设置、持仓清空 | ✅ 完成 |
| **设置** | 全局配置持久化、网关管理 | ✅ 完成 |
| **ML** | 基础模型训练、预测 | ✅ 完成 |

---

## 二、功能差距分析与开发计划

### Phase 1: 关键缺失功能 (高优先级) 🔴

#### 1.1 合约查询管理器 (Contract Manager)

**现状**: Web 端只有下拉选择，缺乏完整合约浏览和筛选
**目标**: 实现类似原 GUI 的合约管理器

**功能需求**:
```
┌─────────────────────────────────────────────────────────────┐
│  合约查询管理器                                               │
├─────────────────────────────────────────────────────────────┤
│  筛选条件: [交易所▼] [产品类型▼] [状态▼]  [搜索...🔍]        │
├─────────────────────────────────────────────────────────────┤
│  合约代码    名称      交易所   合约乘数  价格跳动  状态      │
│  ─────────────────────────────────────────────────────────  │
│  rb2410     螺纹2410   SHFE    10       1.0      交易中    │
│  cu2410     沪铜2410   SHFE    5        10.0     交易中    │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│  [导出CSV]  [刷新]                           共 1256 条     │
└─────────────────────────────────────────────────────────────┘
```

**API 需求**:
- `GET /api/market/contracts/search?exchange={}&product_type={}&keyword={}`
- `GET /api/market/contracts/{vt_symbol}/detail` - 合约详情

**开发任务**:
- [x] 后端: 合约搜索接口（支持分页、筛选）
- [x] 后端: 合约详情接口
- [x] 前端: ContractManager 组件
- [x] 前端: 集成到行情页面作为弹窗

**状态**: ✅ 2026-03-31 完成

---

#### 1.2 条件单(StopOrder)监控页面

**现状**: 策略产生的条件单没有专门查看界面，API 已存在
**目标**: 独立页面展示所有条件单状态

**功能需求**:
```
┌─────────────────────────────────────────────────────────────┐
│  条件单监控                    [全部] [运行中] [已触发] [已撤销] │
├─────────────────────────────────────────────────────────────┤
│  条件单号      策略      合约      条件      方向   状态     │
│  ─────────────────────────────────────────────────────────  │
│  STOP_001    DualThrust  rb2410  突破3500   多     监控中   │
│  STOP_002    RBreak     cu2410  跌破68000  空     已触发   │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**API 需求**:
- `GET /api/strategy/stop-orders?status={}&strategy={}`

**开发任务**:
- [x] 后端: 条件单查询接口
- [x] 前端: StopOrderMonitor 页面
- [x] 前端: 添加到侧边栏菜单

**状态**: ✅ 2026-03-31 完成

---

#### 1.3 策略变量实时监控

**现状**: 有 API `/api/strategy/instances/{name}/variables` 但未在页面集成
**目标**: 策略详情页实时显示变量变化

**功能需求**:
```
┌─────────────────────────────────────────────────────────────┐
│  策略详情 - DualThrust_RB                                   │
├─────────────────────────────────────────────────────────────┤
│  基本信息  |  变量监控  |  日志  |  成交                      │
├─────────────────────────────────────────────────────────────┤
│  变量名            当前值           更新时间                  │
│  ─────────────────────────────────────────────────────────  │
│  fast_ma          3500.5          10:23:45                  │
│  slow_ma          3480.2          10:23:45                  │
│  position         1               10:20:12                  │
│  ...                                                        │
│                                                             │
│  [刷新率: 1秒▼]  [导出变量历史]                              │
└─────────────────────────────────────────────────────────────┘
```

**开发任务**:
- [x] 前端: StrategyDetailPage 添加变量 Tab
- [x] 前端: useVariables  Hook (轮询获取)
- [x] 前端: 变量变化高亮动画

**状态**: ✅ 2026-03-31 完成

---

#### 1.4 算法交易 CSV 批量导入

**现状**: 算法交易只能单个添加
**目标**: 支持 CSV 批量导入算法参数

**CSV 格式**:
```csv
symbol,exchange,algo_type,price,volume,params
rb2410,SHFE,TWAP,3500,10,"{\"interval\":60}"
cu2410,SHFE,SNIPER,68000,5,"{\"trigger_price\":68100}"
```

**API 需求**:
- `POST /api/algo/batch-import` - multipart/form-data

**开发任务**:
- [x] 后端: CSV 解析和批量创建接口
- [x] 前端: CSV 上传组件
- [x] 前端: 导入预览和确认

**状态**: ✅ 2026-03-31 完成

---

### Phase 2: 完善功能 (中优先级) 🟡

#### 2.1 日志监控增强

**现状**: LogsPage 基础实现，缺乏筛选和彩色显示
**目标**: 专业级日志查看器

**功能需求**:
- 日志级别筛选 (DEBUG/INFO/WARNING/ERROR)
- 关键词搜索高亮
- 日志来源筛选 (系统/策略/网关)
- 时间范围选择
- 导出日志
- 自动滚动开关

**开发任务**:
- [ ] 前端: 日志级别筛选器
- [ ] 前端: 实时日志 WebSocket 推送优化
- [ ] 前端: 代码高亮组件

**预计工时**: 1 天

---

#### 2.2 回测详细结果展示

**现状**: 回测结果只展示关键指标和图表，缺少明细
**目标**: 完整的回测结果分析

**新增 Tab**:
```
┌─────────────────────────────────────────────────────────────┐
│  回测结果详情                                                │
├─────────────────────────────────────────────────────────────┤
│  [指标概览] [权益曲线] [分笔成交] [日收益] [持仓变化]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  分笔成交表格:                                               │
│  成交号  时间        方向  开平  价格    数量   盈亏        │
│  ────────────────────────────────────────────────────────   │
│  001    2024-01-05  多    开    3500.0  1      -           │
│  002    2024-01-08  多    平    3510.0  1      +100        │
│  ...                                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**API 需求**:
- `GET /api/backtest/tasks/{id}/trades` - 分笔成交
- `GET /api/backtest/tasks/{id}/daily` - 日收益明细
- `GET /api/backtest/tasks/{id}/positions` - 持仓变化

**开发任务**:
- [ ] 后端: 回测结果明细查询接口
- [ ] 前端: BacktestResultPage 增强

**预计工时**: 1.5 天

---

#### 2.3 策略日志和成交页面

**现状**: StrategyDetailPage 简单实现
**目标**: 专门的策略日志和成交 Tab

**开发任务**:
- [ ] 前端: StrategyLogViewer 组件
- [ ] 前端: StrategyTradeTable 组件
- [ ] 后端: 策略日志查询优化（分页）

**预计工时**: 1 天

---

#### 2.4 数据导入/导出功能

**现状**: 数据管理只有下载，没有导入
**目标**: CSV/Excel 格式导入导出

**支持格式**:
- CSV (标准格式)
- Excel (.xlsx)
- JSON (vnpy 原生格式)

**开发任务**:
- [ ] 后端: CSV 数据导入接口
- [ ] 后端: Excel 数据导入接口（可选）
- [ ] 前端: 数据导入对话框
- [ ] 前端: 数据导出格式选择

**预计工时**: 2 天

---

### Phase 3: 优化项 (低优先级) 🟢

#### 3.1 界面布局保存

**现状**: 页面布局固定
**目标**: 用户可自定义并保存布局

**实现方案**:
- 使用 localStorage 保存用户偏好
- 记录: 列宽、排序、折叠状态、Tab 位置

**开发任务**:
- [ ] 前端: useLayoutPreference Hook
- [ ] 前端: 表格列宽拖拽保存
- [ ] 前端: 侧边栏折叠状态保存

**预计工时**: 1 天

---

#### 3.2 交易快捷键

**现状**: 只能通过鼠标操作
**目标**: 支持键盘快捷键

**快捷键设计**:
| 快捷键 | 功能 |
|--------|------|
| F1 | 买开 |
| F2 | 卖开 |
| F3 | 买平 |
| F4 | 卖平 |
| Ctrl+Z | 撤销订单 |
| Ctrl+Enter | 确认下单 |
| Esc | 取消/关闭弹窗 |

**开发任务**:
- [ ] 前端: useKeyboardShortcuts Hook
- [ ] 前端: TradingPage 快捷键绑定
- [ ] 前端: 快捷键提示 Overlay

**预计工时**: 1 天

---

#### 3.3 批量撤单功能

**现状**: 只能单个撤单
**目标**: 一键撤销所有活跃订单

**开发任务**:
- [ ] 前端: TradingPage 批量撤单按钮
- [ ] API 已存在: `POST /api/trading/cancel-all`

**预计工时**: 0.5 天

---

### Phase 4: 机器学习增强 🧠

**现状**: ML 功能基础，只有模型训练和基础预测
**目标**: 完整的 ML 工作流

#### 4.1 特征工程可视化

**功能需求**:
```
┌─────────────────────────────────────────────────────────────┐
│  特征工程                                                    │
├─────────────────────────────────────────────────────────────┤
│  合约: [rb2410.SHFE▼]  周期: [1d▼]                          │
│  技术指标: [✓]SMA [✓]EMA [✓]RSI [✓]MACD [✓]ATR [✓]布林带  │
│  窗口大小: [5,10,20,60]                                     │
│  目标变量: [未来N期方向▼]  N=[5]                            │
│                                                             │
│  [生成特征预览]                                              │
│                                                             │
│  特征预览:                                                   │
│  特征名        均值      标准差     与目标相关性              │
│  ─────────────────────────────────────────────────────      │
│  sma_5         3500     120       0.45                      │
│  rsi_14        55.2     12.3      0.32                      │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**开发任务**:
- [ ] 前端: FeatureEngineeringPage 新页面
- [ ] 后端: 特征预览接口 `/api/ml/features/preview`
- [ ] 后端: 特征相关性分析

**预计工时**: 2 天

---

#### 4.2 模型评估增强

**新增图表**:
- ROC 曲线
- 混淆矩阵
- 学习曲线
- 特征重要性柱状图
- 预测结果分布

**开发任务**:
- [ ] 后端: 模型评估指标补充
- [ ] 前端: ModelEvaluationCharts 组件

**预计工时**: 1.5 天

---

#### 4.3 实时预测与信号

**功能需求**:
- 模型绑定到合约，实时产生预测信号
- 信号历史记录
- 策略集成（CTA 策略可调用 ML 信号）

**API 需求**:
- `POST /api/ml/signals/subscribe` - 订阅实时信号
- `GET /api/ml/signals/history` - 信号历史
- WebSocket: `ml.signal` 事件

**开发任务**:
- [ ] 后端: ML 信号服务（定时预测）
- [ ] 后端: ML 信号 WebSocket 推送
- [ ] 前端: MLSignalMonitor 页面
- [ ] 策略: ML 信号调用接口

**预计工时**: 2.5 天

---

#### 4.4 模型对比与回测

**功能需求**:
- 多模型对比（准确率、收益率等）
- ML 信号回测（独立回测 ML 策略）
- 最佳模型选择

**开发任务**:
- [ ] 前端: ModelComparison 组件
- [ ] 后端: ML 回测引擎
- [ ] 后端: 模型对比报告接口

**预计工时**: 2 天

---

## 三、开发时间表

```
Week 1 (4.1-4.7)
├── Day 1-2: 合约查询管理器
├── Day 3: 条件单监控页面
├── Day 4: 策略变量实时监控
└── Day 5-6: 算法 CSV 批量导入

Week 2 (4.8-4.14)
├── Day 1: 日志监控增强
├── Day 2-3: 回测详细结果展示
├── Day 4: 策略日志和成交页面
└── Day 5-6: 数据导入/导出功能

Week 3 (4.15-4.21)
├── Day 1: 界面布局保存
├── Day 2: 交易快捷键
├── Day 3: 批量撤单 + 杂项优化
└── Day 4-6: ML 特征工程可视化

Week 4 (4.22-4.30)
├── Day 1-2: ML 模型评估增强
├── Day 3-5: ML 实时预测与信号
└── Day 6: ML 模型对比与回测
```

**总计**: 约 24 个工作日（含缓冲）

---

## 四、技术实现要点

### 4.1 新增后端接口汇总

```yaml
# 合约管理
GET /api/market/contracts/search:
  params:
    - exchange: string (optional)
    - product_type: string (optional)
    - keyword: string (optional)
    - page: int (default: 1)
    - page_size: int (default: 50)

GET /api/market/contracts/{vt_symbol}/detail:
  response:
    - 完整合约信息（乘数、保证金率、交易时间等）

# 条件单
GET /api/strategy/stop-orders:
  params:
    - status: enum ['all', 'running', 'triggered', 'cancelled']
    - strategy_name: string (optional)

# 回测结果
GET /api/backtest/tasks/{id}/trades:
  params:
    - page: int
    - page_size: int

GET /api/backtest/tasks/{id}/daily:
GET /api/backtest/tasks/{id}/positions:

# 数据导入
POST /api/data/import-csv:
  body: multipart/form-data
  fields:
    - file: CSV文件
    - vt_symbol: string
    - interval: string

# 算法批量导入
POST /api/algo/batch-import:
  body: multipart/form-data

# ML 特征
POST /api/ml/features/preview:
  body:
    - vt_symbol: string
    - interval: string
    - start: string
    - end: string
    - config: FeatureConfig

# ML 信号
POST /api/ml/signals/subscribe:
GET /api/ml/signals/history:
WS /ws/ml-signals:
```

### 4.2 新增前端组件规划

```
src/
├── pages/
│   ├── ContractManagerPage.tsx      # 合约查询管理器
│   ├── StopOrderMonitorPage.tsx     # 条件单监控
│   ├── FeatureEngineeringPage.tsx   # 特征工程
│   ├── MLSignalMonitorPage.tsx      # ML 信号监控
│   └── ...
├── components/
│   ├── contract/
│   │   ├── ContractSearch.tsx       # 合约搜索
│   │   ├── ContractDetail.tsx       # 合约详情
│   │   └── ContractTable.tsx        # 合约表格
│   ├── logs/
│   │   ├── LogLevelFilter.tsx       # 日志级别筛选
│   │   ├── LogHighlighter.tsx       # 日志高亮
│   │   └── LogViewer.tsx            # 增强日志查看器
│   ├── backtest/
│   │   ├── TradeDetailTable.tsx     # 分笔成交
│   │   ├── DailyPnlTable.tsx        # 日收益
│   │   └── PositionChangeTable.tsx  # 持仓变化
│   ├── strategy/
│   │   ├── StrategyVariables.tsx    # 策略变量
│   │   ├── StrategyLogs.tsx         # 策略日志
│   │   └── StrategyTrades.tsx       # 策略成交
│   ├── ml/
│   │   ├── FeaturePreview.tsx       # 特征预览
│   │   ├── ModelEvaluation.tsx      # 模型评估
│   │   ├── SignalCard.tsx           # 信号卡片
│   │   └── ModelComparison.tsx      # 模型对比
│   └── common/
│       ├── CSVUploader.tsx          # CSV 上传
│       ├── KeyboardShortcuts.tsx    # 快捷键
│       └── LayoutSaver.tsx          # 布局保存
├── hooks/
│   ├── useKeyboardShortcuts.ts      # 快捷键 Hook
│   ├── useLayoutPreference.ts       # 布局偏好
│   ├── useVariables.ts              # 策略变量轮询
│   └── useMLSignals.ts              # ML 信号订阅
└── stores/
    ├── contractStore.ts             # 合约状态
    ├── layoutStore.ts               # 布局状态
    └── mlSignalStore.ts             # ML 信号状态
```

### 4.3 数据库变更（如需要）

```sql
-- 条件单表
CREATE TABLE stop_orders (
    id VARCHAR(32) PRIMARY KEY,
    strategy_name VARCHAR(64) NOT NULL,
    vt_symbol VARCHAR(32) NOT NULL,
    direction VARCHAR(8) NOT NULL,
    offset VARCHAR(8) NOT NULL,
    price DECIMAL(18,4) NOT NULL,
    volume INT NOT NULL,
    status VARCHAR(16) NOT NULL, -- running, triggered, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_at TIMESTAMP NULL,
    vt_orderid VARCHAR(32) NULL -- 触发后的委托号
);

-- ML 信号历史表
CREATE TABLE ml_signals (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(64) NOT NULL,
    vt_symbol VARCHAR(32) NOT NULL,
    prediction INT NOT NULL, -- 0: down, 1: up
    probability DECIMAL(5,4),
    features JSONB, -- 特征快照
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_stop_orders_strategy ON stop_orders(strategy_name);
CREATE INDEX idx_stop_orders_status ON stop_orders(status);
CREATE INDEX idx_ml_signals_model ON ml_signals(model_name);
CREATE INDEX idx_ml_signals_symbol ON ml_signals(vt_symbol);
CREATE INDEX idx_ml_signals_time ON ml_signals(created_at);
```

---

## 五、验收标准

### 5.1 功能验收

| 功能 | 验收标准 |
|------|----------|
| 合约管理器 | 支持按交易所、产品类型筛选；关键词搜索响应 < 200ms；支持 CSV 导出 |
| 条件单监控 | 实时显示条件单状态变化；支持按策略筛选；显示触发历史 |
| 策略变量 | 变量更新延迟 < 2秒；变化高亮提示；支持导出 |
| 回测明细 | 支持分笔成交、日收益、持仓变化查看；支持导出 Excel |
| ML 特征工程 | 支持技术指标选择；特征预览响应 < 3秒；显示特征相关性 |
| ML 信号 | 实时推送延迟 < 5秒；信号历史可追溯；支持策略集成 |

### 5.2 性能指标

- 页面首屏加载时间 < 2s
- WebSocket 消息延迟 < 100ms
- 表格数据渲染 1000 行 < 500ms
- API 响应时间 P95 < 300ms

---

## 六、风险评估与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 合约数据量大导致性能问题 | 中 | 实现虚拟滚动、分页加载 |
| ML 特征计算耗时 | 中 | 异步处理、缓存特征结果 |
| 实时信号推送频率过高 | 低 | 限流、采样、聚合 |
| 浏览器兼容性问题 | 低 | 测试覆盖 Chrome/Firefox/Edge |

---

## 七、附录

### 7.1 参考资源

- 原 vnpy GUI 源码: `/vnpy/trader/ui/`
- 当前 Web 前端: `/web/frontend/src/`
- 后端 API 文档: `/web/backend/routers/`

### 7.2 术语表

- **StopOrder**: 条件单（本地止损止盈）
- **TWAP**: 时间加权平均价格算法
- **SNIPER**: 狙击算法（触发价成交）
- **Feature Engineering**: 特征工程
- **ML Signal**: 机器学习交易信号

---

*文档维护: 每次功能开发完成后更新进度*
