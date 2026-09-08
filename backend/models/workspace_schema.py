from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# Auth Schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    display_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None = None
    created_at: datetime | None = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# Assessment Schemas
class AssessmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    topic: str | None = None
    due_date: date | None = None
    target_date: date | None = None
    weight_percent: float | None = Field(default=None, ge=0, le=100)
    priority_level: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None


class AssessmentUpdate(BaseModel):
    title: str | None = None
    topic: str | None = None
    due_date: date | None = None
    target_date: date | None = None
    weight_percent: float | None = None
    priority_level: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None
    completed: bool | None = None


class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    title: str
    topic: str | None = None
    due_date: date | None = None
    target_date: date | None = None
    weight_percent: float | None = None
    priority_level: str | None = None
    recommended_action: str | None = None
    why_prioritized: str | None = None
    completed: bool = False
    completed_at: datetime | None = None


# Course Schemas
class CourseCreate(BaseModel):
    course_code: str | None = None
    course_name: str = Field(min_length=1, max_length=180)


class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    course_code: str | None = None
    course_name: str
    assessments: list[AssessmentResponse] = Field(default_factory=list)


# Workspace Schemas
class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    semester: str | None = Field(default=None, max_length=80)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    semester: str | None = Field(default=None, max_length=80)


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    semester: str | None = None
    created_at: datetime
    updated_at: datetime
    courses: list[CourseResponse] = Field(default_factory=list)
