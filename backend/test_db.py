from sqlalchemy import create_engine, text
from core.config import settings

try:
    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print("PostgreSQL connection successful:", result.scalar())
except Exception as e:
    print(f"Could not connect to PostgreSQL ({e}).")
    print("If running locally without PostgreSQL Docker container, SQLite fallback is active.")
