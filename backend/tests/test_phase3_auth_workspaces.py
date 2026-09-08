import uuid
import pytest
from fastapi.testclient import TestClient
from main import app
from core.auth import create_access_token

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_register_and_login():
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    test_password = "SecurePassword123!"

    # 1. Register
    reg_res = client.post(
        "/api/auth/register",
        json={
            "email": test_email,
            "password": test_password,
            "display_name": "Test Student",
        },
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "token" in data
    assert data["user"]["email"] == test_email
    token = data["token"]

    # 2. Get Me
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == test_email

    # 3. List Workspaces (auto-creates default workspace)
    ws_res = client.get(
        "/api/workspaces",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ws_res.status_code == 200
    workspaces = ws_res.json()
    assert len(workspaces) >= 1
    ws_id = workspaces[0]["id"]

    # 4. Create new Course in workspace
    course_res = client.post(
        f"/api/workspaces/{ws_id}/courses",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "course_code": "CS601",
            "course_name": "Distributed Systems",
        },
    )
    assert course_res.status_code == 201
    course_data = course_res.json()
    course_id = course_data["id"]

    # 5. Create Assessment in Course
    assess_res = client.post(
        f"/api/courses/{course_id}/assessments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Raft Consensus Project",
            "topic": "Consensus, leader election, log replication",
            "due_date": "2026-10-30",
            "weight_percent": 25.0,
            "priority_level": "medium",
        },
    )
    assert assess_res.status_code == 201
    assess_data = assess_res.json()
    assess_id = assess_data["id"]
    assert assess_data["completed"] is False

    # 6. Complete Assessment
    complete_res = client.post(
        f"/api/assessments/{assess_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["completed"] is True

    # 7. Update target date
    target_res = client.patch(
        f"/api/assessments/{assess_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"target_date": "2026-10-25"},
    )
    assert target_res.status_code == 200
    assert target_res.json()["target_date"] == "2026-10-25"

    # 8. Login with credentials
    login_res = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": test_password,
        },
    )
    assert login_res.status_code == 200
    assert "token" in login_res.json()
