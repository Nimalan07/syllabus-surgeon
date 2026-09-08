from datetime import date, datetime
from typing import Optional, Any
from dateutil import parser as date_parser
from pydantic import BaseModel, Field, field_validator

NULL_VALUES = {
    "",
    "null",
    "none",
    "n/a",
    "na",
    "unknown",
    "not specified",
    "tbd",
}


class SyllabusItem(BaseModel):
    id: Optional[str] = None
    item: str = Field(min_length=1)
    due_date: Optional[date] = None
    weight_percent: Optional[float] = Field(default=None, ge=0, le=100)
    topic: Optional[str] = None
    date_confidence: str = "unknown"
    notes: Optional[str] = None
    days_until_due: Optional[int] = None
    priority_score: float = 0
    priority_level: str = "unranked"
    recommended_action: str = ""
    why_prioritized: str = ""
    course_name: Optional[str] = None
    course_code: Optional[str] = None

    @field_validator("due_date", mode="before")
    @classmethod
    def normalize_due_date(cls, value: Any) -> Optional[date]:
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned.lower() in NULL_VALUES:
                return None
            try:
                # Try ISO format
                return date.fromisoformat(cleaned)
            except ValueError:
                pass
            try:
                # Try flexible human date parsing (e.g. "14 Aug 2026", "23 Sep 2026")
                return date_parser.parse(cleaned).date()
            except (ValueError, OverflowError):
                return None
        return None

    @field_validator(
        "topic",
        "notes",
        "course_name",
        "course_code",
        mode="before",
    )
    @classmethod
    def normalize_text_nulls(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            if value.strip().lower() in NULL_VALUES:
                return None
            return value.strip()
        return str(value)

    @field_validator("weight_percent", mode="before")
    @classmethod
    def normalize_weight_nulls(cls, value: Any) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            cleaned = value.strip().lower().replace("%", "").strip()
            if cleaned in NULL_VALUES:
                return None
            try:
                val = float(cleaned)
                return max(0.0, min(100.0, val))
            except ValueError:
                return None
        return None


class Course(BaseModel):
    course_name: str
    course_code: Optional[str] = None
    semester: Optional[str] = None
    items: list[SyllabusItem] = Field(default_factory=list)

    @field_validator("course_code", "semester", mode="before")
    @classmethod
    def normalize_course_text(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            if value.strip().lower() in NULL_VALUES:
                return None
            return value.strip()
        return str(value)


class ExtractionResponse(BaseModel):
    courses: list[Course] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class QuestionItem(BaseModel):
    question: str
    options: list[str] = Field(default_factory=list)
    answer: Optional[str] = None
    explanation: Optional[str] = None
    question_type: Optional[str] = None


class QuestionRequest(BaseModel):
    topic: str = Field(min_length=1)
    item: Optional[str] = None
    difficulty: str = Field(default="medium")
    question_type: str = Field(default="mixed")
    count: int = Field(default=5, ge=1, le=10)


class QuestionResponse(BaseModel):
    topic: str
    difficulty: Optional[str] = "medium"
    question_type: Optional[str] = "mixed"
    questions: list[Any] = Field(default_factory=list)
    items: list[QuestionItem] = Field(default_factory=list)
