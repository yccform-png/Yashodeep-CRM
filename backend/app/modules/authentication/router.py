import uuid
import secrets
import re
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.exceptions import UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException
from app.core.deps import get_current_user
from app.core.cache import cache_service
from app.models.user import User, Role
from app.models.student import Student, Guardian, StudentGuardian, StudentUserAccount, GuardianUserAccount
from app.models.academic import BatchStudent
from app.modules.notifications.providers.meta_whatsapp import meta_whatsapp_client
from app.modules.notifications.providers.brevo_email import brevo_email_client
from app.modules.authentication.schemas import (
    LoginRequest, TokenResponse, UserResponse, PasswordChangeRequest,
    ForgotPasswordChannel, ForgotPasswordRequestOtp, ForgotPasswordVerifyAndReset
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

_in_memory_otp_cache: Dict[str, dict] = {}


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


@router.post("/forgot-password/request-otp")
async def forgot_password_request_otp(
    payload: ForgotPasswordRequestOtp,
    db: AsyncSession = Depends(get_db)
):
    """
    Dispatches a 6-digit OTP for Super Admin account recovery via WhatsApp or Email.
    """
    ident = payload.identifier.strip()
    if not ident:
        raise BadRequestException("Please provide your registered Email or Mobile number")

    stmt = select(User).where(or_(User.email.ilike(ident), User.mobile == ident))
    user = (await db.execute(stmt)).scalars().first()

    if not user or not user.is_active:
        raise NotFoundException("No active account found with that Email or Mobile number")

    if user.user_type != "SUPER_ADMIN":
        raise ForbiddenException("Self-service OTP reset is reserved for Super Admin. Operational Admins, Students, and Parents should contact the Super Admin for password resets.")

    otp_code = f"{secrets.randbelow(900000) + 100000}"
    cache_key = f"otp:forgot_pwd:{user.id}"
    now_ts = datetime.now(timezone.utc).timestamp()
    otp_data = {
        "code": otp_code,
        "user_id": str(user.id),
        "attempts": 0,
        "expires_at": now_ts + 300  # 5 minutes
    }

    await cache_service.set(cache_key, otp_data, ttl=300)
    _in_memory_otp_cache[str(user.id)] = otp_data

    masked_destination = ""

    if payload.channel == ForgotPasswordChannel.WHATSAPP:
        if not user.mobile:
            raise BadRequestException("No registered mobile number associated with this Super Admin account to receive WhatsApp OTP.")

        wa_body = (
            f"🔒 *Yashodeep Coaching Classes ERP Security*\n\n"
            f"Your Super Admin verification code is: *{otp_code}*\n\n"
            f"⏱️ This OTP is valid for 5 minutes. Do not share this code with anyone."
        )
        await meta_whatsapp_client.send_text_message(user.mobile, wa_body)
        raw_digits = re.sub(r"\D", "", user.mobile)
        masked_destination = f"+91 ******{raw_digits[-4:]}" if len(raw_digits) >= 4 else user.mobile

    elif payload.channel == ForgotPasswordChannel.EMAIL:
        if not user.email:
            raise BadRequestException("No registered email associated with this Super Admin account to receive Email OTP.")

        html_body = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Yashodeep Coaching Classes ERP</h2>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Super Admin Security Verification</p>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
            <p style="color: #475569; font-size: 13px; margin: 0 0 12px 0;">Use the 6-digit verification code below to reset your master account password:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f172a; font-family: monospace; padding: 12px; background: #ffffff; border: 2px dashed #0284c7; border-radius: 8px; display: inline-block;">
              {otp_code}
            </div>
            <p style="color: #ea580c; font-size: 12px; font-weight: 600; margin: 12px 0 0 0;">⏱️ Valid for 5 minutes only</p>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
            If you did not request this password reset, please contact the Yashodeep IT administration immediately.
          </p>
        </div>
        """
        await brevo_email_client.send_transactional_email(
            to_email=user.email,
            to_name=f"{user.first_name} {user.last_name}",
            subject="🔒 Yashodeep ERP - Super Admin Password Reset OTP",
            html_content=html_body,
            text_content=f"Your Super Admin password reset code is {otp_code}. Valid for 5 minutes."
        )
        parts = user.email.split("@")
        masked_destination = f"{parts[0][:2]}***@{parts[1]}" if len(parts[0]) > 2 else f"*@{parts[1]}"

    return {
        "message": f"Verification code sent successfully via {payload.channel.value}",
        "channel": payload.channel.value,
        "destination_masked": masked_destination,
        "expires_in_seconds": 300
    }


@router.post("/forgot-password/verify-and-reset")
async def forgot_password_verify_and_reset(
    payload: ForgotPasswordVerifyAndReset,
    db: AsyncSession = Depends(get_db)
):
    """
    Verifies the 6-digit OTP and resets the Super Admin password.
    """
    ident = payload.identifier.strip()
    stmt = select(User).where(or_(User.email.ilike(ident), User.mobile == ident))
    user = (await db.execute(stmt)).scalars().first()

    if not user or not user.is_active:
        raise NotFoundException("User account not found")

    cache_key = f"otp:forgot_pwd:{user.id}"
    cached = await cache_service.get(cache_key)
    if not cached:
        cached = _in_memory_otp_cache.get(str(user.id))

    now_ts = datetime.now(timezone.utc).timestamp()
    if not cached or now_ts > cached.get("expires_at", 0):
        raise BadRequestException("Verification code has expired or was not requested. Please request a new code.")

    if cached.get("code") != payload.otp.strip():
        cached["attempts"] = cached.get("attempts", 0) + 1
        if cached["attempts"] >= 3:
            await cache_service.delete(cache_key)
            _in_memory_otp_cache.pop(str(user.id), None)
            raise BadRequestException("Too many incorrect attempts. Verification code invalidated. Please request a new code.")
        raise BadRequestException("Invalid verification code. Please check your message and try again.")

    if len(payload.new_password) < 8:
        raise BadRequestException("New password must be at least 8 characters long")

    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()

    # Clear OTP
    await cache_service.delete(cache_key)
    _in_memory_otp_cache.pop(str(user.id), None)

    return {
        "message": "Super Admin password reset successfully. You can now log in with your new password.",
        "email": user.email
    }

