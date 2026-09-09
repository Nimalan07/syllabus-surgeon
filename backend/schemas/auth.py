from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=4, max_length=128)
    full_name: str | None = Field(
        default=None,
        max_length=200,
    )

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            v_clean = v.strip()
            return v_clean if v_clean else None
        return v


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str | None = None

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
