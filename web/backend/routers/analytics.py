"""交易数据分析路由"""

import time
import math
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from auth import get_current_user
from bridge import bridge

router = APIRouter(prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)])


@router.get("/performance/summary")
async def get_performance_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """获取交易绩效汇总"""
    try:
        # 获取交易数据
        trades = bridge.get_all_trades() or []

        if not trades:
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate": 0,
                "total_pnl": 0,
                "avg_pnl": 0,
                "max_profit": 0,
                "max_loss": 0,
                "profit_factor": 0,
                "sharpe_ratio": 0,
                "calmar_ratio": 0,
                "max_drawdown": 0,
            }

        # 计算基础指标
        total_trades = len(trades)
        pnl_list = [t.get("pnl", 0) for t in trades]
        winning = [p for p in pnl_list if p > 0]
        losing = [p for p in pnl_list if p < 0]

        total_pnl = sum(pnl_list)
        winning_trades = len(winning)
        losing_trades = len(losing)
        win_rate = winning_trades / total_trades if total_trades > 0 else 0

        # 盈亏比
        gross_profit = sum(winning) if winning else 0
        gross_loss = abs(sum(losing)) if losing else 1
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

        # 平均盈亏
        avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
        avg_win = sum(winning) / len(winning) if winning else 0
        avg_loss = sum(losing) / len(losing) if losing else 0

        # 最大盈亏
        max_profit = max(pnl_list) if pnl_list else 0
        max_loss = min(pnl_list) if pnl_list else 0

        # 计算收益率序列（简化处理）
        returns = []
        balance = 1000000  # 假设初始资金
        for pnl in pnl_list:
            ret = pnl / balance
            returns.append(ret)
            balance += pnl

        # Sharpe Ratio (假设无风险利率 3%)
        if len(returns) > 1:
            excess_returns = [r - 0.03/252 for r in returns]  # 日超额收益
            sharpe = np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252) if np.std(excess_returns) > 0 else 0
        else:
            sharpe = 0

        # 计算最大回撤
        cumulative = np.cumsum([0] + pnl_list)
        running_max = np.maximum.accumulate(cumulative)
        drawdown = (running_max - cumulative) / running_max
        max_drawdown = np.max(drawdown) if len(drawdown) > 0 else 0

        # Calmar Ratio
        annual_return = (balance - 1000000) / 1000000 if balance > 0 else 0
        calmar = annual_return / max_drawdown if max_drawdown > 0 else 0

        return {
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "win_rate": round(win_rate, 4),
            "win_rate_pct": round(win_rate * 100, 2),
            "total_pnl": round(total_pnl, 2),
            "avg_pnl": round(avg_pnl, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "max_profit": round(max_profit, 2),
            "max_loss": round(max_loss, 2),
            "profit_factor": round(profit_factor, 2),
            "sharpe_ratio": round(sharpe, 2),
            "calmar_ratio": round(calmar, 2),
            "max_drawdown": round(max_drawdown, 4),
            "max_drawdown_pct": round(max_drawdown * 100, 2),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"绩效分析失败: {str(e)}")


@router.get("/performance/attribution")
async def get_performance_attribution(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """获取绩效归因分析"""
    try:
        # 获取持仓和交易数据
        positions = bridge.get_all_positions() or []
        trades = bridge.get_all_trades() or []

        # 按品种归因
        symbol_pnl = {}
        for trade in trades:
            symbol = trade.get("vt_symbol", "")
            pnl = trade.get("pnl", 0)
            if symbol not in symbol_pnl:
                symbol_pnl[symbol] = {"pnl": 0, "trades": 0, "wins": 0}
            symbol_pnl[symbol]["pnl"] += pnl
            symbol_pnl[symbol]["trades"] += 1
            if pnl > 0:
                symbol_pnl[symbol]["wins"] += 1

        # 按方向归因
        direction_pnl = {"多": 0, "空": 0}
        for trade in trades:
            direction = trade.get("direction", "")
            pnl = trade.get("pnl", 0)
            if direction in ["多", "买入"]:
                direction_pnl["多"] += pnl
            elif direction in ["空", "卖出", "卖"]:
                direction_pnl["空"] += pnl

        # 按时间归因（按小时）
        hourly_pnl = {f"{h:02d}:00": 0 for h in range(24)}
        for trade in trades:
            trade_time = trade.get("trade_time", "")
            if trade_time:
                try:
                    hour = int(trade_time.split(":")[0])
                    pnl = trade.get("pnl", 0)
                    hourly_pnl[f"{hour:02d}:00"] += pnl
                except:
                    pass

        # 生成归因报告
        symbol_attribution = [
            {
                "symbol": symbol,
                "pnl": round(data["pnl"], 2),
                "trades": data["trades"],
                "win_rate": round(data["wins"] / data["trades"], 4) if data["trades"] > 0 else 0,
                "contribution_pct": 0,  # 稍后计算
            }
            for symbol, data in symbol_pnl.items()
        ]

        # 计算贡献百分比
        total_pnl = sum(abs(s["pnl"]) for s in symbol_attribution)
        for item in symbol_attribution:
            item["contribution_pct"] = round(abs(item["pnl"]) / total_pnl * 100, 2) if total_pnl > 0 else 0

        # 按盈亏排序
        symbol_attribution.sort(key=lambda x: x["pnl"], reverse=True)

        return {
            "symbol_attribution": symbol_attribution[:10],  # Top 10
            "direction_attribution": {
                "long_pnl": round(direction_pnl["多"], 2),
                "short_pnl": round(direction_pnl["空"], 2),
            },
            "hourly_attribution": hourly_pnl,
            "analysis_summary": {
                "best_symbol": symbol_attribution[0]["symbol"] if symbol_attribution else "",
                "best_symbol_pnl": symbol_attribution[0]["pnl"] if symbol_attribution else 0,
                "worst_symbol": symbol_attribution[-1]["symbol"] if symbol_attribution else "",
                "worst_symbol_pnl": symbol_attribution[-1]["pnl"] if symbol_attribution else 0,
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"归因分析失败: {str(e)}")


@router.get("/performance/monthly")
async def get_monthly_performance(
    months: int = Query(12, ge=1, le=24)
):
    """获取月度收益统计"""
    try:
        # 生成模拟的月度数据（实际应该从数据库查询）
        # 这里简化处理
        monthly_data = []
        now = datetime.now()

        for i in range(months - 1, -1, -1):
            month_date = now - timedelta(days=i * 30)
            # 模拟数据
            np.random.seed(i)
            pnl = np.random.normal(5000, 20000)
            trades = np.random.randint(10, 50)
            wins = np.random.randint(0, trades)

            monthly_data.append({
                "year_month": month_date.strftime("%Y-%m"),
                "pnl": round(pnl, 2),
                "trades": int(trades),
                "wins": int(wins),
                "win_rate": round(wins / trades, 4),
                "cumulative_pnl": 0  # 稍后计算
            })

        # 计算累计盈亏
        cumulative = 0
        for item in monthly_data:
            cumulative += item["pnl"]
            item["cumulative_pnl"] = round(cumulative, 2)

        return {
            "monthly_data": monthly_data,
            "summary": {
                "total_months": months,
                "profitable_months": len([m for m in monthly_data if m["pnl"] > 0]),
                "losing_months": len([m for m in monthly_data if m["pnl"] < 0]),
                "best_month": max(monthly_data, key=lambda x: x["pnl"])["year_month"] if monthly_data else "",
                "worst_month": min(monthly_data, key=lambda x: x["pnl"])["year_month"] if monthly_data else "",
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"月度统计失败: {str(e)}")


@router.get("/performance/daily")
async def get_daily_performance(
    days: int = Query(30, ge=1, le=365)
):
    """获取日收益统计"""
    try:
        # 生成模拟的日数据
        daily_data = []
        now = datetime.now()

        for i in range(days - 1, -1, -1):
            date = now - timedelta(days=i)
            np.random.seed(i)
            pnl = np.random.normal(200, 5000)

            daily_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "pnl": round(pnl, 2),
                "cumulative_pnl": 0,
                "drawdown": 0,
            })

        # 计算累计盈亏和回撤
        cumulative = 0
        peak = 0
        for item in daily_data:
            cumulative += item["pnl"]
            item["cumulative_pnl"] = round(cumulative, 2)
            if cumulative > peak:
                peak = cumulative
            drawdown = (peak - cumulative) / peak if peak > 0 else 0
            item["drawdown"] = round(drawdown * 100, 2)

        return {
            "daily_data": daily_data,
            "summary": {
                "total_days": days,
                "profitable_days": len([d for d in daily_data if d["pnl"] > 0]),
                "losing_days": len([d for d in daily_data if d["pnl"] < 0]),
                "max_daily_profit": max(d["pnl"] for d in daily_data) if daily_data else 0,
                "max_daily_loss": min(d["pnl"] for d in daily_data) if daily_data else 0,
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"日统计失败: {str(e)}")


@router.post("/report/export")
async def export_report(config: dict):
    """导出分析报告"""
    try:
        report_type = config.get("type", "performance")
        format_type = config.get("format", "json")
        date_range = config.get("date_range", {})

        # 根据报告类型获取数据
        if report_type == "performance":
            data = await get_performance_summary(
                date_range.get("start"),
                date_range.get("end")
            )
        elif report_type == "attribution":
            data = await get_performance_attribution(
                date_range.get("start"),
                date_range.get("end")
            )
        elif report_type == "monthly":
            data = await get_monthly_performance(date_range.get("months", 12))
        else:
            raise HTTPException(status_code=400, detail=f"未知报告类型: {report_type}")

        # 添加元数据
        report = {
            "metadata": {
                "report_type": report_type,
                "generated_at": datetime.now().isoformat(),
                "format": format_type,
                "date_range": date_range,
            },
            "data": data,
        }

        return report

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"报告导出失败: {str(e)}")


@router.get("/report/templates")
async def get_report_templates():
    """获取报告模板列表"""
    return [
        {
            "id": "daily_summary",
            "name": "日度交易总结",
            "description": "当日交易概况、盈亏分析",
            "default_params": {"days": 1}
        },
        {
            "id": "weekly_report",
            "name": "周度绩效报告",
            "description": "本周交易绩效、归因分析",
            "default_params": {"days": 7}
        },
        {
            "id": "monthly_report",
            "name": "月度绩效报告",
            "description": "月度收益统计、风险指标",
            "default_params": {"months": 1}
        },
        {
            "id": "quarterly_report",
            "name": "季度分析报告",
            "description": "季度综合绩效、策略分析",
            "default_params": {"months": 3}
        },
    ]


@router.get("/benchmark/compare")
async def get_benchmark_comparison(
    benchmark: str = Query("sh000300", description="基准代码，如上证指数sh000300")
):
    """获取与基准的对比"""
    try:
        # 模拟基准对比数据
        # 实际应该从数据源获取基准数据
        periods = ["1M", "3M", "6M", "1Y", "YTD"]

        comparison = []
        for period in periods:
            # 模拟策略收益和基准收益
            np.random.seed(ord(period[0]))
            strategy_return = np.random.normal(0.05, 0.1)
            benchmark_return = np.random.normal(0.03, 0.08)
            alpha = strategy_return - benchmark_return

            comparison.append({
                "period": period,
                "strategy_return": round(strategy_return * 100, 2),
                "benchmark_return": round(benchmark_return * 100, 2),
                "alpha": round(alpha * 100, 2),
                "beta": round(np.random.uniform(0.8, 1.2), 2),
                "information_ratio": round(np.random.uniform(-1, 2), 2),
            })

        return {
            "benchmark_code": benchmark,
            "benchmark_name": "沪深300" if benchmark == "sh000300" else benchmark,
            "comparison": comparison,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"基准对比失败: {str(e)}")
