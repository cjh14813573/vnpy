# VeighNa Web 前端设计说明书 v2

## 文档结构说明

本文档分为两部分：
- **第一部分：vnpy 完整 API 参考** — 列出 vnpy 所有公开 API（只读参考）
- **第二部分：实现范围与设计** — 我们选择实现的 Web 功能与具体设计

---

# 第一部分：vnpy 完整 API 参考

> 以下是 vnpy 4.3.0 所有引擎、模块的公开方法完整列表，作为技术参考。

## 1. MainEngine（主引擎）

```
add_app(app_class) -> BaseEngine
add_engine(engine_class) -> Engine
add_gateway(gateway_class, gateway_name='') -> BaseGateway
cancel_order(req: CancelRequest, gateway_name) -> None
cancel_quote(req: CancelRequest, gateway_name) -> None
close() -> None
connect(setting: dict, gateway_name) -> None
get_all_apps() -> list[BaseApp]
get_all_exchanges() -> list[Exchange]
get_all_gateway_names() -> list[str]
get_default_setting(gateway_name) -> dict | None
get_engine(engine_name) -> BaseEngine | None
get_gateway(gateway_name) -> BaseGateway | None
init_engines() -> None
query_history(req: HistoryRequest, gateway_name) -> list[BarData]
send_order(req: OrderRequest, gateway_name) -> str
send_quote(req: QuoteRequest, gateway_name) -> str
subscribe(req: SubscribeRequest, gateway_name) -> None
write_log(msg, source='MainEngine') -> None
```

**MainEngine 实例方法（运行时绑定）：**
```
get_account(vt_accountid) -> AccountData | None
get_all_accounts() -> list[AccountData]
get_all_active_orders() -> list[OrderData]
get_all_active_quotes() -> list[QuoteData]
get_all_contracts() -> list[ContractData]
get_all_orders() -> list[OrderData]
get_all_positions() -> list[PositionData]
get_all_quotes() -> list[QuoteData]
get_all_ticks() -> list[TickData]
get_all_trades() -> list[TradeData]
get_contract(vt_symbol) -> ContractData | None
get_order(vt_orderid) -> OrderData | None
get_position(vt_positionid) -> PositionData | None
get_quote(vt_quoteid) -> QuoteData | None
get_tick(vt_symbol) -> TickData | None
get_trade(vt_tradeid) -> TradeData | None
convert_order_request(req, gateway_name, lock, net) -> list[OrderRequest]
update_order_request(req, vt_orderid, gateway_name) -> None
send_email(subject, content, receiver) -> None
```

## 2. CtaEngine（CTA策略引擎）

```
add_strategy(class_name, strategy_name, vt_symbol, setting) -> None
edit_strategy(strategy_name, setting) -> None
remove_strategy(strategy_name) -> bool
get_all_strategy_class_names() -> list
get_strategy_class_parameters(class_name) -> dict
get_strategy_parameters(strategy_name) -> dict
init_strategy(strategy_name) -> Future
init_all_strategies() -> dict[str, Future]
start_strategy(strategy_name) -> None
start_all_strategies() -> None
stop_strategy(strategy_name) -> None
stop_all_strategies() -> None
load_strategy_class() -> None
load_strategy_class_from_folder(path, module_name) -> None
load_strategy_class_from_module(module_name) -> None
load_strategy_setting() -> None
load_strategy_data() -> None
update_strategy_setting(strategy_name, setting) -> None
remove_strategy_setting(strategy_name) -> None
sync_strategy_data(strategy) -> None
write_log(msg, strategy) -> None
send_email(msg, strategy) -> None
# 内部方法（策略调用）
send_order(strategy, direction, offset, price, volume, stop, lock, net) -> list
send_limit_order(strategy, contract, direction, offset, price, volume, lock, net) -> list
send_server_order(strategy, contract, direction, offset, price, volume, type, lock, net) -> list
send_local_stop_order(...) -> list
send_server_stop_order(...) -> list
cancel_order(strategy, vt_orderid) -> None
cancel_all(strategy) -> None
cancel_local_stop_order(strategy, stop_orderid) -> None
cancel_server_order(strategy, vt_orderid) -> None
load_bar(vt_symbol, days, interval, callback, use_database) -> list[BarData]
load_tick(vt_symbol, days, callback) -> list[TickData]
query_bar_from_datafeed(symbol, exchange, interval, start, end) -> list[BarData]
get_pricetick(strategy) -> float | None
get_size(strategy) -> int | None
get_engine_type() -> EngineType
```

