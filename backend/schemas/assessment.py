from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, computed_field


class AssessmentBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    assessment_type: str = Field(default="other", max_length=50)
    official_due_date: date | None = None
    target_date: date | None = None
    priority: str = Field(default="medium", max_length=30)
    status: str = Field(default="not_started", max_length=30)
    estimated_hours: Decimal | float = 1.0
    completed_hours: Decimal | float = 0.0
    difficulty: str | None = None
    impact: str | None = None
    weight_percent: Decimal | float | None = None
    topic: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None


class AssessmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    assessment_type: str = "other"
    official_due_date: date | None = None
    due_date: date | None = None  # Alias support
    target_date: date | None = None
    priority: str | None = "medium"
    priority_level: str | None = None  # Alias support
    status: str | None = "not_started"
    estimated_hours: float | Decimal = 1.0
    completed_hours: float | Decimal = 0.0
    difficulty: str | None = None
    impact: str | None = None
    weight_percent: float | Decimal | None = None
    topic: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None


class AssessmentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assessment_type: str | None = None
    official_due_date: date | None = None
    due_date: date | None = None
    target_date: date | None = None
    priority: str | None = None
    priority_level: str | None = None
    status: str | None = None
    completed: bool | None = None
    estimated_hours: float | Decimal | None = None
    completed_hours: float | Decimal | None = None
    difficulty: str | None = None
    impact: str | None = None
    weight_percent: float | Decimal | None = None
    topic: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None


class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    title: str
    description: str | None = None
    assessment_type: str = "other"
    official_due_date: date | None = None
    target_date: date | None = None
    priority: str = "medium"
    status: str = "not_started"
    estimated_hours: float | Decimal = 1.0
    completed_hours: float | Decimal = 0.0
    difficulty: str | None = None
    impact: str | None = None
    weight_percent: float | Decimal | None = None
    topic: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    # Computed fields for backward compatibility with frontend
    @computed_field
    @property
    def due_date(self) -> date | None:
        return self.official_due_date

    @computed_field
    @property
    def priority_level(self) -> str:
        return self.priority

    @computed_field
    @property
    def completed(self) -> bool:
        return self.status == "completed"
