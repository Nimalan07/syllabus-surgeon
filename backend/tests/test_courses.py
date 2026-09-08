from datetime import date
from uuid import uuid4

from models.database import Course, Workspace


def test_course_model_fields():
    workspace_id = uuid4()

    workspace = Workspace(
        user_id=uuid4(),
        name="Test Workspace",
        target_date=date(2026, 10, 15),
    )

    course = Course(
        workspace_id=workspace_id,
        code="CS501",
        name="Artificial Intelligence",
        description="AI fundamentals",
    )

    assert workspace.name == "Test Workspace"
    assert course.code == "CS501"
    assert course.name == "Artificial Intelligence"
    assert course.description == "AI fundamentals"
