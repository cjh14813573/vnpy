"""JWT 认证模块"""

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from config import settings
from services.operation_log import operation_log, OperationType

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 密码加密
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ============ Pydantic 模型 ============

class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    username: str
    role: str


class UserInfo(BaseModel):
    username: str
    role: str
    last_login: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# ============ 数据库操作 ============

def _get_db() -> sqlite3.Connection:
    """获取数据库连接"""
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """初始化用户表"""
    conn = _get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'trader',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            is_active BOOLEAN DEFAULT 1
        )
    """)
    conn.commit()

    # 创建默认管理员
    cursor = conn.execute(
        "SELECT id FROM users WHERE username = ?",
        (settings.DEFAULT_ADMIN_USERNAME,)
    )
    if not cursor.fetchone():
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (
                settings.DEFAULT_ADMIN_USERNAME,
                pwd_context.hash(settings.DEFAULT_ADMIN_PASSWORD),
                "admin",
            ),
        )
        conn.commit()

    conn.close()


def get_user(username: str) -> Optional[dict]:
    """查询用户"""
    conn = _get_db()
    row = conn.execute(
        "SELECT username, password_hash, role, last_login, is_active FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def verify_password(plain: str, hashed: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    """哈希密码"""
    return pwd_context.hash(password)


def update_last_login(username: str):
    """更新最后登录时间"""
    conn = _get_db()
    conn.execute(
        "UPDATE users SET last_login = ? WHERE username = ?",
        (datetime.now(timezone.utc).isoformat(), username),
    )
    conn.commit()
    conn.close()


def change_password(username: str, old_password: str, new_password: str):
    """修改密码"""
    user = get_user(username)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if not verify_password(old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="原密码错误")

    conn = _get_db()
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE username = ?",
        (hash_password(new_password), username),
    )
    conn.commit()
    conn.close()


# ============ Token 管理 ============

def create_access_token(data: dict, remember_me: bool = False) -> str:
    """创建 JWT Token"""
    to_encode = data.copy()
    if remember_me:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REMEMBER_ME_EXPIRE_DAYS)
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """解码 JWT Token"""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """获取当前用户（FastAPI 依赖）"""
    payload = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token 格式错误")

    user = get_user(username)
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    return {"username": username, "role": user["role"]}


# ============ API 路由 ============

def get_client_ip(request: Request) -> str:
    """获取客户端IP"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request):
    """用户登录"""
    user = get_user(req.username)
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "")

    if not user or not verify_password(req.password, user["password_hash"]):
        # 记录登录失败
        operation_log.log(
            username=req.username,
            operation=OperationType.LOGIN,
            ip_address=client_ip,
            user_agent=user_agent,
            success=False,
            error_message="用户名或密码错误",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    if not user.get("is_active"):
        # 记录登录失败（账户禁用）
        operation_log.log(
            username=req.username,
            operation=OperationType.LOGIN,
            ip_address=client_ip,
            user_agent=user_agent,
            success=False,
            error_message="账户已禁用",
        )
        raise HTTPException(status_code=403, detail="账户已禁用")

    update_last_login(req.username)

    # 记录登录成功
    operation_log.log(
        username=req.username,
        operation=OperationType.LOGIN,
        ip_address=client_ip,
        user_agent=user_agent,
        success=True,
    )

    token = create_access_token(
        {"sub": req.username, "role": user["role"]},
        remember_me=req.remember_me,
    )

    expire_seconds = (
        settings.JWT_REMEMBER_ME_EXPIRE_DAYS * 86400
        if req.remember_me
        else settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return TokenResponse(
        access_token=token,
        expires_in=expire_seconds,
        username=req.username,
        role=user["role"],
    )


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    user = get_user(current_user["username"])
    return UserInfo(
        username=user["username"],
        role=user["role"],
        last_login=user.get("last_login"),
    )


@router.put("/password")
async def update_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """修改密码"""
    change_password(current_user["username"], req.old_password, req.new_password)
    return {"message": "密码修改成功"}


@router.post("/logout")
async def logout():
    """退出登录（客户端清除 Token 即可）"""
    return {"message": "已退出"}


@router.post("/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """刷新 Token"""
    user = get_user(current_user["username"])
    token = create_access_token(
        {"sub": user["username"], "role": user["role"]},
        remember_me=False,
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        username=user["username"],
        role=user["role"],
    )
