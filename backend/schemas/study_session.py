from datetime import date, datetime, time
import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


def _parse_uuid_safe(v) -> UUID | None:
    if not v:
        return None
    if isinstance(v, UUID):
        return v
    if isinstance(v, str):
        v_clean = v.strip()
        if not v_clean or v_clean.lower() in ("null", "undefined", "none"):
            return None
        try:
            return UUID(v_clean)
        except (ValueError, AttributeError):
            return None
    return None


def _parse_date_safe(v) -> date:
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        v_clean = v.strip()
        # Try YYYY-MM-DD
        try:
            return datetime.strptime(v_clean, "%Y-%m-%d").date()
        except ValueError:
            pass
        # Try MM/DD/YYYY (e.g. 09/09/2026)
        try:
            return datetime.strptime(v_clean, "%m/%d/%Y").date()
        except ValueError:
            pass
        # Try DD/MM/YYYY
        try:
            return datetime.strptime(v_clean, "%d/%m/%Y").date()
        except ValueError:
            pass
        # Try ISO datetime format
        try:
            return datetime.fromisoformat(v_clean.replace("Z", "+00:00")).date()
        except ValueError:
            pass
    # Default fallback to today if unparseable
    return date.today()


def _parse_time_safe(v) -> time | None:
    if not v:
        return None
    if isinstance(v, time):
        return v
    if isinstance(v, str):
        v_clean = v.strip()
        if not v_clean or v_clean.lower() in ("null", "undefined", "none"):
            return None
        # Try HH:MM (e.g. "09:00", "9:00")
        for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p", "%I:%M:%S %p", "%I %p"):
            try:
                return datetime.strptime(v_clean, fmt).time()
            except ValueError:
                continue
    return None


class StudySessionBase(BaseModel):
    course_id: UUID | None = None
    workspace_id: UUID | None = None
    assessment_id: UUID | None = None
    session_date: date
    start_time: time | None = None
    end_time: time | None = None
    planned_minutes: int = 60
    actual_minutes: int = 0
    status: str = "planned"
    notes: str | None = None


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

    @field_validator("course_id", "workspace_id", "assessment_id", mode="before")
    @classmethod
    def validate_uuids(cls, v):
        return _parse_uuid_safe(v)

    @field_validator("session_date", mode="before")
    @classmethod
    def validate_date(cls, v):
        return _parse_date_safe(v)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def validate_time(cls, v):
        return _parse_time_safe(v)

    @field_validator("planned_minutes", mode="before")
    @classmethod
    def validate_planned_mins(cls, v):
        if v is None or v == "":
            return 60
        try:
            val = int(float(v))
            return max(1, min(val, 1440))
        except (ValueError, TypeError):
            return 60

    @field_validator("actual_minutes", "completed_minutes", mode="before")
    @classmethod
    def validate_actual_mins(cls, v):
        if v is None or v == "":
            return 0
        try:
            val = int(float(v))
            return max(0, min(val, 1440))
        except (ValueError, TypeError):
            return 0


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

    @field_validator("course_id", "workspace_id", "assessment_id", mode="before")
    @classmethod
    def validate_uuids(cls, v):
        return _parse_uuid_safe(v)

    @field_validator("session_date", mode="before")
    @classmethod
    def validate_date(cls, v):
        if v is None or v == "":
            return None
        return _parse_date_safe(v)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def validate_time(cls, v):
        if v is None or v == "":
            return None
        return _parse_time_safe(v)

    @field_validator("planned_minutes", mode="before")
    @classmethod
    def validate_planned_mins(cls, v):
        if v is None or v == "":
            return None
        try:
            val = int(float(v))
            return max(1, min(val, 1440))
        except (ValueError, TypeError):
            return None

    @field_validator("actual_minutes", "completed_minutes", mode="before")
    @classmethod
    def validate_actual_mins(cls, v):
        if v is None or v == "":
            return None
        try:
            val = int(float(v))
            return max(0, min(val, 1440))
        except (ValueError, TypeError):
            return None


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
