import uuid
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: str  # Email or mobile
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    user_type: str
    roles: List[str]
    permissions: List[str]


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    mobile: Optional[str] = None
    first_name: str
    last_name: str
    user_type: str
    is_active: bool
    roles: List[str]
    permissions: List[str]

    class Config:
        from_attributes = True


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
