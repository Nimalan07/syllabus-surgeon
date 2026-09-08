import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.auth import (
    CurrentUser,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from core.database import get_db
from models.database import User, Workspace
from schemas.workspace import (
    AuthResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: UserRegister,
    db: Session = Depends(get_db),
):
    existing_user = db.scalar(
        select(User).where(User.email == payload.email.lower().strip())
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user_id = uuid.uuid4()
    full_name = payload.full_name or payload.display_name or payload.email.split("@")[0]

    new_user = User(
        id=user_id,
        email=payload.email.lower().strip(),
        full_name=full_name,
        hashed_password=hash_password(payload.password),
    )

    # Automatically create default starter workspace for this user
    default_workspace = Workspace(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Fall 2026 Semester",
    )

    db.add(new_user)
    db.add(default_workspace)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(user_id=new_user.id, email=new_user.email)

    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(new_user),
    )


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(User.email == payload.email.lower().strip())
    )

    if not user or not verify_password(payload.password, user.hashed_password or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user_id=user.id, email=user.email)

    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(User.id == current_user.id)
    )

    if not user:
        user = User(
            id=current_user.id,
            email=current_user.email or f"{current_user.id}@user.local",
            full_name=current_user.display_name or (current_user.email.split("@")[0] if current_user.email else "Student"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return UserResponse.model_validate(user)


@router.post(
    "/logout",
)
def logout():
    return {"message": "Successfully logged out"}
