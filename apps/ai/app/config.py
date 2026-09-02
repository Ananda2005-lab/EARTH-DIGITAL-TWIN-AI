"""
Application settings loaded from environment variables / .env file.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Auth
    ai_service_token: str = ""

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    max_tokens: int = 2000
    temperature: float = 0.7

    # Server
    port: int = 8000
    host: str = "0.0.0.0"
    log_level: str = "info"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:4000"


settings = Settings()
