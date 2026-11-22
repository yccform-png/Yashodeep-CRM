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
from app.models.fee import Invoice, InstallmentPlan, Installment, InvoiceItem
from app.models.academic import Course, CourseVersion, CourseType, AcademicYear
from app.models.student import Student


@pytest.fixture
async def admin_auth_headers() -> dict:
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "billing_test_admin@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="billing_test_admin@institute.edu",
                hashed_password="hashed_dummy_pw",
                first_name="Billing",
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
async def test_merge_skill_course_into_open_invoice(client: AsyncClient, admin_auth_headers: dict):
    """
    Test Option 3:
    Admin chooses to merge a mid-session skill course into an existing open invoice.
    Verifies:
    1. Line item added to target invoice
    2. Target invoice totals incremented correctly
    3. PAID installments remain untouched
    4. PENDING installments receive the distributed fee
    5. Balance matches pending installments
    """
    async with TestAsyncSessionLocal() as db:
        # 1. Active academic year
        ay = (await db.execute(select(AcademicYear).where(AcademicYear.is_active == True))).scalars().first()
        assert ay is not None

        # 2. Test student
        unique_id = uuid.uuid4().hex[:6]
        student = Student(
            student_code=f"STU-MRG-{unique_id}",
            prn=f"PRN-MRG-{unique_id}",
            first_name="MergeTest",
            last_name="Student",
            date_of_birth=date(2010, 1, 1),
            gender="MALE",
            mobile="9876543210",
            admission_date=date.today(),
            status="ACTIVE"
        )
        db.add(student)
        await db.flush()

        # 3. Create open invoice: 3 installments (1 PAID @ 10,000; 2 PENDING @ 10,000 each)
        inv = Invoice(
            student_id=student.id,
            invoice_number=f"INV-MRG-{unique_id}",
            issue_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            subtotal=Decimal("30000.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("30000.00"),
            paid_amount=Decimal("10000.00"),
            balance_amount=Decimal("20000.00"),
            status="PARTIALLY_PAID"
        )
        db.add(inv)
        await db.flush()

        plan = InstallmentPlan(
            invoice_id=inv.id,
            number_of_installments=3,
            total_amount=Decimal("30000.00")
        )
        db.add(plan)
        await db.flush()

        inst1 = Installment(
            installment_plan_id=plan.id,
            installment_number=1,
            due_date=date.today() - timedelta(days=10),
            amount=Decimal("10000.00"),
            paid_amount=Decimal("10000.00"),
            status="PAID"
        )
        inst2 = Installment(
            installment_plan_id=plan.id,
            installment_number=2,
            due_date=date.today() + timedelta(days=20),
            amount=Decimal("10000.00"),
            paid_amount=Decimal("0.00"),
            status="PENDING"
        )
        inst3 = Installment(
            installment_plan_id=plan.id,
            installment_number=3,
            due_date=date.today() + timedelta(days=50),
            amount=Decimal("10000.00"),
            paid_amount=Decimal("0.00"),
            status="PENDING"
        )
        db.add_all([inst1, inst2, inst3])
        await db.flush()

        # 4. Universal Course for ₹5,000
        course_type = (await db.execute(select(CourseType))).scalars().first()
        course = Course(
            name=f"Robotics Mastery {unique_id}",
            code=f"ROBO-{unique_id}",
            course_type_id=course_type.id if course_type else None,
            is_universal=True,
            duration_months=3,
            is_active=True
        )
        db.add(course)
        await db.flush()

        cver = CourseVersion(
            course_id=course.id,
            version_number=1,
            effective_from=date.today(),
            base_fee=Decimal("5000.00"),
            is_active=True
        )
        db.add(cver)
        await db.commit()

        student_id_str = str(student.id)
        course_id_str = str(course.id)
        inv_id_str = str(inv.id)
        inv_number_str = inv.invoice_number

    # 5. Call API
    payload = {
        "student_id": student_id_str,
        "course_id": course_id_str,
        "discount_amount": 0,
        "billing_mode": "MERGE_INTO_OPEN_INVOICE",
        "target_invoice_id": inv_id_str
    }

    response = await client.post(
        "/api/v1/enrollments/add-skill-course",
        json=payload,
        headers=admin_auth_headers
    )
    assert response.status_code == 201, response.text
    res_data = response.json()
    assert res_data["billing_mode"] == "MERGED"
    assert res_data["invoice_id"] == inv_id_str
    assert res_data["invoice_number"] == inv_number_str
    assert res_data["updated_installments_count"] == 2
    assert Decimal(str(res_data["total_fee"])) == Decimal("5000.00")

    # 6. Verify Database State
    async with TestAsyncSessionLocal() as db:
        inv_reloaded = (await db.execute(
            select(Invoice)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments)
            )
            .where(Invoice.id == uuid.UUID(inv_id_str))
        )).scalars().first()

        # Totals: 30,000 + 5,000 = 35,000 total. Paid: 10,000. Balance: 25,000.
        assert inv_reloaded.total_amount == Decimal("35000.00")
        assert inv_reloaded.balance_amount == Decimal("25000.00")
        assert inv_reloaded.status == "PARTIALLY_PAID"

        # Line item
        skill_items = [it for it in inv_reloaded.items if f"Robotics Mastery {unique_id}" in it.description]
        assert len(skill_items) == 1
        assert skill_items[0].total_amount == Decimal("5000.00")

        # Installments:
        # Inst 1 (PAID): MUST NOT CHANGE (remains 10,000.00)
        # Inst 2 & 3 (PENDING): 5,000 / 2 = +2,500 each => 12,500.00 each
        sorted_insts = sorted(inv_reloaded.installment_plan.installments, key=lambda x: x.installment_number)
        assert len(sorted_insts) == 3

        assert sorted_insts[0].installment_number == 1
        assert sorted_insts[0].amount == Decimal("10000.00")
        assert sorted_insts[0].status == "PAID"

        assert sorted_insts[1].installment_number == 2
        assert sorted_insts[1].amount == Decimal("12500.00")
        assert sorted_insts[1].status == "PENDING"

        assert sorted_insts[2].installment_number == 3
        assert sorted_insts[2].amount == Decimal("12500.00")
        assert sorted_insts[2].status == "PENDING"

        # Total of installments == invoice total
        assert sum(i.amount for i in sorted_insts) == inv_reloaded.total_amount


