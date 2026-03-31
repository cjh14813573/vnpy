"""风控增强功能测试"""

import pytest
from unittest.mock import patch, MagicMock
import numpy as np


def test_get_risk_exposure(client, auth_headers):
    """测试获取风险敞口"""
    # Mock 持仓和账户数据
    mock_positions = [
        {
            "vt_symbol": "rb2410.SHFE",
            "volume": 10,
            "pnl": 5000,
        },
        {
            "vt_symbol": "cu2410.SHFE",
            "volume": -5,
            "pnl": -2000,
        }
    ]
    mock_accounts = [
        {"balance": 1000000, "available": 800000}
    ]
    mock_tick = {"last_price": 3500}
    mock_contract = {"size": 10, "margin_rate": 0.12}

    with patch("routers.risk.bridge.get_all_positions", return_value=mock_positions), \
         patch("routers.risk.bridge.get_all_accounts", return_value=mock_accounts), \
         patch("routers.risk.bridge.get_tick", return_value=mock_tick), \
         patch("routers.risk.bridge.get_contract", return_value=mock_contract):

        resp = client.get("/api/risk/exposure", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "exposures" in data
    assert "summary" in data
    assert "timestamp" in data
    assert len(data["exposures"]) == 2


def test_get_risk_exposure_empty(client, auth_headers):
    """测试空持仓时的风险敞口"""
    import routers.risk as risk_module
    # 清除缓存以确保测试独立
    with risk_module._exposure_lock:
        risk_module._exposure_cache = {}
        risk_module._exposure_cache_time = None

    with patch("routers.risk.bridge.get_all_positions", return_value=[]), \
         patch("routers.risk.bridge.get_all_accounts", return_value=[{"balance": 1000000}]):
        resp = client.get("/api/risk/exposure", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["position_count"] == 0


def test_get_exposure_history(client, auth_headers):
    """测试获取风险敞口历史"""
    resp = client.get("/api/risk/exposure/history?hours=24&interval=1h", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "history" in data
    assert "interval" in data
    assert "hours" in data
    assert len(data["history"]) > 0


def test_get_risk_triggers(client, auth_headers):
    """测试获取风控触发器配置"""
    resp = client.get("/api/risk/triggers", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "margin_call" in data
    assert "daily_loss_limit" in data
    assert "var_limit" in data
    assert "concentration_limit" in data


def test_update_risk_trigger(client, auth_headers):
    """测试更新风控触发器"""
    resp = client.put(
        "/api/risk/triggers/margin_call",
        json={"enabled": True, "threshold": 85, "action": "alert"},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is True
    assert data["threshold"] == 85


def test_update_risk_trigger_not_found(client, auth_headers):
    """测试更新不存在的触发器"""
    resp = client.put(
        "/api/risk/triggers/non_existent",
        json={"enabled": True},
        headers=auth_headers,
    )

    assert resp.status_code == 404


def test_get_risk_trigger_status(client, auth_headers):
    """测试获取风控触发状态"""
    with patch("routers.risk.bridge.get_all_positions", return_value=[]), \
         patch("routers.risk.bridge.get_all_accounts", return_value=[{"balance": 1000000}]):
        resp = client.get("/api/risk/triggers/status", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "triggered_rules" in data
    assert "trigger_count" in data


def test_execute_risk_action_alert(client, auth_headers):
    """测试执行风控警告操作"""
    resp = client.post(
        "/api/risk/triggers/execute",
        json={"action": "alert", "target": "all", "reason": "测试警告"},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["action"] == "alert"


def test_execute_risk_action_reduce(client, auth_headers):
    """测试执行风控减仓操作"""
    resp = client.post(
        "/api/risk/triggers/execute",
        json={"action": "reduce_position", "target": "all", "ratio": 0.5, "reason": "测试减仓"},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["action"] == "reduce_position"
    assert resp.json()["ratio"] == 0.5


def test_execute_risk_action_close_all(client, auth_headers):
    """测试执行风控平仓操作"""
    resp = client.post(
        "/api/risk/triggers/execute",
        json={"action": "close_all", "target": "all", "reason": "测试平仓"},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["action"] == "close_all"


def test_execute_risk_action_invalid(client, auth_headers):
    """测试执行无效的风控操作"""
    resp = client.post(
        "/api/risk/triggers/execute",
        json={"action": "invalid_action"},
        headers=auth_headers,
    )

    assert resp.status_code == 400


def test_get_trigger_events(client, auth_headers):
    """测试获取风控触发事件历史"""
    resp = client.get("/api/risk/triggers/events?limit=10", headers=auth_headers)

    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_calculate_var_historical(client, auth_headers):
    """测试历史法VaR计算"""
    resp = client.post(
        "/api/risk/var/calculate",
        json={
            "method": "historical",
            "confidence": 0.95,
            "time_horizon": 1,
            "portfolio_value": 1000000
        },
        headers=auth_headers,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "var_relative" in data
    assert "var_amount" in data
    assert "confidence" in data
    assert data["method"] == "historical"


def test_calculate_var_monte_carlo(client, auth_headers):
    """测试蒙特卡洛VaR计算"""
    resp = client.post(
        "/api/risk/var/calculate",
        json={
            "method": "monte_carlo",
            "confidence": 0.99,
            "time_horizon": 5,
            "portfolio_value": 2000000
        },
        headers=auth_headers,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["method"] == "monte_carlo"
    assert data["confidence"] == 0.99


def test_calculate_var_parametric(client, auth_headers):
    """测试参数法VaR计算"""
    resp = client.post(
        "/api/risk/var/calculate",
        json={
            "method": "parametric",
            "confidence": 0.95,
            "time_horizon": 1,
            "portfolio_value": 1000000
        },
        headers=auth_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["method"] == "parametric"


def test_calculate_var_invalid_method(client, auth_headers):
    """测试无效的VaR计算方法"""
    resp = client.post(
        "/api/risk/var/calculate",
        json={"method": "invalid_method"},
        headers=auth_headers,
    )

    assert resp.status_code == 400


def test_get_var_sensitivity(client, auth_headers):
    """测试获取VaR敏感度分析"""
    resp = client.get(
        "/api/risk/var/sensitivity?portfolio_value=1000000&base_volatility=0.02",
        headers=auth_headers,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "sensitivity_matrix" in data
    assert "portfolio_value" in data
    assert "base_volatility" in data
    assert len(data["sensitivity_matrix"]) == 3  # 3个置信度
