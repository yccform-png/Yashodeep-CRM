import uuid
from typing import List, Optional
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException, ForbiddenException
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.student import Student
from app.models.service import ServicePlan, StudentService
from app.models.hostel import (
    Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed,
    BedAllocation, HostelVisitor, HostelMaintenance
)
from app.modules.hostel.schemas import (
    HostelResponse, HostelBuildingResponse, HostelFloorResponse,
    HostelRoomResponse, HostelBedResponse, BedAllocationRequest,
    BedRenewalRequest, BedCheckOutRequest, BedTransferRequest,
    HostelVisitorCreate, HostelMaintenanceCreate,
    HostelFloorCreate, HostelRoomCreate, HostelRoomUpdate, HostelBedCreate
)
from app.modules.services.service_billing import (
    create_facility_invoice_and_payment,
    create_facility_renewal_invoice,
    get_or_create_custom_plan
)

router = APIRouter(prefix="/hostels", tags=["Hostel"])


def natural_sort_key(s: str):
    import re
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s or '')]


@router.get("", response_model=List[HostelResponse])
async def list_hostels(db: AsyncSession = Depends(get_db)):
    cached = await cache_service.get(CacheKeys.hostel_tree())
    if cached is not None:
        return cached

    stmt = (
        select(Hostel)
        .options(
            selectinload(Hostel.buildings)
            .selectinload(HostelBuilding.floors)
            .selectinload(HostelFloor.rooms)
            .selectinload(HostelRoom.beds)
            .selectinload(HostelBed.allocations)
            .selectinload(BedAllocation.student),
            selectinload(Hostel.buildings)
            .selectinload(HostelBuilding.floors)
            .selectinload(HostelFloor.rooms)
            .selectinload(HostelRoom.beds)
            .selectinload(HostelBed.allocations)
            .selectinload(BedAllocation.student_service)
            .selectinload(StudentService.service_plan)
        )
    )
    result = await db.execute(stmt)
    hostels = result.scalars().all()

    output = []
    for h in hostels:
        b_list = []
        for b in h.buildings:
            f_list = []
            sorted_floors = sorted(b.floors, key=lambda f: f.floor_number)
            for f in sorted_floors:
                r_list = []
                sorted_rooms = sorted(f.rooms, key=lambda r: natural_sort_key(r.room_number))
                for r in sorted_rooms:
                    beds_out = []
                    sorted_beds = sorted(r.beds, key=lambda bd: (bd.bunk_group or 0, natural_sort_key(bd.bed_number)))
                    for bed in sorted_beds:
                        active_alloc = next((a for a in bed.allocations if a.status == "ACTIVE"), None)
                        occ_name = None
                        occ_code = None
                        alloc_id = None
                        start_d = None
                        end_d = None
                        dep_amt = None
                        rent_price = None
                        plan_name = None
                        freq = None

                        if active_alloc and active_alloc.student:
                            occ_name = f"{active_alloc.student.first_name} {active_alloc.student.last_name}"
                            occ_code = active_alloc.student.student_code
                            alloc_id = active_alloc.id
                            start_d = active_alloc.start_date
                            end_d = active_alloc.end_date
                            dep_amt = active_alloc.deposit_amount
                            if active_alloc.student_service:
                                rent_price = active_alloc.student_service.unit_price
                                if active_alloc.student_service.deposit_amount:
                                    dep_amt = active_alloc.student_service.deposit_amount
                                freq = active_alloc.student_service.billing_frequency
                                if active_alloc.student_service.service_plan:
                                    plan_name = active_alloc.student_service.service_plan.name

                        beds_out.append(
                            HostelBedResponse(
                                id=bed.id,
                                room_id=bed.room_id,
                                bed_number=bed.bed_number,
                                bed_label=bed.bed_label,
                                tier=bed.tier or ("UPPER" if "-U" in bed.bed_number else "LOWER"),
                                bunk_group=bed.bunk_group or 1,
                                status=bed.status,
                                occupant_name=occ_name,
                                occupant_code=occ_code,
                                allocation_id=alloc_id,
                                allocation_start_date=start_d,
                                allocation_end_date=end_d,
                                deposit_amount=dep_amt,
                                unit_price=rent_price,
                                plan_name=plan_name,
                                billing_frequency=freq
                            )
                        )
                    r_list.append(
                        HostelRoomResponse(
                            id=r.id,
                            room_number=r.room_number,
                            room_type=r.room_type,
                            capacity=r.capacity,
                            has_attached_bathroom=r.has_attached_bathroom,
                            is_ac=r.is_ac,
                            beds=beds_out
                        )
                    )
                f_list.append(HostelFloorResponse(id=f.id, floor_number=f.floor_number, name=f.name, rooms=r_list))
            b_list.append(HostelBuildingResponse(id=b.id, name=b.name, code=b.code, floors=f_list))
        output.append(HostelResponse(id=h.id, name=h.name, code=h.code, gender_type=h.gender_type, address=h.address, buildings=b_list))
    serialized_dicts = [h.model_dump() for h in output]
    await cache_service.set(CacheKeys.hostel_tree(), serialized_dicts, ttl=120)
    return output


