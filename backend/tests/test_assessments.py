from datetime import date
from decimal import Decimal
from uuid import uuid4
from fastapi.testclient import TestClient

from main import app
from models.database import Assessment

client = TestClient(app)


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


def test_assessment_crud_endpoints():
    # 1. Create workspace & course
    ws_res = client.post(
        "/api/workspaces",
        json={"name": "Assessment Test WS", "target_date": "2026-12-01"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    course_res = client.post(
        f"/api/workspaces/{ws_id}/courses",
        json={"code": "MATH301", "name": "Linear Algebra"},
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    # 2. Create assessment
    asm_res = client.post(
        f"/api/courses/{course_id}/assessments",
        json={
            "title": "Midterm Exam",
            "assessment_type": "exam",
            "official_due_date": "2026-10-15",
            "priority": "high",
            "status": "not_started",
        },
    )
    assert asm_res.status_code == 201
    asm_data = asm_res.json()
    asm_id = asm_data["id"]
    assert asm_data["title"] == "Midterm Exam"
    assert asm_data["priority"] == "high"

    # 3. List assessments for course
    list_res = client.get(f"/api/courses/{course_id}/assessments")
    assert list_res.status_code == 200
    assert any(a["id"] == asm_id for a in list_res.json())

    # 4. Patch assessment
    patch_res = client.patch(
        f"/api/assessments/{asm_id}",
        json={"status": "in_progress", "priority": "critical"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "in_progress"
    assert patch_res.json()["priority"] == "critical"

    # 5. Delete assessment
    del_res = client.delete(f"/api/assessments/{asm_id}")
    assert del_res.status_code == 204

    # 6. Verify deletion
    verify_res = client.get(f"/api/assessments/{asm_id}")
    assert verify_res.status_code == 404
