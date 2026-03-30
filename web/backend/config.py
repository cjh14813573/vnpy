"""应用配置"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置项"""

    APP_NAME: str = "vnpy-web"
    DEBUG: bool = False

    # JWT
    JWT_SECRET_KEY: str = "vnpy-web-dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时
    JWT_REMEMBER_ME_EXPIRE_DAYS: int = 7

    # 数据库
    DB_PATH: str = "users.db"

    # vnpy
    VNPY_GATEWAY_CONFIG_DIR: str = "./gateway_settings"

    # 默认管理员（首次启动自动创建）
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"

    # 限流配置
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT_RATE: int = 10       # 每秒默认10请求
    RATE_LIMIT_DEFAULT_CAPACITY: int = 20   # 默认桶容量（突发20请求）
    RATE_LIMIT_LOGIN_RATE: int = 5          # 登录接口每秒5请求（防爆破）
    RATE_LIMIT_WS_RATE: int = 30            # WebSocket每秒30消息

    model_config = {"env_prefix": "VNPY_WEB_"}


settings = Settings()
