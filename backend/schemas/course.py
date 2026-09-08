from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, computed_field

from schemas.assessment import AssessmentResponse


class CourseBase(BaseModel):
    code: str | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class CourseCreate(BaseModel):
    code: str | None = Field(
        default=None,
        max_length=50,
    )
    course_code: str | None = None  # Alias support

    name: str | None = Field(
        default=None,
        max_length=200,
    )
    course_name: str | None = None  # Alias support

    description: str | None = None


class CourseUpdate(BaseModel):
    code: str | None = Field(
        default=None,
        max_length=50,
    )
    course_code: str | None = None

    name: str | None = Field(
        default=None,
        max_length=200,
    )
    course_name: str | None = None

    description: str | None = None


class CourseResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    code: str | None = None
    name: str
    description: str | None = None
    created_at: datetime
    assessments: list[AssessmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(
        from_attributes=True,
    )

    # Computed alias properties for frontend compatibility
    @computed_field
    @property
    def course_code(self) -> str | None:
        return self.code

    @computed_field
    @property
    def course_name(self) -> str:
        return self.name
