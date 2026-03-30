# 第二部分：Web 前端实现范围与设计

## 1. 实现范围总览

> 基于 vnpy API，我们选择实现以下功能模块。标记 ✅ = 实现，❌ = 不实现（本期），⏳ = 后续迭代。

| 模块 | 功能 | 实现状态 | 说明 |
|------|------|----------|------|
| **系统管理** | 网关连接/断开 | ✅ | connect, get_all_gateway_names, get_default_setting |
| | 系统状态查询 | ✅ | get_all_apps, get_all_exchanges |
| | 系统日志 | ✅ | EVENT_LOG 推送 |
| **行情中心** | 合约列表 | ✅ | get_all_contracts |
| | 实时行情订阅 | ✅ | subscribe, EVENT_TICK |
| | 实时行情展示 | ✅ | get_tick, get_all_ticks |
| | 历史K线查询 | ✅ | query_history |
| | K线图表 | ✅ | ECharts |
| **交易面板** | 下单 | ✅ | send_order |
| | 撤单 | ✅ | cancel_order |
| | 委托列表 | ✅ | get_all_orders, get_all_active_orders |
| | 成交列表 | ✅ | get_all_trades |
| | 持仓查询 | ✅ | get_all_positions |
| | 账户查询 | ✅ | get_all_accounts |
| | 期权询价 | ⏳ | send_quote, cancel_quote（二期）|
| **CTA策略** | 策略类列表 | ✅ | get_all_strategy_class_names |
| | 策略类参数 | ✅ | get_strategy_class_parameters |
| | 策略源码查看 | ✅ | get_strategy_class_file |
| | 添加策略 | ✅ | add_strategy |
| | 修改策略参数 | ✅ | edit_strategy |
| | 删除策略 | ✅ | remove_strategy |
| | 初始化策略 | ✅ | init_strategy, init_all_strategies |
| | 启动/停止策略 | ✅ | start/stop_strategy, start/stop_all |
| | 策略变量实时展示 | ✅ | get_strategy_parameters + WS推送 |
| | 策略日志 | ✅ | 按策略过滤 |
| | 策略交易记录 | ✅ | 按策略过滤成交 |
| **回测中心** | 执行回测 | ✅ | start_backtesting |
| | 回测结果统计 | ✅ | get_result_statistics |
| | 资金曲线 | ✅ | get_result_values, get_result_df |
| | 交易明细 | ✅ | get_all_trades, get_all_orders |
| | 参数优化（网格） | ✅ | start_optimization (use_ga=False) |
| | 参数优化（遗传） | ✅ | start_optimization (use_ga=True) |
| | 下载历史数据 | ✅ | start_downloading |
| **数据管理** | Bar数据概览 | ✅ | get_bar_overview |
| | 下载数据 | ✅ | download_bar_data |
| | 删除数据 | ✅ | delete_bar_data |
| | CSV导入/导出 | ✅ | import/output_data_from_csv |
| | Tick数据管理 | ⏳ | 二期（BaseDatabase层）|
| **风控管理** | 规则列表 | ✅ | get_all_rule_names |
| | 规则数据/修改 | ✅ | get_rule_data, update_rule_setting |
| **模拟盘** | 配置查询/修改 | ✅ | get/set_instant_trade, trade_slippage |
| | 清空持仓 | ✅ | clear_position |
| **算法交易** | 启动算法 | ⏳ | start_algo（二期）|
| | 停止/暂停算法 | ⏳ | stop/pause/resume_algo（二期）|
| **脚本交易** | 脚本引擎 | ❌ | 不实现（Web端不适用）|
| **Alpha研究** | 数据集/模型/信号 | ⏳ | 三期（需要Polars/ML环境）|
| **AI Agent** | vnag 对话 | ⏳ | 三期 |

## 2. API 接口设计（我们要实现的）

### 2.1 认证（Auth）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/me` | 当前用户信息 |
| POST | `/api/auth/refresh` | 刷新Token |
| PUT | `/api/auth/password` | 修改密码 |

