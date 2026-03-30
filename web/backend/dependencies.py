"""FastAPI 依赖项

包含限流、认证等共享依赖。
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional

from config import settings
from services.rate_limiter import rate_limiter


async def rate_limit_dependency(request: Request):
    """限流依赖

    使用方式:
        @router.get("/endpoint", dependencies=[Depends(rate_limit_dependency)])
        async def endpoint():
            ...

    或在路由集合上应用:
        router = APIRouter(dependencies=[Depends(rate_limit_dependency)])
    """
    if not settings.RATE_LIMIT_ENABLED:
        return

    # 获取用户ID（已认证）或None
    user_id = None
    if hasattr(request.state, "user") and request.state.user:
        user_id = request.state.user.get("username")

    # 获取客户端IP
    client_ip = request.client.host if request.client else "unknown"
    # 考虑反向代理
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    # 检查限流
    allowed, headers = rate_limiter.is_allowed(
        method=request.method,
        path=request.url.path,
        user_id=user_id,
        client_ip=client_ip
    )

    # 将限流信息存入请求状态，供响应使用
    request.state.rate_limit_headers = headers

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请稍后重试",
            headers={**headers, "Retry-After": headers.get("Retry-After", "60")}
        )


class RateLimitMiddleware:
    """限流中间件 - 全局应用"""

    def __init__(self, app, skip_paths: Optional[list[str]] = None):
        self.app = app
        self.skip_paths = skip_paths or ["/health", "/docs", "/openapi.json"]

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from starlette.requests import Request

        request = Request(scope, receive)
        path = request.url.path

        # 跳过特定路径
        if any(path.startswith(skip) for skip in self.skip_paths):
            await self.app(scope, receive, send)
            return

        # 检查限流
        if settings.RATE_LIMIT_ENABLED:
            user_id = None
            # 尝试从 Authorization 头解析用户（简单处理）
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                try:
                    from auth import decode_token
                    token = auth_header[7:]
                    payload = decode_token(token)
                    user_id = payload.get("sub")
                except Exception:
                    pass

            client_ip = request.client.host if request.client else "unknown"
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                client_ip = forwarded.split(",")[0].strip()

            allowed, headers = rate_limiter.is_allowed(
                method=request.method,
                path=path,
                user_id=user_id,
                client_ip=client_ip
            )

            if not allowed:
                response = JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "请求过于频繁，请稍后重试"},
                    headers=headers
                )
                await response(scope, receive, send)
                return

            # 包装 send 以添加限流头
            original_send = send

            async def send_with_headers(message):
                if message["type"] == "http.response.start":
                    headers_list = message.get("headers", [])
                    # 添加限流头
                    for key, value in headers.items():
                        headers_list.append([key.encode(), value.encode()])
                    message["headers"] = headers_list
                await original_send(message)

            await self.app(scope, receive, send_with_headers)
        else:
            await self.app(scope, receive, send)


def get_rate_limit_headers(request: Request) -> dict:
    """获取当前请求的限流头信息"""
    return getattr(request.state, "rate_limit_headers", {})
