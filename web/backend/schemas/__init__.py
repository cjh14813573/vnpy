"""Pydantic 数据模型"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ============ 枚举 ============

class DirectionEnum(str, Enum):
    LONG = "多"
    SHORT = "空"


class OrderTypeEnum(str, Enum):
    LIMIT = "限价"
    MARKET = "市价"
    STOP = "停损"
    FAK = "FAK"
    FOK = "FOK"


class OffsetEnum(str, Enum):
    NONE = ""
    OPEN = "开"
    CLOSE = "平"
    CLOSETODAY = "平今"
    CLOSEYESTERDAY = "平昨"


class IntervalEnum(str, Enum):
    MINUTE = "1m"
    HOUR = "1h"
    DAILY = "d"
    WEEKLY = "w"


# ============ 网关 ============

class GatewayConnectRequest(BaseModel):
    gateway_name: str
    setting: dict


# ============ 行情 ============

class SubscribeRequest(BaseModel):
    vt_symbol: str
    gateway_name: str


class HistoryQueryRequest(BaseModel):
    vt_symbol: str
    start: str
    end: str
    interval: str = "1m"
    gateway_name: str = ""


# ============ 交易 ============

class OrderSendRequest(BaseModel):
    symbol: str
    exchange: str
    direction: DirectionEnum
    type: OrderTypeEnum = OrderTypeEnum.LIMIT
    volume: float = Field(gt=0)
    price: float = Field(ge=0)
    offset: OffsetEnum = OffsetEnum.NONE
    gateway_name: str = ""
    reference: str = ""


class OrderCancelRequest(BaseModel):
    vt_orderid: str
    gateway_name: str = ""


# ============ 策略 ============

class StrategyAddRequest(BaseModel):
    class_name: str
    strategy_name: str
    vt_symbol: str
    setting: dict = {}


class StrategyEditRequest(BaseModel):
    setting: dict


# ============ 回测 ============

class BacktestRunRequest(BaseModel):
    class_name: str
    vt_symbol: str
    interval: str = "1m"
    start: str = ""
    end: str = ""
    rate: float = 0.0001
    slippage: float = 0.0
    size: float = 1.0
    pricetick: float = 0.01
    capital: float = 1_000_000.0
    setting: dict = {}


class BacktestOptimizeRequest(BaseModel):
    class_name: str
    vt_symbol: str
    interval: str = "1m"
    start: str = ""
    end: str = ""
    parameters: dict = {}
    use_ga: bool = False
    target_name: str = "total_net_pnl"


class DownloadRequest(BaseModel):
    vt_symbol: str
    start: str
    end: str
    interval: str = "1m"


# ============ 数据管理 ============

class DataDeleteRequest(BaseModel):
    vt_symbol: str
    interval: str = "1m"
    start: str = ""
    end: str = ""


class CSVImportRequest(BaseModel):
    file_path: str
    vt_symbol: str
    interval: str = "1m"


class CSVExportRequest(BaseModel):
    vt_symbol: str
    interval: str = "1m"
    start: str = ""
    end: str = ""
    file_path: str = ""


# ============ 风控 ============

class RiskRuleUpdateRequest(BaseModel):
    active: bool
    setting: dict = {}


# ============ 模拟盘 ============

class PaperTradeSetting(BaseModel):
    instant_trade: bool = True
    trade_slippage: float = 0.0