### 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "request_id": "uuid",
  "timestamp": 1710123456789
}
```

**错误码定义：**

| Code | 说明 |
|------|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如策略已存在）|
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
| 503 | 服务暂时不可用（如网关未连接）|

**错误响应示例：**
```json
{
  "code": 400,
  "message": "策略名称已存在: MyStrategy",
  "error_type": "StrategyExistsError",
  "data": null,
  "request_id": "uuid",
  "timestamp": 1710123456789
}
```

### 分页与过滤

列表接口统一支持：

```
GET /api/market/contracts?page=1&page_size=50&exchange=SHFE&keyword=rb
```

**参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码，从1开始 |
| page_size | int | 50 | 每页数量，最大100 |
| sort_by | string | - | 排序字段 |
| sort_order | string | asc | asc/desc |
| keyword | string | - | 关键词搜索 |

**分页响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "page_size": 50,
      "total": 1250,
      "total_pages": 25
    }
  }
}
```

---

### 2.2 系统管理

| 方法 | 路径 | 对应 vnpy API |
|------|------|--------------|
| GET | `/api/system/status` | MainEngine 状态汇总 |
| GET | `/api/system/gateways` | get_all_gateway_names() |
| GET | `/api/system/gateways/{name}/setting` | get_default_setting(name) |
| POST | `/api/system/gateways/{name}/connect` | connect(setting, name) |
| POST | `/api/system/gateways/{name}/disconnect` | disconnect(name) |
| GET | `/api/system/gateways/{name}/status` | 网关连接状态 |
| GET | `/api/system/apps` | get_all_apps() |
| GET | `/api/system/exchanges` | get_all_exchanges() |
| GET | `/api/system/logs` | EVENT_LOG 历史（分页）|
| GET | `/api/system/health` | 健康检查（不鉴权）|

### 2.3 行情数据

| 方法 | 路径 | 对应 vnpy API | 说明 |
|------|------|--------------|------|
| GET | `/api/market/contracts` | get_all_contracts() | 支持分页、过滤 |
| GET | `/api/market/contracts/{vt_symbol}` | get_contract(vt_symbol) | |
| GET | `/api/market/ticks` | get_all_ticks() | 支持 vt_symbols 批量查询 |
| GET | `/api/market/ticks/{vt_symbol}` | get_tick(vt_symbol) | |
| POST | `/api/market/subscribe` | subscribe(req) | 改为统一订阅入口 |
| POST | `/api/market/unsubscribe` | - | 取消订阅 |
| POST | `/api/market/subscriptions` | - | 查询当前订阅列表 |
| POST | `/api/market/history` | query_history(req, gateway) | 异步任务，返回 task_id |
| GET | `/api/market/history/{task_id}` | - | 查询历史数据下载进度 |

### 2.4 交易下单

| 方法 | 路径 | 对应 vnpy API | 说明 |
|------|------|--------------|------|
| POST | `/api/trading/orders` | send_order(req, gateway) | 下单 |
| DELETE | `/api/trading/orders/{vt_orderid}` | cancel_order(req, gateway) | 撤单 |
| POST | `/api/trading/orders/batch` | - | 批量下单（最大10笔）|
| DELETE | `/api/trading/orders/batch` | - | 批量撤单 |
| DELETE | `/api/trading/orders/active` | cancel_all | 全撤 |
| GET | `/api/trading/orders` | get_all_orders() | 支持分页、过滤 |
| GET | `/api/trading/orders/active` | get_all_active_orders() | 活跃委托 |
| GET | `/api/trading/trades` | get_all_trades() | 支持分页、按时间过滤 |
| GET | `/api/trading/positions` | get_all_positions() | 持仓列表 |
| GET | `/api/trading/positions/{vt_positionid}` | get_position(vt_positionid) | 持仓详情 |
| GET | `/api/trading/accounts` | get_all_accounts() | 账户列表 |
| GET | `/api/trading/accounts/{accountid}` | get_account(accountid) | 账户详情 |

