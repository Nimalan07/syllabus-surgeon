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
    estimated_hours: Decimal = Field(default=Decimal("1.00"), ge=0, max_digits=6, decimal_places=2)
    completed_hours: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=6, decimal_places=2)
    difficulty: str | None = None
    impact: str | None = None


class AssessmentCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = None

    assessment_type: str = Field(
        default="other",
        max_length=50,
    )

    official_due_date: date | None = None
    due_date: date | None = None  # Alias support
    target_date: date | None = None

    priority: str = Field(
        default="medium",
        max_length=30,
    )
    priority_level: str | None = None  # Alias support

    status: str = Field(
        default="not_started",
        max_length=30,
    )

    estimated_hours: Decimal = Field(
        default=Decimal("1.00"),
        ge=0,
        max_digits=6,
        decimal_places=2,
    )

    completed_hours: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=6,
        decimal_places=2,
    )

    difficulty: str | None = Field(
        default=None,
        max_length=30,
    )

    impact: str | None = Field(
        default=None,
        max_length=30,
    )

    weight_percent: float | Decimal | None = None
    topic: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None


class AssessmentUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    description: str | None = None
    assessment_type: str | None = Field(default=None, max_length=50)

    official_due_date: date | None = None
    due_date: date | None = None
    target_date: date | None = None

    priority: str | None = Field(default=None, max_length=30)
    priority_level: str | None = None
    status: str | None = Field(default=None, max_length=30)
    completed: bool | None = None

    estimated_hours: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=6,
        decimal_places=2,
    )

    completed_hours: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=6,
        decimal_places=2,
    )

    difficulty: str | None = Field(default=None, max_length=30)
    impact: str | None = Field(default=None, max_length=30)
    weight_percent: float | Decimal | None = None
    topic: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None


class AssessmentResponse(BaseModel):
    id: UUID
    course_id: UUID
    title: str
    description: str | None = None
    assessment_type: str = "other"

    official_due_date: date | None = None
    target_date: date | None = None

    priority: str = "medium"
    status: str = "not_started"

    estimated_hours: Decimal
    completed_hours: Decimal

    difficulty: str | None = None
    impact: str | None = None
    weight_percent: float | Decimal | None = None
    topic: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None

    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(
        from_attributes=True,
    )

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