@router.post("/allocate")
async def allocate_bed(
    data: BedAllocationRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN", "HOSTEL_WARDEN"])),
    db: AsyncSession = Depends(get_db)
):
    student = await db.get(Student, data.student_id)
    if not student:
        raise NotFoundException("Student not found")

    bed_stmt = select(HostelBed).where(HostelBed.id == data.hostel_bed_id).with_for_update()
    bed = (await db.execute(bed_stmt)).scalar_one_or_none()
    if not bed or bed.status != "AVAILABLE":
        raise ConflictException("Selected bed is not available")

    # 1. Determine Pricing Model & Permissions
    if data.service_plan_id:
        plan = await db.get(ServicePlan, data.service_plan_id)
        if not plan:
            raise NotFoundException("Selected hostel service plan not found")
        rent_amount = plan.base_amount
        deposit_amount = data.deposit_amount if data.deposit_amount is not None else plan.deposit_amount
        frequency = plan.billing_frequency
        item_desc = f"Hostel Bed {bed.bed_number} ({plan.name})"
    else:
        # Custom Pricing requires Super Admin or Admin authorization
        if current_user.user_type not in ["SUPER_ADMIN", "ADMIN"]:
            raise ForbiddenException("Custom pricing requires Super Admin or Admin authorization.")
        plan = await get_or_create_custom_plan(db, "HOSTEL")
        rent_amount = data.custom_rent_amount or Decimal("0.00")
        deposit_amount = data.deposit_amount or Decimal("0.00")
        frequency = "ONE_TIME"
        item_desc = f"Hostel Bed {bed.bed_number} (Custom Agreement)"

    # 2. Create Active Student Service
    hostel_sub = StudentService(
        student_id=student.id,
        service_plan_id=plan.id,
        start_date=data.start_date,
        end_date=data.end_date,
        billing_frequency=frequency,
        unit_price=rent_amount,
        deposit_amount=deposit_amount,
        status="ACTIVE"
    )
    db.add(hostel_sub)
    await db.flush()

    # 3. Create Bed Allocation
    bed.status = "OCCUPIED"
    alloc = BedAllocation(
        hostel_bed_id=bed.id,
        student_id=student.id,
        student_service_id=hostel_sub.id,
        start_date=data.start_date,
        end_date=data.end_date,
        check_in_date=date.today(),
        deposit_amount=deposit_amount,
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
        service_id=hostel_sub.id,
        service_type_code="HOSTEL",
        item_description=item_desc,
        rent_amount=rent_amount,
        deposit_amount=deposit_amount,
        collect_payment=data.collect_payment,
        payment_mode=data.payment_mode or "CASH",
        collected_by_user_id=current_user.id
    )

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    if alloc.student_id:
        await cache_service.delete(CacheKeys.student_profile(alloc.student_id))
    return {
        "message": f"Bed {bed.bed_number} allocated successfully to student {student.student_code}",
        "allocation_id": str(alloc.id),
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "total_amount": float(invoice.total_amount),
        "paid_amount": float(invoice.paid_amount),
        "status": invoice.status
    }


