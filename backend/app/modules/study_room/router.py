import uuid
from typing import List, Optional
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException, ForbiddenException
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.student import Student
from app.models.service import ServicePlan, StudentService
from app.models.study_room import StudyRoom, StudySeat, SeatAllocation, StudyRoomAttendance
from app.modules.study_room.schemas import (
    StudySeatResponse, SeatAllocationRequest, SeatTransferRequest,
    SeatRenewalRequest, SeatVacateRequest, StudyRoomAttendanceRecord
)
from app.modules.services.service_billing import (
    create_facility_invoice_and_payment,
    create_facility_renewal_invoice,
    get_or_create_custom_plan
)

router = APIRouter(prefix="/study-rooms", tags=["Study Room"])


@router.get("/seats", response_model=List[StudySeatResponse])
async def get_study_room_seats(
    gender_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns visual floor plan seat layout (150 initial seats: 105 Boys, 45 Girls)
    with real-time occupancy, subscription plans, and student metadata.
    Cached for 60 seconds with active write-invalidation.
    """
    cache_key = CacheKeys.study_room_seats(gender_filter, status_filter)
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached

    stmt = (
        select(StudySeat)
        .options(
            selectinload(StudySeat.allocations)
            .selectinload(SeatAllocation.student),
            selectinload(StudySeat.allocations)
            .selectinload(SeatAllocation.student_service)
            .selectinload(StudentService.service_plan)
        )
        .where(StudySeat.is_active.is_(True))
    )
    if gender_filter:
        stmt = stmt.where(StudySeat.gender_allowed == gender_filter)
    if status_filter:
        stmt = stmt.where(StudySeat.status == status_filter)

    stmt = stmt.order_by(StudySeat.seat_number.asc())
    result = await db.execute(stmt)
    seats = result.scalars().all()

    output = []
    for s in seats:
        active_alloc = next((a for a in s.allocations if a.status == "ACTIVE"), None)
        occupant_name = None
        occupant_code = None
        alloc_id = None
        start_d = None
        end_d = None
        plan_name = None
        frequency = None
        rent_price = None
        deposit = None

        if active_alloc and active_alloc.student:
            occupant_name = f"{active_alloc.student.first_name} {active_alloc.student.last_name}"
            occupant_code = active_alloc.student.student_code
            alloc_id = active_alloc.id
            start_d = active_alloc.start_date
            end_d = active_alloc.end_date
            if active_alloc.student_service:
                rent_price = active_alloc.student_service.unit_price
                deposit = active_alloc.student_service.deposit_amount
                frequency = active_alloc.student_service.billing_frequency
                if active_alloc.student_service.service_plan:
                    plan_name = active_alloc.student_service.service_plan.name

        output.append(
            StudySeatResponse(
                id=s.id,
                study_room_id=s.study_room_id,
                seat_number=s.seat_number,
                row_identifier=s.row_identifier,
                column_identifier=s.column_identifier,
                gender_allowed=s.gender_allowed,
                has_power_outlet=s.has_power_outlet,
                has_locker=s.has_locker,
                status=s.status,
                occupant_name=occupant_name,
                occupant_code=occupant_code,
                allocation_id=alloc_id,
                allocation_start_date=start_d,
                allocation_end_date=end_d,
                plan_name=plan_name,
                billing_frequency=frequency,
                unit_price=rent_price,
                deposit_amount=deposit
            )
        )
    serialized_dicts = [item.model_dump() for item in output]
    await cache_service.set(cache_key, serialized_dicts, ttl=60)
    return output


@router.post("/allocate")
async def allocate_seat(
    data: SeatAllocationRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    student = await db.get(Student, data.student_id)
    if not student:
        raise NotFoundException("Student not found")

    # Select for update row lock to prevent double allocation
    seat_stmt = select(StudySeat).where(StudySeat.id == data.study_seat_id).with_for_update()
    seat = (await db.execute(seat_stmt)).scalar_one_or_none()
    if not seat or seat.status != "AVAILABLE":
        raise ConflictException(f"Seat {seat.seat_number if seat else ''} is not available")

    is_boy = student.gender in ("MALE", "BOY", "BOYS")
    is_girl = student.gender in ("FEMALE", "GIRL", "GIRLS")
    if seat.gender_allowed == "BOYS" and not is_boy:
        raise BadRequestException(f"Seat {seat.seat_number} is reserved for BOYS")
    if seat.gender_allowed == "GIRLS" and not is_girl:
        raise BadRequestException(f"Seat {seat.seat_number} is reserved for GIRLS")

    # 1. Determine Pricing Model & Permissions
    if data.service_plan_id:
        plan = await db.get(ServicePlan, data.service_plan_id)
        if not plan:
            raise NotFoundException("Selected study room service plan not found")
        rent_amount = plan.base_amount
        deposit_amount = data.custom_deposit_amount if data.custom_deposit_amount is not None else plan.deposit_amount
        frequency = plan.billing_frequency
        item_desc = f"Study Room Desk {seat.seat_number} ({plan.name})"
    else:
        # Custom Pricing requires Super Admin or Admin authorization
        if current_user.user_type not in ["SUPER_ADMIN", "ADMIN"]:
            raise ForbiddenException("Custom pricing requires Super Admin or Admin authorization.")
        plan = await get_or_create_custom_plan(db, "STUDY_ROOM")
        rent_amount = data.custom_rent_amount or Decimal("0.00")
        deposit_amount = data.custom_deposit_amount or Decimal("0.00")
        frequency = "ONE_TIME"
        item_desc = f"Study Room Desk {seat.seat_number} (Custom Agreement)"

    # 2. Create Active Student Service
    sr_sub = StudentService(
        student_id=student.id,
        service_plan_id=plan.id,
        start_date=data.start_date,
        end_date=data.end_date,
        billing_frequency=frequency,
        unit_price=rent_amount,
        deposit_amount=deposit_amount,
        status="ACTIVE"
    )
    db.add(sr_sub)
    await db.flush()

    # 3. Create Seat Allocation
    seat.status = "OCCUPIED"
    alloc = SeatAllocation(
        study_seat_id=seat.id,
        student_id=student.id,
        student_service_id=sr_sub.id,
        start_date=data.start_date,
        end_date=data.end_date,
        status="ACTIVE",
        allocated_by_user_id=current_user.id
    )
    db.add(alloc)
    await db.flush()

    # 4. Generate Official Invoice & Optional Payment
    invoice = await create_facility_invoice_and_payment(
        db=db,
        institute_id=current_user.institute_id,
        student_id=student.id,
        service_id=sr_sub.id,
        service_type_code="STUDY_ROOM",
        item_description=item_desc,
        rent_amount=rent_amount,
        deposit_amount=deposit_amount,
        collect_payment=data.collect_payment,
        payment_mode=data.payment_mode or "CASH",
        collected_by_user_id=current_user.id
    )

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.study_room_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    if alloc.student_id:
        await cache_service.delete(CacheKeys.student_profile(alloc.student_id))
    return {
        "message": f"Seat {seat.seat_number} allocated successfully to student {student.student_code}",
        "allocation_id": str(alloc.id),
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "total_amount": float(invoice.total_amount),
        "paid_amount": float(invoice.paid_amount),
        "status": invoice.status
    }


@router.post("/transfer")
async def transfer_seat(
    data: SeatTransferRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    old_alloc = await db.get(SeatAllocation, data.current_allocation_id)
    if not old_alloc or old_alloc.status != "ACTIVE":
        raise NotFoundException("Active allocation not found")

    student = await db.get(Student, old_alloc.student_id)
    old_seat = await db.get(StudySeat, old_alloc.study_seat_id)

    # Lock new seat
    new_seat_stmt = select(StudySeat).where(StudySeat.id == data.new_study_seat_id).with_for_update()
    new_seat = (await db.execute(new_seat_stmt)).scalar_one_or_none()
    if not new_seat or new_seat.status != "AVAILABLE":
        raise ConflictException("New seat is not available")

    is_boy = student.gender in ("MALE", "BOY", "BOYS")
    is_girl = student.gender in ("FEMALE", "GIRL", "GIRLS")
    if new_seat.gender_allowed == "BOYS" and not is_boy:
        raise BadRequestException(f"Seat {new_seat.seat_number} is reserved for BOYS")
    if new_seat.gender_allowed == "GIRLS" and not is_girl:
        raise BadRequestException(f"Seat {new_seat.seat_number} is reserved for GIRLS")

    # Vacate old seat
    old_seat.status = "AVAILABLE"
    old_alloc.status = "TRANSFERRED"
    old_alloc.vacated_at = datetime.now(timezone.utc)

    # Allocate new seat
    new_seat.status = "OCCUPIED"
    new_alloc = SeatAllocation(
        study_seat_id=new_seat.id,
        student_id=student.id,
        student_service_id=old_alloc.student_service_id,
        start_date=date.today(),
        end_date=old_alloc.end_date,
        status="ACTIVE",
        allocated_by_user_id=current_user.id,
        remarks=f"Transferred from seat {old_seat.seat_number}"
    )
    db.add(new_alloc)
    await db.commit()
    await cache_service.delete_pattern(CacheKeys.study_room_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete(CacheKeys.student_profile(student.id))

    return {"message": f"Successfully transferred student from {old_seat.seat_number} to {new_seat.seat_number}"}


@router.post("/renew/{allocation_id}")
async def renew_seat(
    allocation_id: uuid.UUID,
    data: SeatRenewalRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    alloc = await db.get(SeatAllocation, allocation_id)
    if not alloc or alloc.status != "ACTIVE":
        raise NotFoundException("Active seat allocation not found")

    seat = await db.get(StudySeat, alloc.study_seat_id)
    student = await db.get(Student, alloc.student_id)
    if not seat or not student:
        raise NotFoundException("Associated seat or student not found")

    sr_sub = None
    if alloc.student_service_id:
        sr_sub = await db.get(StudentService, alloc.student_service_id)

    if data.renewal_rent_amount is not None:
        rent_amount = data.renewal_rent_amount
    elif sr_sub and sr_sub.unit_price is not None:
        rent_amount = sr_sub.unit_price
    else:
        rent_amount = Decimal("0.00")

    base_date = alloc.end_date if alloc.end_date >= date.today() else date.today()
    new_end_date = base_date + timedelta(days=data.extension_days)

    alloc.end_date = new_end_date
    if sr_sub:
        sr_sub.end_date = new_end_date
        sr_sub.status = "ACTIVE"

    invoice = await create_facility_renewal_invoice(
        db=db,
        institute_id=current_user.institute_id,
        student_id=student.id,
        service_id=sr_sub.id if sr_sub else alloc.id,
        service_type_code="STUDY_ROOM",
        item_description=f"Study Room Desk {seat.seat_number} Renewal ({data.extension_days} Days)",
        renewal_rent_amount=rent_amount,
        collect_payment=data.collect_payment,
        payment_mode=data.payment_mode or "CASH",
        collected_by_user_id=current_user.id
    )

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.study_room_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    if alloc.student_id:
        await cache_service.delete(CacheKeys.student_profile(alloc.student_id))
    return {
        "message": f"Seat {seat.seat_number} subscription renewed until {new_end_date.isoformat()}",
        "new_end_date": new_end_date.isoformat(),
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "total_amount": float(invoice.total_amount),
        "paid_amount": float(invoice.paid_amount),
        "status": invoice.status
    }


@router.post("/vacate/{allocation_id}")
async def vacate_seat(
    allocation_id: uuid.UUID,
    data: Optional[SeatVacateRequest] = None,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    alloc = await db.get(SeatAllocation, allocation_id)
    if not alloc or alloc.status != "ACTIVE":
        raise NotFoundException("Active seat allocation not found")

    seat = await db.get(StudySeat, alloc.study_seat_id)
    if seat:
        seat.status = "AVAILABLE"

    total_deposit = Decimal("0.00")
    if alloc.student_service_id:
        sr_sub = await db.get(StudentService, alloc.student_service_id)
        if sr_sub:
            total_deposit = sr_sub.deposit_amount or Decimal("0.00")
            sr_sub.status = "EXPIRED"
            sr_sub.end_date = date.today()

    alloc.status = "EXPIRED"
    alloc.vacated_at = datetime.now(timezone.utc)
    if data and data.remarks:
        alloc.remarks = data.remarks

    deduction = data.damage_deduction if data else Decimal("0.00")
    net_refund = max(Decimal("0.00"), total_deposit - deduction)

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.study_room_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    if alloc.student_id:
        await cache_service.delete(CacheKeys.student_profile(alloc.student_id))
    return {
        "message": f"Seat {seat.seat_number if seat else ''} vacated successfully",
        "deposit_amount": float(total_deposit),
        "damage_deduction": float(deduction),
        "refund_amount": float(net_refund)
    }


@router.post("/attendance")
async def record_study_attendance(
    data: StudyRoomAttendanceRecord,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    today = date.today()
    if data.is_check_out:
        # Find active check-in
        stmt = (
            select(StudyRoomAttendance)
            .where(
                and_(
                    StudyRoomAttendance.student_id == data.student_id,
                    StudyRoomAttendance.study_seat_id == data.study_seat_id,
                    StudyRoomAttendance.attendance_date == today,
                    StudyRoomAttendance.check_out_time.is_(None)
                )
            )
        )
        rec = (await db.execute(stmt)).scalar_one_or_none()
        if rec:
            rec.check_out_time = datetime.now(timezone.utc)
            await db.commit()
            await cache_service.delete(CacheKeys.student_profile(data.student_id))
            await cache_service.delete_pattern(CacheKeys.study_room_pattern())
            return {"message": "Study room check-out recorded"}
        raise NotFoundException("No active check-in session found for student today")
    else:
        att = StudyRoomAttendance(
            study_seat_id=data.study_seat_id,
            student_id=data.student_id,
            check_in_time=datetime.now(timezone.utc),
            attendance_date=today,
            recorded_by_user_id=current_user.id
        )
        db.add(att)
        await db.commit()
        await cache_service.delete(CacheKeys.student_profile(data.student_id))
        await cache_service.delete_pattern(CacheKeys.study_room_pattern())
        return {"message": "Study room check-in recorded"}
