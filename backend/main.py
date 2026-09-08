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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.app_env,
    }