@router.post("/renew/{allocation_id}")
async def renew_bed(
    allocation_id: uuid.UUID,
    data: BedRenewalRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN", "HOSTEL_WARDEN"])),
    db: AsyncSession = Depends(get_db)
):
    alloc = await db.get(BedAllocation, allocation_id)
    if not alloc or alloc.status != "ACTIVE":
        raise NotFoundException("Active bed allocation not found")

    bed = await db.get(HostelBed, alloc.hostel_bed_id)
    student = await db.get(Student, alloc.student_id)
    if not bed or not student:
        raise NotFoundException("Associated bed or student not found")

    hostel_sub = None
    if alloc.student_service_id:
        hostel_sub = await db.get(StudentService, alloc.student_service_id)

    if data.renewal_rent_amount is not None:
        rent_amount = data.renewal_rent_amount
    elif hostel_sub and hostel_sub.unit_price is not None:
        rent_amount = hostel_sub.unit_price
    else:
        rent_amount = Decimal("0.00")

    base_date = alloc.end_date if alloc.end_date >= date.today() else date.today()
    new_end_date = base_date + timedelta(days=data.extension_days)

    alloc.end_date = new_end_date
    if hostel_sub:
        hostel_sub.end_date = new_end_date
        hostel_sub.status = "ACTIVE"

    invoice = await create_facility_renewal_invoice(
        db=db,
        institute_id=current_user.institute_id,
        student_id=student.id,
        service_id=hostel_sub.id if hostel_sub else alloc.id,
        service_type_code="HOSTEL",
        item_description=f"Hostel Bed {bed.bed_number} Renewal ({data.extension_days} Days)",
        renewal_rent_amount=rent_amount,
        collect_payment=data.collect_payment,
        payment_mode=data.payment_mode or "CASH",
        collected_by_user_id=current_user.id
    )

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    if alloc.student_id:
        await cache_service.delete(CacheKeys.student_profile(alloc.student_id))
    return {
        "message": f"Bed {bed.bed_number} subscription renewed until {new_end_date.isoformat()}",
        "new_end_date": new_end_date.isoformat(),
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "total_amount": float(invoice.total_amount),
        "paid_amount": float(invoice.paid_amount),
        "status": invoice.status
    }


@router.post("/check-out/{allocation_id}")
async def check_out_bed(
    allocation_id: uuid.UUID,
    data: Optional[BedCheckOutRequest] = None,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN", "HOSTEL_WARDEN"])),
    db: AsyncSession = Depends(get_db)
):
    alloc = await db.get(BedAllocation, allocation_id)
    if not alloc or alloc.status != "ACTIVE":
        raise NotFoundException("Active bed allocation not found")

    bed = await db.get(HostelBed, alloc.hostel_bed_id)
    if bed:
        bed.status = "AVAILABLE"

    total_deposit = alloc.deposit_amount or Decimal("0.00")
    if alloc.student_service_id:
        hostel_sub = await db.get(StudentService, alloc.student_service_id)
        if hostel_sub:
            if hostel_sub.deposit_amount:
                total_deposit = hostel_sub.deposit_amount
            hostel_sub.status = "EXPIRED"
            hostel_sub.end_date = date.today()

    alloc.status = "VACATED"
    alloc.check_out_date = date.today()
    if data and data.remarks:
        alloc.remarks = data.remarks

    deduction = data.damage_deduction if data else Decimal("0.00")
    net_refund = max(Decimal("0.00"), total_deposit - deduction)

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    if alloc.student_id:
        await cache_service.delete(CacheKeys.student_profile(alloc.student_id))
    return {
        "message": f"Bed {bed.bed_number if bed else ''} checked out and vacated successfully",
        "deposit_amount": float(total_deposit),
        "damage_deduction": float(deduction),
        "refund_amount": float(net_refund)
    }