### 2.5 CTA 策略管理

**并发控制说明：**
- 策略操作使用分布式锁，防止多用户同时操作同一策略
- 返回 423 Locked 状态码表示资源被其他用户锁定

| 方法 | 路径 | 对应 vnpy API | 说明 |
|------|------|--------------|------|
| GET | `/api/strategy/classes` | get_all_strategy_class_names() | 策略类列表 |
| GET | `/api/strategy/classes/{name}/params` | get_strategy_class_parameters(name) | 类参数 |
| GET | `/api/strategy/classes/{name}/code` | get_strategy_class_file(name) | 源码查看 |
| GET | `/api/strategy/instances` | - | 策略实例列表（支持分页）|
| GET | `/api/strategy/instances/{name}` | - | 策略详情 |
| POST | `/api/strategy/instances` | add_strategy(...) | 添加策略 |
| PUT | `/api/strategy/instances/{name}` | edit_strategy(name, setting) | 修改策略（需锁）|
| DELETE | `/api/strategy/instances/{name}` | remove_strategy(name) | 删除策略（需锁）|
| POST | `/api/strategy/instances/{name}/init` | init_strategy(name) | 初始化（需锁）|
| POST | `/api/strategy/instances/{name}/start` | start_strategy(name) | 启动策略（需锁）|
| POST | `/api/strategy/instances/{name}/stop` | stop_strategy(name) | 停止策略（需锁）|
| POST | `/api/strategy/instances/init-all` | init_all_strategies() | 批量初始化 |
| POST | `/api/strategy/instances/start-all` | start_all_strategies() | 批量启动 |
| POST | `/api/strategy/instances/stop-all` | stop_all_strategies() | 批量停止 |
| POST | `/api/strategy/instances/{name}/lock` | - | 获取策略锁（编辑前）|
| DELETE | `/api/strategy/instances/{name}/lock` | - | 释放策略锁 |
| GET | `/api/strategy/instances/{name}/variables` | get_strategy_parameters | 策略变量 |
| GET | `/api/strategy/instances/{name}/logs` | - | 策略日志（分页）|
| GET | `/api/strategy/instances/{name}/trades` | - | 策略成交（分页）|
| GET | `/api/strategy/instances/{name}/orders` | - | 策略委托（分页）|
| GET | `/api/strategy/instances/{name}/positions` | - | 策略持仓 |
| POST | `/api/strategy/instances/{name}/clone` | - | 克隆策略配置 |

### 2.6 回测引擎

**回测任务管理（支持并发执行多个回测）：**

| 方法 | 路径 | 对应 vnpy API | 说明 |
|------|------|--------------|------|
| GET | `/api/backtest/classes` | get_strategy_class_names() | |
| GET | `/api/backtest/classes/{name}/setting` | get_default_setting(name) | |
| POST | `/api/backtest/tasks` | start_backtesting(...) | 创建回测任务，返回 task_id |
| GET | `/api/backtest/tasks` | - | 回测任务列表 |
| GET | `/api/backtest/tasks/{task_id}` | - | 任务详情/进度 |
| DELETE | `/api/backtest/tasks/{task_id}` | - | 取消回测任务 |
| GET | `/api/backtest/tasks/{task_id}/result` | get_result_statistics() | 结果统计 |
| GET | `/api/backtest/tasks/{task_id}/daily` | get_all_daily_results() | 每日结果 |
| GET | `/api/backtest/tasks/{task_id}/trades` | get_all_trades() | 成交明细 |
| GET | `/api/backtest/tasks/{task_id}/orders` | get_all_orders() | 委托明细 |
| GET | `/api/backtest/tasks/{task_id}/chart` | get_result_values() | 资金曲线数据 |
| GET | `/api/backtest/tasks/{task_id}/report` | - | 生成回测报告(PDF) |
| POST | `/api/backtest/optimize` | start_optimization(...) | 参数优化（异步任务）|
| POST | `/api/backtest/download` | start_downloading(...) | 数据下载（异步任务）|

