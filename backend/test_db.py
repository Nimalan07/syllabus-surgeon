from sqlalchemy import create_engine, text
from core.config import settings


def test_database_connection() -> None:
    engine = create_engine(settings.database_url)

    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        assert result.scalar() == 1

    print("PostgreSQL connection successful.")


if __name__ == "__main__":
    test_database_connection()
