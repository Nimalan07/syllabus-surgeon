from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import get_db
from models.database import (
    Assessment,
    Course,
    StudySession,
    Workspace,
)
from routes.workspaces import ensure_user_exists, get_optional_current_user
from schemas.study_session import (
    StudySessionCreate,
    StudySessionResponse,
    StudySessionUpdate,
)

router = APIRouter(
    prefix="/api",
    tags=["Study Sessions"],
)


def get_owned_course(
    course_id: UUID,
    db: Session,
    current_user=None,
) -> Course:
    if current_user is None:
        user = ensure_user_exists(db, get_optional_current_user())
    else:
        user = ensure_user_exists(db, current_user)

    course = db.scalar(
        select(Course)
        .join(Workspace, Course.workspace_id == Workspace.id)
        .where(
            Course.id == course_id,
            Workspace.user_id == user.id,
        )
    )

    if course is None:
        course = db.scalar(select(Course).where(Course.id == course_id))
        if course is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found",
            )

    return course


def get_owned_assessment(
    assessment_id: UUID,
    db: Session,
    current_user=None,
) -> Assessment:
    if current_user is None:
        user = ensure_user_exists(db, get_optional_current_user())
    else:
        user = ensure_user_exists(db, current_user)

    assessment = db.scalar(
        select(Assessment)
        .join(Course, Assessment.course_id == Course.id)
        .join(Workspace, Course.workspace_id == Workspace.id)
        .where(
            Assessment.id == assessment_id,
            Workspace.user_id == user.id,
        )
    )

    if assessment is None:
        assessment = db.scalar(select(Assessment).where(Assessment.id == assessment_id))
        if assessment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found",
            )

    return assessment


def get_owned_session(
    session_id: UUID,
    db: Session,
    current_user=None,
) -> StudySession:
    if current_user is None:
        user = ensure_user_exists(db, get_optional_current_user())
    else:
        user = ensure_user_exists(db, current_user)

    study_session = db.scalar(
        select(StudySession)
        .outerjoin(Course, StudySession.course_id == Course.id)
        .outerjoin(Workspace, StudySession.workspace_id == Workspace.id)
        .where(
            StudySession.id == session_id,
            (Workspace.user_id == user.id) | (Course.workspace.has(user_id=user.id)),
        )
    )

    if study_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study session not found",
        )

    return study_session


@router.post(
    "/study-sessions",
    response_model=StudySessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_study_session(
    payload: StudySessionCreate,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    course_id = payload.course_id
    workspace_id = payload.workspace_id

    if course_id is not None:
        course = get_owned_course(course_id, db, current_user)
        workspace_id = course.workspace_id
    elif workspace_id is not None:
        user = ensure_user_exists(db, current_user)
        ws = db.scalar(select(Workspace).where(Workspace.id == workspace_id, Workspace.user_id == user.id))
        if ws is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found",
            )
    else:
        user = ensure_user_exists(db, current_user)
        ws = db.scalar(select(Workspace).where(Workspace.user_id == user.id).order_by(Workspace.created_at.desc()))
        if ws:
            workspace_id = ws.id

    if payload.assessment_id is not None:
        assessment = get_owned_assessment(payload.assessment_id, db, current_user)
        if course_id is not None and assessment.course_id != course_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assessment does not belong to the selected course",
            )
        if course_id is None:
            course_id = assessment.course_id

    actual_mins = payload.actual_minutes or payload.completed_minutes or 0

    study_session = StudySession(
        id=uuid4(),
        workspace_id=workspace_id,
        course_id=course_id,
        assessment_id=payload.assessment_id,
        session_date=payload.session_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        planned_minutes=payload.planned_minutes,
        completed_minutes=actual_mins,
        status=payload.status,
        notes=payload.notes,
    )

    db.add(study_session)
    db.commit()
    db.refresh(study_session)

    return study_session


@router.post(
    "/workspaces/{workspace_id}/study-sessions",
    response_model=StudySessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_workspace_study_session(
    workspace_id: UUID,
    payload: StudySessionCreate,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    payload.workspace_id = workspace_id
    return create_study_session(payload, current_user, db)


@router.get(
    "/courses/{course_id}/study-sessions",
    response_model=list[StudySessionResponse],
)
def list_course_study_sessions(
    course_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    course = get_owned_course(course_id, db, current_user)

    statement = (
        select(StudySession)
        .where(StudySession.course_id == course.id)
        .order_by(
            StudySession.session_date.asc(),
            StudySession.start_time.asc().nullslast(),
        )
    )

    return list(db.scalars(statement).all())


@router.get(
    "/workspaces/{workspace_id}/study-sessions",
    response_model=list[StudySessionResponse],
)
def list_workspace_study_sessions(
    workspace_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user = ensure_user_exists(db, current_user)

    statement = (
        select(StudySession)
        .where(StudySession.workspace_id == workspace_id)
        .order_by(
            StudySession.session_date.asc(),
            StudySession.start_time.asc().nullslast(),
        )
    )

    return list(db.scalars(statement).all())


@router.get(
    "/study-sessions/{session_id}",
    response_model=StudySessionResponse,
)
def get_study_session(
    session_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    return get_owned_session(session_id, db, current_user)


@router.patch(
    "/study-sessions/{session_id}",
    response_model=StudySessionResponse,
)
def update_study_session(
    session_id: UUID,
    payload: StudySessionUpdate,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    study_session = get_owned_session(session_id, db, current_user)

    update_data = payload.model_dump(exclude_unset=True)

    if "course_id" in update_data:
        course_id = update_data["course_id"]
        if course_id is not None:
            get_owned_course(course_id, db, current_user)

    if "assessment_id" in update_data:
        assessment_id = update_data["assessment_id"]
        if assessment_id is not None:
            assessment = get_owned_assessment(assessment_id, db, current_user)
            final_course_id = update_data.get(
                "course_id",
                study_session.course_id,
            )
            if final_course_id is not None and assessment.course_id != final_course_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assessment does not belong to the selected course",
                )

    if "actual_minutes" in update_data:
        study_session.completed_minutes = update_data.pop("actual_minutes")
    elif "completed_minutes" in update_data:
        study_session.completed_minutes = update_data.pop("completed_minutes")

    for field, value in update_data.items():
        if hasattr(study_session, field):
            setattr(study_session, field, value)

    db.commit()
    db.refresh(study_session)

    return study_session


@router.delete(
    "/study-sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_study_session(
    session_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    study_session = get_owned_session(session_id, db, current_user)

    db.delete(study_session)
    db.commit()

    return None
