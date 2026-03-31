"""测试 fixtures"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch
from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient

# 确保 backend 目录在 sys.path 中
backend_dir = str(Path(__file__).parent.parent)
sys.path.insert(0, backend_dir)

# 临时数据库
_test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_test_db_path = _test_db.name
_test_db.close()


@pytest.fixture(autouse=True)
def _patch_settings():
    """使用临时数据库和测试密钥"""
    import auth as auth_mod
    original_db_path = auth_mod.settings.DB_PATH
    original_secret = auth_mod.settings.JWT_SECRET_KEY

    auth_mod.settings.DB_PATH = _test_db_path
    auth_mod.settings.JWT_SECRET_KEY = "test-secret-key"

    yield

    # 恢复
    auth_mod.settings.DB_PATH = original_db_path
    auth_mod.settings.JWT_SECRET_KEY = original_secret


def _make_mock_bridge():
    """创建 mock bridge"""
    mock_bridge = MagicMock()
    mock_bridge.main_engine = MagicMock()
    mock_bridge.get_all_gateway_names.return_value = ["CTP", "IB"]
    mock_bridge.get_default_setting.return_value = {"用户名": "", "密码": ""}
    mock_bridge.connect.return_value = None
    mock_bridge.get_all_apps.return_value = [
        {"app_name": "cta_strategy", "display_name": "CTA策略"},
    ]
    mock_bridge.get_all_exchanges.return_value = ["SHFE", "CFFEX", "DCE"]
    mock_bridge.get_logs.return_value = []
    mock_bridge.get_all_contracts.return_value = [
        {
            "symbol": "rb2410",
            "exchange": "SHFE",
            "vt_symbol": "rb2410.SHFE",
            "gateway_name": "CTP",
            "name": "螺纹钢2410",
            "product": "期货",
            "size": 10,
            "pricetick": 1.0,
            "min_volume": 1.0,
            "history_data": True,
        }
    ]
    mock_bridge.get_contract.return_value = {
        "symbol": "rb2410",
        "exchange": "SHFE",
        "vt_symbol": "rb2410.SHFE",
        "gateway_name": "CTP",
        "name": "螺纹钢2410",
    }
    mock_bridge.get_all_ticks.return_value = []
    mock_bridge.get_tick.return_value = None
    mock_bridge.subscribe.return_value = True
    mock_bridge.query_history.return_value = [
        {
            "datetime": "2024-01-01T09:00:00",
            "open_price": 3800,
            "high_price": 3850,
            "low_price": 3790,
            "close_price": 3840,
            "volume": 1000,
            "turnover": 3820000,
            "open_interest": 50000,
        }
    ]
    mock_bridge.send_order.return_value = "CTP.000000001"
    mock_bridge.cancel_order.return_value = None
    mock_bridge.cancel_all_orders.return_value = 5
    mock_bridge.cancel_all_orders_for_gateway.return_value = 3
    mock_bridge.get_all_orders.return_value = []
    mock_bridge.get_all_active_orders.return_value = []
    mock_bridge.get_all_trades.return_value = []
    mock_bridge.get_all_positions.return_value = []
    mock_bridge.get_all_accounts.return_value = [
        {
            "vt_accountid": "CTP.001",
            "gateway_name": "CTP",
            "accountid": "001",
            "balance": 1000000,
            "frozen": 0,
            "available": 1000000,
        }
    ]
    mock_bridge.get_all_strategy_class_names.return_value = ["AtrRsiStrategy", "BollChannelStrategy"]
    mock_bridge.get_strategy_class_parameters.return_value = {
        "atr_length": {"default": 20, "type": "int"},
        "atr_ma_length": {"default": 10, "type": "int"},
    }
    mock_bridge.get_strategy_class_file.return_value = "class AtrRsiStrategy(CtaTemplate): pass"
    mock_bridge.get_strategy_infolist.return_value = [
        {
            "strategy_name": "atr_rsi_01",
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "author": "",
            "parameters": {"atr_length": 20},
            "variables": {"atr_value": 1.5},
            "inited": True,
            "trading": True,
        }
    ]
    mock_bridge.get_strategy_variables.return_value = {"atr_value": 1.5, "ma_value": 3800}
    mock_bridge.add_strategy.return_value = True
    mock_bridge.edit_strategy.return_value = True
    mock_bridge.remove_strategy.return_value = True
    mock_bridge.init_strategy.return_value = True
    mock_bridge.init_all_strategies.return_value = True
    mock_bridge.start_strategy.return_value = True
    mock_bridge.start_all_strategies.return_value = True
    mock_bridge.stop_strategy.return_value = True
    mock_bridge.stop_all_strategies.return_value = True
    return mock_bridge


@pytest.fixture
def client(_patch_settings):
    """FastAPI 测试客户端"""
    import auth as auth_mod

    # 先初始化数据库（此时 settings.DB_PATH 已经被 patch 为临时路径）
    auth_mod.init_db()

    mock_bridge = _make_mock_bridge()

    with patch("main.bridge", mock_bridge), \
         patch("routers.system.bridge", mock_bridge), \
         patch("routers.market.bridge", mock_bridge), \
         patch("routers.trading.bridge", mock_bridge), \
         patch("routers.strategy.bridge", mock_bridge), \
         patch("routers.backtest.bridge", mock_bridge), \
         patch("bridge.bridge", mock_bridge):
        from main import app
        # 覆盖 lifespan 中的 bridge 初始化
        with TestClient(app) as c:
            yield c


@pytest.fixture
def auth_token(client) -> str:
    """获取测试用 JWT Token"""
    resp = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "admin123",
    })
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token) -> dict:
    """获取带认证的请求头"""
    return {"Authorization": f"Bearer {auth_token}"}