@router.post("/transfer")
async def transfer_bed(
    data: BedTransferRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN", "HOSTEL_WARDEN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Transfers an active resident student from their current bed to a new bed
    (within the same room, to a new room on the same floor, or to another floor).
    """
    stmt_alloc = (
        select(BedAllocation)
        .options(
            selectinload(BedAllocation.hostel_bed).selectinload(HostelBed.room),
            selectinload(BedAllocation.student),
            selectinload(BedAllocation.student_service)
        )
        .where(BedAllocation.id == data.current_allocation_id)
    )
    old_alloc = (await db.execute(stmt_alloc)).scalar_one_or_none()
    if not old_alloc or old_alloc.status != "ACTIVE":
        raise NotFoundException("Active bed allocation not found")

    student = old_alloc.student
    old_bed = old_alloc.hostel_bed
    if not old_bed or not student:
        raise NotFoundException("Associated bed or student record not found")

    # Lock and validate target new bed
    new_bed_stmt = (
        select(HostelBed)
        .options(selectinload(HostelBed.room))
        .where(HostelBed.id == data.new_hostel_bed_id)
        .with_for_update()
    )
    new_bed = (await db.execute(new_bed_stmt)).scalar_one_or_none()
    if not new_bed:
        raise NotFoundException("Target bed not found")
    if new_bed.status != "AVAILABLE":
        raise ConflictException(f"Target bed '{new_bed.bed_label or new_bed.bed_number}' is not available")

    if new_bed.id == old_bed.id:
        raise BadRequestException("Target bed must be different from current bed")

    today = date.today()

    # 1. Vacate old bed & mark allocation as TRANSFERRED
    old_alloc.status = "TRANSFERRED"
    old_alloc.check_out_date = today
    old_room_num = old_bed.room.room_number if old_bed.room else ""
    new_room_num = new_bed.room.room_number if new_bed.room else ""
    transfer_note = f"[Transferred to Bed {new_bed.bed_number} (Room {new_room_num}) on {today}]"
    old_alloc.remarks = f"{old_alloc.remarks or ''} {transfer_note}".strip()
    old_bed.status = "AVAILABLE"

    # 2. Occupy new bed & create active new allocation
    new_bed.status = "OCCUPIED"
    new_remarks = data.remarks or f"Transferred from Bed {old_bed.bed_number} (Room {old_room_num})"
    new_alloc = BedAllocation(
        hostel_bed_id=new_bed.id,
        student_id=student.id,
        student_service_id=old_alloc.student_service_id,
        start_date=today,
        end_date=old_alloc.end_date,
        check_in_date=today,
        deposit_amount=old_alloc.deposit_amount,
        status="ACTIVE",
        allocated_by_user_id=current_user.id,
        remarks=new_remarks
    )
    db.add(new_alloc)

    # 3. Update student service remark
    if old_alloc.student_service:
        old_alloc.student_service.remarks = f"Hostel Bed {new_bed.bed_number} (Transferred from {old_bed.bed_number})"

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    if student.id:
        await cache_service.delete(CacheKeys.student_profile(student.id))

    is_same_room = old_room_num == new_room_num
    loc_phrase = f"within Room {old_room_num}" if is_same_room else f"from Room {old_room_num} to Room {new_room_num}"

    return {
        "message": f"Successfully transferred {student.first_name} {student.last_name} {loc_phrase} (Bed {old_bed.bed_number} → Bed {new_bed.bed_number})",
        "new_allocation_id": str(new_alloc.id),
        "old_bed_number": old_bed.bed_number,
        "new_bed_number": new_bed.bed_number,
        "is_same_room": is_same_room
    }


@router.post("/rooms/{target_room_id}/transfer-bunk")
async def transfer_bunk_to_room(
    target_room_id: uuid.UUID,
    source_room_id: uuid.UUID,
    bunk_group: int,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Transfers an entire vacant 2-tier bunk bed unit from a source room to a target room.
    Decrements source room capacity by 2 and increments target room capacity by 2.
    """
    stmt_src = select(HostelRoom).options(selectinload(HostelRoom.beds)).where(HostelRoom.id == source_room_id)
    source_room = (await db.execute(stmt_src)).scalar_one_or_none()
    if not source_room:
        raise NotFoundException("Source room not found")

    stmt_tgt = select(HostelRoom).options(selectinload(HostelRoom.beds)).where(HostelRoom.id == target_room_id)
    target_room = (await db.execute(stmt_tgt)).scalar_one_or_none()
    if not target_room:
        raise NotFoundException("Target room not found")

    bunk_beds = [b for b in source_room.beds if b.bunk_group == bunk_group]
    if not bunk_beds:
        raise NotFoundException(f"Bunk {bunk_group} not found in Room {source_room.room_number}")

    if any(b.status == "OCCUPIED" for b in bunk_beds):
        raise BadRequestException(f"Cannot transfer Bunk {bunk_group}: contains active occupants. Vacate or transfer occupants first.")

    # Determine next bunk group in target room
    tgt_bunks = {b.bunk_group for b in target_room.beds if b.bunk_group is not None}
    next_tgt_bunk = 1
    while next_tgt_bunk in tgt_bunks:
        next_tgt_bunk += 1

    # Move beds to target room and rename according to target room convention
    for bed in bunk_beds:
        bed.room_id = target_room.id
        bed.bunk_group = next_tgt_bunk
        if next_tgt_bunk == 1:
            bed.bed_number = f"{target_room.room_number}-{'L' if bed.tier == 'LOWER' else 'U'}"
            bed.bed_label = "Lower Berth" if bed.tier == "LOWER" else "Upper Berth"
        else:
            bed.bed_number = f"{target_room.room_number}-B{next_tgt_bunk}-{'L' if bed.tier == 'LOWER' else 'U'}"
            bed.bed_label = f"Bunk {next_tgt_bunk} - {'Lower Berth' if bed.tier == 'LOWER' else 'Upper Berth'}"

    # Adjust capacities
    source_room.capacity = max(0, len(source_room.beds) - len(bunk_beds))
    if source_room.capacity > 2:
        source_room.room_type = "DORMITORY"
    elif source_room.capacity == 2:
        source_room.room_type = "DOUBLE"
    elif source_room.capacity == 1:
        source_room.room_type = "SINGLE"

    target_room.capacity = len(target_room.beds) + len(bunk_beds)
    if target_room.capacity > 2:
        target_room.room_type = "DORMITORY"
    elif target_room.capacity == 2:
        target_room.room_type = "DOUBLE"

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())

    return {
        "message": f"Successfully transferred Bunk {bunk_group} from Room {source_room.room_number} to Room {target_room.room_number} as Bunk {next_tgt_bunk} (+2 capacity)"
    }