**回测任务状态：**
```json
{
  "task_id": "bt-uuid",
  "status": "running",  // pending/running/completed/failed/cancelled
  "progress": 45,
  "created_at": "2024-01-01T10:00:00Z",
  "started_at": "2024-01-01T10:00:05Z",
  "estimated_completion": "2024-01-01T10:02:00Z"
}
```

### 2.7 数据管理

| 方法 | 路径 | 对应 vnpy API |
|------|------|--------------|
| GET | `/api/data/overview` | get_bar_overview() |
| POST | `/api/data/download` | download_bar_data(...) |
| DELETE | `/api/data/delete` | delete_bar_data(...) |
| POST | `/api/data/import-csv` | import_data_from_csv(...) |
| POST | `/api/data/export-csv` | output_data_to_csv(...) |

### 2.8 风控管理

| 方法 | 路径 | 对应 vnpy API |
|------|------|--------------|
| GET | `/api/risk/rules` | get_all_rule_names() |
| GET | `/api/risk/rules/{name}` | get_rule_data(name) |
| PUT | `/api/risk/rules/{name}` | update_rule_setting(name, setting) |

### 2.9 模拟盘

| 方法 | 路径 | 对应 vnpy API |
|------|------|--------------|
| GET | `/api/paper/setting` | get_instant_trade(), get_trade_slippage() |
| PUT | `/api/paper/setting` | set_instant_trade(), set_trade_slippage() |
| POST | `/api/paper/clear` | clear_position() |

### 2.10 WebSocket 事件

**连接与鉴权：**
```
WS /ws?token={jwt_token}
```

**连接后鉴权（替代方案，Token 不暴露在 URL）：**
```json
// Client → Server
{
  "type": "auth",
  "token": "jwt_token_here"
}

// Server → Client
{
  "type": "auth_response",
  "success": true,
  "message": "Authenticated"
}
```

**心跳机制：**
```json
// Client → Server (每 30 秒)
{
  "type": "ping",
  "timestamp": 1710123456789
}

// Server → Client
{
  "type": "pong",
  "timestamp": 1710123456789,
  "server_time": 1710123456790
}
```

**订阅管理：**
```json
// 订阅行情
{
  "type": "subscribe",
  "topics": ["tick:rb2505.SHFE", "tick:cu2505.SHFE"]
}

// 取消订阅
{
  "type": "unsubscribe",
  "topics": ["tick:cu2505.SHFE"]
}

// 订阅确认
{
  "type": "subscribe_response",
  "subscribed": ["tick:rb2505.SHFE"],
  "failed": ["tick:INVALID.CFFEX"]
}
```

**数据推送消息格式：**
```json
{
  "type": "event",
  "topic": "tick",
  "data": { ...TickData... },
  "timestamp": 1710123456789
}
```

**事件类型：**

| topic | data | 说明 |
|-------|------|------|
| `tick` | TickData | 行情更新 |
| `order` | OrderData | 委托更新 |
| `trade` | TradeData | 成交回报 |
| `position` | PositionData | 持仓更新 |
| `account` | AccountData | 账户更新 |
| `contract` | ContractData | 合约推送 |
| `log` | {level, msg, source} | 系统日志 |
| `strategy_status` | {name, status, timestamp} | 策略状态变更 |
| `strategy_variable` | {name, variables, timestamp} | 策略变量更新 |
| `backtest_progress` | {task_id, progress, msg} | 回测进度 |
| `gateway_status` | {name, status} | 网关连接状态 |
| `error` | {code, message, request_id} | 错误通知 |

## 3. 前端页面设计

### 3.1 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 框架 | Semi Design 2 (@douyinfe/semi-ui) |
| 主题 | 圆角 12px |
| 图标 | Semi Icons (@douyinfe/semi-icons) |
| 图表 | ECharts 6 |
| 状态管理 | Zustand |
| HTTP | Axios |
| 实时 | WebSocket |

### 3.2 页面结构

