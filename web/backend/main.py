"""vnpy Web 后端入口"""

import asyncio
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from auth import router as auth_router, init_db, decode_token
from bridge import bridge
from ws_manager import ws_manager
from services.backtest_runner import backtest_runner
from services.rate_limiter import rate_limiter
from services.pnl_calculator import pnl_calculator
from dependencies import RateLimitMiddleware

from routers.system import router as system_router
from routers.market import router as market_router
from routers.trading import router as trading_router
from routers.strategy import router as strategy_router
from routers.backtest import router as backtest_router
from routers.data import router as data_router
from routers.risk import router as risk_router
from routers.paper import router as paper_router
from routers.algo import router as algo_router
from routers.editor import router as editor_router
from routers.ml import router as ml_router
from routers.logs import router as logs_router
from routers.settings import router as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    # 初始化用户数据库（必须在最前面）
    init_db()

    # 注册 vnpy 事件推送回调（带订阅过滤）
    async def on_bridge_event(topic: str, data: dict, symbol: str = None):
        """处理 vnpy 事件，根据订阅过滤推送"""
        if symbol:
            # 只推送给订阅了该合约的客户端
            await ws_manager.broadcast_to_subscribers(symbol, {
                "type": "event",
                "topic": topic,
                "data": data,
                "timestamp": time.time()
            })
        else:
            # 全量广播（account, log, contract 等）
            await ws_manager.broadcast({
                "type": "event",
                "topic": topic,
                "data": data,
                "timestamp": time.time()
            })

    bridge.register_ws_callback(on_bridge_event)

    # 注册回测进度回调（广播到所有客户端）
    def on_backtest_progress(task_id: str, progress: int, message: str):
        """回测进度回调 - 广播到所有 WebSocket 客户端"""
        asyncio.create_task(ws_manager.broadcast({
            "type": "backtest_progress",
            "task_id": task_id,
            "progress": progress,
            "message": message,
            "timestamp": time.time()
        }))

    backtest_runner.register_progress_callback(on_backtest_progress)

    # 配置限流
    if settings.RATE_LIMIT_ENABLED:
        rate_limiter.DEFAULT_RATE = settings.RATE_LIMIT_DEFAULT_RATE
        rate_limiter.DEFAULT_CAPACITY = settings.RATE_LIMIT_DEFAULT_CAPACITY
        # 登录接口更严格（防爆破）
        rate_limiter.set_endpoint_limit("POST", "/api/auth/login", settings.RATE_LIMIT_LOGIN_RATE, 10)
        # 下单接口限制
        rate_limiter.set_endpoint_limit("POST", "/api/trading/order", 5, 10)

    # 启动实时盈亏计算器
    pnl_calculator.start()

    yield

    # 清理：停止盈亏计算器
    pnl_calculator.stop()

    # 清理：取消所有运行中的回测任务
    for task in backtest_runner.get_all_tasks(status="running"):
        backtest_runner.cancel_task(task["task_id"])


app = FastAPI(
    title=settings.APP_NAME,
    description="vnpy Web 交易系统 API",
    version="0.1.0",
    lifespan=lifespan,
)

# 限流中间件（在CORS之前）
app.add_middleware(RateLimitMiddleware, skip_paths=["/health", "/docs", "/openapi.json", "/"])

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router)
app.include_router(system_router)
app.include_router(market_router)
app.include_router(trading_router)
app.include_router(strategy_router)
app.include_router(backtest_router)
app.include_router(data_router)
app.include_router(risk_router)
app.include_router(paper_router)
app.include_router(algo_router)
app.include_router(editor_router)
app.include_router(ml_router)
app.include_router(logs_router)
app.include_router(settings_router)


@app.get("/")
async def root():
    return {"message": "vnpy Web API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 连接（需携带 token 参数）

    支持的消息类型：
    - {"type": "ping"} - 心跳
    - {"type": "subscribe", "symbols": ["rb2410.SHFE", "cu2505.SHFE"]} - 订阅合约
    - {"type": "unsubscribe", "symbols": ["cu2505.SHFE"]} - 取消订阅
    - {"type": "get_subscriptions"} - 获取当前订阅列表
    """
    # 从 query 参数获取 token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_token(token)
        username = payload.get("sub")
        if not username:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    client_id = f"{username}_{uuid.uuid4().hex[:8]}"
    conn_info = await ws_manager.connect(websocket, client_id, username)

    try:
        while True:
            # 接收客户端消息
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                # 心跳检测
                ws_manager.update_heartbeat(client_id)
                await ws_manager.send_pong(client_id)

            elif msg_type == "subscribe":
                # 订阅合约
                symbols = data.get("symbols", [])
                if symbols:
                    await ws_manager.subscribe(client_id, symbols)
                    await ws_manager.send_personal(client_id, {
                        "type": "subscribe_response",
                        "success": True,
                        "subscribed": symbols,
                        "total_subscriptions": len(conn_info.get_subscriptions())
                    })

            elif msg_type == "unsubscribe":
                # 取消订阅
                symbols = data.get("symbols", [])
                if symbols:
                    await ws_manager.unsubscribe(client_id, symbols)
                    await ws_manager.send_personal(client_id, {
                        "type": "unsubscribe_response",
                        "success": True,
                        "unsubscribed": symbols,
                        "total_subscriptions": len(conn_info.get_subscriptions())
                    })

            elif msg_type == "get_subscriptions":
                # 获取当前订阅列表
                subs = await ws_manager.get_subscriptions(client_id)
                await ws_manager.send_personal(client_id, {
                    "type": "subscriptions",
                    "symbols": subs or []
                })

            elif msg_type == "subscribe_all":
                # 订阅所有行情（谨慎使用）
                await ws_manager.send_personal(client_id, {
                    "type": "warning",
                    "message": "subscribe_all not supported, use subscribe with specific symbols"
                })

    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(client_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
