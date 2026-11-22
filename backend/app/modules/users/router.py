import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import get_password_hash
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException
from app.models.user import User, Role, UserRole
from app.modules.authentication.schemas import UserResponse
from app.modules.users.schemas import UserCreate, UserUpdate, RoleResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    user_type: Optional[str] = None,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).options(selectinload(User.roles).selectinload(Role.permissions))
    if search:
        term = f"%{search}%"
        stmt = stmt.where(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.email.ilike(term),
                User.mobile.ilike(term)
            )
        )
    if user_type:
        stmt = stmt.where(User.user_type == user_type)

    stmt = stmt.offset(skip).limit(limit).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()

    response = []
    for u in users:
        roles_list = [r.code for r in u.roles]
        if u.user_type not in roles_list:
            roles_list.append(u.user_type)
        perms_set = {p.code for r in u.roles for p in r.permissions}
        response.append(
            UserResponse(
                id=u.id,
                email=u.email,
                mobile=u.mobile,
                first_name=u.first_name,
                last_name=u.last_name,
                user_type=u.user_type,
                is_active=u.is_active,
                roles=roles_list,
                permissions=sorted(list(perms_set))
            )
        )
    return response


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    # Check existing email
    stmt = select(User).where(User.email == data.email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise ConflictException(f"User with email {data.email} already exists")

    new_user = User(
        institute_id=current_user.institute_id,
        email=data.email,
        mobile=data.mobile,
        hashed_password=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        user_type=data.user_type,
        is_active=True,
        is_verified=True
    )
    db.add(new_user)
    await db.flush()

    if data.role_codes:
        for code in data.role_codes:
            role_stmt = select(Role).where(Role.code == code)
            role = (await db.execute(role_stmt)).scalar_one_or_none()
            if role:
                ur = UserRole(user_id=new_user.id, role_id=role.id)
                db.add(ur)

    await db.commit()

    # Re-fetch with relationships
    stmt = (
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(User.id == new_user.id)
    )
    u = (await db.execute(stmt)).scalar_one()
    roles_list = [r.code for r in u.roles]
    if u.user_type not in roles_list:
        roles_list.append(u.user_type)
    perms_set = {p.code for r in u.roles for p in r.permissions}

    return UserResponse(
        id=u.id,
        email=u.email,
        mobile=u.mobile,
        first_name=u.first_name,
        last_name=u.last_name,
        user_type=u.user_type,
        is_active=u.is_active,
        roles=roles_list,
        permissions=sorted(list(perms_set))
    )


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Role).order_by(Role.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()
