import uuid
import pytest
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from tests.conftest import TestAsyncSessionLocal
from app.models.academic import AcademicYear, Class
from app.models.student import Student
from app.models.enrollment import EnrollmentGroup, EnrollmentYear
from app.models.study_room import StudyRoom, StudySeat, SeatAllocation
from app.models.hostel import Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed, BedAllocation
from app.models.fee import Invoice, Payment


@pytest.mark.asyncio
async def test_study_seat_double_booking_prevented_by_partial_unique_index():
    """
    Verify PostgreSQL partial unique index uq_active_study_seat prevents two ACTIVE
    allocations on the same seat concurrently.
    """
    sr_id = None
    seat_id = None
    alloc1_id = None
    s1_id = None
    s2_id = None
    async with TestAsyncSessionLocal() as session:
        try:
            sr = StudyRoom(name="Test Room", code=f"SR-{uuid.uuid4().hex[:6]}", total_capacity=10)
            session.add(sr)
            await session.flush()
            sr_id = sr.id

            seat = StudySeat(study_room_id=sr.id, seat_number=f"S-{uuid.uuid4().hex[:4]}", gender_allowed="ANY")
            session.add(seat)
            await session.flush()
            seat_id = seat.id

            s1 = Student(student_code=f"STU-{uuid.uuid4().hex[:6]}", first_name="Test", last_name="One", date_of_birth=date(2008, 1, 1), gender="MALE")
            s2 = Student(student_code=f"STU-{uuid.uuid4().hex[:6]}", first_name="Test", last_name="Two", date_of_birth=date(2008, 1, 1), gender="MALE")
            session.add_all([s1, s2])
            await session.flush()
            s1_id = s1.id
            s2_id = s2.id

            alloc1 = SeatAllocation(study_seat_id=seat.id, student_id=s1.id, start_date=date.today(), end_date=date.today() + timedelta(days=30), status="ACTIVE")
            session.add(alloc1)
            await session.commit()
            alloc1_id = alloc1.id
        except Exception:
            await session.rollback()
            raise

    # Attempt second active allocation in separate session
    async with TestAsyncSessionLocal() as session2:
        try:
            alloc2 = SeatAllocation(study_seat_id=seat_id, student_id=s2_id, start_date=date.today(), end_date=date.today() + timedelta(days=30), status="ACTIVE")
            session2.add(alloc2)
            with pytest.raises(IntegrityError) as exc_info:
                await session2.commit()
            assert "uq_active_study_seat" in str(exc_info.value)
        finally:
            await session2.rollback()

    # Clean up test records in proper dependency order
    async with TestAsyncSessionLocal() as clean_session:
        if alloc1_id:
            a_obj = await clean_session.get(SeatAllocation, alloc1_id)
            if a_obj:
                await clean_session.delete(a_obj)
        if seat_id:
            seat_obj = await clean_session.get(StudySeat, seat_id)
            if seat_obj:
                await clean_session.delete(seat_obj)
        if sr_id:
            sr_obj = await clean_session.get(StudyRoom, sr_id)
            if sr_obj:
                await clean_session.delete(sr_obj)
        if s1_id:
            s1_obj = await clean_session.get(Student, s1_id)
            if s1_obj:
                await clean_session.delete(s1_obj)
        if s2_id:
            s2_obj = await clean_session.get(Student, s2_id)
            if s2_obj:
                await clean_session.delete(s2_obj)
        await clean_session.commit()


