from datetime import date
from uuid import uuid4
from fastapi.testclient import TestClient

from main import app
from models.database import User, Workspace

client = TestClient(app)


def test_workspace_model_fields():
    user_id = uuid4()

    user = User(
        id=user_id,
        email="test@example.com",
        full_name="Test User",
    )

    workspace = Workspace(
        user_id=user_id,
        name="Test Workspace",
        target_date=date(2026, 10, 15),
    )

    assert user.email == "test@example.com"
    assert workspace.name == "Test Workspace"
    assert workspace.target_date == date(2026, 10, 15)


def test_workspace_crud_endpoints():
    # 1. Create Workspace
    create_res = client.post(
        "/api/workspaces",
        json={
            "name": "Semester 5 Study Plan",
            "target_date": "2026-10-15",
        },
    )
    assert create_res.status_code == 201
    created_data = create_res.json()
    ws_id = created_data["id"]
    assert created_data["name"] == "Semester 5 Study Plan"
    assert created_data["target_date"] == "2026-10-15"

    # 2. Get Workspace
    get_res = client.get(f"/api/workspaces/{ws_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Semester 5 Study Plan"

    # 3. List Workspaces
    list_res = client.get("/api/workspaces")
    assert list_res.status_code == 200
    workspaces = list_res.json()
    assert any(w["id"] == ws_id for w in workspaces)

    # 4. Patch Workspace
    patch_res = client.patch(
        f"/api/workspaces/{ws_id}",
        json={
            "name": "Updated Semester Planner",
            "target_date": "2026-10-20",
        },
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Updated Semester Planner"
    assert patch_res.json()["target_date"] == "2026-10-20"

    # 5. Delete Workspace
    del_res = client.delete(f"/api/workspaces/{ws_id}")
    assert del_res.status_code == 204

    # 6. Verify Deletion
    get_after_del = client.get(f"/api/workspaces/{ws_id}")
    assert get_after_del.status_code == 404
