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

    model_config = {"env_prefix": "VNPY_WEB_"}


settings = Settings()
