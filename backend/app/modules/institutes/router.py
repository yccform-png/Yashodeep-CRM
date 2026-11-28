import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, update

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException, BadRequestException
from app.core.security import verify_password
from app.core.cache import cache_service, CacheKeys
from app.models.user import User, UserSession, UserRole
from app.models.institute import Institute
from app.models.student import Student, Guardian, StudentGuardian, StudentDocument, StudentUserAccount, GuardianUserAccount
from app.models.enrollment import EnrollmentGroup, Enrollment, EnrollmentYear, EnrollmentSubject
from app.models.fee import (
    Invoice, InvoiceItem, InstallmentPlan, Installment, Payment,
    PaymentAllocation, Receipt, Refund, StudentDiscount
)
from app.models.service import StudentService
from app.models.study_room import StudySeat, SeatAllocation, SeatReservation, StudyRoomAttendance
from app.models.hostel import HostelBed, BedAllocation, HostelAttendance, HostelVisitor
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceCorrection
from app.models.examination import Examination, ExamSubject, ExamMarks, ExamResult
from app.models.academic import BatchStudent
from app.models.notification import Notification, NotificationOutbox
from app.modules.institutes.schemas import (
    InstituteResponse, InstituteUpdate,
    DangerZonePreviewResponse, DangerZonePurgeRequest
)

router = APIRouter(prefix="/institutes", tags=["Institutes & Settings"])


@router.get("/profile", response_model=InstituteResponse)
async def get_institute_profile(
    db: AsyncSession = Depends(get_db)
):
    """
    Returns active institute letterhead and branding profile.
    Used across UI navigation, dual-copy invoices, and payment receipts.
    Cached for 3600 seconds with write-invalidation.
    """
    cached = await cache_service.get(CacheKeys.institute_profile())
    if cached:
        return cached

    stmt = select(Institute).where(Institute.is_active == True).order_by(Institute.created_at.asc())
    institute = (await db.execute(stmt)).scalars().first()
    if not institute:
        raise NotFoundException("Institute configuration not found")

    data_dict = InstituteResponse.model_validate(institute).model_dump()
    await cache_service.set(CacheKeys.institute_profile(), data_dict, ttl=3600)
    return institute