@pytest.mark.asyncio
async def test_separate_skill_course_invoice(client: AsyncClient, admin_auth_headers: dict):
    """
    Test Separate Invoice Mode:
    Admin chooses to issue a dedicated add-on invoice for the skill course.
    Verifies:
    1. Independent invoice created with its own invoice number
    2. Linked enrollment_id matches the new skill course enrollment
    3. Independent installment schedule created
    """
    async with TestAsyncSessionLocal() as db:
        ay = (await db.execute(select(AcademicYear).where(AcademicYear.is_active == True))).scalars().first()
        assert ay is not None

        unique_id = uuid.uuid4().hex[:6]
        student = Student(
            student_code=f"STU-SEP-{unique_id}",
            prn=f"PRN-SEP-{unique_id}",
            first_name="SepTest",
            last_name="Student",
            date_of_birth=date(2010, 1, 1),
            gender="FEMALE",
            mobile="9876543211",
            admission_date=date.today(),
            status="ACTIVE"
        )
        db.add(student)
        await db.flush()

        course_type = (await db.execute(select(CourseType))).scalars().first()
        course = Course(
            name=f"Public Speaking {unique_id}",
            code=f"SPEAK-{unique_id}",
            course_type_id=course_type.id if course_type else None,
            is_universal=True,
            duration_months=2,
            is_active=True
        )
        db.add(course)
        await db.flush()

        cver = CourseVersion(
            course_id=course.id,
            version_number=1,
            effective_from=date.today(),
            base_fee=Decimal("4000.00"),
            is_active=True
        )
        db.add(cver)
        await db.commit()

        student_id_str = str(student.id)
        course_id_str = str(course.id)

    payload = {
        "student_id": student_id_str,
        "course_id": course_id_str,
        "discount_amount": 0,
        "number_of_installments": 2,
        "billing_mode": "SEPARATE_INVOICE"
    }

    response = await client.post(
        "/api/v1/enrollments/add-skill-course",
        json=payload,
        headers=admin_auth_headers
    )
    assert response.status_code == 201, response.text
    res_data = response.json()
    assert res_data["billing_mode"] == "SEPARATE_INVOICE"
    assert res_data["updated_installments_count"] == 2
    assert Decimal(str(res_data["total_fee"])) == Decimal("4000.00")

    async with TestAsyncSessionLocal() as db:
        new_inv = (await db.execute(
            select(Invoice)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments)
            )
            .where(Invoice.id == uuid.UUID(res_data["invoice_id"]))
        )).scalars().first()

        assert new_inv is not None
        assert new_inv.total_amount == Decimal("4000.00")
        assert new_inv.balance_amount == Decimal("4000.00")
        assert new_inv.status == "ISSUED"
        assert len(new_inv.installment_plan.installments) == 2
        for inst in new_inv.installment_plan.installments:
            assert inst.amount == Decimal("2000.00")
