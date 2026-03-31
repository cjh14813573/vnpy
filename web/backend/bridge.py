"""vnpy 引擎桥接层

将 vnpy 的 MainEngine 及各功能引擎封装为线程安全的 Web API 可调用接口。
事件引擎的回调会推送到 WebSocket 管理器。
"""

import asyncio
import importlib
import inspect
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

from vnpy.event import EventEngine, Event
from vnpy.trader.engine import MainEngine
from vnpy.trader.object import (
    OrderRequest, CancelRequest, SubscribeRequest, HistoryRequest,
    LogData, TickData, OrderData, TradeData, PositionData, AccountData,
    ContractData,
)
from vnpy.trader.constant import Exchange, Direction, OrderType, Interval
from vnpy.trader.event import (
    EVENT_TICK, EVENT_ORDER, EVENT_TRADE, EVENT_POSITION,
    EVENT_ACCOUNT, EVENT_CONTRACT, EVENT_LOG,
)


class VnpyBridge:
    """vnpy 引擎桥接单例"""

    _instance: Optional["VnpyBridge"] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._event_engine: Optional[EventEngine] = None
        self._main_engine: Optional[MainEngine] = None
        self._ws_callbacks: list[Callable] = []
        self._log_history: list[dict] = []
        self._max_log_history = 500
        self._init_lock = threading.Lock()

    @property
    def main_engine(self) -> MainEngine:
        self.ensure_init()
        if self._main_engine is None:
            raise RuntimeError("vnpy 引擎初始化失败，请检查 vnpy 安装")
        return self._main_engine

    @property
    def event_engine(self) -> EventEngine:
        self.ensure_init()
        if self._event_engine is None:
            raise RuntimeError("vnpy 引擎初始化失败")
        return self._event_engine

    def init(self):
        """初始化引擎（线程安全）"""
        with self._init_lock:
            if self._main_engine is not None:
                return

            try:
                self._event_engine = EventEngine()
                self._main_engine = MainEngine(self._event_engine)

                # 添加 CTA 策略应用
                try:
                    from vnpy_ctastrategy import CtaStrategyApp
                    self._main_engine.add_app(CtaStrategyApp)
                except Exception as e:
                    print(f"[Bridge] Failed to add CtaStrategyApp: {e}")

                # 添加模拟交易应用
                try:
                    from vnpy_paperaccount import PaperAccountApp
                    self._main_engine.add_app(PaperAccountApp)
                except Exception as e:
                    print(f"[Bridge] Failed to add PaperAccountApp: {e}")

                # 添加算法交易应用
                try:
                    from vnpy_algotrading import AlgoTradingApp
                    self._main_engine.add_app(AlgoTradingApp)
                except Exception as e:
                    print(f"[Bridge] Failed to add AlgoTradingApp: {e}")

                # 注册事件回调
                self._register_event(EVENT_TICK, self._on_tick)
                self._register_event(EVENT_ORDER, self._on_order)
                self._register_event(EVENT_TRADE, self._on_trade)
                self._register_event(EVENT_POSITION, self._on_position)
                self._register_event(EVENT_ACCOUNT, self._on_account)
                self._register_event(EVENT_CONTRACT, self._on_contract)
                self._register_event(EVENT_LOG, self._on_log)
            except Exception:
                # vnpy 引擎初始化失败时记录但不断裂应用
                self._event_engine = None
                self._main_engine = None

    def ensure_init(self):
        """确保引擎已初始化"""
        if self._main_engine is None:
            self.init()

    def _register_event(self, event_type: str, handler: Callable):
        """注册事件处理"""
        self._event_engine.register(event_type, handler)

    def register_ws_callback(self, callback: Callable):
        """注册 WebSocket 推送回调"""
        self._ws_callbacks.append(callback)

    def _emit_ws(self, topic: str, data: dict, symbol: str = None):
        """触发 WebSocket 推送（非阻塞，带订阅过滤）

        Args:
            topic: 事件类型
            data: 事件数据
            symbol: 合约代码（用于订阅过滤）
        """
        for cb in self._ws_callbacks:
            try:
                # 回调可能是协程函数
                if asyncio.iscoroutinefunction(cb):
                    asyncio.run_coroutine_threadsafe(cb(topic, data, symbol), asyncio.get_event_loop())
                else:
                    cb(topic, data, symbol)
            except Exception:
                pass

    # ============ 事件回调 ============

    def _on_tick(self, event: Event):
        tick: TickData = event.data
        tick_dict = self._tick_to_dict(tick)
        # tick 按 vt_symbol 过滤推送
        vt_symbol = tick_dict.get("vt_symbol")
        self._emit_ws("tick", tick_dict, vt_symbol)

    def _on_order(self, event: Event):
        order: OrderData = event.data
        order_dict = self._order_to_dict(order)
        # order 按 vt_symbol 过滤推送
        vt_symbol = order_dict.get("vt_symbol")
        self._emit_ws("order", order_dict, vt_symbol)

    def _on_trade(self, event: Event):
        trade: TradeData = event.data
        trade_dict = self._trade_to_dict(trade)
        # trade 按 vt_symbol 过滤推送
        vt_symbol = trade_dict.get("vt_symbol")
        self._emit_ws("trade", trade_dict, vt_symbol)

    def _on_position(self, event: Event):
        pos: PositionData = event.data
        pos_dict = self._position_to_dict(pos)
        # position 按 vt_symbol 过滤推送
        vt_symbol = pos_dict.get("vt_symbol")
        self._emit_ws("position", pos_dict, vt_symbol)

    def _on_account(self, event: Event):
        account: AccountData = event.data
        account_dict = self._account_to_dict(account)
        # account 全量推送（不属于特定合约）
        self._emit_ws("account", account_dict, None)

    def _on_contract(self, event: Event):
        contract: ContractData = event.data
        contract_dict = self._contract_to_dict(contract)
        # contract 全量推送（新合约通知）
        self._emit_ws("contract", contract_dict, None)

    def _on_log(self, event: Event):
        log: LogData = event.data
        log_dict = {
            "msg": log.msg,
            "level": log.level,
            "time": log.time.isoformat() if log.time else None,
            "gateway_name": log.gateway_name,
        }
        self._log_history.append(log_dict)
        if len(self._log_history) > self._max_log_history:
            self._log_history = self._log_history[-self._max_log_history:]
        # log 全量推送
        self._emit_ws("log", log_dict, None)

    # ============ 数据转换 ============

    @staticmethod
    def _tick_to_dict(tick: TickData) -> dict:
        return {
            "symbol": tick.symbol,
            "exchange": tick.exchange.value if tick.exchange else "",
            "vt_symbol": f"{tick.symbol}.{tick.exchange.value}" if tick.exchange else tick.symbol,
            "gateway_name": tick.gateway_name,
            "name": tick.name,
            "last_price": tick.last_price,
            "volume": tick.volume,
            "turnover": tick.turnover,
            "open_interest": tick.open_interest,
            "datetime": tick.datetime.isoformat() if tick.datetime else None,
            "bid_price_1": tick.bid_price_1,
            "bid_volume_1": tick.bid_volume_1,
            "ask_price_1": tick.ask_price_1,
            "ask_volume_1": tick.ask_volume_1,
            "bid_price_2": tick.bid_price_2,
            "bid_volume_2": tick.bid_volume_2,
            "ask_price_2": tick.ask_price_2,
            "ask_volume_2": tick.ask_volume_2,
            "bid_price_3": tick.bid_price_3,
            "bid_volume_3": tick.bid_volume_3,
            "ask_price_3": tick.ask_price_3,
            "ask_volume_3": tick.ask_volume_3,
            "bid_price_4": tick.bid_price_4,
            "bid_volume_4": tick.bid_volume_4,
            "ask_price_4": tick.ask_price_4,
            "ask_volume_4": tick.ask_volume_4,
            "bid_price_5": tick.bid_price_5,
            "bid_volume_5": tick.bid_volume_5,
            "ask_price_5": tick.ask_price_5,
            "ask_volume_5": tick.ask_volume_5,
            "open_price": tick.open_price,
            "high_price": tick.high_price,
            "low_price": tick.low_price,
            "pre_close": tick.pre_close,
            "upper_limit": tick.upper_limit,
            "lower_limit": tick.lower_limit,
        }

    @staticmethod
    def _order_to_dict(order: OrderData) -> dict:
        return {
            "vt_orderid": order.vt_orderid,
            "symbol": order.symbol,
            "exchange": order.exchange.value if order.exchange else "",
            "vt_symbol": f"{order.symbol}.{order.exchange.value}" if order.exchange else order.symbol,
            "gateway_name": order.gateway_name,
            "orderid": order.orderid,
            "direction": order.direction.value if order.direction else "",
            "type": order.type.value if order.type else "",
            "offset": order.offset.value if order.offset else "",
            "price": order.price,
            "volume": order.volume,
            "traded": order.traded,
            "status": order.status.value if order.status else "",
            "datetime": order.datetime.isoformat() if order.datetime else None,
        }

    @staticmethod
    def _trade_to_dict(trade: TradeData) -> dict:
        return {
            "vt_tradeid": trade.vt_tradeid,
            "vt_orderid": trade.vt_orderid,
            "symbol": trade.symbol,
            "exchange": trade.exchange.value if trade.exchange else "",
            "vt_symbol": f"{trade.symbol}.{trade.exchange.value}" if trade.exchange else trade.symbol,
            "gateway_name": trade.gateway_name,
            "tradeid": trade.tradeid,
            "orderid": trade.orderid,
            "direction": trade.direction.value if trade.direction else "",
            "offset": trade.offset.value if trade.offset else "",
            "price": trade.price,
            "volume": trade.volume,
            "datetime": trade.datetime.isoformat() if trade.datetime else None,
        }

    @staticmethod
    def _position_to_dict(pos: PositionData) -> dict:
        return {
            "vt_positionid": pos.vt_positionid,
            "symbol": pos.symbol,
            "exchange": pos.exchange.value if pos.exchange else "",
            "vt_symbol": f"{pos.symbol}.{pos.exchange.value}" if pos.exchange else pos.symbol,
            "gateway_name": pos.gateway_name,
            "direction": pos.direction.value if pos.direction else "",
            "volume": pos.volume,
            "frozen": pos.frozen,
            "price": pos.price,
            "pnl": pos.pnl,
            "yd_volume": getattr(pos, "yd_volume", 0),
        }

    @staticmethod
    def _account_to_dict(account: AccountData) -> dict:
        return {
            "vt_accountid": account.vt_accountid,
            "gateway_name": account.gateway_name,
            "accountid": account.accountid,
            "balance": account.balance,
            "frozen": account.frozen,
            "available": account.available,
        }

    @staticmethod
    def _contract_to_dict(contract: ContractData) -> dict:
        return {
            "symbol": contract.symbol,
            "exchange": contract.exchange.value if contract.exchange else "",
            "vt_symbol": f"{contract.symbol}.{contract.exchange.value}" if contract.exchange else contract.symbol,
            "gateway_name": contract.gateway_name,
            "name": contract.name,
            "product": contract.product.value if contract.product else "",
            "size": contract.size,
            "pricetick": contract.pricetick,
            "min_volume": contract.min_volume,
            "option_portfolio": getattr(contract, "option_portfolio", ""),
            "option_expiry": str(getattr(contract, "option_expiry", "")) if getattr(contract, "option_expiry", None) else "",
            "option_strike": getattr(contract, "option_strike", 0),
            "option_type": getattr(contract, "option_type", "").value if getattr(contract, "option_type", None) else "",
            "history_data": contract.history_data,
        }

    # ============ 系统管理 ============

    def get_all_gateway_names(self) -> list[str]:
        return self.main_engine.get_all_gateway_names()

    def get_default_setting(self, gateway_name: str) -> dict:
        return self.main_engine.get_default_setting(gateway_name)

    def connect(self, setting: dict, gateway_name: str):
        self.main_engine.connect(setting, gateway_name)

    def get_all_apps(self) -> list[dict]:
        apps = self.main_engine.get_all_apps()
        return [{"app_name": a.app_name, "display_name": getattr(a, "display_name", a.app_name)} for a in apps]

    def get_all_exchanges(self) -> list[str]:
        return [e.value for e in self.main_engine.get_all_exchanges()]

    def get_logs(self) -> list[dict]:
        return list(self._log_history)

    # ============ 行情数据 ============

    def get_all_contracts(self) -> list[dict]:
        contracts = self.main_engine.get_all_contracts()
        return [self._contract_to_dict(c) for c in contracts]

    def get_contract(self, vt_symbol: str) -> Optional[dict]:
        contract = self.main_engine.get_contract(vt_symbol)
        if contract:
            return self._contract_to_dict(contract)
        return None

    def get_tick(self, vt_symbol: str) -> Optional[dict]:
        tick = self.main_engine.get_tick(vt_symbol)
        if tick:
            return self._tick_to_dict(tick)
        return None

    def get_all_ticks(self) -> list[dict]:
        ticks = self.main_engine.get_all_ticks()
        return [self._tick_to_dict(t) for t in ticks]

    def subscribe(self, vt_symbol: str, gateway_name: str) -> bool:
        parts = vt_symbol.split(".")
        if len(parts) == 2:
            symbol, exchange_str = parts
            exchange = Exchange(exchange_str)
        else:
            symbol = vt_symbol
            exchange = Exchange.SMART  # 默认值

        req = SubscribeRequest(symbol=symbol, exchange=exchange)
        self.main_engine.subscribe(req, gateway_name)
        return True

    def query_history(self, vt_symbol: str, start: str, end: str,
                      interval: str = "1m", gateway_name: str = "") -> list[dict]:
        parts = vt_symbol.split(".")
        symbol = parts[0]
        exchange = Exchange(parts[1]) if len(parts) > 1 else Exchange.SMART

        req = HistoryRequest(
            symbol=symbol,
            exchange=exchange,
            start=datetime.fromisoformat(start),
            end=datetime.fromisoformat(end),
            interval=Interval(interval),
        )
        data = self.main_engine.query_history(req, gateway_name)
        if data:
            return [
                {
                    "datetime": bar.datetime.isoformat(),
                    "open_price": bar.open_price,
                    "high_price": bar.high_price,
                    "low_price": bar.low_price,
                    "close_price": bar.close_price,
                    "volume": bar.volume,
                    "turnover": bar.turnover,
                    "open_interest": bar.open_interest,
                }
                for bar in data
            ]
        return []

    # ============ 交易操作 ============

    def send_order(self, req_dict: dict) -> str:
        req = OrderRequest(
            symbol=req_dict["symbol"],
            exchange=Exchange(req_dict["exchange"]),
            direction=Direction(req_dict["direction"]),
            type=OrderType(req_dict["type"]),
            volume=float(req_dict["volume"]),
            price=float(req_dict.get("price", 0)),
            offset=req_dict.get("offset", ""),
            reference=req_dict.get("reference", ""),
        )
        gateway = req_dict.get("gateway_name", "")
        return self.main_engine.send_order(req, gateway)

    def cancel_order(self, vt_orderid: str, gateway_name: str = ""):
        parts = vt_orderid.split(".")
        if len(parts) == 2:
            orderid = parts[1]
        else:
            orderid = vt_orderid
        req = CancelRequest(orderid=orderid, symbol="", exchange=Exchange.SMART)
        # 如果 vt_orderid 中包含网关信息，从已有订单中获取
        if not gateway_name:
            orders = self.main_engine.get_all_orders()
            for order in orders:
                if order.vt_orderid == vt_orderid:
                    req.symbol = order.symbol
                    req.exchange = order.exchange
                    gateway_name = order.gateway_name
                    break
        self.main_engine.cancel_order(req, gateway_name)

    def get_all_orders(self) -> list[dict]:
        return [self._order_to_dict(o) for o in self.main_engine.get_all_orders()]

    def get_all_active_orders(self) -> list[dict]:
        return [self._order_to_dict(o) for o in self.main_engine.get_all_active_orders()]

    def get_all_trades(self) -> list[dict]:
        return [self._trade_to_dict(t) for t in self.main_engine.get_all_trades()]

    def get_all_positions(self, include_paper: bool = True) -> list[dict]:
        """获取所有持仓（实盘+模拟盘）"""
        positions = [self._position_to_dict(p) for p in self.main_engine.get_all_positions()]

        # 添加模拟盘持仓
        if include_paper:
            paper_positions = self.get_paper_positions()
            for pos in paper_positions:
                pos["is_paper"] = True  # 标记为模拟盘持仓
                positions.append(pos)

        return positions

    def get_all_accounts(self) -> list[dict]:
        """获取所有账户（实盘+模拟盘）"""
        accounts = []

        # 实盘账户
        for account in self.main_engine.get_all_accounts():
            account_dict = self._account_to_dict(account)
            account_dict["account_type"] = "real"
            accounts.append(account_dict)

        # 模拟盘账户
        paper = self._get_paper_engine()
        if paper is not None:
            paper_account = {
                "gateway_name": "PAPER",
                "accountid": "SIM001",
                "vt_accountid": "PAPER.SIM001",
                "account_type": "paper",
                "balance": getattr(paper, "balance", 1000000),
                "frozen": getattr(paper, "frozen", 0),
                "available": getattr(paper, "available", 1000000),
                "commission": getattr(paper, "commission", 0),
                "margin": getattr(paper, "margin", 0),
                "close_profit": getattr(paper, "close_profit", 0),
                "holding_profit": getattr(paper, "holding_profit", 0),
            }
            accounts.append(paper_account)

        return accounts

    def cancel_all_orders(self) -> int:
        """取消所有活动委托，返回取消数量"""
        active_orders = self.main_engine.get_all_active_orders()
        count = 0
        for order in active_orders:
            try:
                req = CancelRequest(
                    orderid=order.orderid,
                    symbol=order.symbol,
                    exchange=order.exchange
                )
                self.main_engine.cancel_order(req, order.gateway_name)
                count += 1
            except Exception:
                pass
        return count

    def cancel_all_orders_for_gateway(self, gateway_name: str) -> int:
        """取消指定网关的所有活动委托"""
        active_orders = self.main_engine.get_all_active_orders()
        count = 0
        for order in active_orders:
            if order.gateway_name == gateway_name:
                try:
                    req = CancelRequest(
                        orderid=order.orderid,
                        symbol=order.symbol,
                        exchange=order.exchange
                    )
                    self.main_engine.cancel_order(req, gateway_name)
                    count += 1
                except Exception:
                    pass
        return count

    # ============ CTA 策略 ============

    def _get_cta_engine(self):
        """获取 CTA 引擎"""
        self.ensure_init()
        if self._main_engine is None:
            return None
        return self._main_engine.get_engine("CtaStrategy")

    def get_all_strategy_class_names(self) -> list[str]:
        cta = self._get_cta_engine()
        if cta is None:
            return []
        return cta.get_all_strategy_class_names()

    def get_strategy_class_parameters(self, class_name: str) -> dict:
        cta = self._get_cta_engine()
        if cta is None:
            return {}
        return cta.get_strategy_class_parameters(class_name)

    def get_strategy_class_file(self, class_name: str) -> str:
        cta = self._get_cta_engine()
        if cta is None:
            return ""
        return cta.get_strategy_class_file(class_name)

    def get_strategy_names(self) -> list[str]:
        cta = self._get_cta_engine()
        if cta is None:
            return []
        return [s.strategy_name for s in cta.strategies.values()]

    def get_strategy_infolist(self) -> list[dict]:
        cta = self._get_cta_engine()
        if cta is None:
            return []
        result = []
        for s in cta.strategies.values():
            info = {
                "strategy_name": s.strategy_name,
                "class_name": s.__class__.__name__,
                "vt_symbol": getattr(s, "vt_symbol", ""),
                "author": getattr(s, "author", ""),
                "parameters": {},
                "variables": {},
                "inited": getattr(s, "inited", False),
                "trading": getattr(s, "trading", False),
            }
            # 参数
            for name in getattr(s, "parameters", []):
                info["parameters"][name] = getattr(s, name, None)
            # 变量
            for name in getattr(s, "variables", []):
                info["variables"][name] = getattr(s, name, None)
            result.append(info)
        return result

    def get_strategy_variables(self, strategy_name: str) -> dict:
        cta = self._get_cta_engine()
        if cta is None or strategy_name not in cta.strategies:
            return {}
        s = cta.strategies[strategy_name]
        return {name: getattr(s, name, None) for name in getattr(s, "variables", [])}

    def add_strategy(self, class_name: str, strategy_name: str, vt_symbol: str, setting: dict) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.add_strategy(class_name, strategy_name, vt_symbol, setting)
        return True

    def edit_strategy(self, strategy_name: str, setting: dict) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.edit_strategy(strategy_name, setting)
        return True

    def remove_strategy(self, strategy_name: str) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.remove_strategy(strategy_name)
        return True

    def init_strategy(self, strategy_name: str) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.init_strategy(strategy_name)
        return True

    def init_all_strategies(self) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.init_all_strategies()
        return True

    def start_strategy(self, strategy_name: str) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.start_strategy(strategy_name)
        return True

    def start_all_strategies(self) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.start_all_strategies()
        return True

    def stop_strategy(self, strategy_name: str) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.stop_strategy(strategy_name)
        return True

    def stop_all_strategies(self) -> bool:
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")
        cta.stop_all_strategies()
        return True

    def run_backtest(
        self,
        class_name: str,
        vt_symbol: str,
        interval: str,
        start: str,
        end: str,
        rate: float,
        slippage: float,
        size: int,
        pricetick: float,
        capital: int,
        setting: dict,
        progress_callback=None
    ) -> dict:
        """运行回测"""
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")

        from vnpy_ctastrategy.backtesting import BacktestingEngine
        from vnpy_ctastrategy.base import BacktestingMode
        from vnpy.trader.constant import Interval as VnpyInterval

        if progress_callback:
            progress_callback(20, "初始化回测引擎...")

        engine = BacktestingEngine()
        engine.set_parameters(
            vt_symbol=vt_symbol,
            interval=VnpyInterval(interval),
            start=datetime.fromisoformat(start),
            end=datetime.fromisoformat(end),
            rate=rate,
            slippage=slippage,
            size=size,
            pricetick=pricetick,
            capital=capital,
            mode=BacktestingMode.BAR
        )

        if progress_callback:
            progress_callback(30, "加载历史数据...")
        engine.load_data()

        if progress_callback:
            progress_callback(50, "运行回测...")
        engine.add_strategy(cta.classes[class_name], setting)
        engine.run_backtesting()

        if progress_callback:
            progress_callback(80, "计算回测结果...")
        engine.calculate_result()
        stats = engine.calculate_statistics()

        # 获取成交记录
        trades = []
        for trade in engine.trades.values():
            trades.append({
                "tradeid": trade.tradeid,
                "datetime": trade.datetime.isoformat() if trade.datetime else "",
                "direction": trade.direction.value if trade.direction else "",
                "offset": trade.offset.value if trade.offset else "",
                "price": trade.price,
                "volume": trade.volume,
                "symbol": trade.symbol,
            })

        # 获取每日结果
        daily_results = []
        for date, result in engine.daily_df.iterrows():
            daily_results.append({
                "date": str(date),
                "close_price": result.get("close_price", 0),
                "net_pnl": result.get("net_pnl", 0),
                "commission": result.get("commission", 0),
                "slippage": result.get("slippage", 0),
                "trading_pnl": result.get("trading_pnl", 0),
                "holding_pnl": result.get("holding_pnl", 0),
                "total_pnl": result.get("total_pnl", 0),
            })

        result = {
            "total_return": stats.get("total_return", 0),
            "annual_return": stats.get("annual_return", 0),
            "max_drawdown": stats.get("max_drawdown", 0),
            "max_ddpercent": stats.get("max_ddpercent", 0),
            "sharpe_ratio": stats.get("sharpe_ratio", 0),
            "total_trade_count": stats.get("total_trade_count", 0),
            "winning_trade_count": stats.get("winning_trade_count", 0),
            "losing_trade_count": stats.get("losing_trade_count", 0),
            "win_rate": stats.get("win_rate", 0),
            "daily_results": daily_results,
            "trades": trades,
            "capital": capital,
        }

        engine.clear_data()
        return result

    def get_strategy_source(self, class_name: str) -> str:
        """获取策略源码"""
        cta = self._get_cta_engine()
        if cta is None:
            return ""
        file_path = cta.get_strategy_class_file(class_name)
        if file_path and Path(file_path).exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        return ""

    def save_strategy_source(self, class_name: str, content: str) -> bool:
        """保存策略源码"""
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")

        # 获取策略目录
        strategy_path = Path.home() / ".vntrader" / "strategies"
        strategy_path.mkdir(parents=True, exist_ok=True)

        # 策略文件名（小写+下划线）
        file_name = class_name.lower()
        if not file_name.endswith('.py'):
            file_name += '.py'

        file_path = strategy_path / file_name

        # 安全写入
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # 重新加载策略类
            self._reload_strategy_classes()
            return True
        except Exception as e:
            raise RuntimeError(f"保存策略失败: {e}")

    def _reload_strategy_classes(self) -> None:
        """重新加载策略类"""
        cta = self._get_cta_engine()
        if cta is None:
            return

        # 重新加载策略目录
        strategy_path = Path.home() / ".vntrader" / "strategies"
        if strategy_path.exists():
            cta.load_strategy_class_from_folder(str(strategy_path))

    def get_strategy_templates(self) -> list[dict]:
        """获取策略模板列表"""
        templates = [
            {
                "name": "EmptyStrategy",
                "display_name": "空策略模板",
                "description": "最基础的双均线策略框架",
                "code": '''from vnpy_ctastrategy import CtaTemplate, StopOrder
from vnpy.trader.object import TickData, BarData, TradeData, OrderData


class EmptyStrategy(CtaTemplate):
    author = "Your Name"

    # 策略参数
    fast_window = 10
    slow_window = 20

    # 策略变量
    fast_ma = 0.0
    slow_ma = 0.0

    parameters = ["fast_window", "slow_window"]
    variables = ["fast_ma", "slow_ma"]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)

    def on_init(self):
        self.write_log("策略初始化")
        self.load_bar(10)

    def on_start(self):
        self.write_log("策略启动")

    def on_stop(self):
        self.write_log("策略停止")

    def on_tick(self, tick: TickData):
        pass

    def on_bar(self, bar: BarData):
        # TODO: 实现你的交易逻辑
        pass

    def on_order(self, order: OrderData):
        pass

    def on_trade(self, trade: TradeData):
        self.put_event()
'''
            },
            {
                "name": "AtrRsiStrategy",
                "display_name": "ATR+RSI策略",
                "description": "经典的ATR止损+RSI入场策略",
                "code": '''from vnpy_ctastrategy import CtaTemplate, StopOrder
from vnpy.trader.object import TickData, BarData, TradeData, OrderData
from vnpy.trader.constant import Direction, Offset
from vnpy_ctastrategy.base import EngineType


class AtrRsiStrategy(CtaTemplate):
    author = "vn.py"

    atr_length = 22
    atr_ma_length = 10
    rsi_length = 5
    rsi_entry = 16
    trailing_percent = 0.8
    fixed_size = 1

    atr_value = 0.0
    atr_ma = 0.0
    rsi_value = 0.0
    rsi_buy = 0.0
    rsi_sell = 0.0
    intra_trade_high = 0.0
    intra_trade_low = 0.0
    long_stop = 0.0
    short_stop = 0.0

    parameters = [
        "atr_length", "atr_ma_length", "rsi_length",
        "rsi_entry", "trailing_percent", "fixed_size"
    ]
    variables = [
        "atr_value", "atr_ma", "rsi_value",
        "rsi_buy", "rsi_sell", "intra_trade_high",
        "intra_trade_low", "long_stop", "short_stop"
    ]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
        self.rsi_buy = 50 + self.rsi_entry
        self.rsi_sell = 50 - self.rsi_entry

    def on_init(self):
        self.write_log("策略初始化")
        self.load_bar(10)

    def on_start(self):
        self.write_log("策略启动")

    def on_stop(self):
        self.write_log("策略停止")

    def on_tick(self, tick: TickData):
        pass

    def on_bar(self, bar: BarData):
        self.cancel_all()

        am = self.am
        am.update_bar(bar)
        if not am.inited:
            return

        self.atr_value = am.atr(self.atr_length)
        self.atr_ma = am.sma(self.atr_length)
        self.rsi_value = am.rsi(self.rsi_length)

        if self.pos == 0:
            self.intra_trade_high = bar.high_price
            self.intra_trade_low = bar.low_price

            if self.atr_value > self.atr_ma:
                if self.rsi_value > self.rsi_buy:
                    self.buy(bar.close_price + 5, self.fixed_size)
                elif self.rsi_value < self.rsi_sell:
                    self.short(bar.close_price - 5, self.fixed_size)

        elif self.pos > 0:
            self.intra_trade_high = max(self.intra_trade_high, bar.high_price)
            self.intra_trade_low = bar.low_price

            self.long_stop = self.intra_trade_high * (1 - self.trailing_percent / 100)
            self.sell(self.long_stop, abs(self.pos), stop=True)

        elif self.pos < 0:
            self.intra_trade_high = bar.high_price
            self.intra_trade_low = min(self.intra_trade_low, bar.low_price)

            self.short_stop = self.intra_trade_low * (1 + self.trailing_percent / 100)
            self.cover(self.short_stop, abs(self.pos), stop=True)

        self.put_event()

    def on_order(self, order: OrderData):
        pass

    def on_trade(self, trade: TradeData):
        if trade.offset == Offset.OPEN:
            if trade.direction == Direction.LONG:
                self.intra_trade_high = trade.price
                self.intra_trade_low = trade.price
            else:
                self.intra_trade_high = trade.price
                self.intra_trade_low = trade.price
        self.put_event()
'''
            },
            {
                "name": "DualThrustStrategy",
                "display_name": "Dual Thrust策略",
                "description": "经典的Dual Thrust趋势跟踪策略",
                "code": '''from vnpy_ctastrategy import CtaTemplate, StopOrder
from vnpy.trader.object import TickData, BarData, TradeData, OrderData


class DualThrustStrategy(CtaTemplate):
    author = "vn.py"

    n_days = 5
    k1 = 0.4
    k2 = 0.6
    fixed_size = 1

    buy_entry = 0.0
    sell_entry = 0.0

    parameters = ["n_days", "k1", "k2", "fixed_size"]
    variables = ["buy_entry", "sell_entry"]

    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)

    def on_init(self):
        self.write_log("策略初始化")
        self.load_bar(10)

    def on_start(self):
        self.write_log("策略启动")

    def on_stop(self):
        self.write_log("策略停止")

    def on_tick(self, tick: TickData):
        pass

    def on_bar(self, bar: BarData):
        self.cancel_all()

        am = self.am
        am.update_bar(bar)
        if not am.inited:
            return

        # 计算Dual Thrust范围
        hh = am.high[-self.n_days:].max()
        ll = am.low[-self.n_days:].min()
        hc = am.close[-self.n_days:].max()
        lc = am.close[-self.n_days:].min()

        range_value = max(hh - lc, hc - ll)
        self.buy_entry = bar.open_price + self.k1 * range_value
        self.sell_entry = bar.open_price - self.k2 * range_value

        if self.pos == 0:
            self.buy(self.buy_entry, self.fixed_size)
            self.short(self.sell_entry, self.fixed_size)
        elif self.pos > 0:
            self.sell(self.sell_entry, abs(self.pos))
        elif self.pos < 0:
            self.cover(self.buy_entry, abs(self.pos))

        self.put_event()

    def on_order(self, order: OrderData):
        pass

    def on_trade(self, trade: TradeData):
        self.put_event()
'''
            }
        ]
        return templates

    def run_backtest_optimization(
        self,
        class_name: str,
        vt_symbol: str,
        interval: str,
        start: str,
        end: str,
        rate: float,
        slippage: float,
        size: int,
        pricetick: float,
        capital: int,
        param_ranges: dict
    ) -> list[dict]:
        """运行参数优化"""
        cta = self._get_cta_engine()
        if cta is None:
            raise RuntimeError("CTA engine not initialized")

        from vnpy_ctastrategy.backtesting import BacktestingEngine
        from vnpy_ctastrategy.base import BacktestingMode
        from vnpy.trader.constant import Interval as VnpyInterval

        results = []

        # 生成参数组合
        param_names = list(param_ranges.keys())
        param_values = [param_ranges[name] for name in param_names]

        # 笛卡尔积生成所有参数组合
        import itertools
        for combo in itertools.product(*param_values):
            setting = dict(zip(param_names, combo))

            engine = BacktestingEngine()
            engine.set_parameters(
                vt_symbol=vt_symbol,
                interval=VnpyInterval(interval),
                start=datetime.fromisoformat(start),
                end=datetime.fromisoformat(end),
                rate=rate,
                slippage=slippage,
                size=size,
                pricetick=pricetick,
                capital=capital,
                mode=BacktestingMode.BAR
            )
            engine.add_strategy(cta.classes[class_name], setting)
            engine.load_data()
            engine.run_backtesting()
            engine.calculate_result()
            stats = engine.calculate_statistics()

            result = {
                "parameters": setting,
                "total_return": stats.get("total_return", 0),
                "sharpe_ratio": stats.get("sharpe_ratio", 0),
                "max_drawdown": stats.get("max_drawdown", 0),
                "total_trade_count": stats.get("total_trade_count", 0),
                "daily_net_pnl": stats.get("daily_net_pnl", 0),
            }
            results.append(result)
            engine.clear_data()

        # 按夏普比率排序
        results.sort(key=lambda x: x["sharpe_ratio"], reverse=True)
        return results

    # ============ 模拟交易 ============

    def _get_paper_engine(self):
        """获取模拟交易引擎"""
        self.ensure_init()
        if self._main_engine is None:
            return None
        return self._main_engine.get_engine("PaperAccount")

    def get_paper_setting(self) -> dict:
        """获取模拟交易设置"""
        paper = self._get_paper_engine()
        if paper is None:
            return {}
        return {
            "instant_trade": paper.get_instant_trade(),
            "trade_slippage": paper.get_trade_slippage(),
            "timer_interval": paper.get_timer_interval(),
        }

    def set_paper_setting(self, instant_trade: bool = None, trade_slippage: float = None, timer_interval: int = None) -> bool:
        """设置模拟交易参数"""
        paper = self._get_paper_engine()
        if paper is None:
            raise RuntimeError("Paper engine not initialized")
        if instant_trade is not None:
            paper.set_instant_trade(instant_trade)
        if trade_slippage is not None:
            paper.set_trade_slippage(trade_slippage)
        if timer_interval is not None:
            paper.set_timer_interval(timer_interval)
        paper.save_setting()
        return True

    def clear_paper_positions(self) -> bool:
        """清空模拟持仓"""
        paper = self._get_paper_engine()
        if paper is None:
            raise RuntimeError("Paper engine not initialized")
        paper.clear_position()
        return True

    def get_paper_positions(self) -> list[dict]:
        """获取模拟持仓"""
        paper = self._get_paper_engine()
        if paper is None:
            return []
        positions = []
        for vt_symbol, pos in paper.positions.items():
            positions.append({
                "vt_symbol": vt_symbol,
                "volume": pos.get("volume", 0),
                "frozen": pos.get("frozen", 0),
                "price": pos.get("price", 0),
                "pnl": paper.calculate_pnl(vt_symbol),
                "account_type": "paper",
                "gateway_name": "PAPER",
                "direction": "多" if pos.get("volume", 0) > 0 else "空" if pos.get("volume", 0) < 0 else "无",
            })
        return positions

    # ============ 算法交易 ============

    def _get_algo_engine(self):
        """获取算法交易引擎"""
        self.ensure_init()
        if self._main_engine is None:
            return None
        return self._main_engine.get_engine("AlgoTrading")

    def get_algo_templates(self) -> list[dict]:
        """获取算法模板列表"""
        algo = self._get_algo_engine()
        if algo is None:
            return []
        templates = []
        for name, template in algo.algo_templates.items():
            templates.append({
                "name": name,
                "display_name": getattr(template, 'display_name', name),
                "default_setting": getattr(template, 'default_setting', {}),
            })
        return templates

    def get_algo_template(self, name: str) -> dict:
        """获取算法模板详情"""
        algo = self._get_algo_engine()
        if algo is None:
            return {}
        template = algo.get_algo_template(name)
        if template:
            return {
                "name": name,
                "display_name": getattr(template, 'display_name', name),
                "default_setting": getattr(template, 'default_setting', {}),
                "variables": getattr(template, 'variables', []),
            }
        return {}

    def start_algo(self, template_name: str, vt_symbol: str, direction: str, offset: str, price: float, volume: float, setting: dict = None) -> str:
        """启动算法"""
        algo = self._get_algo_engine()
        if algo is None:
            raise RuntimeError("Algo engine not initialized")
        algo_name = algo.start_algo(template_name, vt_symbol, direction, offset, price, volume, setting or {})
        return algo_name

    def stop_algo(self, algo_name: str) -> bool:
        """停止算法"""
        algo = self._get_algo_engine()
        if algo is None:
            raise RuntimeError("Algo engine not initialized")
        algo.stop_algo(algo_name)
        return True

    def stop_all_algos(self) -> bool:
        """停止所有算法"""
        algo = self._get_algo_engine()
        if algo is None:
            raise RuntimeError("Algo engine not initialized")
        algo.stop_all()
        return True

    def pause_algo(self, algo_name: str) -> bool:
        """暂停算法"""
        algo = self._get_algo_engine()
        if algo is None:
            raise RuntimeError("Algo engine not initialized")
        algo.pause_algo(algo_name)
        return True

    def resume_algo(self, algo_name: str) -> bool:
        """恢复算法"""
        algo = self._get_algo_engine()
        if algo is None:
            raise RuntimeError("Algo engine not initialized")
        algo.resume_algo(algo_name)
        return True

    def get_algo_list(self) -> list[dict]:
        """获取运行中的算法列表"""
        algo = self._get_algo_engine()
        if algo is None:
            return []
        algos = []
        for name, a in algo.algos.items():
            algos.append({
                "name": name,
                "template_name": a.__class__.__name__,
                "vt_symbol": getattr(a, 'vt_symbol', ''),
                "direction": getattr(a, 'direction', ''),
                "offset": getattr(a, 'offset', ''),
                "price": getattr(a, 'price', 0),
                "volume": getattr(a, 'volume', 0),
                "traded": getattr(a, 'traded', 0),
                "status": getattr(a, 'status', ''),
                "variables": a.get_variables(),
            })
        return algos


# 全局单例
bridge = VnpyBridge()
