from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.database import get_db
from models.database import Course, Workspace
from routes.workspaces import ensure_user_exists, get_optional_current_user
from schemas.course import (
    CourseCreate,
    CourseResponse,
    CourseUpdate,
)

router = APIRouter(
    prefix="/api",
    tags=["Courses"],
)


def get_owned_workspace(
    workspace_id: UUID,
    db: Session,
    current_user=None,
) -> Workspace:
    if current_user is None:
        user = ensure_user_exists(db, get_optional_current_user())
    else:
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

    return workspace


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
        .options(selectinload(Course.assessments))
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


@router.post(
    "/workspaces/{workspace_id}/courses",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_course(
    workspace_id: UUID,
    payload: CourseCreate,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    workspace = get_owned_workspace(workspace_id, db, current_user)

    code = payload.code or payload.course_code
    name = payload.name or payload.course_name or "Untitled Subject"

    course = Course(
        id=uuid4(),
        workspace_id=workspace.id,
        code=code,
        name=name,
        description=payload.description,
    )

    db.add(course)
    db.commit()
    db.refresh(course)

    return course


@router.get(
    "/workspaces/{workspace_id}/courses",
    response_model=list[CourseResponse],
)
def list_courses(
    workspace_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    workspace = get_owned_workspace(workspace_id, db, current_user)

    statement = (
        select(Course)
        .options(selectinload(Course.assessments))
        .where(Course.workspace_id == workspace.id)
        .order_by(Course.created_at.asc())
    )

    return list(db.scalars(statement).all())


@router.get(
    "/courses/{course_id}",
    response_model=CourseResponse,
)
def get_course(
    course_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    return get_owned_course(course_id, db, current_user)


@router.patch(
    "/courses/{course_id}",
    response_model=CourseResponse,
)
def update_course(
    course_id: UUID,
    payload: CourseUpdate,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    course = get_owned_course(course_id, db, current_user)

    if payload.code is not None or payload.course_code is not None:
        course.code = payload.code or payload.course_code
    if payload.name is not None or payload.course_name is not None:
        course.name = payload.name or payload.course_name
    if payload.description is not None:
        course.description = payload.description

    db.commit()
    db.refresh(course)

    return course


@router.delete(
    "/courses/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_course(
    course_id: UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    course = get_owned_course(course_id, db, current_user)

    db.delete(course)
    db.commit()

    return None