```
App
├── 登录页
│   ├── 用户名/密码输入
│   ├── 记住登录
│   └── 登录按钮
│
├── 主布局（登录后）
│   ├── 顶部应用栏（Logo + 系统状态 + 用户菜单）
│   ├── 侧边导航（可折叠）
│   └── 内容区域
│
├── Dashboard（总览）
│   ├── 账户资金卡片
│   ├── 持仓表格
│   ├── 今日盈亏曲线
│   ├── 活跃委托
│   └── 系统日志
│
├── 行情中心
│   ├── 合约搜索/列表
│   ├── 实时行情表格（五档）
│   ├── K线图（ECharts）
│   └── 分时图
│
├── 交易面板
│   ├── 下单表单
│   ├── 五档盘口
│   ├── 活跃委托（可撤单）
│   ├── 最新成交
│   └── 持仓明细
│
├── 策略管理
│   ├── 策略类市场（卡片网格）
│   ├── 已部署策略表格
│   ├── 添加策略向导（三步）
│   ├── 策略详情（7个Tab）
│   └── 批量操作
│
├── 回测中心
│   ├── 回测配置表单
│   ├── 结果统计卡片
│   ├── 资金曲线图
│   ├── 交易明细表
│   └── 参数优化
│
├── 数据管理
│   ├── 数据概览表格
│   ├── 下载/删除
│   └── CSV导入导出
│
├── 风控设置
│   ├── 规则列表
│   └── 规则参数修改
│
├── 系统设置
│   ├── 网关管理
│   └── 模拟盘设置
│
└── AI 助手（三期）
    └── 对话界面
```

### 3.3 核心组件

- **K线图**：ECharts，支持周期切换、指标叠加、实时更新
- **行情表格**：虚拟滚动、五档展示、涨跌颜色
- **下单组件**：品种选择、方向切换、数量快捷、盘口填价
- **策略卡片**：状态灯、变量展示、快捷操作
- **策略详情**：Material Tabs（概览/参数/变量/日志/交易/持仓/代码）
- **回测结果**：统计卡片 + 资金曲线 + 交易明细

## 4. 鉴权设计

### 4.1 JWT 认证（改进版）

**双 Token 机制：**

| Token | 有效期 | 用途 | 存储位置 |
|-------|--------|------|----------|
| Access Token | 15 分钟 | API 鉴权 | httpOnly Cookie |
| Refresh Token | 7 天 | 刷新 Access Token | httpOnly Cookie |
| Remember Token | 30 天 | 记住登录 | httpOnly Cookie（可选）|

**为什么不存 localStorage：**
- localStorage 易受 XSS 攻击
- httpOnly Cookie 无法被 JavaScript 读取，安全性更高

**传输方式：**
- HTTP：Cookie 自动携带（需配置 `credentials: include`）
- WebSocket：连接后发送 `auth` 消息携带 token

**刷新机制：**
```
Client → POST /api/auth/refresh (携带 Refresh Token Cookie)
Server → 返回新的 Access Token Cookie
```

### 4.2 限流设计

**API 限流：**

| 接口类型 | 限流策略 | 说明 |
|----------|----------|------|
| 交易接口 | 10 req/s per user | 防止频繁下单 |
| 行情查询 | 100 req/min per user | |
| 回测启动 | 5 req/min per user | 资源消耗大 |
| 登录接口 | 5 req/min per IP | 防止暴力破解 |
| WebSocket | 100 msg/s per connection | 防止消息轰炸 |

**限流响应：**
```json
{
  "code": 429,
  "message": "Too many requests, retry after 60s",
  "retry_after": 60
}
```

### 4.3 用户表（SQLite/PostgreSQL）

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,  -- bcrypt hash
  role TEXT DEFAULT 'trader' CHECK (role IN ('admin', 'trader', 'viewer')),
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  login_attempts INTEGER DEFAULT 0,
  locked_until DATETIME  -- 登录失败锁定
);

CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,  -- token 的哈希值
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME,  -- 撤销时间
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,  -- e.g., 'send_order', 'start_strategy'
  resource_type TEXT,    -- e.g., 'order', 'strategy'
  resource_id TEXT,
  params TEXT,           -- JSON
  result TEXT,           -- success/failure
  error_message TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 用户表

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT DEFAULT 'trader',
  created_at DATETIME,
  last_login DATETIME,
  is_active BOOLEAN DEFAULT 1
);
```

### 4.4 角色与权限矩阵

**角色定义：**

| 角色 | 权限 |
|------|------|
| admin | 全部功能 + 用户管理 + 系统配置 |
| trader | 行情/交易/策略/回测/数据（完整交易权限）|
| viewer | 只读（查看行情/持仓/策略状态/日志）|

**资源级权限控制（RBAC）：**

| 资源 | admin | trader | viewer |
|------|-------|--------|--------|
| 行情查看 | ✅ | ✅ | ✅ |
| 下单交易 | ✅ | ✅ | ❌ |
| 撤单 | ✅ | ✅ | ❌ |
| 策略查看 | ✅ | ✅ | ✅ |
| 策略启停 | ✅ | ✅ | ❌ |
| 策略删除 | ✅ | 自己的 ✅ | ❌ |
| 回测执行 | ✅ | ✅ | ❌ |
| 数据下载 | ✅ | ✅ | ❌ |
| 数据删除 | ✅ | ✅ | ❌ |
| 风控修改 | ✅ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ |
| 系统设置 | ✅ | ❌ | ❌ |

## 5. 后端架构

```
backend/
├── main.py                   # FastAPI 入口
├── config.py                 # 配置
├── database.py               # 数据库连接（SQLAlchemy）
├── cache.py                  # Redis 缓存
├── rate_limit.py             # 限流中间件
├── auth/
│   ├── jwt.py               # JWT 处理
│   ├── password.py          # 密码哈希
│   └── middleware.py        # 鉴权中间件
├── bridge.py                # vnpy 桥接（核心）
├── ws_manager.py            # WebSocket 管理
├── routers/
│   ├── auth.py
│   ├── system.py
│   ├── market.py
│   ├── trading.py
│   ├── strategy.py
│   ├── backtest.py
│   ├── data.py
│   ├── risk.py
│   └── paper.py
├── services/
│   ├── strategy_lock.py     # 策略锁服务
│   ├── backtest_runner.py   # 回测任务管理
│   └── data_sync.py         # 数据同步
├── models/
│   └── *.py                 # SQLAlchemy 模型
└── schemas/
    └── *.py                 # Pydantic 模型
```

### 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| Web 框架 | FastAPI | 异步高性能，自动生成文档 |
| 数据库 | SQLite / PostgreSQL | SQLite 单用户，PostgreSQL 多用户 |
| 缓存 | Redis | Token 存储、限流计数、行情缓存 |
| ORM | SQLAlchemy 2.0 | 类型提示支持 |
| 任务队列 | Celery + Redis | 回测、数据下载等异步任务 |
| WebSocket | python-socketio | 支持房间/命名空间 |

### bridge.py 核心类

```python
class VnpyBridge:
    """vnpy 引擎桥接单例（线程安全）"""
    event_engine: EventEngine
    main_engine: MainEngine
    cta_engine: CtaEngine
    backtester_engine: BacktesterEngine
    manager_engine: ManagerEngine
    risk_engine: RiskEngine
    paper_engine: PaperEngine

    # 线程安全的数据查询（加锁）
    def get_all_ticks(self) -> list[dict]
    def get_all_positions(self) -> list[dict]
    ...

    # 交易操作
    def send_order(self, req: dict, user_id: str) -> str
    def cancel_order(self, req: dict, user_id: str) -> None

    # 策略操作（带锁检查）
    def add_strategy(self, ..., user_id: str) -> None
    def start_strategy(self, name: str, user_id: str) -> None
    ...

    # 策略锁管理
    def acquire_strategy_lock(self, name: str, user_id: str, ttl: int = 300) -> bool
    def release_strategy_lock(self, name: str, user_id: str) -> bool
    def get_strategy_lock_holder(self, name: str) -> str | None

    # 事件回调注册
    def register_ws_callback(self, callback: Callable)

    # 订阅管理
    def subscribe(self, vt_symbols: list[str], client_id: str) -> None
    def unsubscribe(self, vt_symbols: list[str], client_id: str) -> None
