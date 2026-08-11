from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class EmailCredentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    remember: bool = False


class GoogleCredentials(BaseModel):
    credential: str = Field(min_length=20)


class UserResponse(BaseModel):
    email: EmailStr
    provider: Literal["password", "google"]


class SessionResponse(BaseModel):
    token: str
    expires_at: datetime
    user: UserResponse


class HealthResponse(BaseModel):
    status: Literal["ok"]
