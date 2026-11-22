import uuid
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    mobile: Optional[str] = None
    first_name: str
    last_name: str
    password: str
    user_type: str
    role_codes: Optional[List[str]] = []


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    is_active: Optional[bool] = None
    role_codes: Optional[List[str]] = None


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    description: Optional[str] = None

    class Config:
        from_attributes = True
