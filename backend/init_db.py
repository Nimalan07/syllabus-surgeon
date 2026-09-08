import subprocess
import sys
from core.database import Base, engine
from models import database


def initialize_database() -> None:
    # Try running Alembic migrations first
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        check=False,
    )

    if result.returncode != 0:
        print("Alembic command exited with non-zero code. Ensuring tables exist via Base.metadata...")
        Base.metadata.create_all(bind=engine)
        print("Database tables ensured successfully.")
        return

    print("Database migrations applied successfully.")


if __name__ == "__main__":
    initialize_database()