@router.post("/visitors")
async def log_visitor(
    data: HostelVisitorCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN", "HOSTEL_WARDEN"])),
    db: AsyncSession = Depends(get_db)
):
    visitor = HostelVisitor(
        student_id=data.student_id,
        visitor_name=data.visitor_name,
        visitor_phone=data.visitor_phone,
        relation=data.relation,
        visit_date=date.today(),
        in_time=data.in_time,
        purpose=data.purpose
    )
    db.add(visitor)
    await db.commit()
    await cache_service.delete(CacheKeys.student_profile(data.student_id))
    return {"message": "Visitor entry logged"}


@router.post("/maintenance")
async def report_maintenance(
    data: HostelMaintenanceCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN", "HOSTEL_WARDEN"])),
    db: AsyncSession = Depends(get_db)
):
    maint = HostelMaintenance(
        hostel_room_id=data.hostel_room_id,
        issue_type=data.issue_type,
        description=data.description,
        priority=data.priority,
        status="OPEN"
    )
    db.add(maint)
    await db.commit()
    return {"message": "Maintenance ticket created"}


# ==============================================================================
# Dynamic Hostel Infrastructure Management (Floors, Rooms & Beds)
# Strictly restricted to SUPER_ADMIN and ADMIN
# ==============================================================================

