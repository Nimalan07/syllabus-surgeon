from datetime import date
from uuid import uuid4
from fastapi.testclient import TestClient

from main import app
from models.database import Course, Workspace

client = TestClient(app)


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


def test_course_crud_endpoints():
    # 1. Create a workspace
    ws_res = client.post(
        "/api/workspaces",
        json={"name": "Course Test Workspace", "target_date": "2026-11-20"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Create Course in workspace
    course_res = client.post(
        f"/api/workspaces/{ws_id}/courses",
        json={
            "code": "CS404",
            "name": "Distributed Systems",
            "description": "Consensus and microservices",
        },
    )
    assert course_res.status_code == 201
    course_data = course_res.json()
    course_id = course_data["id"]
    assert course_data["code"] == "CS404"
    assert course_data["name"] == "Distributed Systems"

    # 3. List courses
    list_res = client.get(f"/api/workspaces/{ws_id}/courses")
    assert list_res.status_code == 200
    courses = list_res.json()
    assert any(c["id"] == course_id for c in courses)

    # 4. Get specific course
    get_res = client.get(f"/api/courses/{course_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Distributed Systems"

    # 5. Patch course
    patch_res = client.patch(
        f"/api/courses/{course_id}",
        json={"name": "Advanced Distributed Systems"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Advanced Distributed Systems"

    # 6. Delete course
    del_res = client.delete(f"/api/courses/{course_id}")
    assert del_res.status_code == 204

    # 7. Verify deletion
    verify_res = client.get(f"/api/courses/{course_id}")
    assert verify_res.status_code == 404