@router.put("/profile", response_model=InstituteResponse)
async def update_institute_profile(
    data: InstituteUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the master institute branding, registration, campus address,
    contact numbers, bank/UPI coordinates, and authorized signatory.
    Purges cached profile on commit.
    """
    stmt = select(Institute).order_by(Institute.created_at.asc())
    if current_user.institute_id:
        stmt = select(Institute).where(Institute.id == current_user.institute_id)

    institute = (await db.execute(stmt)).scalars().first()
    if not institute:
        raise NotFoundException("Institute record not found")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            setattr(institute, key, value)

    await db.commit()
    await db.refresh(institute)
    await cache_service.delete(CacheKeys.institute_profile())
    return institute


@router.get("/danger-zone/preview", response_model=DangerZonePreviewResponse)
async def preview_test_data_to_purge(
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns live inventory counts of transactional and test data eligible for purging.
    Strictly restricted to SUPER_ADMIN.
    """
    students_count = (await db.execute(select(func.count(Student.id)))).scalar() or 0
    guardians_count = (await db.execute(select(func.count(Guardian.id)))).scalar() or 0
    portal_users_count = (await db.execute(
        select(func.count(User.id)).where(User.user_type.in_(["STUDENT", "PARENT"]))
    )).scalar() or 0
    invoices_count = (await db.execute(select(func.count(Invoice.id)))).scalar() or 0
    gross_invoiced = (await db.execute(select(func.coalesce(func.sum(Invoice.total_amount), 0.0)))).scalar() or 0.0
    payments_count = (await db.execute(select(func.count(Payment.id)))).scalar() or 0
    examinations_count = (await db.execute(select(func.count(Examination.id)))).scalar() or 0
    exam_marks_count = (await db.execute(select(func.count(ExamMarks.id)))).scalar() or 0
    attendance_records_count = (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() or 0
    seat_allocations_count = (await db.execute(select(func.count(SeatAllocation.id)))).scalar() or 0
    bed_allocations_count = (await db.execute(select(func.count(BedAllocation.id)))).scalar() or 0

    return DangerZonePreviewResponse(
        students_count=students_count,
        guardians_count=guardians_count,
        portal_users_count=portal_users_count,
        invoices_count=invoices_count,
        total_gross_invoiced=float(gross_invoiced),
        payments_count=payments_count,
        examinations_count=examinations_count,
        exam_marks_count=exam_marks_count,
        attendance_records_count=attendance_records_count,
        seat_allocations_count=seat_allocations_count,
        bed_allocations_count=bed_allocations_count
    )


@router.post("/danger-zone/purge-test-data")
async def purge_test_data_for_production(
    data: DangerZonePurgeRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Safely purges test transactions and student accounts before production go-live.
    Requires SUPER_ADMIN role, correct password verification, and confirmation phrase.
    Preserves all master institutes, academic years, courses, batches, and staff accounts.
    """
    # 1. Verify confirmation phrase
    if data.confirmation_phrase.strip() != "CONFIRM-PURGE-TEST-DATA":
        raise BadRequestException(
            "Invalid confirmation phrase. Please type exactly 'CONFIRM-PURGE-TEST-DATA' to proceed."
        )

    # 2. Verify SuperAdmin password
    if not verify_password(data.password, current_user.hashed_password):
        raise BadRequestException(
            "Incorrect Super Admin password. Action aborted for security."
        )

    # 3. Execute atomic cascade deletion in strict foreign-key order
    # Step A: Attendance
    await db.execute(delete(AttendanceCorrection))
    await db.execute(delete(AttendanceRecord))
    await db.execute(delete(AttendanceSession))

    # Step B: Examinations & Results
    await db.execute(delete(ExamResult))
    await db.execute(delete(ExamMarks))
    await db.execute(delete(ExamSubject))
    await db.execute(delete(Examination))

    # Step C: Fees, Invoices & Payments
    await db.execute(delete(Refund))
    await db.execute(delete(Receipt))
    await db.execute(delete(PaymentAllocation))
    await db.execute(delete(Payment))
    await db.execute(delete(Installment))
    await db.execute(delete(InstallmentPlan))
    await db.execute(delete(InvoiceItem))
    await db.execute(delete(Invoice))
    await db.execute(delete(StudentDiscount))
    await db.execute(delete(StudentService))

    # Step D: Facility Occupancies (Seats and Beds reset to AVAILABLE)
    await db.execute(delete(SeatReservation))
    await db.execute(delete(SeatAllocation))
    await db.execute(delete(StudyRoomAttendance))
    await db.execute(
        update(StudySeat)
        .where(StudySeat.status.in_(["OCCUPIED", "RESERVED"]))
        .values(status="AVAILABLE")
    )

    await db.execute(delete(HostelVisitor))
    await db.execute(delete(HostelAttendance))
    await db.execute(delete(BedAllocation))
    await db.execute(
        update(HostelBed)
        .where(HostelBed.status.in_(["OCCUPIED", "RESERVED"]))
        .values(status="AVAILABLE")
    )

    # Step E: Batch Rosters & Enrollments (Batches & Courses remain completely intact)
    await db.execute(delete(BatchStudent))
    await db.execute(delete(EnrollmentSubject))
    await db.execute(delete(EnrollmentYear))
    await db.execute(delete(Enrollment))
    await db.execute(delete(EnrollmentGroup))

    # Step F: Student Documents, Relational links & Portal User Accounts
    await db.execute(delete(StudentDocument))
    await db.execute(delete(StudentUserAccount))
    await db.execute(delete(GuardianUserAccount))
    await db.execute(delete(StudentGuardian))

    # Delete portal student and parent users
    portal_users_stmt = select(User.id).where(User.user_type.in_(["STUDENT", "PARENT"]))
    portal_user_ids = (await db.execute(portal_users_stmt)).scalars().all()
    if portal_user_ids:
        await db.execute(delete(UserSession).where(UserSession.user_id.in_(portal_user_ids)))
        await db.execute(delete(UserRole).where(UserRole.user_id.in_(portal_user_ids)))
        await db.execute(delete(User).where(User.id.in_(portal_user_ids)))

    # Step G: Students & Guardians
    await db.execute(delete(Guardian))
    await db.execute(delete(Student))

    # Step H: Notifications & Outbox Queue
    await db.execute(delete(NotificationOutbox))
    await db.execute(delete(Notification))

    # Commit all deletions atomically
    await db.commit()

    # Invalidate cached endpoints across all modules
    try:
        await cache_service.delete_pattern("dashboard:*")
        await cache_service.delete_pattern("finance:*")
        await cache_service.delete_pattern("students:*")
        await cache_service.delete_pattern("reports:*")
        await cache_service.delete_pattern("attendance:*")
    except Exception:
        pass

    return {
        "success": True,
        "message": "All test transactional data, student profiles, invoices, and exam marks have been permanently wiped. Institute master configuration is clean and ready for production."
    }

