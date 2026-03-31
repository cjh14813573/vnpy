"""实时盈亏计算器

定时计算账户和持仓的实时盈亏，并通过 WebSocket 推送
"""

import asyncio
import time
from typing import Any, Optional

from bridge import bridge
from ws_manager import ws_manager


class PnLCalculator:
    """实时盈亏计算器"""

    def __init__(self, interval: float = 1.0):
        self._interval = interval  # 计算间隔（秒）
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_pnl: dict[str, Any] = {}

    def start(self):
        """启动计算器"""
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._calculate_loop())

    def stop(self):
        """停止计算器"""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _calculate_loop(self):
        """计算循环"""
        while self._running:
            try:
                await self._calculate_and_broadcast()
            except Exception as e:
                print(f"PnL calculation error: {e}")
            await asyncio.sleep(self._interval)

    async def _calculate_and_broadcast(self):
        """计算并广播盈亏"""
        # 获取所有账户
        accounts = bridge.get_all_accounts()

        # 获取所有持仓（实盘+模拟盘）
        positions = bridge.get_all_positions(include_paper=True)

        # 获取所有合约的最新行情
        ticks: dict[str, dict] = {}
        for pos in positions:
            vt_symbol = pos.get("vt_symbol")
            if vt_symbol and vt_symbol not in ticks:
                tick = bridge.get_tick(vt_symbol)
                if tick:
                    ticks[vt_symbol] = tick

        # 计算持仓盈亏
        position_pnl = []
        total_realized_pnl = 0  # 已实现盈亏
        total_unrealized_pnl = 0  # 未实现盈亏

        for pos in positions:
            vt_symbol = pos.get("vt_symbol", "")
            volume = pos.get("volume", 0)
            direction = pos.get("direction", "多")
            avg_price = pos.get("price", 0)
            is_paper = pos.get("is_paper", False) or pos.get("account_type") == "paper"

            tick = ticks.get(vt_symbol)
            if tick and volume != 0:
                last_price = tick.get("last_price", avg_price)
                # 计算浮动盈亏
                if direction == "多":
                    unrealized = (last_price - avg_price) * volume
                else:
                    unrealized = (avg_price - last_price) * volume

                # 已实现盈亏（从持仓数据获取）
                realized = pos.get("pnl", 0)

                position_pnl.append({
                    "vt_symbol": vt_symbol,
                    "volume": volume,
                    "direction": direction,
                    "avg_price": avg_price,
                    "last_price": last_price,
                    "unrealized_pnl": round(unrealized, 2),
                    "realized_pnl": round(realized, 2),
                    "total_pnl": round(unrealized + realized, 2),
                    "is_paper": is_paper,
                })

                if is_paper:
                    # 模拟盘的盈亏单独计算
                    pass
                else:
                    total_unrealized_pnl += unrealized
                    total_realized_pnl += realized

        # 计算账户汇总
        account_summary = []
        total_balance = 0
        total_available = 0
        total_margin = 0

        for acc in accounts:
            balance = acc.get("balance", 0)
            available = acc.get("available", 0)
            frozen = acc.get("frozen", 0)
            margin = acc.get("margin", 0)
            is_paper = acc.get("account_type") == "paper"

            account_summary.append({
                "gateway_name": acc.get("gateway_name", ""),
                "accountid": acc.get("accountid", ""),
                "account_type": acc.get("account_type", "real"),
                "balance": round(balance, 2),
                "available": round(available, 2),
                "frozen": round(frozen, 2),
                "margin": round(margin, 2),
                "is_paper": is_paper,
            })

            total_balance += balance
            total_available += available
            total_margin += margin

        # 构建盈亏数据
        pnl_data = {
            "timestamp": time.time(),
            "summary": {
                "total_balance": round(total_balance, 2),
                "total_available": round(total_available, 2),
                "total_margin": round(total_margin, 2),
                "total_realized_pnl": round(total_realized_pnl, 2),
                "total_unrealized_pnl": round(total_unrealized_pnl, 2),
                "total_pnl": round(total_realized_pnl + total_unrealized_pnl, 2),
            },
            "accounts": account_summary,
            "positions": position_pnl,
        }

        # 检查是否有变化
        has_changed = self._has_changed(pnl_data)
        self._last_pnl = pnl_data

        # 无论是否变化都广播（前端需要定时刷新）
        await ws_manager.broadcast({
            "type": "pnl_update",
            "data": pnl_data
        })

    def _has_changed(self, new_pnl: dict) -> bool:
        """检查盈亏数据是否有显著变化"""
        if not self._last_pnl:
            return True

        old_positions = {p["vt_symbol"]: p for p in self._last_pnl.get("positions", [])}
        new_positions = {p["vt_symbol"]: p for p in new_pnl.get("positions", [])}

        # 检查持仓数量变化
        if set(old_positions.keys()) != set(new_positions.keys()):
            return True

        # 检查盈亏变化超过1元
        for vt_symbol, new_pos in new_positions.items():
            old_pos = old_positions.get(vt_symbol)
            if not old_pos:
                return True
            if abs(new_pos.get("unrealized_pnl", 0) - old_pos.get("unrealized_pnl", 0)) >= 1:
                return True

        return False

    def get_last_pnl(self) -> dict:
        """获取最新的盈亏数据"""
        return self._last_pnl


# 全局实例
pnl_calculator = PnLCalculator(interval=1.0)  # 每秒计算一次