@pytest.mark.asyncio
async def test_hostel_bed_double_booking_prevented_by_partial_unique_index():
    """
    Verify PostgreSQL partial unique index uq_active_hostel_bed prevents two ACTIVE
    allocations on the same bed concurrently.
    """
    hostel_id = None
    bed_id = None
    alloc1_id = None
    s1_id = None
    s2_id = None
    async with TestAsyncSessionLocal() as session:
        try:
            hostel = Hostel(name="Test Hostel", code=f"H-{uuid.uuid4().hex[:6]}", gender_type="BOYS")
            session.add(hostel)
            await session.flush()
            hostel_id = hostel.id

            bld = HostelBuilding(hostel_id=hostel.id, name="B1", code=f"B-{uuid.uuid4().hex[:4]}", total_floors=1)
            session.add(bld)
            await session.flush()

            flr = HostelFloor(building_id=bld.id, floor_number=1, name="F1")
            session.add(flr)
            await session.flush()

            rm = HostelRoom(floor_id=flr.id, room_number=f"R-{uuid.uuid4().hex[:4]}", room_type="SINGLE", capacity=1)
            session.add(rm)
            await session.flush()

            bed = HostelBed(room_id=rm.id, bed_number=f"BED-{uuid.uuid4().hex[:4]}", status="AVAILABLE")
            session.add(bed)
            await session.flush()
            bed_id = bed.id

            s1 = Student(student_code=f"STU-{uuid.uuid4().hex[:6]}", first_name="Bed", last_name="User1", date_of_birth=date(2008, 1, 1), gender="MALE")
            s2 = Student(student_code=f"STU-{uuid.uuid4().hex[:6]}", first_name="Bed", last_name="User2", date_of_birth=date(2008, 1, 1), gender="MALE")
            session.add_all([s1, s2])
            await session.flush()
            s1_id = s1.id
            s2_id = s2.id

            alloc1 = BedAllocation(hostel_bed_id=bed.id, student_id=s1.id, start_date=date.today(), end_date=date.today() + timedelta(days=90), status="ACTIVE")
            session.add(alloc1)
            await session.commit()
            alloc1_id = alloc1.id
        except Exception:
            await session.rollback()
            raise

    # Attempt second active allocation in separate session
    async with TestAsyncSessionLocal() as session2:
        try:
            alloc2 = BedAllocation(hostel_bed_id=bed_id, student_id=s2_id, start_date=date.today(), end_date=date.today() + timedelta(days=90), status="ACTIVE")
            session2.add(alloc2)
            with pytest.raises(IntegrityError) as exc_info:
                await session2.commit()
            assert "uq_active_hostel_bed" in str(exc_info.value)
        finally:
            await session2.rollback()

    # Clean up
    async with TestAsyncSessionLocal() as clean_session:
        if alloc1_id:
            a_obj = await clean_session.get(BedAllocation, alloc1_id)
            if a_obj:
                await clean_session.delete(a_obj)
        if hostel_id:
            h_obj = await clean_session.get(Hostel, hostel_id)
            if h_obj:
                await clean_session.delete(h_obj)
        if s1_id:
            s1_obj = await clean_session.get(Student, s1_id)
            if s1_obj:
                await clean_session.delete(s1_obj)
        if s2_id:
            s2_obj = await clean_session.get(Student, s2_id)
            if s2_obj:
                await clean_session.delete(s2_obj)
        await clean_session.commit()


