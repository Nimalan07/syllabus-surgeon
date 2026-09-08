from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.database import Course, Workspace
from models.workspace_schema import CourseCreate, CourseResponse

router = APIRouter(
    prefix="/api/workspaces/{workspace_id}/courses",
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
    "",
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
        .order_by(Course.course_name.asc())
    )

    return list(db.scalars(statement).all())


@router.post(
    "",
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

    course = Course(
        workspace_id=workspace_id,
        course_code=payload.course_code,
        course_name=payload.course_name,
    )

    db.add(course)
    db.commit()
    db.refresh(course)

    return course
