import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Syllabus Surgeon"
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    database_url: str = "sqlite:///./syllabus_surgeon.db"

    jwt_secret: str = "syllabus-surgeon-dev-jwt-secret-key-32charsmin!"
    jwt_algorithm: str = "HS256"

    max_upload_size_mb: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
