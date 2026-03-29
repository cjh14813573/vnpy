"""启动 vnpy WebTrader 前端 (FastAPI)"""
import os
import sys

os.environ["LD_LIBRARY_PATH"] = os.path.expanduser("~/.local/lib") + ":" + os.environ.get("LD_LIBRARY_PATH", "")

import uvicorn
from vnpy_webtrader.web import app

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"vnpy WebTrader 前端启动于 http://0.0.0.0:{port}")
    print(f"用户名: admin, 密码: vnpy2024")
    uvicorn.run(app, host="0.0.0.0", port=port)
