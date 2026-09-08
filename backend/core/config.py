import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Syllabus Surgeon"
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"

    # Database connection URL (PostgreSQL default, with SQLite fallback support)
    database_url: str = "postgresql+psycopg2://syllabus_user:syllabus_password@localhost:5432/syllabus_surgeon"

    # JWT Authentication
    jwt_secret_key: str = "syllabus-surgeon-dev-jwt-secret-key-32charsmin!"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # For backward compatibility
    @property
    def jwt_secret(self) -> str:
        return self.jwt_secret_key

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

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
