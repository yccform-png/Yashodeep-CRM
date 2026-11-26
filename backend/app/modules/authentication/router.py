import uuid
from typing import Optional, Tuple
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.exceptions import UnauthorizedException, BadRequestException
from app.core.deps import get_current_user
from app.models.user import User, Role
from app.models.student import Student, Guardian, StudentGuardian, StudentUserAccount, GuardianUserAccount
from app.models.academic import BatchStudent
from app.modules.authentication.schemas import LoginRequest, TokenResponse, UserResponse, PasswordChangeRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _get_student_id_for_user(db: AsyncSession, user: User) -> Optional[uuid.UUID]:
    """Helper to resolve student_id for STUDENT or PARENT user accounts."""
    if not user:
        return None
    student_id = None
    if user.user_type == "STUDENT":
        s_stmt = select(Student.id).where(Student.user_id == user.id)
        student_id = (await db.execute(s_stmt)).scalar_one_or_none()
        if not student_id:
            sua_stmt = select(StudentUserAccount.student_id).where(StudentUserAccount.user_id == user.id)
            student_id = (await db.execute(sua_stmt)).scalar_one_or_none()
        if not student_id and user.mobile:
            s_m_stmt = select(Student.id).where(Student.mobile == user.mobile)
            student_id = (await db.execute(s_m_stmt)).scalar_one_or_none()
        if not student_id and user.email:
            s_e_stmt = select(Student.id).where(Student.email == user.email)
            student_id = (await db.execute(s_e_stmt)).scalar_one_or_none()
    elif user.user_type == "PARENT":
        g_stmt = select(Guardian.id).where(Guardian.user_id == user.id)
        guardian_id = (await db.execute(g_stmt)).scalar_one_or_none()
        if not guardian_id:
            gua_stmt = select(GuardianUserAccount.guardian_id).where(GuardianUserAccount.user_id == user.id)
            guardian_id = (await db.execute(gua_stmt)).scalar_one_or_none()
        if not guardian_id and user.mobile:
            g_m_stmt = select(Guardian.id).where(Guardian.mobile == user.mobile)
            guardian_id = (await db.execute(g_m_stmt)).scalar_one_or_none()
        if guardian_id:
            sg_stmt = select(StudentGuardian.student_id).where(StudentGuardian.guardian_id == guardian_id)
            student_id = (await db.execute(sg_stmt)).scalars().first()
    return student_id


async def _resolve_user_and_student_id(db: AsyncSession, identifier: str) -> Tuple[Optional[User], Optional[uuid.UUID]]:
    """
    Resolves a user from:
    1. Direct User email or mobile
    2. Student PRN, Student Code, or Batch Roll Number
    3. Guardian Mobile Number
    Returns (User, student_id)
    """
    clean_id = identifier.strip()
    raw_mobile = clean_id.replace(" ", "").replace("-", "")
    if raw_mobile.startswith("+91"):
        raw_mobile_no_prefix = raw_mobile[3:]
    else:
        raw_mobile_no_prefix = raw_mobile

    # 1. Direct User Table Lookup
    stmt = (
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(
            or_(
                User.email.ilike(clean_id),
                User.mobile == clean_id,
                User.mobile == raw_mobile,
                User.mobile.ilike(f"%{raw_mobile_no_prefix}%")
            )
        )
    )
    user = (await db.execute(stmt)).scalars().first()

    if user:
        student_id = await _get_student_id_for_user(db, user)
        return user, student_id

    # 2. Student PRN, Student Code, or Roll Number Lookup
    stu_stmt = select(Student).where(
        or_(
            Student.prn.ilike(clean_id),
            Student.student_code.ilike(clean_id)
        )
    )
    student = (await db.execute(stu_stmt)).scalars().first()

    if not student and clean_id.isdigit():
        roll_num = int(clean_id)
        bs_stmt = select(BatchStudent).where(BatchStudent.roll_number == roll_num)
        bs = (await db.execute(bs_stmt)).scalars().first()
        if bs:
            student = await db.get(Student, bs.student_id)

    if student:
        user_id = student.user_id
        if not user_id:
            sua_stmt = select(StudentUserAccount.user_id).where(StudentUserAccount.student_id == student.id)
            user_id = (await db.execute(sua_stmt)).scalar_one_or_none()
        if user_id:
            u_stmt = (
                select(User)
                .options(selectinload(User.roles).selectinload(Role.permissions))
                .where(User.id == user_id)
            )
            user = (await db.execute(u_stmt)).scalar_one_or_none()
            if user:
                return user, student.id

    # 3. Guardian Mobile Lookup
    g_stmt = select(Guardian).where(
        or_(
            Guardian.mobile == clean_id,
            Guardian.mobile == raw_mobile,
            Guardian.mobile.ilike(f"%{raw_mobile_no_prefix}%")
        )
    )
    guardian = (await db.execute(g_stmt)).scalars().first()
    if guardian:
        user_id = guardian.user_id
        if not user_id:
            gua_stmt = select(GuardianUserAccount.user_id).where(GuardianUserAccount.guardian_id == guardian.id)
            user_id = (await db.execute(gua_stmt)).scalar_one_or_none()
        if user_id:
            u_stmt = (
                select(User)
                .options(selectinload(User.roles).selectinload(Role.permissions))
                .where(User.id == user_id)
            )
            user = (await db.execute(u_stmt)).scalar_one_or_none()
            if user:
                sg_stmt = select(StudentGuardian.student_id).where(StudentGuardian.guardian_id == guardian.id)
                student_id = (await db.execute(sg_stmt)).scalars().first()
                return user, student_id

    return None, None


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    # Support OAuth2 login form standard with multi-identifier resolution
    user, student_id = await _resolve_user_and_student_id(db, form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise UnauthorizedException("Incorrect credentials. Please verify your Email/Mobile/PRN and Password.")

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
            "roles": roles_list,
            "student_id": str(student_id) if student_id else None
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
        permissions=sorted(list(perms_set)),
        student_id=student_id
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    roles_list = [r.code for r in current_user.roles]
    if current_user.user_type not in roles_list:
        roles_list.append(current_user.user_type)

    perms_set = set()
    for r in current_user.roles:
        for p in r.permissions:
            perms_set.add(p.code)

    student_id = await _get_student_id_for_user(db, current_user)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        mobile=current_user.mobile,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        user_type=current_user.user_type,
        is_active=current_user.is_active,
        roles=roles_list,
        permissions=sorted(list(perms_set)),
        student_id=student_id
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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

    student_id = await _get_student_id_for_user(db, current_user)

    token = create_access_token(
        subject=current_user.id,
        extra_claims={
            "email": current_user.email,
            "user_type": current_user.user_type,
            "roles": roles_list,
            "student_id": str(student_id) if student_id else None
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
        permissions=sorted(list(perms_set)),
        student_id=student_id
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