@router.post("/buildings/{building_id}/floors", response_model=HostelFloorResponse, status_code=status.HTTP_201_CREATED)
async def create_hostel_floor(
    building_id: uuid.UUID,
    data: HostelFloorCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    building = await db.get(HostelBuilding, building_id)
    if not building:
        raise NotFoundException("Hostel building not found")

    stmt = select(HostelFloor).where(
        HostelFloor.building_id == building_id,
        HostelFloor.floor_number == data.floor_number
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise BadRequestException(f"Floor number {data.floor_number} already exists in building '{building.name}'")

    floor = HostelFloor(
        building_id=building_id,
        floor_number=data.floor_number,
        name=data.name
    )
    db.add(floor)
    building.total_floors = max(building.total_floors, data.floor_number)
    await db.commit()
    await db.refresh(floor)
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())

    return HostelFloorResponse(
        id=floor.id,
        floor_number=floor.floor_number,
        name=floor.name,
        rooms=[]
    )


@router.delete("/floors/{floor_id}")
async def delete_hostel_floor(
    floor_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(HostelFloor)
        .options(
            selectinload(HostelFloor.rooms)
            .selectinload(HostelRoom.beds)
        )
        .where(HostelFloor.id == floor_id)
    )
    floor = (await db.execute(stmt)).scalar_one_or_none()
    if not floor:
        raise NotFoundException("Hostel floor not found")

    # Check for occupied beds
    for r in floor.rooms:
        for b in r.beds:
            if b.status == "OCCUPIED":
                raise BadRequestException(
                    f"Cannot delete floor '{floor.name}': Room {r.room_number} has an actively occupied bed ({b.bed_label or b.bed_number}). Checkout occupant first."
                )

    await db.delete(floor)
    await db.commit()
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    return {"message": f"Floor '{floor.name}' and all its vacant rooms were deleted successfully"}


@router.post("/floors/{floor_id}/rooms", response_model=HostelRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_hostel_room(
    floor_id: uuid.UUID,
    data: HostelRoomCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    floor = await db.get(HostelFloor, floor_id)
    if not floor:
        raise NotFoundException("Hostel floor not found")

    stmt = select(HostelRoom).where(
        HostelRoom.floor_id == floor_id,
        HostelRoom.room_number == data.room_number
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise BadRequestException(f"Room '{data.room_number}' already exists on floor '{floor.name}'")

    room = HostelRoom(
        floor_id=floor_id,
        room_number=data.room_number,
        room_type=data.room_type,
        capacity=data.capacity,
        has_attached_bathroom=data.has_attached_bathroom,
        is_ac=data.is_ac,
        is_active=True
    )
    db.add(room)
    await db.flush()

    # Smart Auto-Provisioning of Beds
    created_beds: List[HostelBed] = []
    if data.auto_create_beds and data.capacity > 0:
        if data.capacity == 1:
            bed = HostelBed(
                room_id=room.id,
                bed_number=f"{data.room_number}-1",
                bed_label="Single Bed",
                tier="SINGLE",
                bunk_group=1,
                status="AVAILABLE",
                is_active=True
            )
            db.add(bed)
            created_beds.append(bed)
        elif data.capacity == 2:
            bed_l = HostelBed(
                room_id=room.id,
                bed_number=f"{data.room_number}-L",
                bed_label="Lower Berth",
                tier="LOWER",
                bunk_group=1,
                status="AVAILABLE",
                is_active=True
            )
            bed_u = HostelBed(
                room_id=room.id,
                bed_number=f"{data.room_number}-U",
                bed_label="Upper Berth",
                tier="UPPER",
                bunk_group=1,
                status="AVAILABLE",
                is_active=True
            )
            db.add(bed_l)
            db.add(bed_u)
            created_beds.extend([bed_l, bed_u])
        else:
            for i in range(data.capacity):
                b_grp = (i // 2) + 1
                b_tier = "LOWER" if i % 2 == 0 else "UPPER"
                suffix = "L" if b_tier == "LOWER" else "U"
                if b_grp == 1:
                    bed_number = f"{data.room_number}-{suffix}"
                    bed_label = "Lower Berth" if b_tier == "LOWER" else "Upper Berth"
                else:
                    bed_number = f"{data.room_number}-B{b_grp}-{suffix}"
                    bed_label = f"Bunk {b_grp} - {'Lower Berth' if b_tier == 'LOWER' else 'Upper Berth'}"

                bed = HostelBed(
                    room_id=room.id,
                    bed_number=bed_number,
                    bed_label=bed_label,
                    tier=b_tier,
                    bunk_group=b_grp,
                    status="AVAILABLE",
                    is_active=True
                )
                db.add(bed)
                created_beds.append(bed)

    await db.commit()
    await db.refresh(room)
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())

    return HostelRoomResponse(
        id=room.id,
        room_number=room.room_number,
        room_type=room.room_type,
        capacity=room.capacity,
        has_attached_bathroom=room.has_attached_bathroom,
        is_ac=room.is_ac,
        beds=[
            HostelBedResponse(
                id=b.id,
                room_id=b.room_id,
                bed_number=b.bed_number,
                bed_label=b.bed_label,
                tier=b.tier,
                bunk_group=b.bunk_group,
                status=b.status
            ) for b in created_beds
        ]
    )


@router.put("/rooms/{room_id}", response_model=HostelRoomResponse)
async def update_hostel_room(
    room_id: uuid.UUID,
    data: HostelRoomUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HostelRoom).options(selectinload(HostelRoom.beds)).where(HostelRoom.id == room_id)
    room = (await db.execute(stmt)).scalar_one_or_none()
    if not room:
        raise NotFoundException("Hostel room not found")

    if data.room_type is not None:
        room.room_type = data.room_type
    if data.capacity is not None:
        occupied_count = sum(1 for b in room.beds if b.status == "OCCUPIED")
        if data.capacity < occupied_count:
            raise BadRequestException(f"Cannot reduce capacity to {data.capacity}; room currently has {occupied_count} occupied beds.")
        room.capacity = data.capacity
    if data.has_attached_bathroom is not None:
        room.has_attached_bathroom = data.has_attached_bathroom
    if data.is_ac is not None:
        room.is_ac = data.is_ac

    await db.commit()
    await db.refresh(room)
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())

    return HostelRoomResponse(
        id=room.id,
        room_number=room.room_number,
        room_type=room.room_type,
        capacity=room.capacity,
        has_attached_bathroom=room.has_attached_bathroom,
        is_ac=room.is_ac,
        beds=[
            HostelBedResponse(
                id=b.id,
                room_id=b.room_id,
                bed_number=b.bed_number,
                bed_label=b.bed_label,
                tier=b.tier or ("UPPER" if "-U" in b.bed_number else "LOWER"),
                bunk_group=b.bunk_group or 1,
                status=b.status
            ) for b in room.beds
        ]
    )


@router.delete("/rooms/{room_id}")
async def delete_hostel_room(
    room_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HostelRoom).options(selectinload(HostelRoom.beds)).where(HostelRoom.id == room_id)
    room = (await db.execute(stmt)).scalar_one_or_none()
    if not room:
        raise NotFoundException("Hostel room not found")

    for b in room.beds:
        if b.status == "OCCUPIED":
            raise BadRequestException(f"Cannot delete Room {room.room_number}: bed '{b.bed_label or b.bed_number}' is actively occupied.")

    await db.delete(room)
    await db.commit()
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    return {"message": f"Room {room.room_number} and its vacant beds were deleted successfully"}


@router.post("/rooms/{room_id}/bunks", response_model=List[HostelBedResponse], status_code=status.HTTP_201_CREATED)
async def create_hostel_bunk_unit(
    room_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Atomically adds a complete 2-tier Bunk Bed unit (both Lower Berth and Upper Berth)
    to the room, incrementing capacity by +2 positions.
    """
    stmt = select(HostelRoom).options(selectinload(HostelRoom.beds)).where(HostelRoom.id == room_id)
    room = (await db.execute(stmt)).scalar_one_or_none()
    if not room:
        raise NotFoundException("Hostel room not found")

    import re
    # Determine all occupied bunk group slots in this room
    existing_bunks = {b.bunk_group for b in room.beds if b.bunk_group is not None}
    if any(b.bed_number.endswith("-L") and "-B" not in b.bed_number for b in room.beds):
        existing_bunks.add(1)
    for b in room.beds:
        m = re.search(r'-B(\d+)-', b.bed_number)
        if m:
            existing_bunks.add(int(m.group(1)))

    next_bunk = 1
    while next_bunk in existing_bunks:
        next_bunk += 1

    # Numbering: Bunk 1 gets 101-L and 101-U; Bunk 2+ gets 101-B2-L and 101-B2-U
    if next_bunk == 1:
        lower_num = f"{room.room_number}-L"
        upper_num = f"{room.room_number}-U"
        lower_label = "Lower Berth"
        upper_label = "Upper Berth"
    else:
        lower_num = f"{room.room_number}-B{next_bunk}-L"
        upper_num = f"{room.room_number}-B{next_bunk}-U"
        lower_label = f"Bunk {next_bunk} - Lower Berth"
        upper_label = f"Bunk {next_bunk} - Upper Berth"

    lower_bed = HostelBed(
        room_id=room.id,
        bed_number=lower_num,
        bed_label=lower_label,
        tier="LOWER",
        bunk_group=next_bunk,
        status="AVAILABLE",
        is_active=True
    )
    upper_bed = HostelBed(
        room_id=room.id,
        bed_number=upper_num,
        bed_label=upper_label,
        tier="UPPER",
        bunk_group=next_bunk,
        status="AVAILABLE",
        is_active=True
    )

    db.add(lower_bed)
    db.add(upper_bed)
    room.beds.append(lower_bed)
    room.beds.append(upper_bed)
    room.capacity = len(room.beds)
    if room.capacity > 2:
        room.room_type = "DORMITORY"
    elif room.capacity == 2:
        room.room_type = "DOUBLE"

    await db.commit()
    await db.refresh(room)
    await db.refresh(lower_bed)
    await db.refresh(upper_bed)
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())

    return [
        HostelBedResponse(
            id=lower_bed.id,
            room_id=lower_bed.room_id,
            bed_number=lower_bed.bed_number,
            bed_label=lower_bed.bed_label,
            tier=lower_bed.tier,
            bunk_group=lower_bed.bunk_group,
            status=lower_bed.status
        ),
        HostelBedResponse(
            id=upper_bed.id,
            room_id=upper_bed.room_id,
            bed_number=upper_bed.bed_number,
            bed_label=upper_bed.bed_label,
            tier=upper_bed.tier,
            bunk_group=upper_bed.bunk_group,
            status=upper_bed.status
        )
    ]


@router.delete("/rooms/{room_id}/bunks/{bunk_group}")
async def delete_hostel_bunk_unit(
    room_id: uuid.UUID,
    bunk_group: int,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Atomically deletes an entire 2-tier Bunk Bed unit (both berths) if neither
    is occupied, decrementing room capacity by 2.
    """
    stmt = select(HostelRoom).options(selectinload(HostelRoom.beds)).where(HostelRoom.id == room_id)
    room = (await db.execute(stmt)).scalar_one_or_none()
    if not room:
        raise NotFoundException("Hostel room not found")

    # Match beds by bunk_group or fallback to bed naming convention
    bunk_beds = [b for b in room.beds if b.bunk_group == bunk_group]
    if not bunk_beds:
        if bunk_group == 1:
            bunk_beds = [b for b in room.beds if b.bed_number in [f"{room.room_number}-L", f"{room.room_number}-U"]]
        else:
            bunk_beds = [b for b in room.beds if f"-B{bunk_group}-" in b.bed_number]

    if not bunk_beds:
        raise NotFoundException(f"Bunk {bunk_group} not found in this room")

    occupied = [b for b in bunk_beds if b.status == "OCCUPIED"]
    if occupied:
        occ_names = ", ".join(b.occupant_name or b.bed_number for b in occupied)
        raise BadRequestException(f"Cannot delete Bunk {bunk_group}: occupied by {occ_names}. Vacate occupant(s) first.")

    for b in bunk_beds:
        if b in room.beds:
            room.beds.remove(b)
        await db.delete(b)

    room.capacity = max(0, len(room.beds))
    if room.capacity > 2:
        room.room_type = "DORMITORY"
    elif room.capacity == 2:
        room.room_type = "DOUBLE"
    elif room.capacity == 1:
        room.room_type = "SINGLE"

    await db.commit()
    await db.refresh(room)
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    return {"message": f"Bunk {bunk_group} and its {len(bunk_beds)} berths deleted successfully"}


@router.post("/rooms/{room_id}/beds", response_model=HostelBedResponse, status_code=status.HTTP_201_CREATED)
async def create_hostel_bed(
    room_id: uuid.UUID,
    data: HostelBedCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HostelRoom).options(selectinload(HostelRoom.beds)).where(HostelRoom.id == room_id)
    room = (await db.execute(stmt)).scalar_one_or_none()
    if not room:
        raise NotFoundException("Hostel room not found")

    default_tier = data.tier or ("UPPER" if len(room.beds) % 2 == 1 else "LOWER")
    default_bunk = data.bunk_group or ((len(room.beds) // 2) + 1)
    suffix = "U" if default_tier == "UPPER" else "L"
    bed_number = data.bed_number or f"{room.room_number}-{suffix}"
    bed_label = data.bed_label or ("Upper Berth" if default_tier == "UPPER" else "Lower Berth")

    if any(b.bed_number == bed_number for b in room.beds):
        # Fallback to bunk notation if duplicate
        bed_number = f"{room.room_number}-B{default_bunk}-{suffix}"
        if any(b.bed_number == bed_number for b in room.beds):
            letter = chr(ord('A') + len(room.beds))
            bed_number = f"{room.room_number}-{letter}"

    bed = HostelBed(
        room_id=room_id,
        bed_number=bed_number,
        bed_label=bed_label,
        tier=default_tier,
        bunk_group=default_bunk,
        status="AVAILABLE",
        is_active=True
    )
    db.add(bed)
    room.capacity = max(room.capacity, len(room.beds) + 1)
    await db.commit()
    await db.refresh(bed)
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())

    return HostelBedResponse(
        id=bed.id,
        room_id=bed.room_id,
        bed_number=bed_number,
        bed_label=bed_label,
        tier=bed.tier,
        bunk_group=bed.bunk_group,
        status=bed.status
    )


@router.delete("/beds/{bed_id}")
async def delete_hostel_bed(
    bed_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HostelBed).options(selectinload(HostelBed.room)).where(HostelBed.id == bed_id)
    bed = (await db.execute(stmt)).scalar_one_or_none()
    if not bed:
        raise NotFoundException("Hostel bed not found")

    if bed.status == "OCCUPIED":
        raise BadRequestException("Cannot delete an occupied bed. Checkout occupant first.")

    room = bed.room
    if room:
        room.capacity = max(1, room.capacity - 1)

    await db.delete(bed)
    await db.commit()
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    return {"message": f"Bed '{bed.bed_label or bed.bed_number}' deleted successfully"}
