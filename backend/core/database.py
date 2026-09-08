from collections.abc import Generator
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from core.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def create_db_engine():
    db_url = settings.database_url
    connect_args = {}
    if db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        return create_engine(
            db_url,
            connect_args=connect_args,
            pool_pre_ping=True,
            future=True,
        )

    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            future=True,
        )
        # Test connection
        with engine.connect() as conn:
            pass
        return engine
    except Exception as e:
        logger.warning(
            f"Could not connect to PostgreSQL at {db_url} ({e}). Falling back to local SQLite database for development."
        )
        sqlite_url = "sqlite:///./syllabus_surgeon.db"
        return create_engine(
            sqlite_url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
            future=True,
        )


engine = create_db_engine()

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
