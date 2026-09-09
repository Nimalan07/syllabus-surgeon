import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import Base, engine
from routes import assessments, auth, courses, questions, study_sessions, upload, workspaces

def ensure_database_schema():
    try:
        Base.metadata.create_all(bind=engine)
        with engine.begin() as conn:
            dialect = engine.dialect.name
            if dialect == "sqlite":
                try:
                    tables = [t[0] for t in conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
                    if "users" in tables:
                        info = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
                        col_names = [col[1] for col in info]
                        if "password_hash" not in col_names:
                            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")
                            if "hashed_password" in col_names:
                                conn.exec_driver_sql("UPDATE users SET password_hash = hashed_password WHERE password_hash IS NULL")

                    if "study_sessions" in tables:
                        info = conn.exec_driver_sql("PRAGMA table_info(study_sessions)").fetchall()
                        col_names = [col[1] for col in info]
                        if "course_id" not in col_names:
                            conn.exec_driver_sql("ALTER TABLE study_sessions ADD COLUMN course_id CHAR(32)")
                        if "updated_at" not in col_names:
                            conn.exec_driver_sql("ALTER TABLE study_sessions ADD COLUMN updated_at DATETIME")
                        if "workspace_id" not in col_names:
                            conn.exec_driver_sql("ALTER TABLE study_sessions ADD COLUMN workspace_id CHAR(32)")
                        if "assessment_id" not in col_names:
                            conn.exec_driver_sql("ALTER TABLE study_sessions ADD COLUMN assessment_id CHAR(32)")
                except Exception as ex:
                    print(f"SQLite migration notice: {ex}")
            elif dialect == "postgresql":
                try:
                    conn.exec_driver_sql("""
                        DO $$
                        BEGIN
                            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
                                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
                                    ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
                                END IF;
                                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'hashed_password') THEN
                                    UPDATE users SET password_hash = hashed_password WHERE password_hash IS NULL;
                                END IF;
                            END IF;

                            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'study_sessions') THEN
                                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_sessions' AND column_name = 'course_id') THEN
                                    ALTER TABLE study_sessions ADD COLUMN course_id UUID;
                                END IF;
                                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_sessions' AND column_name = 'updated_at') THEN
                                    ALTER TABLE study_sessions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
                                END IF;
                            END IF;
                        END $$;
                    """)
                except Exception as ex:
                    print(f"PostgreSQL migration notice: {ex}")
    except Exception as e:
        print(f"Warning during DB table creation: {e}")

ensure_database_schema()

app = FastAPI(
    title=settings.app_name,
    version="3.0.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
if settings.frontend_url and settings.frontend_url not in allowed_origins:
    allowed_origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication, Workspaces, Courses, Assessments, Study Sessions
app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(courses.router)
app.include_router(assessments.router)
app.include_router(study_sessions.router)

# AI Extraction & Practice Questions
app.include_router(upload.router, prefix="/api")
app.include_router(questions.router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "version": "3.0.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "syllabus-surgeon",
        "app": settings.app_name,
    }
