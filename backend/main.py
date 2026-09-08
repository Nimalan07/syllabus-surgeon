import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import Base, engine
from routes import assessments, auth, courses, questions, study_sessions, upload, workspaces

# Automatically create tables in database (PostgreSQL / SQLite fallback)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning during DB table creation: {e}")

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
