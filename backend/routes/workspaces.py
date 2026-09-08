from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.auth import CurrentUser, get_optional_current_user
from core.database import get_db
from models.database import Course, StudySession, User, Workspace
from schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
)

router = APIRouter(
    prefix="/api/workspaces",
    tags=["Workspaces"],
)


def ensure_user_exists(db: Session, current_user: CurrentUser) -> User:
    user = db.get(User, current_user.id)
    if user is None:
        user = User(
            id=current_user.id,
            email=current_user.email or f"{current_user.id}@user.local",
            full_name=current_user.display_name or (current_user.email.split("@")[0] if current_user.email else "Demo Student"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_workspace(
    payload: WorkspaceCreate,
    current_user: CurrentUser = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user = ensure_user_exists(db, current_user)

    workspace = Workspace(
        id=uuid4(),
        user_id=user.id,
        name=payload.name or "My Study Workspace",
        target_date=payload.target_date,
    )

    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    return workspace


@router.get(
    "",
    response_model=list[WorkspaceResponse],
)
def list_workspaces(
    current_user: CurrentUser = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user = ensure_user_exists(db, current_user)

    statement = (
        select(Workspace)
        .options(
            selectinload(Workspace.courses).selectinload(Course.assessments),
            selectinload(Workspace.study_sessions).selectinload(StudySession.assessment),
        )
        .where(Workspace.user_id == user.id)
        .order_by(Workspace.created_at.desc())
    )

    workspaces = list(db.scalars(statement).all())

    # If user has no workspaces, create a default one
    if not workspaces:
        default_workspace = Workspace(
            id=uuid4(),
            user_id=user.id,
            name="Fall 2026 Semester",
        )
        db.add(default_workspace)
        db.commit()
        db.refresh(default_workspace)
        workspaces = [default_workspace]

    return workspaces


@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
)
def get_workspace(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user = ensure_user_exists(db, current_user)

    workspace = db.scalar(
        select(Workspace)
        .options(
            selectinload(Workspace.courses).selectinload(Course.assessments),
            selectinload(Workspace.study_sessions).selectinload(StudySession.assessment),
        )
        .where(
            Workspace.id == workspace_id,
            Workspace.user_id == user.id,
        )
    )

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    return workspace


@router.patch(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
)
def update_workspace(
    workspace_id: UUID,
    payload: WorkspaceUpdate,
    current_user: CurrentUser = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user = ensure_user_exists(db, current_user)

    workspace = db.scalar(
        select(Workspace)
        .options(
            selectinload(Workspace.courses).selectinload(Course.assessments),
            selectinload(Workspace.study_sessions).selectinload(StudySession.assessment),
        )
        .where(
            Workspace.id == workspace_id,
            Workspace.user_id == user.id,
        )
    )

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "semester" in update_data:
        update_data.pop("semester")

    for field, value in update_data.items():
        setattr(workspace, field, value)

    db.commit()
    db.refresh(workspace)

    return workspace


@router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_workspace(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user = ensure_user_exists(db, current_user)

    workspace = db.scalar(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == user.id,
        )
    )

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    db.delete(workspace)
    db.commit()

    return None