```

## 6. 开发阶段（调整版）

### 第一阶段：MVP（最小可用）
1. 后端框架 + 数据库 + Redis
2. JWT 认证（httpOnly Cookie）
3. vnpy 桥接 + 事件系统
4. WebSocket + 心跳机制
5. 前端项目搭建（React + MUI）
6. 登录页 + 主布局
7. Dashboard（账户/持仓/日志）
8. 行情中心（合约列表 + 实时Tick）
9. 交易面板（下单/撤单/委托/成交）

### 第二阶段：策略 + 回测
10. 策略锁机制 + 并发控制
11. 策略管理页（增删改查 + 启停）
12. 策略详情（参数/变量/日志/交易）
13. 回测中心（异步任务 + 进度推送）
14. 回测结果（统计 + 资金曲线 + 报告）
15. 数据管理页（下载/导入/导出）

### 第三阶段：高级功能
16. 风控设置页
17. 模拟盘设置
18. 期权交易（OptionMaster）
19. 投资组合（PortfolioManager）
20. 价差交易（SpreadTrading）

### 第四阶段
21. AI Agent（vnag）
22. Alpha 研究
23. 算法交易
24. Tick 数据管理

## 7. 部署建议

### 单用户部署（开发/个人使用）
```yaml
# docker-compose.yml
services:
  vnpy-web:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./vnpy_data:/app/vnpy_data
    environment:
      - DATABASE_URL=sqlite:///app/vnpy_data/vnpy.db
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-secret-key
  redis:
    image: redis:alpine
```

### 多用户部署（生产环境）
```yaml
# 需要 PostgreSQL + Redis Cluster + Nginx
services:
  vnpy-web:
    build: .
    replicas: 2  # 负载均衡
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres/vnpy
      - REDIS_URL=redis://redis-cluster:6379
  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
  nginx:
    image: nginx:alpine
    # 反向代理 + SSL + 限流
```

---

## 附录：不实现的功能及原因

| 功能 | 原因 | 替代方案 |
|------|------|---------|
| ScriptEngine | 脚本引擎用于 REPL/命令行交互，Web 端不适用 | Web 端通过策略管理 + CtaTemplate 实现类似功能 |
| convert_order_request | 内部方法，主要用于锁仓/净仓转换逻辑 | Web 端直接调用 send_order |
| update_order_request | 改单功能，大部分交易所不支持 | 撤单后重新下单 |
| load_bar/load_tick（CtaTemplate） | 策略内部方法，用于策略初始化时加载数据 | Web 端无需暴露，由策略自行调用 |
| send_limit_order/send_server_order | CtaEngine 内部辅助方法 | Web 端统一使用 send_order |
| query_bar_from_datafeed | 内部数据查询方法 | Web 端通过 DataManager API 下载数据 |
| process_*_event | 事件处理内部回调 | 由 bridge 层统一处理，WebSocket 推送 |
| 本地文件系统操作 | 安全限制，Web 端无法直接访问服务器文件系统 | 通过上传/下载 API 进行文件传输 |

---

## 变更日志

### v2.1 (2024-03-30)
- 修正 REST API 设计，统一资源命名规范
- 添加统一响应格式和错误码定义
- 添加分页与过滤参数
- 改进 JWT 鉴权，使用 httpOnly Cookie 替代 localStorage
- 添加双 Token 刷新机制
- 添加 WebSocket 心跳机制
- 添加限流设计
- 添加策略锁机制（并发控制）
- 添加回测异步任务管理
- 修正数据对象字段（AccountData, PositionData 等）
- 添加 OptionMaster、PortfolioManager、SpreadTrading 引擎 API
- 添加数据库选型说明和部署建议