## 3. BacktesterEngine（回测引擎）

```
get_strategy_class_names() -> list
get_strategy_class_file(class_name) -> str
get_default_setting(class_name) -> dict
load_strategy_class() -> None
load_strategy_class_from_folder(path, module_name) -> None
load_strategy_class_from_module(module_name) -> None
reload_strategy_class() -> None
start_backtesting(class_name, vt_symbol, interval, start, end, rate, slippage, size, pricetick, capital, setting) -> bool
run_backtesting(...) -> None
start_optimization(class_name, vt_symbol, interval, start, end, rate, slippage, size, pricetick, capital, optimization_setting, use_ga, max_workers) -> bool
run_optimization(...) -> None
start_downloading(vt_symbol, interval, start, end) -> bool
run_downloading(...) -> None
get_result_statistics() -> dict | None
get_result_values() -> list | None
get_result_df() -> DataFrame | None
get_all_trades() -> list
get_all_orders() -> list
get_all_daily_results() -> list
get_history_data() -> list
write_log(msg) -> None
init_engine() -> None
init_datafeed() -> None
close() -> None
```

## 4. ManagerEngine（数据管理引擎）

```
get_bar_overview() -> list[BarOverview]
load_bar_data(symbol, exchange, interval, start, end) -> list[BarData]
download_bar_data(symbol, exchange, interval, start, output) -> int
delete_bar_data(symbol, exchange, interval) -> int
import_data_from_csv(file_path, symbol, exchange, interval, tz_name, datetime_head, open_head, high_head, low_head, close_head, volume_head, turnover_head, open_interest_head, datetime_format) -> tuple
output_data_to_csv(file_path, symbol, exchange, interval, start, end) -> bool
download_tick_data(symbol, exchange, start, output) -> int
close() -> None
```

## 5. RiskEngine（风控引擎）

```
add_rule(rule_class) -> None
get_all_rule_names() -> list[str]
get_rule_data(rule_name) -> dict
update_rule_setting(rule_name, rule_setting) -> None
load_rules() -> None
load_rules_from_folder(folder_path, module_name) -> None
load_rules_from_module(module_name) -> None
check_allowed(req, gateway_name) -> bool
send_order(req, gateway_name) -> str
get_contract(vt_symbol) -> ContractData | None
get_field_name(field) -> str
write_log(msg) -> None
close() -> None
```

## 6. PaperEngine（模拟盘引擎）

```
send_order(req, gateway_name) -> str
cancel_order(req, gateway_name) -> None
send_quote(req, gateway_name) -> str
cancel_quote(req, gateway_name) -> None
subscribe(req, gateway_name) -> None
query_history(req, gateway_name) -> list[BarData]
get_position(vt_symbol, direction) -> PositionData
clear_position() -> None
get_instant_trade() -> bool
set_instant_trade(instant_trade) -> None
get_trade_slippage() -> int
set_trade_slippage(trade_slippage) -> None
get_timer_interval() -> int
set_timer_interval(timer_interval) -> None
load_setting() -> None
save_setting() -> None
load_data() -> None
save_data() -> None
write_log(msg) -> None
close() -> None
```

## 7. AlgoEngine（算法交易引擎）

```
add_algo_template(template) -> None
get_algo_template() -> dict
start_algo(template_name, vt_symbol, direction, offset, price, volume, setting) -> str
stop_algo(algo_name) -> None
pause_algo(algo_name) -> None
resume_algo(algo_name) -> None
stop_all() -> None
send_order(algo, direction, price, volume, order_type, offset) -> str
cancel_order(algo, vt_orderid) -> None
get_contract(algo) -> ContractData | None
get_tick(algo) -> TickData | None
subscribe(symbol, exchange, gateway_name) -> None
write_log(msg, algo) -> None
init_engine() -> None
load_algo_template() -> None
close() -> None
```

