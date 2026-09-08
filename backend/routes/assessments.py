from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.database import Assessment, Course, Workspace
from models.workspace_schema import (
    AssessmentCreate,
    AssessmentResponse,
    AssessmentUpdate,
)

router = APIRouter(
    prefix="/api",
    tags=["assessments"],
)


def get_owned_assessment(
    assessment_id: UUID,
    current_user: CurrentUser,
    db: Session,
) -> Assessment:
    statement = (
        select(Assessment)
        .join(Course, Assessment.course_id == Course.id)
        .join(Workspace, Course.workspace_id == Workspace.id)
        .where(
            Assessment.id == assessment_id,
            Workspace.user_id == current_user.id,
        )
    )

    assessment = db.scalar(statement)

    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    return assessment


@router.get(
    "/workspaces/{workspace_id}/assessments",
    response_model=list[AssessmentResponse],
)
def list_assessments(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statement = (
        select(Assessment)
        .join(Course, Assessment.course_id == Course.id)
        .join(Workspace, Course.workspace_id == Workspace.id)
        .where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
        .order_by(Assessment.due_date.asc().nullslast())
    )

    return list(db.scalars(statement).all())


@router.post(
    "/courses/{course_id}/assessments",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_assessment(
    course_id: UUID,
    payload: AssessmentCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = db.scalar(
        select(Course)
        .join(Workspace, Course.workspace_id == Workspace.id)
        .where(
            Course.id == course_id,
            Workspace.user_id == current_user.id,
        )
    )

    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    assessment = Assessment(
        course_id=course_id,
        **payload.model_dump(),
    )

    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return assessment


@router.patch(
    "/assessments/{assessment_id}",
    response_model=AssessmentResponse,
)
def update_assessment(
    assessment_id: UUID,
    payload: AssessmentUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = get_owned_assessment(
        assessment_id,
        current_user,
        db,
    )

    updates = payload.model_dump(exclude_unset=True)

    if "completed" in updates:
        completed = updates["completed"]
        assessment.completed = completed
        if completed:
            assessment.completed_at = datetime.now(timezone.utc)
        else:
            assessment.completed_at = None
        updates.pop("completed")

    for field, value in updates.items():
        setattr(assessment, field, value)

    db.commit()
    db.refresh(assessment)

    return assessment


@router.post(
    "/assessments/{assessment_id}/complete",
    response_model=AssessmentResponse,
)
def complete_assessment(
    assessment_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = get_owned_assessment(
        assessment_id,
        current_user,
        db,
    )

    assessment.completed = not assessment.completed
    if assessment.completed:
        assessment.completed_at = datetime.now(timezone.utc)
    else:
        assessment.completed_at = None

    db.commit()
    db.refresh(assessment)

    return assessment


@router.delete(
    "/assessments/{assessment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_assessment(
    assessment_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = get_owned_assessment(
        assessment_id,
        current_user,
        db,
    )

    db.delete(assessment)
    db.commit()
