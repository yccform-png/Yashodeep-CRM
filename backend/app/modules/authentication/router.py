from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.exceptions import UnauthorizedException, BadRequestException
from app.core.deps import get_current_user
from app.models.user import User, Role
from app.modules.authentication.schemas import LoginRequest, TokenResponse, UserResponse, PasswordChangeRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    # Support OAuth2 login form standard
    stmt = (
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where((User.email == form_data.username) | (User.mobile == form_data.username))
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise UnauthorizedException("Incorrect email/mobile or password")

    if not user.is_active:
        raise UnauthorizedException("User account is inactive. Please contact administration.")

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    roles_list = [r.code for r in user.roles]
    if user.user_type not in roles_list:
        roles_list.append(user.user_type)

    perms_set = set()
    for r in user.roles:
        for p in r.permissions:
            perms_set.add(p.code)

    token = create_access_token(
        subject=user.id,
        extra_claims={
            "email": user.email,
            "user_type": user.user_type,
            "roles": roles_list
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        user_type=user.user_type,
        roles=roles_list,
        permissions=sorted(list(perms_set))
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    roles_list = [r.code for r in current_user.roles]
    if current_user.user_type not in roles_list:
        roles_list.append(current_user.user_type)

    perms_set = set()
    for r in current_user.roles:
        for p in r.permissions:
            perms_set.add(p.code)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        mobile=current_user.mobile,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        user_type=current_user.user_type,
        is_active=current_user.is_active,
        roles=roles_list,
        permissions=sorted(list(perms_set))
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """
    Sliding session refresh endpoint.
    Issues a fresh access token for an actively working user to keep their session alive.
    """
    roles_list = [r.code for r in current_user.roles]
    if current_user.user_type not in roles_list:
        roles_list.append(current_user.user_type)

    perms_set = set()
    for r in current_user.roles:
        for p in r.permissions:
            perms_set.add(p.code)

    token = create_access_token(
        subject=current_user.id,
        extra_claims={
            "email": current_user.email,
            "user_type": current_user.user_type,
            "roles": roles_list
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        user_type=current_user.user_type,
        roles=roles_list,
        permissions=sorted(list(perms_set))
    )


@router.post("/change-password")
async def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise BadRequestException("Current password does not match")
    if len(data.new_password) < 8:
        raise BadRequestException("New password must be at least 8 characters long")

    current_user.hashed_password = get_password_hash(data.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}
