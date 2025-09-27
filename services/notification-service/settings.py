from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://notify:notify@notification-db:5432/notify"
    redis_url: str = "redis://redis:6379"
    internal_token: str = "change-me"

    class Config:
        env_prefix = "NOTIFICATION_"
        env_file = [".env.notification", ".env", ".env.development"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
