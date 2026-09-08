from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import get_db
from models.database import Assessment, Course, Workspace
from routes.workspaces import ensure_user_exists, get_optional_current_user
from schemas.assessment import (
    AssessmentCreate,
    AssessmentResponse,
    AssessmentUpdate,
)

router = APIRouter(
    prefix="/api",
    tags=["Assessments"],
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    return assessment


@router.post(
    "/courses/{course_id}/assessments",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_assessment(
    course_id: UUID,
    payload: AssessmentCreate,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    course = get_owned_course(course_id, db, current_user)

    official_due = payload.official_due_date or payload.due_date
    priority = payload.priority or payload.priority_level or "medium"

    assessment = Assessment(
        id=uuid4(),
        course_id=course.id,
        title=payload.title,
        description=payload.description,
        assessment_type=payload.assessment_type or "other",
        official_due_date=official_due,
        target_date=payload.target_date,
        priority=priority,
        status=payload.status or "not_started",
        estimated_hours=payload.estimated_hours or Decimal("1.00"),
        completed_hours=payload.completed_hours or Decimal("0.00"),
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


@router.get(
    "/courses/{course_id}/assessments",
    response_model=list[AssessmentResponse],
)
def list_assessments(
    course_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    course = get_owned_course(course_id, db, current_user)

    statement = (
        select(Assessment)
        .where(Assessment.course_id == course.id)
        .order_by(
            Assessment.target_date.asc().nullslast(),
            Assessment.official_due_date.asc().nullslast(),
            Assessment.created_at.asc(),
        )
    )

    return list(db.scalars(statement).all())


@router.get(
    "/workspaces/{workspace_id}/assessments",
    response_model=list[AssessmentResponse],
)
def list_workspace_assessments(
    workspace_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user = ensure_user_exists(db, current_user)

    statement = (
        select(Assessment)
        .join(Course, Assessment.course_id == Course.id)
        .join(Workspace, Course.workspace_id == Workspace.id)
        .where(
            Workspace.id == workspace_id,
            Workspace.user_id == user.id,
        )
        .order_by(
            Assessment.target_date.asc().nullslast(),
            Assessment.official_due_date.asc().nullslast(),
            Assessment.created_at.asc(),
        )
    )

    return list(db.scalars(statement).all())


@router.get(
    "/assessments/{assessment_id}",
    response_model=AssessmentResponse,
)
def get_assessment(
    assessment_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    return get_owned_assessment(assessment_id, db, current_user)


@router.patch(
    "/assessments/{assessment_id}",
    response_model=AssessmentResponse,
)
def update_assessment(
    assessment_id: UUID,
    payload: AssessmentUpdate,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    assessment = get_owned_assessment(assessment_id, db, current_user)

    update_data = payload.model_dump(exclude_unset=True)

    if "official_due_date" in update_data:
        assessment.official_due_date = update_data.pop("official_due_date")
    elif "due_date" in update_data:
        assessment.official_due_date = update_data.pop("due_date")

    if "priority" in update_data:
        assessment.priority = update_data.pop("priority")
    elif "priority_level" in update_data:
        assessment.priority = update_data.pop("priority_level")

    if "completed" in update_data:
        completed = update_data.pop("completed")
        assessment.status = "completed" if completed else "not_started"
        if completed and assessment.completed_hours == 0:
            assessment.completed_hours = assessment.estimated_hours
    elif "status" in update_data:
        assessment.status = update_data.pop("status")

    for field, value in update_data.items():
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
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    assessment = get_owned_assessment(assessment_id, db, current_user)

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
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    assessment = get_owned_assessment(assessment_id, db, current_user)

    db.delete(assessment)
    db.commit()

    return None
