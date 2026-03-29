"""vnpy Web 后端入口"""

import asyncio
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from auth import router as auth_router, init_db, decode_token
from bridge import bridge
from ws_manager import ws_manager

from routers.system import router as system_router
from routers.market import router as market_router
from routers.trading import router as trading_router
from routers.strategy import router as strategy_router
from routers.backtest import router as backtest_router
from routers.data import router as data_router
from routers.risk import router as risk_router
from routers.paper import router as paper_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    # 启动时初始化
    init_db()
    bridge.init()

    # 注册 WebSocket 推送
    async def ws_push(topic: str, data: dict):
        await ws_manager.broadcast({"topic": topic, "data": data})

    bridge.register_ws_callback(ws_push)

    yield

    # 关闭时清理
    pass


app = FastAPI(
    title=settings.APP_NAME,
    description="vnpy Web 交易系统 API",
    version="0.1.0",
    lifespan=lifespan,
)

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


@app.get("/")
async def root():
    return {"message": "vnpy Web API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 连接（需携带 token 参数）"""
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
    await ws_manager.connect(websocket, client_id)

    try:
        while True:
            # 接收客户端消息（心跳/订阅请求等）
            data = await websocket.receive_json()
            # 简单的心跳回应
            if data.get("type") == "ping":
                await ws_manager.send_personal(client_id, {"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(client_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