@pytest.mark.asyncio
async def test_invoice_check_constraints_prevent_inconsistent_accounting():
    """
    Verify PostgreSQL check constraint check_invoice_paid_amount prevents paid_amount > total_amount.
    """
    s_id = None
    async with TestAsyncSessionLocal() as session:
        s = Student(student_code=f"STU-{uuid.uuid4().hex[:6]}", first_name="Fin", last_name="Test", date_of_birth=date(2008, 1, 1), gender="FEMALE")
        session.add(s)
        await session.flush()
        s_id = s.id

        inv = Invoice(
            student_id=s.id,
            invoice_number=f"INV-TEST-{uuid.uuid4().hex[:6]}",
            issue_date=date.today(),
            due_date=date.today() + timedelta(days=15),
            subtotal=Decimal("1000.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("1000.00"),
            paid_amount=Decimal("1500.00"),  # INVALID!
            balance_amount=Decimal("0.00"),
            status="PAID"
        )
        session.add(inv)
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "check_invoice_paid_amount" in str(exc_info.value)
        await session.rollback()

        # Clean student
        s_obj = await session.get(Student, s_id)
        if s_obj:
            await session.delete(s_obj)
            await session.commit()


@pytest.mark.asyncio
async def test_payment_positive_amount_check_constraint():
    """
    Verify PostgreSQL check constraint check_payment_amount_positive rejects payments <= 0.
    """
    s_id = None
    async with TestAsyncSessionLocal() as session:
        s = Student(student_code=f"STU-{uuid.uuid4().hex[:6]}", first_name="Pay", last_name="Test", date_of_birth=date(2008, 1, 1), gender="FEMALE")
        session.add(s)
        await session.flush()
        s_id = s.id

        pay = Payment(
            student_id=s.id,
            payment_number=f"PAY-ZERO-{uuid.uuid4().hex[:6]}",
            amount=Decimal("0.00"),  # INVALID! Must be > 0
            payment_method="CASH",
            status="SUCCESS"
        )
        session.add(pay)
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "check_payment_amount_positive" in str(exc_info.value)
        await session.rollback()

        # Clean student
        s_obj = await session.get(Student, s_id)
        if s_obj:
            await session.delete(s_obj)
            await session.commit()


@pytest.mark.asyncio
async def test_multi_year_combined_enrollment_structure():
    """
    Verify multi-year combined admission group structure and enrollment year uniqueness constraints.
    """
    grp_id = None
    ay2_id = None
    ay3_id = None
    async with TestAsyncSessionLocal() as session:
        c11 = (await session.execute(select(Class).where(Class.code == "STD-11"))).scalar_one()
        c12 = (await session.execute(select(Class).where(Class.code == "STD-12"))).scalar_one()
        ay1 = (await session.execute(select(AcademicYear).where(AcademicYear.is_current == True))).scalar_one()

        ay2 = AcademicYear(name="2027-2028", code=f"AY-{uuid.uuid4().hex[:6]}", start_date=date(2027, 6, 1), end_date=date(2028, 4, 30), is_current=False)
        ay3 = AcademicYear(name="2028-2029", code=f"AY-{uuid.uuid4().hex[:6]}", start_date=date(2028, 6, 1), end_date=date(2029, 4, 30), is_current=False)
        session.add_all([ay2, ay3])
        await session.flush()
        ay2_id = ay2.id
        ay3_id = ay3.id

        grp = EnrollmentGroup(group_code=f"GRP-TEST-{uuid.uuid4().hex[:6]}", enrollment_type="COMBINED_MULTI_YEAR", total_years=2, remarks="11th + 12th Combined")
        session.add(grp)
        await session.flush()
        grp_id = grp.id

        ey1 = EnrollmentYear(enrollment_group_id=grp.id, academic_year_id=ay1.id, class_id=c11.id, year_order=1, status="ACTIVE")
        ey2 = EnrollmentYear(enrollment_group_id=grp.id, academic_year_id=ay2.id, class_id=c12.id, year_order=2, status="PLANNED")
        session.add_all([ey1, ey2])
        await session.commit()

    # 1. Duplicate year_order for same group must fail
    async with TestAsyncSessionLocal() as session2:
        ey_dup_order = EnrollmentYear(
            enrollment_group_id=grp_id,
            academic_year_id=ay3_id,
            class_id=c11.id,
            year_order=1,  # Duplicate!
            status="PLANNED"
        )
        session2.add(ey_dup_order)
        with pytest.raises(IntegrityError) as exc_info:
            await session2.commit()
        assert "uq_enrollment_group_year_order" in str(exc_info.value)
        await session2.rollback()

    # 2. Duplicate academic_year for same group must fail
    async with TestAsyncSessionLocal() as session3:
        ey_dup_ay = EnrollmentYear(
            enrollment_group_id=grp_id,
            academic_year_id=ay1.id,  # Duplicate!
            class_id=c12.id,
            year_order=3,
            status="PLANNED"
        )
        session3.add(ey_dup_ay)
        with pytest.raises(IntegrityError) as exc_info:
            await session3.commit()
        assert "uq_enrollment_group_academic_year" in str(exc_info.value)
        await session3.rollback()

    # Teardown
    async with TestAsyncSessionLocal() as clean_session:
        grp_obj = await clean_session.get(EnrollmentGroup, grp_id)
        if grp_obj:
            await clean_session.delete(grp_obj)
        ay2_obj = await clean_session.get(AcademicYear, ay2_id)
        if ay2_obj:
            await clean_session.delete(ay2_obj)
        ay3_obj = await clean_session.get(AcademicYear, ay3_id)
        if ay3_obj:
            await clean_session.delete(ay3_obj)
        await clean_session.commit()
