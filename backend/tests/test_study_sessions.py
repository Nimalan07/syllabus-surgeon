from datetime import date, time
from uuid import uuid4

from models.database import StudySession


def test_study_session_model_fields():
    session = StudySession(
        course_id=uuid4(),
        assessment_id=uuid4(),
        session_date=date(2026, 9, 20),
        start_time=time(18, 0),
        end_time=time(19, 30),
        planned_minutes=90,
        actual_minutes=60,
        status="in_progress",
        notes="Revise search algorithms",
    )

    assert session.session_date == date(2026, 9, 20)
    assert session.start_time == time(18, 0)
    assert session.end_time == time(19, 30)
    assert session.planned_minutes == 90
    assert session.actual_minutes == 60
    assert session.status == "in_progress"
    assert session.notes == "Revise search algorithms"
