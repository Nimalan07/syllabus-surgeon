from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.database import Assessment, Course, Workspace
from schemas.assessment import (
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
    "/courses/{course_id}/assessments",
    response_model=list[AssessmentResponse],
)
def list_course_assessments(
    course_id: UUID,
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

    statement = (
        select(Assessment)
        .where(Assessment.course_id == course_id)
        .order_by(Assessment.official_due_date.asc().nullslast())
    )

    return list(db.scalars(statement).all())


@router.get(
    "/workspaces/{workspace_id}/assessments",
    response_model=list[AssessmentResponse],
)
def list_workspace_assessments(
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
        .order_by(Assessment.official_due_date.asc().nullslast())
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

    official_due = payload.official_due_date or payload.due_date
    priority = payload.priority or payload.priority_level or "medium"

    assessment = Assessment(
        course_id=course_id,
        title=payload.title,
        description=payload.description,
        assessment_type=payload.assessment_type or "other",
        official_due_date=official_due,
        target_date=payload.target_date,
        priority=priority,
        status=payload.status or "not_started",
        estimated_hours=payload.estimated_hours or 1.0,
        completed_hours=payload.completed_hours or 0.0,
        difficulty=payload.difficulty,
        impact=payload.impact,
        weight_percent=payload.weight_percent,
        topic=payload.topic,
        recommended_action=payload.recommended_action,
        why_prioritized=payload.why_prioritized,
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

    # Handle official_due_date / due_date alias
    if "official_due_date" in updates:
        assessment.official_due_date = updates.pop("official_due_date")
    elif "due_date" in updates:
        assessment.official_due_date = updates.pop("due_date")

    # Handle priority / priority_level alias
    if "priority" in updates:
        assessment.priority = updates.pop("priority")
    elif "priority_level" in updates:
        assessment.priority = updates.pop("priority_level")

    # Handle completion status
    if "completed" in updates:
        completed = updates.pop("completed")
        assessment.status = "completed" if completed else "not_started"
        if completed and assessment.completed_hours == 0:
            assessment.completed_hours = assessment.estimated_hours
    elif "status" in updates:
        assessment.status = updates.pop("status")

    for field, value in updates.items():
        if hasattr(assessment, field):
            setattr(assessment, field, value)

    db.commit()
    db.refresh(assessment)

    return assessment


@router.post(
    "/assessments/{assessment_id}/complete",
    response_model=AssessmentResponse,
)
def toggle_assessment_complete(
    assessment_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = get_owned_assessment(
        assessment_id,
        current_user,
        db,
    )

    if assessment.status == "completed":
        assessment.status = "not_started"
    else:
        assessment.status = "completed"
        if assessment.completed_hours == 0:
            assessment.completed_hours = assessment.estimated_hours

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
