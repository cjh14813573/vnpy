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

    def get_all_positions(self) -> list[dict]:
        return [self._position_to_dict(p) for p in self.main_engine.get_all_positions()]

    def get_all_accounts(self) -> list[dict]:
        return [self._account_to_dict(a) for a in self.main_engine.get_all_accounts()]

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


# 全局单例
bridge = VnpyBridge()