## 8. ScriptEngine（脚本交易引擎）

```
# 快捷下单
buy(vt_symbol, price, volume, order_type=LIMIT) -> str
sell(vt_symbol, price, volume, order_type=LIMIT) -> str
short(vt_symbol, price, volume, order_type=LIMIT) -> str
cover(vt_symbol, price, volume, order_type=LIMIT) -> str
send_order(vt_symbol, price, volume, direction, offset, order_type) -> str
cancel_order(vt_orderid) -> None
# 数据查询
get_tick(vt_symbol, use_df=False) -> TickData | None
get_ticks(vt_symbols, use_df=False) -> list[TickData] | DataFrame
get_bars(vt_symbol, start_date, interval, use_df=False) -> list[BarData]
get_contract(vt_symbol, use_df=False) -> ContractData | None
get_contracts(vt_symbols, use_df=False) -> list[ContractData] | DataFrame
get_order(vt_orderid, use_df=False) -> OrderData | None
get_orders(vt_orderids, use_df=False) -> list[OrderData] | DataFrame
get_all_contracts(use_df=False) -> list[ContractData] | DataFrame
get_all_positions(use_df=False) -> list[PositionData] | DataFrame
get_all_accounts(use_df=False) -> list[AccountData] | DataFrame
get_all_active_orders(use_df=False) -> list[OrderData] | DataFrame
get_position(vt_positionid, use_df=False) -> PositionData | None
get_position_by_symbol(vt_symbol, direction, use_df=False) -> PositionData | None
get_account(vt_accountid, use_df=False) -> AccountData | None
get_trades(vt_orderid, use_df=False) -> list[TradeData] | DataFrame
# 订阅
subscribe(vt_symbols) -> None
# 脚本策略
run_strategy(script_path) -> None
start_strategy(script_path) -> None
stop_strategy() -> None
# 网关
connect_gateway(setting, gateway_name) -> None
# 其他
send_email(msg) -> None
write_log(msg) -> None
init() -> None
close() -> None
```

## 9. AlphaLab（AI量化研究）

```
# 数据加载
load_bar_data(vt_symbol, interval, start, end) -> list[BarData]
load_bar_df(vt_symbols, interval, start, end, extended_days) -> DataFrame | None
save_bar_data(bars) -> None
# 合约设置
add_contract_setting(vt_symbol, long_rate, short_rate, size, pricetick) -> None
load_contract_settings() -> dict
# 指数成分
load_component_symbols(index_symbol, start, end) -> list[str]
load_component_filters(index_symbol, start, end) -> dict[str, list[tuple]]
save_component_data(index_symbol, index_components) -> None
# 数据集
save_dataset(name, dataset) -> None
load_dataset(name) -> AlphaDataset | None
remove_dataset(name) -> bool
list_all_datasets() -> list[str]
# 模型
save_model(name, model) -> None
load_model(name) -> AlphaModel | None
remove_model(name) -> bool
list_all_models() -> list[str]
# 信号
save_signal(name, signal) -> None
load_signal(name) -> DataFrame | None
remove_signal(name) -> bool
list_all_signals() -> list[str]
```

## 10. BaseDatabase（数据库接口）

```
save_bar_data(bars, stream=False) -> bool
load_bar_data(symbol, exchange, interval, start, end) -> list[BarData]
delete_bar_data(symbol, exchange, interval) -> int
get_bar_overview() -> list[BarOverview]
save_tick_data(ticks, stream=False) -> bool
load_tick_data(symbol, exchange, start, end) -> list[TickData]
delete_tick_data(symbol, exchange) -> int
get_tick_overview() -> list[TickOverview]
```

## 11. BaseDatafeed（数据源接口）

```
init(output=print) -> bool
query_bar_history(req: HistoryRequest, output) -> list[BarData]
query_tick_history(req: HistoryRequest, output) -> list[TickData]
```

## 12. CtaTemplate（策略模板基类）

