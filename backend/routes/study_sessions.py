from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.database import Assessment, StudySession, Workspace
from schemas.study_session import (
    StudySessionCreate,
    StudySessionResponse,
    StudySessionUpdate,
)

router = APIRouter(
    prefix="/api",
    tags=["study_sessions"],
)


def get_owned_workspace(
    workspace_id: UUID,
    current_user: CurrentUser,
    db: Session,
) -> Workspace:
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

    return workspace


def get_owned_study_session(
    session_id: UUID,
    current_user: CurrentUser,
    db: Session,
) -> StudySession:
    statement = (
        select(StudySession)
        .join(Workspace, StudySession.workspace_id == Workspace.id)
        .where(
            StudySession.id == session_id,
            Workspace.user_id == current_user.id,
        )
    )

    session_obj = db.scalar(statement)

    if session_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found",
        )

    return session_obj


@router.get(
    "/workspaces/{workspace_id}/study-sessions",
    response_model=list[StudySessionResponse],
)
def list_study_sessions(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_workspace(workspace_id, current_user, db)

    statement = (
        select(StudySession)
        .options(selectinload(StudySession.assessment))
        .where(StudySession.workspace_id == workspace_id)
        .order_by(StudySession.session_date.asc())
    )

    return list(db.scalars(statement).all())


@router.post(
    "/workspaces/{workspace_id}/study-sessions",
    response_model=StudySessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_study_session(
    workspace_id: UUID,
    payload: StudySessionCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_workspace(workspace_id, current_user, db)

    if payload.assessment_id:
        assessment = db.scalar(
            select(Assessment).where(Assessment.id == payload.assessment_id)
        )
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found",
            )

    study_session = StudySession(
        workspace_id=workspace_id,
        assessment_id=payload.assessment_id,
        session_date=payload.session_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        planned_minutes=payload.planned_minutes,
        completed_minutes=payload.completed_minutes,
        status=payload.status,
        notes=payload.notes,
    )

    db.add(study_session)
    db.commit()
    db.refresh(study_session)

    return study_session


@router.patch(
    "/study-sessions/{session_id}",
    response_model=StudySessionResponse,
)
def update_study_session(
    session_id: UUID,
    payload: StudySessionUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_obj = get_owned_study_session(session_id, current_user, db)

    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(session_obj, field, value)

    db.commit()
    db.refresh(session_obj)

    return session_obj


@router.delete(
    "/study-sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_study_session(
    session_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_obj = get_owned_study_session(session_id, current_user, db)

    db.delete(session_obj)
    db.commit()
