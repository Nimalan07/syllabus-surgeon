from datetime import date, time
from uuid import uuid4
from fastapi.testclient import TestClient

from main import app
from models.database import StudySession

client = TestClient(app)


def test_study_session_model_fields():
    session = StudySession(
        course_id=uuid4(),
        assessment_id=uuid4(),
        session_date=date(2026, 9, 20),
        start_time=time(18, 0),
        end_time=time(19, 30),
        planned_minutes=90,
        completed_minutes=60,
        status="in_progress",
        notes="Revise search algorithms",
    )

    assert session.session_date == date(2026, 9, 20)
    assert session.start_time == time(18, 0)
    assert session.end_time == time(19, 30)
    assert session.planned_minutes == 90
    assert session.completed_minutes == 60
    assert session.status == "in_progress"
    assert session.notes == "Revise search algorithms"


def test_study_session_crud_endpoints():
    # 1. Create a workspace first
    ws_res = client.post(
        "/api/workspaces",
        json={"name": "Calendar Session Workspace", "target_date": "2026-12-15"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Create a study session
    create_res = client.post(
        "/api/study-sessions",
        json={
            "workspace_id": ws_id,
            "session_date": "2026-10-05",
            "start_time": "09:00:00",
            "end_time": "10:30:00",
            "planned_minutes": 90,
            "status": "planned",
            "notes": "Chapter 3 Linear Regression",
        },
    )
    assert create_res.status_code == 201
    session_data = create_res.json()
    session_id = session_data["id"]
    assert session_data["session_date"] == "2026-10-05"
    assert session_data["planned_minutes"] == 90
    assert session_data["notes"] == "Chapter 3 Linear Regression"

    # 3. Get study session
    get_res = client.get(f"/api/study-sessions/{session_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == session_id

    # 4. Patch study session
    patch_res = client.patch(
        f"/api/study-sessions/{session_id}",
        json={
            "status": "completed",
            "completed_minutes": 90,
            "notes": "Finished Chapter 3 exercises",
        },
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "completed"
    assert patch_res.json()["completed_minutes"] == 90

    # 5. Delete study session
    del_res = client.delete(f"/api/study-sessions/{session_id}")
    assert del_res.status_code == 204

    # 6. Verify deletion
    verify_res = client.get(f"/api/study-sessions/{session_id}")
    assert verify_res.status_code == 404