```
# 生命周期回调
on_init() -> None
on_start() -> None
on_stop() -> None
on_bar(bar: BarData) -> None
on_tick(tick: TickData) -> None
on_order(order: OrderData) -> None
on_trade(trade: TradeData) -> None
on_stop_order(stop_order: StopOrder) -> None
# 下单
buy(price, volume, stop=False, lock=False, net=False) -> list
sell(price, volume, stop=False, lock=False, net=False) -> list
short(price, volume, stop=False, lock=False, net=False) -> list
cover(price, volume, stop=False, lock=False, net=False) -> list
send_order(direction, offset, price, volume, stop=False, lock=False, net=False) -> list
cancel_order(vt_orderid) -> None
cancel_all() -> None
# 数据
load_bar(days, interval=MINUTE, callback, use_database=False) -> None
load_tick(days) -> None
# 信息
get_parameters() -> dict
get_variables() -> dict
get_data() -> dict
get_pricetick() -> float
get_size() -> int
get_engine_type() -> EngineType
# 其他
update_setting(setting) -> None
sync_data() -> None
put_event() -> None
write_log(msg) -> None
send_email(msg) -> None
```

## 13. 数据对象字段

### TickData
```
symbol, exchange, datetime, name, volume, turnover, open_interest,
last_price, last_volume, limit_up, limit_down, open_price, high_price,
low_price, pre_close, bid_price_1~5, bid_volume_1~5, ask_price_1~5,
ask_volume_1~5, localtime, gateway_name
```

### BarData
```
symbol, exchange, datetime, interval, open_price, high_price, low_price,
close_price, volume, turnover, open_interest, gateway_name
```

### OrderData
```
symbol, exchange, orderid, type, direction, offset, price, volume,
traded, status, datetime, reference, gateway_name
```

### TradeData
```
symbol, exchange, orderid, tradeid, direction, offset, price, volume,
datetime, gateway_name
```

### PositionData
```
symbol, exchange, direction, volume, frozen, price, pnl, yd_volume, gateway_name
```

### AccountData
```
accountid, balance, frozen, gateway_name
```

### ContractData
```
symbol, exchange, name, product, size, pricetick, min_volume, max_volume,
stop_supported, net_position, history_data, option_strike, option_underlying,
option_type, option_listed, option_expiry, option_portfolio, option_index, gateway_name
```

### QuoteData（期权询价）
```
symbol, exchange, quoteid, bid_price, bid_volume, ask_price, ask_volume,
bid_offset, ask_offset, status, datetime, reference, gateway_name
```

### LogData
```
msg, level, gateway_name
```

## 14. 请求对象

### SubscribeRequest
```
symbol, exchange
```

### OrderRequest
```
symbol, exchange, direction, type, volume, price, offset, reference
```

### CancelRequest
```
orderid, symbol, exchange
```

### HistoryRequest
```
symbol, exchange, start, end, interval
```

### QuoteRequest
```
symbol, exchange, bid_price, bid_volume, ask_price, ask_volume,
bid_offset, ask_offset, reference
```

## 15. 事件常量

```
EVENT_TICK = "eTick."
EVENT_TRADE = "eTrade."
EVENT_ORDER = "eOrder."
EVENT_POSITION = "ePosition."
EVENT_ACCOUNT = "eAccount."
EVENT_QUOTE = "eQuote."
EVENT_CONTRACT = "eContract."
EVENT_LOG = "eLog"
```

## 16. 枚举常量

### Direction
```
LONG = "多"    # 做多
SHORT = "空"   # 做空
NET = "净"     # 净持仓
```

### Offset
```
NONE = ""           # 无（股票）
OPEN = "开"         # 开仓
CLOSE = "平"        # 平仓
CLOSETODAY = "平今" # 平今仓
CLOSEYESTERDAY = "平昨" # 平昨仓
```

### Status
```
SUBMITTING = "提交中"
NOTTRADED = "未成交"
PARTTRADED = "部分成交"
ALLTRADED = "全部成交"
CANCELLED = "已撤销"
REJECTED = "拒单"
```

### OrderType
```
LIMIT = "限价"
MARKET = "市价"
STOP = "停止"
FAK = "FAK"
FOK = "FOK"
```

### Interval
```
TICK = "tick"
MINUTE = "1m"
HOUR = "1h"
DAILY = "d"
WEEKLY = "w"
```

---
