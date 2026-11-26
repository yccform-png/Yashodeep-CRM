import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import get_password_hash
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException, ForbiddenException
from app.models.user import User, Role, UserRole
from app.modules.authentication.schemas import UserResponse
from app.modules.users.schemas import UserCreate, UserUpdate, RoleResponse, ResetAdminPasswordRequest

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
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    # Check existing email
    stmt = select(User).where(User.email == data.email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise ConflictException(f"User with email {data.email} already exists")

    if data.mobile:
        m_stmt = select(User).where(User.mobile == data.mobile)
        existing_m = (await db.execute(m_stmt)).scalar_one_or_none()
        if existing_m:
            raise ConflictException(f"User with mobile {data.mobile} already exists")

    user_type = data.user_type or "ADMIN"
    new_user = User(
        institute_id=current_user.institute_id,
        email=data.email,
        mobile=data.mobile,
        hashed_password=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        user_type=user_type,
        is_active=True,
        is_verified=True
    )
    db.add(new_user)
    await db.flush()

    role_codes = data.role_codes or [user_type]
    for code in role_codes:
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


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Super Admin can edit any staff user (including operations admins),
    or a user can update their own personal details.
    """
    is_super_admin = current_user.user_type == "SUPER_ADMIN"
    if not is_super_admin and current_user.id != user_id:
        raise ForbiddenException("Only Super Admin can update other users")

    user = await db.get(User, user_id)
    if not user:
        raise NotFoundException(f"User {user_id} not found")

    # Check email uniqueness if updating email
    if data.email and data.email != user.email:
        existing = (await db.execute(select(User).where(User.email == data.email, User.id != user_id))).scalar_one_or_none()
        if existing:
            raise ConflictException(f"User with email {data.email} already exists")
        user.email = data.email

    # Check mobile uniqueness if updating mobile
    if data.mobile and data.mobile != user.mobile:
        existing_m = (await db.execute(select(User).where(User.mobile == data.mobile, User.id != user_id))).scalar_one_or_none()
        if existing_m:
            raise ConflictException(f"User with mobile {data.mobile} already exists")
        user.mobile = data.mobile

    if data.first_name is not None and data.first_name.strip():
        user.first_name = data.first_name.strip()
    if data.last_name is not None and data.last_name.strip():
        user.last_name = data.last_name.strip()

    # Only super admin can change active status or role codes of staff
    if is_super_admin:
        if data.is_active is not None:
            if user_id == current_user.id and not data.is_active:
                raise BadRequestException("Cannot deactivate your own master account")
            user.is_active = data.is_active

        if data.role_codes is not None:
            # Delete old user roles
            await db.execute(delete(UserRole).where(UserRole.user_id == user.id))
            for code in data.role_codes:
                role_stmt = select(Role).where(Role.code == code)
                role = (await db.execute(role_stmt)).scalar_one_or_none()
                if role:
                    db.add(UserRole(user_id=user.id, role_id=role.id))

    await db.commit()

    # Re-fetch with relationships
    stmt = (
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(User.id == user.id)
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


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: uuid.UUID,
    data: ResetAdminPasswordRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Super Admin can reset the password for any Admin/Staff user.
    """
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundException(f"User {user_id} not found")

    if len(data.new_password) < 8:
        raise BadRequestException("Password must be at least 8 characters long")

    user.hashed_password = get_password_hash(data.new_password)
    await db.commit()

    return {
        "message": f"Password reset successfully for {user.first_name} {user.last_name}",
        "user_id": str(user.id),
        "email": user.email
    }



@router.patch("/{user_id}/status", response_model=UserResponse)
async def toggle_user_status(
    user_id: uuid.UUID,
    is_active: bool = Query(...),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    if user_id == current_user.id:
        raise BadRequestException("Cannot deactivate your own master account")
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundException(f"User {user_id} not found")

    user.is_active = is_active
    await db.commit()

    stmt = (
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(User.id == user.id)
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


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    if user_id == current_user.id:
        raise BadRequestException("Cannot delete your own master account")
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundException(f"User {user_id} not found")
    await db.delete(user)
    await db.commit()


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Role).order_by(Role.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()
