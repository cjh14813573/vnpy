"""vnpy 回测演示 — 下载数据到数据库 → 回测"""

import vnpy
print(f"vnpy 版本: {vnpy.__version__}\n")

from datetime import datetime
from logging import INFO

from vnpy.trader.setting import SETTINGS
from vnpy.trader.database import get_database
from vnpy.trader.object import BarData
from vnpy.trader.constant import Exchange, Interval

SETTINGS["log.level"] = INFO

# ========== 第一步：用 AKShare 下载数据写入数据库 ==========
import akshare as ak

print("===== 第一步：下载沪深300 ETF 数据 =====")
df = ak.fund_etf_hist_em(
    symbol="510300",
    period="daily",
    start_date="20230101",
    end_date="20241231",
    adjust="qfq"
)
print(f"AKShare 返回 {len(df)} 条数据")

# 转换为 BarData
bars: list[BarData] = []
for _, row in df.iterrows():
    bar = BarData(
        symbol="510300",
        exchange=Exchange.SSE,
        datetime=datetime.strptime(str(row["日期"])[:10], "%Y-%m-%d"),
        interval=Interval.DAILY,
        open_price=float(row["开盘"]),
        high_price=float(row["最高"]),
        low_price=float(row["最低"]),
        close_price=float(row["收盘"]),
        volume=float(row["成交量"]),
        turnover=float(row["成交额"]),
        gateway_name="AKSHARE"
    )
    bars.append(bar)

print(f"转换为 {len(bars)} 根 Bar 数据")

# 写入数据库
db = get_database()
db.save_bar_data(bars)
print(f"已写入 SQLite 数据库\n")

# ========== 第二步：回测 ==========
from vnpy_ctastrategy.backtesting import BacktestingEngine
from vnpy_ctastrategy.strategies.double_ma_strategy import DoubleMaStrategy

print("===== 第二步：双均线策略回测 =====")

engine = BacktestingEngine()
engine.set_parameters(
    vt_symbol="510300.SSE",
    interval="d",
    start=datetime(2023, 1, 1),
    end=datetime(2024, 12, 31),
    rate=0.0003,
    slippage=0.0001,
    size=1,
    pricetick=0.001,
    capital=1_000_000,
)

engine.add_strategy(DoubleMaStrategy, {"fast_window": 10, "slow_window": 20})

print("加载数据...")
engine.load_data()

print("开始回测...")
engine.run_backtesting()

print("\n计算结果...")
engine.calculate_result()

print("\n===== 回测统计 =====")
engine.calculate_statistics()

# 生成图表并保存
try:
    engine.show_chart()
    print("\n图表已生成")
except Exception as e:
    print(f"\n图表生成跳过（无GUI环境）: {e}")
