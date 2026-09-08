from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(
        default=None,
        max_length=200,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token: str | None = None
    token_type: str = "bearer"
    user: UserResponse

    def __init__(self, **data):
        if "access_token" in data and "token" not in data:
            data["token"] = data["access_token"]
        elif "token" in data and "access_token" not in data:
            data["access_token"] = data["token"]
        super().__init__(**data)
