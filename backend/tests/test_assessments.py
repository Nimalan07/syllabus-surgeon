from datetime import date
from decimal import Decimal
from uuid import uuid4

from models.database import Assessment


def test_assessment_model_fields():
    assessment = Assessment(
        course_id=uuid4(),
        title="AI Unit 1 Assignment",
        assessment_type="assignment",
        official_due_date=date(2026, 9, 25),
        target_date=date(2026, 9, 20),
        priority="high",
        status="not_started",
        estimated_hours=Decimal("4.50"),
        completed_hours=Decimal("0.00"),
        difficulty="medium",
        impact="high",
    )

    assert assessment.title == "AI Unit 1 Assignment"
    assert assessment.official_due_date == date(2026, 9, 25)
    assert assessment.target_date == date(2026, 9, 20)
    assert assessment.priority == "high"
    assert assessment.status == "not_started"
    assert assessment.estimated_hours == Decimal("4.50")
    assert assessment.completed_hours == Decimal("0.00")
