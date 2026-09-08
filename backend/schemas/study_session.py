from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field


class StudySessionCreate(BaseModel):
    course_id: UUID | None = None
    workspace_id: UUID | None = None
    assessment_id: UUID | None = None

    session_date: date
    start_time: time | None = None
    end_time: time | None = None

    planned_minutes: int = Field(
        default=60,
        ge=1,
        le=1440,
    )

    actual_minutes: int = Field(
        default=0,
        ge=0,
        le=1440,
    )
    completed_minutes: int | None = None

    status: str = Field(
        default="planned",
        max_length=30,
    )

    notes: str | None = None


class StudySessionUpdate(BaseModel):
    course_id: UUID | None = None
    workspace_id: UUID | None = None
    assessment_id: UUID | None = None

    session_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None

    planned_minutes: int | None = Field(
        default=None,
        ge=1,
        le=1440,
    )

    actual_minutes: int | None = Field(
        default=None,
        ge=0,
        le=1440,
    )
    completed_minutes: int | None = None

    status: str | None = Field(
        default=None,
        max_length=30,
    )

    notes: str | None = None


class StudySessionResponse(BaseModel):
    id: UUID
    course_id: UUID | None = None
    workspace_id: UUID | None = None
    assessment_id: UUID | None = None

    session_date: date
    start_time: time | None = None
    end_time: time | None = None

    planned_minutes: int
    completed_minutes: int = 0

    status: str
    notes: str | None = None

    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(
        from_attributes=True,
    )

    @computed_field
    @property
    def actual_minutes(self) -> int:
        return self.completed_minutes
