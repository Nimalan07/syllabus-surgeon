from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.database import Course, StudySession, User, Workspace
from schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
)

router = APIRouter(
    prefix="/api/workspaces",
    tags=["workspaces"],
)


def ensure_user_exists(db: Session, current_user: CurrentUser) -> User:
    user = db.scalar(select(User).where(User.id == current_user.id))
    if not user:
        user = User(
            id=current_user.id,
            email=current_user.email or f"{current_user.id}@user.local",
            full_name=current_user.display_name or (current_user.email.split("@")[0] if current_user.email else "Student"),
        )
        db.add(user)
        db.commit()
    return user


@router.get(
    "",
    response_model=list[WorkspaceResponse],
)
def list_workspaces(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_exists(db, current_user)

    statement = (
        select(Workspace)
        .options(
            selectinload(Workspace.courses).selectinload(Course.assessments),
            selectinload(Workspace.study_sessions).selectinload(StudySession.assessment),
        )
        .where(Workspace.user_id == current_user.id)
        .order_by(Workspace.created_at.desc())
    )

    workspaces = list(db.scalars(statement).all())

    # If user has no workspaces, create a default one
    if not workspaces:
        default_workspace = Workspace(
            user_id=current_user.id,
            name="Fall 2026 Semester",
        )
        db.add(default_workspace)
        db.commit()
        db.refresh(default_workspace)
        workspaces = [default_workspace]

    return workspaces


@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_workspace(
    payload: WorkspaceCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_exists(db, current_user)

    workspace = Workspace(
        user_id=current_user.id,
        name=payload.name or "My Study Workspace",
        target_date=payload.target_date,
    )

    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    return workspace


@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
)
def get_workspace(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.scalar(
        select(Workspace)
        .options(
            selectinload(Workspace.courses).selectinload(Course.assessments),
            selectinload(Workspace.study_sessions).selectinload(StudySession.assessment),
        )
        .where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
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
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.scalar(
        select(Workspace)
        .options(
            selectinload(Workspace.courses).selectinload(Course.assessments),
            selectinload(Workspace.study_sessions).selectinload(StudySession.assessment),
        )
        .where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    )

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    updates = payload.model_dump(exclude_unset=True)
    if "semester" in updates:
        updates.pop("semester")

    for field, value in updates.items():
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
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.scalar(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    )

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    db.delete(workspace)
    db.commit()
