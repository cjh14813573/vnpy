"""机器学习模块测试"""

import pytest
from unittest.mock import patch, MagicMock


def test_generate_features_success(client, auth_headers):
    """测试特征生成功能"""
    # Mock query_history 返回更多数据以满足特征计算需求
    from datetime import datetime, timedelta
    base_date = datetime(2024, 1, 1)
    mock_history = [
        {
            "datetime": (base_date + timedelta(days=i)).strftime("%Y-%m-%dT%H:%M:%S"),
            "open_price": 3800 + i * 10,
            "high_price": 3850 + i * 10,
            "low_price": 3790 + i * 10,
            "close_price": 3840 + i * 10,
            "volume": 1000 + i * 100,
            "turnover": 3820000,
            "open_interest": 50000,
        }
        for i in range(100)
    ]

    with patch("routers.ml.bridge.query_history", return_value=mock_history):
        resp = client.post(
            "/api/ml/features/generate",
            params={"vt_symbol": "rb2410.SHFE", "interval": "1d"},
            json={
                "technical_indicators": ["sma", "rsi"],
                "window_sizes": [5, 10, 20],
                "target_horizon": 5,
                "target_type": "direction",
            },
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "features_count" in data
    assert "samples_count" in data
    assert "feature_names" in data
    assert "target_distribution" in data
    assert data["features_count"] > 0
    assert data["samples_count"] > 0


def test_generate_features_no_data(client, auth_headers):
    """测试特征生成时无历史数据"""
    with patch("routers.ml.bridge.query_history", return_value=[]):
        resp = client.post(
            "/api/ml/features/generate",
            params={"vt_symbol": "rb2410.SHFE", "interval": "1d"},
            json={
                "technical_indicators": ["sma"],
                "window_sizes": [5],
                "target_horizon": 5,
                "target_type": "direction",
            },
            headers=auth_headers,
        )

    assert resp.status_code == 404
    assert "未找到" in resp.json()["detail"]


def test_preview_features_success(client, auth_headers):
    """测试特征预览接口"""
    # Mock 足够的历史数据
    from datetime import datetime, timedelta
    base_date = datetime(2024, 1, 1)
    mock_history = [
        {
            "datetime": (base_date + timedelta(days=i)).strftime("%Y-%m-%dT%H:%M:%S"),
            "open_price": 3800 + i * 10,
            "high_price": 3850 + i * 10,
            "low_price": 3790 + i * 10,
            "close_price": 3840 + i * 10,
            "volume": 1000 + i * 100,
            "turnover": 3820000,
            "open_interest": 50000,
        }
        for i in range(100)
    ]

    with patch("routers.ml.bridge.query_history", return_value=mock_history):
        resp = client.post(
            "/api/ml/features/preview",
            json={
                "vt_symbol": "rb2410.SHFE",
                "interval": "1d",
                "start": "2024-01-01",
                "end": "2024-04-01",
                "feature_config": {
                    "technical_indicators": ["sma", "ema", "rsi"],
                    "window_sizes": [5, 10, 20],
                    "target_horizon": 5,
                    "target_type": "direction",
                },
            },
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()

    # 验证返回结构
    assert data["vt_symbol"] == "rb2410.SHFE"
    assert data["interval"] == "1d"
    assert "samples_count" in data
    assert "features_count" in data
    assert "target_distribution" in data
    assert "target_config" in data
    assert "feature_stats" in data
    assert "date_range" in data

    # 验证目标配置
    assert data["target_config"]["horizon"] == 5
    assert data["target_config"]["type"] == "direction"

    # 验证特征统计
    assert len(data["feature_stats"]) > 0
    first_feature = data["feature_stats"][0]
    assert "name" in first_feature
    assert "mean" in first_feature
    assert "std" in first_feature
    assert "min" in first_feature
    assert "max" in first_feature
    assert "median" in first_feature
    assert "target_correlation" in first_feature

    # 验证特征按相关性排序
    correlations = [f["target_correlation"] for f in data["feature_stats"]]
    abs_correlations = [abs(c) for c in correlations]
    assert abs_correlations == sorted(abs_correlations, reverse=True)


def test_preview_features_insufficient_data(client, auth_headers):
    """测试特征预览时数据不足"""
    with patch("routers.ml.bridge.query_history", return_value=[]):
        resp = client.post(
            "/api/ml/features/preview",
            json={
                "vt_symbol": "rb2410.SHFE",
                "interval": "1d",
                "start": "2024-01-01",
                "end": "2024-01-10",
                "feature_config": {
                    "technical_indicators": ["sma"],
                    "window_sizes": [5],
                    "target_horizon": 5,
                    "target_type": "direction",
                },
            },
            headers=auth_headers,
        )

    assert resp.status_code == 400
    assert "数据不足" in resp.json()["detail"]


def test_preview_features_invalid_params(client, auth_headers):
    """测试特征预览时缺少必填参数"""
    resp = client.post(
        "/api/ml/features/preview",
        json={
            # 缺少 vt_symbol
            "interval": "1d",
            "start": "2024-01-01",
            "end": "2024-04-01",
            "feature_config": {
                "technical_indicators": ["sma"],
                "window_sizes": [5],
                "target_horizon": 5,
                "target_type": "direction",
            },
        },
        headers=auth_headers,
    )

    assert resp.status_code == 422  # 验证错误


def test_list_models_empty(client, auth_headers):
    """测试列出模型（空列表）"""
    with patch("routers.ml.ML_MODELS_DIR") as mock_dir:
        mock_dir.glob.return_value = []
        resp = client.get("/api/ml/models", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json() == []


def test_train_model_insufficient_data(client, auth_headers):
    """测试训练模型时数据不足"""
    with patch("routers.ml.bridge.query_history", return_value=[]):
        resp = client.post(
            "/api/ml/models/train",
            json={
                "name": "test_model",
                "model_type": "random_forest",
                "vt_symbol": "rb2410.SHFE",
                "interval": "1d",
                "start": "2024-01-01",
                "end": "2024-01-10",
                "feature_config": {
                    "technical_indicators": ["sma"],
                    "window_sizes": [5],
                    "target_horizon": 5,
                    "target_type": "direction",
                },
            },
            headers=auth_headers,
        )

    assert resp.status_code == 400
    assert "历史数据不足" in resp.json()["detail"]


def test_get_model_not_found(client, auth_headers):
    """测试获取不存在的模型详情"""
    resp = client.get("/api/ml/models/non_existent_model", headers=auth_headers)

    assert resp.status_code == 404
    assert "模型不存在" in resp.json()["detail"]


def test_get_model_evaluation_not_found(client, auth_headers):
    """测试获取不存在的模型评估数据"""
    resp = client.get("/api/ml/models/non_existent_model/evaluation", headers=auth_headers)

    assert resp.status_code == 404
    assert "模型不存在" in resp.json()["detail"]


def test_signal_subscribe_model_not_found(client, auth_headers):
    """测试订阅不存在的模型信号"""
    resp = client.post(
        "/api/ml/signals/subscribe",
        json={
            "model_name": "non_existent_model",
            "vt_symbol": "rb2410.SHFE",
            "interval": 60
        },
        headers=auth_headers,
    )

    assert resp.status_code == 400
    assert "订阅失败" in resp.json()["detail"]


def test_signal_unsubscribe_not_found(client, auth_headers):
    """测试取消不存在的订阅"""
    resp = client.post(
        "/api/ml/signals/unsubscribe",
        params={"vt_symbol": "non_existent.SHFE"},
        headers=auth_headers,
    )

    assert resp.status_code == 404
    assert "未找到" in resp.json()["detail"]


def test_signal_subscriptions_list(client, auth_headers):
    """测试获取信号订阅列表"""
    resp = client.get("/api/ml/signals/subscriptions", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "subscriptions" in data
    assert "count" in data
    assert data["count"] == 0


def test_signal_history_empty(client, auth_headers):
    """测试获取空的信号历史"""
    resp = client.get("/api/ml/signals/history", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "signals" in data
    assert "count" in data
    assert data["count"] == 0


def test_signal_history_with_limit(client, auth_headers):
    """测试获取信号历史（带限制）"""
    resp = client.get("/api/ml/signals/history?limit=10", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0


def test_clear_signal_history(client, auth_headers):
    """测试清空信号历史"""
    resp = client.delete("/api/ml/signals/history", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_signal_service_status(client, auth_headers):
    """测试获取信号服务状态"""
    resp = client.get("/api/ml/signals/status", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "running" in data
    assert "subscription_count" in data
    assert "history_size" in data


# ========== 模型对比与回测测试 ==========

def test_compare_models_insufficient(client, auth_headers):
    """测试模型对比时模型数量不足"""
    resp = client.post(
        "/api/ml/models/compare",
        json={"model_names": ["model1"]},
        headers=auth_headers,
    )

    assert resp.status_code == 400
    assert "至少需要" in resp.json()["detail"]


def test_compare_models_not_found(client, auth_headers):
    """测试对比不存在的模型"""
    resp = client.post(
        "/api/ml/models/compare",
        json={"model_names": ["non_existent_1", "non_existent_2"]},
        headers=auth_headers,
    )

    assert resp.status_code == 400
    assert "有效模型不足" in resp.json()["detail"]


def test_ml_backtest_model_not_found(client, auth_headers):
    """测试回测时模型不存在"""
    resp = client.post(
        "/api/ml/backtest",
        json={
            "model_name": "non_existent_model",
            "vt_symbol": "rb2410.SHFE",
            "start": "2024-01-01",
            "end": "2024-03-01",
        },
        headers=auth_headers,
    )

    assert resp.status_code == 404
    assert "模型不存在" in resp.json()["detail"]


def test_ml_backtest_model_not_found(client, auth_headers):
    """测试回测时模型不存在"""
    resp = client.post(
        "/api/ml/backtest",
        json={
            "model_name": "non_existent_backtest_model",
            "vt_symbol": "rb2410.SHFE",
            "start": "2024-01-01",
            "end": "2024-03-01",
        },
        headers=auth_headers,
    )

    assert resp.status_code == 404
    assert "模型不存在" in resp.json()["detail"]


def test_delete_model_not_found(client, auth_headers):
    """测试删除不存在的模型"""
    resp = client.delete("/api/ml/models/non_existent_model", headers=auth_headers)

    assert resp.status_code == 404
    assert "模型不存在" in resp.json()["detail"]


def test_predict_model_not_found(client, auth_headers):
    """测试使用不存在的模型进行预测"""
    resp = client.post(
        "/api/ml/models/non_existent_model/predict",
        json={"close": 3800, "volume": 1000},
        headers=auth_headers,
    )

    assert resp.status_code == 404
    assert "模型不存在" in resp.json()["detail"]


def test_preview_features_various_indicators(client, auth_headers):
    """测试特征预览支持多种技术指标"""
    from datetime import datetime, timedelta
    base_date = datetime(2024, 1, 1)
    mock_history = [
        {
            "datetime": (base_date + timedelta(days=i)).strftime("%Y-%m-%dT%H:%M:%S"),
            "open_price": 3800 + i * 10,
            "high_price": 3850 + i * 10,
            "low_price": 3790 + i * 10,
            "close_price": 3840 + i * 10,
            "volume": 1000 + i * 100,
            "turnover": 3820000,
            "open_interest": 50000,
        }
        for i in range(100)
    ]

    # 测试全部技术指标
    all_indicators = ["sma", "ema", "rsi", "macd", "atr", "bollinger"]

    with patch("routers.ml.bridge.query_history", return_value=mock_history):
        resp = client.post(
            "/api/ml/features/preview",
            json={
                "vt_symbol": "rb2410.SHFE",
                "interval": "1d",
                "start": "2024-01-01",
                "end": "2024-04-01",
                "feature_config": {
                    "technical_indicators": all_indicators,
                    "window_sizes": [5, 10, 20, 60],
                    "target_horizon": 10,
                    "target_type": "direction",
                },
            },
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["features_count"] > len(all_indicators)  # 应该生成更多特征

    # 验证生成了预期的特征名称
    feature_names = [f["name"] for f in data["feature_stats"]]
    assert any("sma" in name for name in feature_names)
    assert any("rsi" in name for name in feature_names)
    assert any("macd" in name for name in feature_names)
    assert any("atr" in name for name in feature_names)
    assert any("bb_" in name for name in feature_names)


def test_preview_features_target_types(client, auth_headers):
    """测试特征预览支持不同的目标变量类型"""
    from datetime import datetime, timedelta
    base_date = datetime(2024, 1, 1)
    mock_history = [
        {
            "datetime": (base_date + timedelta(days=i)).strftime("%Y-%m-%dT%H:%M:%S"),
            "open_price": 3800 + i * 10,
            "high_price": 3850 + i * 10,
            "low_price": 3790 + i * 10,
            "close_price": 3840 + i * 10,
            "volume": 1000 + i * 100,
            "turnover": 3820000,
            "open_interest": 50000,
        }
        for i in range(100)
    ]

    # 测试 return 目标类型
    with patch("routers.ml.bridge.query_history", return_value=mock_history):
        resp = client.post(
            "/api/ml/features/preview",
            json={
                "vt_symbol": "rb2410.SHFE",
                "interval": "1d",
                "start": "2024-01-01",
                "end": "2024-04-01",
                "feature_config": {
                    "technical_indicators": ["sma", "rsi"],
                    "window_sizes": [5, 10],
                    "target_horizon": 5,
                    "target_type": "return",  # 收益率目标
                },
            },
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["target_config"]["type"] == "return"
    # return 类型应该有3个类别 (-inf, -2%, +2%, +inf)
    assert len(data["target_distribution"]) >= 2
