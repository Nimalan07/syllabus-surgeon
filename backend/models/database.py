import uuid
from datetime import date, datetime, time
from decimal import Decimal
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    full_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    workspaces: Mapped[list["Workspace"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @property
    def hashed_password(self) -> str | None:
        return self.password_hash

    @hashed_password.setter
    def hashed_password(self, value: str | None):
        self.password_hash = value

    # Helper property for backwards compatibility
    @property
    def display_name(self) -> str | None:
        return self.full_name

    @display_name.setter
    def display_name(self, value: str | None):
        self.full_name = value


# Alias UserProfile to User for backward compatibility
UserProfile = User


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @property
    def owner_id(self) -> uuid.UUID:
        return self.user_id

    @owner_id.setter
    def owner_id(self, value: uuid.UUID):
        self.user_id = value

    name: Mapped[str] = mapped_column(
        String(150),
        default="My Study Workspace",
        nullable=False,
    )

    target_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="workspaces")

    courses: Mapped[list["Course"]] = relationship(
        back_populates="workspace",
        cascade="all, delete-orphan",
    )

    study_sessions: Mapped[list["StudySession"]] = relationship(
        back_populates="workspace",
        cascade="all, delete-orphan",
    )


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    workspace: Mapped["Workspace"] = relationship(
        back_populates="courses",
    )

    assessments: Mapped[list["Assessment"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )

    study_sessions: Mapped[list["StudySession"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )

    # Aliases for compatibility
    @property
    def course_code(self) -> str | None:
        return self.code

    @course_code.setter
    def course_code(self, val: str | None):
        self.code = val

    @property
    def course_name(self) -> str:
        return self.name

    @course_name.setter
    def course_name(self, val: str):
        self.name = val


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    assessment_type: Mapped[str] = mapped_column(
        String(50),
        default="other",
        nullable=False,
    )

    official_due_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    target_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    priority: Mapped[str] = mapped_column(
        String(30),
        default="medium",
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="not_started",
        nullable=False,
    )

    estimated_hours: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        default=Decimal("1.00"),
        nullable=False,
    )

    completed_hours: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    difficulty: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    impact: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    weight_percent: Mapped[float | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )

    topic: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    recommended_action: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    why_prioritized: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    course: Mapped["Course"] = relationship(
        back_populates="assessments",
    )

    study_sessions: Mapped[list["StudySession"]] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
    )

    # Aliases & properties for compatibility
    @property
    def due_date(self) -> date | None:
        return self.official_due_date

    @due_date.setter
    def due_date(self, val: date | None):
        self.official_due_date = val

    @property
    def priority_level(self) -> str:
        return self.priority

    @priority_level.setter
    def priority_level(self, val: str):
        self.priority = val

    @property
    def completed(self) -> bool:
        return self.status == "completed"

    @completed.setter
    def completed(self, val: bool):
        self.status = "completed" if val else "not_started"


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    course_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    assessment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=True,
    )

    session_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    start_time: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    end_time: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    planned_minutes: Mapped[int] = mapped_column(
        Integer,
        default=60,
        nullable=False,
    )

    completed_minutes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="planned",
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )

    workspace: Mapped["Workspace | None"] = relationship(
        back_populates="study_sessions",
    )

    course: Mapped["Course | None"] = relationship(
        back_populates="study_sessions",
    )

    assessment: Mapped["Assessment | None"] = relationship(
        back_populates="study_sessions",
    )

    @property
    def actual_minutes(self) -> int:
        return self.completed_minutes

    @actual_minutes.setter
    def actual_minutes(self, val: int):
        self.completed_minutes = val
