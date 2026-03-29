"""SimNow 连接测试脚本（备用地址）"""
from time import sleep

from vnpy.event import EventEngine
from vnpy.trader.engine import MainEngine
from vnpy.trader.logger import INFO
from vnpy.trader.setting import SETTINGS
from vnpy.trader.object import LogData
from vnpy.trader.event import EVENT_LOG, EVENT_CONTRACT, EVENT_ACCOUNT
from vnpy_ctp import CtpGateway

SETTINGS["log.active"] = True
SETTINGS["log.level"] = INFO
SETTINGS["log.console"] = True

# SimNow 备用地址（可达）
SIMNOW_SETTING = {
    "用户名": "258760",
    "密码": "abcmaking4527077",
    "经纪商代码": "9999",
    "交易服务器": "182.254.243.31:40001",
    "行情服务器": "182.254.243.31:40011",
    "产品名称": "simnow_client_test",
    "授权编码": "0000000000000000",
    "柜台环境": "实盘",
}

LEVEL_NAMES = {10: "DEBUG", 20: "INFO", 30: "WARNING", 40: "ERROR"}


def on_log(event):
    log: LogData = event.data
    name = LEVEL_NAMES.get(log.level, str(log.level))
    print(f"[{name}] {log.msg}")


def on_contract(event):
    contract = event.data
    print(f"[合约] {contract.vt_symbol} - {contract.name}")


def on_account(event):
    account = event.data
    print(f"[账户] {account.vt_accountid} 余额={account.balance} 可用={account.available}")


def main():
    print("=" * 50)
    print("SimNow 连接测试（备用地址 182.254.243.31）")
    print("=" * 50)

    event_engine = EventEngine()
    main_engine = MainEngine(event_engine)
    main_engine.add_gateway(CtpGateway)

    event_engine.register(EVENT_LOG, on_log)
    event_engine.register(EVENT_CONTRACT, on_contract)
    event_engine.register(EVENT_ACCOUNT, on_account)

    print("主引擎创建成功，开始连接...")
    main_engine.connect(SIMNOW_SETTING, "CTP")

    print("等待 25 秒接收数据...")
    sleep(25)

    contracts = main_engine.get_all_contracts()
    accounts = main_engine.get_all_accounts()

    print(f"\n结果：获取到 {len(contracts)} 个合约, {len(accounts)} 个账户")

    if contracts:
        print("前 10 个合约:")
        for c in contracts[:10]:
            print(f"  - {c.vt_symbol} ({c.name})")

    for a in accounts:
        print(f"账户: {a.vt_accountid} 余额={a.balance} 可用={a.available}")

    main_engine.close()
    print("测试完成")


if __name__ == "__main__":
    main()
