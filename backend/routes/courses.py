from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.database import Course, Workspace
from schemas.course import CourseCreate, CourseResponse, CourseUpdate

router = APIRouter(
    tags=["courses"],
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


@router.get(
    "/api/workspaces/{workspace_id}/courses",
    response_model=list[CourseResponse],
)
def list_courses(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_workspace(workspace_id, current_user, db)

    statement = (
        select(Course)
        .options(selectinload(Course.assessments))
        .where(Course.workspace_id == workspace_id)
        .order_by(Course.name.asc())
    )

    return list(db.scalars(statement).all())


@router.post(
    "/api/workspaces/{workspace_id}/courses",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_course(
    workspace_id: UUID,
    payload: CourseCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_workspace(workspace_id, current_user, db)

    code = payload.code or payload.course_code
    name = payload.name or payload.course_name or "Untitled Subject"

    course = Course(
        workspace_id=workspace_id,
        code=code,
        name=name,
        description=payload.description,
    )

    db.add(course)
    db.commit()
    db.refresh(course)

    return course


@router.patch(
    "/api/courses/{course_id}",
    response_model=CourseResponse,
)
def update_course(
    course_id: UUID,
    payload: CourseUpdate,
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
    "/api/courses/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_course(
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

    db.delete(course)
    db.commit()
