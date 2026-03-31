"""全局配置管理路由"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Optional
from pydantic import BaseModel
from auth import get_current_user
import json
import os

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(get_current_user)])

# 配置文件路径
SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "settings.json")

# 默认配置
DEFAULT_SETTINGS = {
    # 交易设置
    "trading": {
        "default_volume": 1,
        "default_slippage": 0.0,
        "confirm_before_order": True,
        "auto_refresh_interval": 3,
    },
    # 回测设置
    "backtest": {
        "default_capital": 1000000,
        "default_rate": 0.0001,
        "default_slippage": 0.0,
        "default_size": 1,
        "default_interval": "1m",
    },
    # 显示设置
    "display": {
        "theme": "light",
        "chart_type": "lightweight",  # lightweight / echarts
        "show_trade_markers": True,
        "language": "zh-CN",
    },
    # 通知设置
    "notification": {
        "order_filled": True,
        "order_rejected": True,
        "stop_loss_triggered": True,
        "take_profit_triggered": True,
        "price_alert": True,
    },
    # 风控设置
    "risk": {
        "daily_loss_limit": 10000,
        "single_order_limit": 100,
        "enable_order_flow_control": True,
    },
}


def _ensure_data_dir():
    """确保数据目录存在"""
    data_dir = os.path.dirname(SETTINGS_FILE)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)


def _load_settings() -> dict:
    """加载配置"""
    _ensure_data_dir()
    if not os.path.exists(SETTINGS_FILE):
        return DEFAULT_SETTINGS.copy()

    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            saved = json.load(f)
            # 合并默认值和用户保存的配置
            settings = DEFAULT_SETTINGS.copy()
            _deep_update(settings, saved)
            return settings
    except Exception:
        return DEFAULT_SETTINGS.copy()


def _save_settings(settings: dict):
    """保存配置"""
    _ensure_data_dir()
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


def _deep_update(base: dict, update: dict):
    """深度更新字典"""
    for key, value in update.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_update(base[key], value)
        else:
            base[key] = value


class SettingsUpdateRequest(BaseModel):
    category: str
    key: str
    value: Any


@router.get("")
async def get_settings():
    """获取所有配置"""
    return _load_settings()


@router.get("/{category}")
async def get_category_settings(category: str):
    """获取指定分类的配置"""
    settings = _load_settings()
    if category not in settings:
        raise HTTPException(status_code=404, detail=f"配置分类不存在: {category}")
    return settings[category]


@router.put("/{category}/{key}")
async def update_setting(category: str, key: str, body: dict):
    """更新单个配置项"""
    settings = _load_settings()

    if category not in settings:
        raise HTTPException(status_code=404, detail=f"配置分类不存在: {category}")

    if key not in settings[category]:
        # 允许添加新键
        pass

    settings[category][key] = body.get("value")
    _save_settings(settings)

    return {"success": True, "category": category, "key": key, "value": body.get("value")}


@router.put("/{category}")
async def update_category_settings(category: str, body: dict):
    """更新整个分类的配置"""
    settings = _load_settings()

    if category not in settings:
        raise HTTPException(status_code=404, detail=f"配置分类不存在: {category}")

    # 只更新提供的键
    for key, value in body.items():
        settings[category][key] = value

    _save_settings(settings)

    return {"success": True, "category": category, "settings": settings[category]}


@router.post("/reset")
async def reset_settings(category: Optional[str] = None):
    """重置配置为默认值

    Args:
        category: 要重置的分类，不传则重置所有
    """
    if category:
        settings = _load_settings()
        if category not in DEFAULT_SETTINGS:
            raise HTTPException(status_code=404, detail=f"配置分类不存在: {category}")
        settings[category] = DEFAULT_SETTINGS[category].copy()
        _save_settings(settings)
        return {"success": True, "message": f"{category} 已重置为默认值"}
    else:
        _save_settings(DEFAULT_SETTINGS.copy())
        return {"success": True, "message": "所有配置已重置为默认值"}


@router.get("/user/preferences")
async def get_user_preferences():
    """获取用户偏好设置（简化接口）"""
    settings = _load_settings()
    return {
        "trading": settings.get("trading", {}),
        "display": settings.get("display", {}),
        "notification": settings.get("notification", {}),
    }
