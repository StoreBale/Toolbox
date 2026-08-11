from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://toolbox:toolbox@localhost:5432/toolbox"
    frontend_origins: str = "http://localhost:5173"
    google_client_id: str = ""
    session_days: int = 30
    admin_session_secret: str = ""
    admin_cookie_secure: bool = False

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
