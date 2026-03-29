"""vnpy RPC 服务端 - 启动 MainEngine + WebEngine(RPC)"""
import os
import sys
import signal
import time

# 设置 ta-lib 库路径
os.environ["LD_LIBRARY_PATH"] = os.path.expanduser("~/.local/lib") + ":" + os.environ.get("LD_LIBRARY_PATH", "")

from vnpy.event import EventEngine
from vnpy.trader.engine import MainEngine
from vnpy.trader.object import LogData
from vnpy.trader.event import EVENT_LOG
from vnpy.trader.utility import get_file_path

# 加载 web_trader 配置
import json
setting_path = get_file_path("web_trader_setting.json")
with open(setting_path) as f:
    setting = json.load(f)

REQ_ADDRESS = setting["req_address"]
SUB_ADDRESS = setting["sub_address"]

print("=" * 50)
print("vnpy RPC 服务端启动")
print(f"REP 地址: {REQ_ADDRESS}")
print(f"PUB 地址: {SUB_ADDRESS}")
print("=" * 50)

# 创建引擎
event_engine = EventEngine()
main_engine = MainEngine(event_engine)

# 加载网关和应用
from vnpy_ctp import CtpGateway
main_engine.add_gateway(CtpGateway)

# 加载 WebTrader/ScriptTrader 等应用
from vnpy_webtrader import WebTraderApp
main_engine.add_app(WebTraderApp)

# 注册日志输出
def on_log(event):
    log: LogData = event.data
    print(f"[LOG] {log.msg}")

event_engine.register(EVENT_LOG, on_log)

# 启动 RPC 服务
web_engine = main_engine.get_engine("RpcService")
web_engine.start_server(REQ_ADDRESS, SUB_ADDRESS)

print(f"\nRPC 服务已启动！")
print(f"  REP: {REQ_ADDRESS}")
print(f"  PUB: {SUB_ADDRESS}")
print(f"\n按 Ctrl+C 停止服务\n")

# 保持运行
def signal_handler(sig, frame):
    print("\n正在停止服务...")
    web_engine.close()
    main_engine.close()
    event_engine.stop()
    print("服务已停止")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

while True:
    time.sleep(1)
