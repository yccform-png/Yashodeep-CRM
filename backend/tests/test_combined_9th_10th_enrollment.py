import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from tests.conftest import TestAsyncSessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.institute import Institute
from app.models.fee import Invoice, InstallmentPlan, Installment
from app.models.academic import Course, CourseVersion, CourseType, Class, Batch, AcademicYear, BatchStudent
from app.models.enrollment import Enrollment, EnrollmentGroup


@pytest.fixture
async def admin_auth_headers() -> dict:
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "combined_admin_test@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="combined_admin_test@institute.edu",
                hashed_password="hashed_dummy_pw",
                first_name="Combined",
                last_name="Administrator",
                user_type="SUPER_ADMIN",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
        token = create_access_token(subject=str(user.id), extra_claims={"user_type": user.user_type})
        return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_combined_9th_and_10th_admission_and_division_continuity(client: AsyncClient, admin_auth_headers: dict):
    """
    Test 9th + 10th Combined Enrollment:
    1. Admitted into 9th Standard under COMBINED_MULTI_YEAR
    2. Remarks set to '9th + 10th Combined Admission'
    3. Assigned to 9th Standard Division A
    4. Single 2-year package invoice issued with flexible EMIs (Option 1)
    5. Promoted to 10th Standard:
       - Auto-resolves 10th Standard batch with Division A
       - Division continuity preserved (Div A -> Div A)
       - Retains parent EnrollmentGroup
    """
    async with TestAsyncSessionLocal() as db:
        # Load active academic year
        ay = (await db.execute(select(AcademicYear).where(AcademicYear.is_active == True))).scalars().first()
        std9 = (await db.execute(select(Class).where(Class.code == "STD-09"))).scalars().first()
        std10 = (await db.execute(select(Class).where(Class.code == "STD-10"))).scalars().first()
        reg_type = (await db.execute(select(CourseType).where(CourseType.code == "REGULAR"))).scalars().first()

        assert ay is not None
        assert std9 is not None
        assert std10 is not None

        inst = (await db.execute(select(Institute).where(Institute.is_active == True))).scalars().first()
        form_fee = inst.admission_form_fee if (inst and inst.enable_admission_form_fee) else Decimal("0.00")
        expected_total = Decimal("50000.00") + form_fee

        unique_id = uuid.uuid4().hex[:6]

        # 9th Standard Regular Course & Batch Div A (Physical Classroom)
        course_9_reg = Course(
            name=f"9th Standard Regular Board {unique_id}",
            code=f"CRS-09REG-{unique_id}",
            course_type_id=reg_type.id,
            class_id=std9.id,
            duration_months=12,
            is_active=True
        )
        db.add(course_9_reg)
        await db.flush()

        batch_9a = Batch(
            course_id=course_9_reg.id,
            academic_year_id=ay.id,
            name=f"9th Regular Div A {unique_id}",
            code=f"BAT-9A-{unique_id}",
            division="A",
            max_capacity=50,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            is_active=True
        )
        db.add(batch_9a)
        await db.flush()

        # Combined 9th + 10th Course (2-Year Multi-Year Package sharing 9th Regular Batches)
        course_9_10 = Course(
            name=f"9th & 10th Combined Test {unique_id}",
            code=f"CRS-0910-{unique_id}",
            course_type_id=reg_type.id,
            class_id=std9.id,
            duration_months=24,
            is_active=True
        )
        db.add(course_9_10)
        await db.flush()

        cver_9_10 = CourseVersion(
            course_id=course_9_10.id,
            version_number=1,
            effective_from=date.today(),
            base_fee=Decimal("50000.00"),
            is_active=True
        )
        db.add(cver_9_10)
        await db.flush()

        # 10th Standard Course & Batch Div A (for year 2 promotion)
        course_10 = Course(
            name=f"10th Standard Board {unique_id}",
            code=f"CRS-10-{unique_id}",
            course_type_id=reg_type.id,
            class_id=std10.id,
            duration_months=12,
            is_active=True
        )
        db.add(course_10)
        await db.flush()

        batch_10a = Batch(
            course_id=course_10.id,
            academic_year_id=ay.id,
            name=f"10th Standard Div A {unique_id}",
            code=f"BAT-10A-{unique_id}",
            division="A",
            max_capacity=50,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            is_active=True
        )
        batch_10b = Batch(
            course_id=course_10.id,
            academic_year_id=ay.id,
            name=f"10th Standard Div B {unique_id}",
            code=f"BAT-10B-{unique_id}",
            division="B",
            max_capacity=50,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            is_active=True
        )
        db.add_all([batch_10a, batch_10b])
        await db.commit()

        course_9_10_id = str(course_9_10.id)
        batch_9a_id = str(batch_9a.id)
        std9_id = str(std9.id)
        std10_id = str(std10.id)
        ay_id = str(ay.id)
        course_10_id = str(course_10.id)
        batch_10a_id = str(batch_10a.id)

    # 0. Verify that querying batches for combined course resolves to 9th Regular batch!
    batch_query_resp = await client.get(
        f"/api/v1/academics/batches?course_id={course_9_10_id}",
        headers=admin_auth_headers
    )
    assert batch_query_resp.status_code == 200, batch_query_resp.text
    returned_batches = batch_query_resp.json()
    assert any(b["id"] == batch_9a_id for b in returned_batches), "Combined course must resolve to 9th Regular Batch!"

    # 1. Admit student via Admission Wizard API
    admission_payload = {
        "first_name": "Rohan",
        "last_name": f"Sharma-{unique_id}",
        "date_of_birth": "2011-05-15",
        "gender": "MALE",
        "mobile": "9811223344",
        "institution_type": "SCHOOL",
        "is_academic_enrolled": True,
        "enrollment_type": "COMBINED_MULTI_YEAR",
        "academic_year_id": ay_id,
        "class_id": std9_id,
        "course_id": course_9_10_id,
        "batch_id": batch_9a_id,
        "number_of_installments": 4,
        "discount_amount": 0
    }

    admit_resp = await client.post(
        "/api/v1/enrollments/admit",
        json=admission_payload,
        headers=admin_auth_headers
    )
    assert admit_resp.status_code == 201, admit_resp.text
    admit_data = admit_resp.json()
    student_id = admit_data["student_id"]
    enrollment_id = admit_data["enrollment_id"]
    group_id = admit_data["enrollment_group_id"]
    invoice_id = admit_data["invoice_id"]

    assert group_id is not None
    assert Decimal(str(admit_data["total_fee"])) == expected_total

    # 2. Verify Database State
    async with TestAsyncSessionLocal() as db:
        group = await db.get(EnrollmentGroup, uuid.UUID(group_id))
        assert group.enrollment_type == "COMBINED_MULTI_YEAR"
        assert "9th + 10th Combined" in group.remarks

        enr = await db.get(Enrollment, uuid.UUID(enrollment_id))
        assert enr.class_id == uuid.UUID(std9_id)
        assert enr.enrollment_group_id == group.id

        # Verify Option 1 single 2-year package invoice with 4 installments
        inv = (await db.execute(
            select(Invoice)
            .options(selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments))
            .where(Invoice.id == uuid.UUID(invoice_id))
        )).scalars().first()
        assert inv.total_amount == expected_total
        assert len(inv.installment_plan.installments) == 4
        expected_inst_amt = (expected_total / Decimal("4")).quantize(Decimal("0.01"))
        for inst in inv.installment_plan.installments:
            assert abs(inst.amount - expected_inst_amt) <= Decimal("1.00")

        # Verify student is in 9th Standard Div A
        bs = (await db.execute(
            select(BatchStudent)
            .options(selectinload(BatchStudent.batch))
            .where(BatchStudent.student_id == uuid.UUID(student_id), BatchStudent.status == "ACTIVE")
        )).scalars().first()
        assert bs is not None
        assert bs.batch.division == "A"
        assert bs.batch_id == uuid.UUID(batch_9a_id)

    # 3. Promote Student to 10th Standard (Omit next_batch_id to test division auto-continuity)
    promote_payload = {
        "next_academic_year_id": ay_id,
        "next_class_id": std10_id,
        "next_course_id": course_10_id,
        "subject_ids": [],
        "next_batch_id": None  # System must auto-match Division A!
    }

    promote_resp = await client.post(
        f"/api/v1/enrollments/{enrollment_id}/promote",
        json=promote_payload,
        headers=admin_auth_headers
    )
    assert promote_resp.status_code == 200, promote_resp.text
    promoted_enr_id = promote_resp.json()["next_enrollment_id"]

    # 4. Verify Division Continuity in Year 2
    async with TestAsyncSessionLocal() as db:
        next_enr = await db.get(Enrollment, uuid.UUID(promoted_enr_id))
        assert next_enr.class_id == uuid.UUID(std10_id)
        assert next_enr.enrollment_group_id == uuid.UUID(group_id)

        # Student must be enrolled into 10th Standard Division A automatically!
        bs_10 = (await db.execute(
            select(BatchStudent)
            .options(selectinload(BatchStudent.batch))
            .where(
                BatchStudent.student_id == uuid.UUID(student_id),
                BatchStudent.batch_id == uuid.UUID(batch_10a_id)
            )
        )).scalars().first()
        assert bs_10 is not None
        assert bs_10.batch.division == "A"
        assert bs_10.batch.course_id == uuid.UUID(course_10_id)
