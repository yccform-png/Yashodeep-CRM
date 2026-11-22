import uuid
from typing import AsyncGenerator, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.user import User, Role, Permission

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = decode_token(token)
    if not payload:
        raise UnauthorizedException("Could not validate credentials or token expired")
    
    user_id_str: str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException("Malformed authentication token")
    
    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException("Invalid token user identifier")

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles).selectinload(Role.permissions)
        )
        .where(User.id == user_uuid, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException("User not found or account is deactivated")
    return user


def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_codes = {role.code for role in current_user.roles}
        user_role_codes.add(current_user.user_type)

        if "SUPER_ADMIN" in user_role_codes:
            return current_user

        if not any(role in user_role_codes for role in allowed_roles):
            raise ForbiddenException(
                f"Operation requires one of the following roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


def require_permission(permission_code: str):
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_codes = {role.code for role in current_user.roles}
        user_role_codes.add(current_user.user_type)

        if "SUPER_ADMIN" in user_role_codes or "ADMIN" in user_role_codes:
            return current_user

        # Collect all permissions
        user_permissions = set()
        for role in current_user.roles:
            for perm in role.permissions:
                user_permissions.add(perm.code)
        
        if "*" in user_permissions or permission_code in user_permissions:
            return current_user

        # Check module-level wildcard e.g., "ACADEMICS:*"
        module = permission_code.split(":")[0]
        if f"{module}:*" in user_permissions:
            return current_user

        raise ForbiddenException(f"Missing required permission: {permission_code}")
    return permission_checker
