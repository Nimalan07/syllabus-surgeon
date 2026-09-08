from datetime import date, datetime, time
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from schemas.assessment import AssessmentResponse


class StudySessionBase(BaseModel):
    session_date: date
    start_time: time | None = None
    end_time: time | None = None
    planned_minutes: int = 30
    completed_minutes: int = 0
    status: str = "planned"
    notes: str | None = None


class StudySessionCreate(BaseModel):
    assessment_id: UUID | None = None
    session_date: date
    start_time: time | None = None
    end_time: time | None = None
    planned_minutes: int = 30
    completed_minutes: int = 0
    status: str = "planned"
    notes: str | None = None


class StudySessionUpdate(BaseModel):
    assessment_id: UUID | None = None
    session_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    planned_minutes: int | None = None
    completed_minutes: int | None = None
    status: str | None = None
    notes: str | None = None


class StudySessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    assessment_id: UUID | None = None
    session_date: date
    start_time: time | None = None
    end_time: time | None = None
    planned_minutes: int = 30
    completed_minutes: int = 0
    status: str = "planned"
    notes: str | None = None
    created_at: datetime | None = None
    assessment: AssessmentResponse | None = None
