import uuid
from datetime import date, time
import pytest
from fastapi.testclient import TestClient

from main import app
from core.auth import create_access_token

client = TestClient(app)


def test_phase3b_full_persistence_lifecycle():
    test_email = f"persisted_{uuid.uuid4().hex[:8]}@example.com"
    test_password = "SecurePassword123!"

    # 1. Register user
    reg_res = client.post(
        "/api/auth/register",
        json={
            "email": test_email,
            "password": test_password,
            "full_name": "Postgres User",
        },
    )
    assert reg_res.status_code == 201
    auth_data = reg_res.json()
    token = auth_data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Workspaces CRUD
    # List (should have the default workspace)
    ws_list_res = client.get("/api/workspaces", headers=headers)
    assert ws_list_res.status_code == 200
    workspaces = ws_list_res.json()
    assert len(workspaces) >= 1
    default_ws = workspaces[0]

    # Create new custom workspace
    new_ws_res = client.post(
        "/api/workspaces",
        headers=headers,
        json={"name": "Spring 2027 Workspace", "target_date": "2027-05-30"},
    )
    assert new_ws_res.status_code == 201
    new_ws = new_ws_res.json()
    ws_id = new_ws["id"]
    assert new_ws["name"] == "Spring 2027 Workspace"

    # Patch workspace
    patch_ws_res = client.patch(
        f"/api/workspaces/{ws_id}",
        headers=headers,
        json={"name": "Spring 2027 - Advanced"},
    )
    assert patch_ws_res.status_code == 200
    assert patch_ws_res.json()["name"] == "Spring 2027 - Advanced"

    # 3. Courses CRUD
    course_res = client.post(
        f"/api/workspaces/{ws_id}/courses",
        headers=headers,
        json={
            "code": "CS750",
            "name": "Database Systems & Storage Internals",
            "description": "Deep dive into PostgreSQL, LSM-trees, and B-trees.",
        },
    )
    assert course_res.status_code == 201
    course_data = course_res.json()
    course_id = course_data["id"]
    assert course_data["code"] == "CS750"
    assert course_data["name"] == "Database Systems & Storage Internals"

    # List courses in workspace
    courses_list_res = client.get(
        f"/api/workspaces/{ws_id}/courses",
        headers=headers,
    )
    assert courses_list_res.status_code == 200
    assert len(courses_list_res.json()) >= 1

    # 4. Assessments CRUD with separated official_due_date and target_date
    assess_res = client.post(
        f"/api/courses/{course_id}/assessments",
        headers=headers,
        json={
            "title": "B-Tree Storage Engine Implementation",
            "assessment_type": "project",
            "official_due_date": "2027-04-15",
            "target_date": "2027-04-10",
            "priority": "urgent",
            "status": "not_started",
            "estimated_hours": 12.0,
            "difficulty": "hard",
            "impact": "high",
            "weight_percent": 30.0,
            "topic": "Storage Engine, Buffer Pool, B+ Tree Indexing",
            "why_prioritized": "30% grade weight with high complexity",
            "recommended_action": "Complete node split/merge algorithms first",
        },
    )
    assert assess_res.status_code == 201
    assess_data = assess_res.json()
    assess_id = assess_data["id"]
    assert assess_data["official_due_date"] == "2027-04-15"
    assert assess_data["target_date"] == "2027-04-10"
    assert assess_data["status"] == "not_started"

    # Patch only the target_date (ensuring official_due_date remains intact)
    patch_target_res = client.patch(
        f"/api/assessments/{assess_id}",
        headers=headers,
        json={"target_date": "2027-04-05"},
    )
    assert patch_target_res.status_code == 200
    patched_data = patch_target_res.json()
    assert patched_data["target_date"] == "2027-04-05"
    assert patched_data["official_due_date"] == "2027-04-15"  # Untouched!

    # Toggle completion status
    complete_res = client.post(
        f"/api/assessments/{assess_id}/complete",
        headers=headers,
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "completed"

    # 5. Study Sessions CRUD
    session_res = client.post(
        f"/api/workspaces/{ws_id}/study-sessions",
        headers=headers,
        json={
            "assessment_id": assess_id,
            "session_date": "2027-04-02",
            "planned_minutes": 60,
            "status": "planned",
            "notes": "Review buffer manager latching protocols",
        },
    )
    assert session_res.status_code == 201
    session_data = session_res.json()
    session_id = session_data["id"]
    assert session_data["planned_minutes"] == 60
    assert session_data["session_date"] == "2027-04-02"

    # List study sessions for workspace
    sessions_list_res = client.get(
        f"/api/workspaces/{ws_id}/study-sessions",
        headers=headers,
    )
    assert sessions_list_res.status_code == 200
    sessions_list = sessions_list_res.json()
    assert len(sessions_list) >= 1
    assert sessions_list[0]["id"] == session_id

    # Patch study session
    patch_session_res = client.patch(
        f"/api/study-sessions/{session_id}",
        headers=headers,
        json={"completed_minutes": 60, "status": "completed"},
    )
    assert patch_session_res.status_code == 200
    assert patch_session_res.json()["completed_minutes"] == 60
    assert patch_session_res.json()["status"] == "completed"

    # Delete study session
    del_session_res = client.delete(
        f"/api/study-sessions/{session_id}",
        headers=headers,
    )
    assert del_session_res.status_code == 204

    # Delete workspace
    del_ws_res = client.delete(
        f"/api/workspaces/{ws_id}",
        headers=headers,
    )
    assert del_ws_res.status_code == 204
