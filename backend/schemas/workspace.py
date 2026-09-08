from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

from schemas.course import CourseResponse
from schemas.study_session import StudySessionResponse


# Auth Schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str | None = None
    display_name: str | None = None  # Alias support


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None = None
    created_at: datetime | None = None

    @computed_field
    @property
    def display_name(self) -> str | None:
        return self.full_name


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# Workspace Schemas
class WorkspaceBase(BaseModel):
    name: str = Field(min_length=1, max_length=150, default="My Study Workspace")
    target_date: date | None = None


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150, default="My Study Workspace")
    target_date: date | None = None
    semester: str | None = None  # Alias support


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    target_date: date | None = None
    semester: str | None = None


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    target_date: date | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    courses: list[CourseResponse] = Field(default_factory=list)
    study_sessions: list[StudySessionResponse] = Field(default_factory=list)

    @computed_field
    @property
    def semester(self) -> str | None:
        return "Current"
