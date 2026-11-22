import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy import select

from tests.conftest import TestAsyncSessionLocal
from app.models.academic import Course, CourseVersion, AcademicYear, Class, Stream, BatchStudent
from app.models.student import Student
from app.models.institute import Institute
from app.models.enrollment import Enrollment
from app.models.fee import Invoice, InstallmentPlan, Installment, Payment


@pytest.mark.asyncio
async def test_provisional_trial_admission_and_dropout_flow(client: AsyncClient, auth_headers: dict):
    """
    Test Complete Provisional Trial Flow:
    1. Institute has admission_form_fee=200, trial_period_days=14
    2. Student enrolled under PROVISIONAL_TRIAL
    3. Upfront form fee receipt is issued, student assigned to batch
    4. Zero tuition invoice/debt created
    5. Student profile confirms PROVISIONAL_TRIAL status and receipt
    6. Student discontinues -> Close Trial
    7. Status becomes TRIAL_DROPOUT, batch student deactivated, institute retains form fee
    """
    async with TestAsyncSessionLocal() as session:
        inst = (await session.execute(select(Institute).where(Institute.is_active == True))).scalars().first()
        cv = (await session.execute(select(CourseVersion).where(CourseVersion.is_active == True))).scalars().first()
        cur_year = (await session.execute(select(AcademicYear).where(AcademicYear.is_current == True))).scalars().first()
        cur_class = (await session.execute(select(Class))).scalars().first()

    today = date.today()
    uid = uuid.uuid4().hex[:6]
    trial_payload = {
        "first_name": "TrialStudent",
        "last_name": f"Tester-{uid}",
        "date_of_birth": "2008-05-15",
        "gender": "MALE",
        "mobile": f"+9198{uuid.uuid4().int % 100000000:08d}",
        "admission_date": today.isoformat(),
        "admission_type": "PROVISIONAL_TRIAL",
        "form_fee_payment_mode": "CASH",
        "is_academic_enrolled": True,
        "academic_year_id": str(cur_year.id),
        "class_id": str(cur_class.id),
        "course_version_id": str(cv.id),
        "number_of_installments": 1
    }

    res = await client.post("/api/v1/enrollments/admit", headers=auth_headers, json=trial_payload)
    assert res.status_code in [200, 201], res.text
    data = res.json()

    # 1. Verify Trial Response Data
    assert data["is_trial"] is True
    assert data["invoice_id"] is None
    assert data["invoice_number"] is None
    assert data["trial_receipt_number"] is not None
    assert data["trial_receipt_number"].startswith("REC-FORM-")
    expected_expiry = today + timedelta(days=inst.trial_period_days or 14)
    assert data["trial_end_date"] == expected_expiry.isoformat()

    student_id = data["student_id"]
    enrollment_id = data["enrollment_id"]

    # 2. Verify Student in DB
    async with TestAsyncSessionLocal() as session:
        stu = await session.get(Student, uuid.UUID(student_id))
        assert stu.status == "PROVISIONAL_TRIAL"
        assert stu.trial_form_fee_paid is True
        assert stu.trial_receipt_number == data["trial_receipt_number"]
        assert stu.trial_end_date == expected_expiry

        enr = await session.get(Enrollment, uuid.UUID(enrollment_id))
        assert enr.status == "PROVISIONAL_TRIAL"

        # Verify Form Fee Payment Record in DB
        pmt = (await session.execute(
            select(Payment).where(Payment.payment_number == data["trial_receipt_number"])
        )).scalars().first()
        assert pmt is not None
        assert pmt.amount == Decimal("200.00")
        assert pmt.payment_method == "CASH"

    # 3. Check Student Profile
    prof_res = await client.get(f"/api/v1/students/{student_id}/profile", headers=auth_headers)
    assert prof_res.status_code == 200
    prof = prof_res.json()
    assert prof["overview"]["status"] == "PROVISIONAL_TRIAL"
    assert prof["overview"]["trial_receipt_number"] == data["trial_receipt_number"]
    assert prof["overview"]["trial_end_date"] == expected_expiry.isoformat()
    # Ensure zero tuition debts in invoices
    assert len(prof["fees"]) == 0

    # 4. Student Drops Out -> Admin closes trial
    close_res = await client.post(
        f"/api/v1/enrollments/{enrollment_id}/close-trial",
        headers=auth_headers,
        params={"reason": "Student found commute too far"}
    )
    assert close_res.status_code == 200
    close_data = close_res.json()
    assert close_data["status"] == "TRIAL_DROPOUT"

    # Verify student is now TRIAL_DROPOUT
    async with TestAsyncSessionLocal() as session:
        stu_after = await session.get(Student, uuid.UUID(student_id))
        assert stu_after.status == "TRIAL_DROPOUT"
        enr_after = await session.get(Enrollment, uuid.UUID(enrollment_id))
        assert enr_after.status == "TRIAL_DROPOUT"


@pytest.mark.asyncio
async def test_trial_conversion_and_installment_restructure_flow(client: AsyncClient, auth_headers: dict):
    """
    Test Trial Conversion & Post-Enrollment Restructuring:
    1. Student enrolled under PROVISIONAL_TRIAL
    2. Student decides to continue -> Admin converts to confirmed admission with 2 installments
    3. Status changes to ACTIVE, tuition invoice is generated with form fee credited
    4. Parent asks to restructure remaining balance into 3 installments
    5. Admin restructures invoice plan with custom dates & amounts
    6. System validates sum equality, updates plan, marks is_restructured=True
    """
    async with TestAsyncSessionLocal() as session:
        cv = (await session.execute(select(CourseVersion).where(CourseVersion.is_active == True))).scalars().first()
        cur_year = (await session.execute(select(AcademicYear).where(AcademicYear.is_current == True))).scalars().first()
        cur_class = (await session.execute(select(Class))).scalars().first()

    joining_date = date.today()
    uid = uuid.uuid4().hex[:6]
    trial_payload = {
        "first_name": "ConvertStudent",
        "last_name": f"Retained-{uid}",
        "date_of_birth": "2008-06-20",
        "gender": "FEMALE",
        "mobile": f"+9198{uuid.uuid4().int % 100000000:08d}",
        "admission_date": joining_date.isoformat(),
        "admission_type": "PROVISIONAL_TRIAL",
        "form_fee_payment_mode": "UPI",
        "is_academic_enrolled": True,
        "academic_year_id": str(cur_year.id),
        "class_id": str(cur_class.id),
        "course_version_id": str(cv.id),
        "number_of_installments": 1
    }

    admit_res = await client.post("/api/v1/enrollments/admit", headers=auth_headers, json=trial_payload)
    assert admit_res.status_code in [200, 201], admit_res.text
    admit_data = admit_res.json()
    enrollment_id = admit_data["enrollment_id"]
    student_id = admit_data["student_id"]

    # Convert Trial to Confirmed Admission
    convert_payload = {
        "discount_amount": 0.00,
        "number_of_installments": 2,
        "joining_date": joining_date.isoformat(),
        "custom_installments": [
            {"installment_number": 1, "due_date": joining_date.isoformat()},
            {"installment_number": 2, "due_date": (joining_date + timedelta(days=30)).isoformat()}
        ]
    }
    conv_res = await client.post(
        f"/api/v1/enrollments/{enrollment_id}/convert-trial",
        headers=auth_headers,
        json=convert_payload
    )
    assert conv_res.status_code == 200, conv_res.text
    conv_data = conv_res.json()
    assert conv_data["invoice_id"] is not None
    assert conv_data["invoice_number"] is not None
    invoice_id = conv_data["invoice_id"]

    # Verify student is now ACTIVE
    async with TestAsyncSessionLocal() as session:
        stu = await session.get(Student, uuid.UUID(student_id))
        assert stu.status == "ACTIVE"
        assert stu.trial_end_date is None

        inv = await session.get(Invoice, uuid.UUID(invoice_id))
        assert inv.status == "ISSUED"
        balance = float(inv.balance_amount)
        assert balance > 0

    # Admin Restructures invoice into 3 installments
    # Uneven split: split remaining balance across 3 installments
    split1 = round(balance * 0.4, 2)
    split2 = round(balance * 0.3, 2)
    split3 = round(balance - split1 - split2, 2)
    assert round(split1 + split2 + split3, 2) == round(balance, 2)

    restructure_payload = {
        "number_of_installments": 3,
        "installments": [
            {"installment_number": 1, "due_date": joining_date.isoformat(), "amount": split1},
            {"installment_number": 2, "due_date": (joining_date + timedelta(days=25)).isoformat(), "amount": split2},
            {"installment_number": 3, "due_date": (joining_date + timedelta(days=55)).isoformat(), "amount": split3}
        ],
        "reason": "Parent requested 3-way split due to monthly salary schedule"
    }

    restr_res = await client.post(
        f"/api/v1/fees/invoices/{invoice_id}/restructure",
        headers=auth_headers,
        json=restructure_payload
    )
    assert restr_res.status_code == 200, restr_res.text
    restr_data = restr_res.json()
    assert len(restr_data["installments"]) == 3
    assert float(restr_data["installments"][0]["amount"]) == split1
    assert float(restr_data["installments"][1]["amount"]) == split2
    assert float(restr_data["installments"][2]["amount"]) == split3

    # Check Plan audit fields in DB
    async with TestAsyncSessionLocal() as session:
        plan = (await session.execute(
            select(InstallmentPlan).where(InstallmentPlan.invoice_id == uuid.UUID(invoice_id))
        )).scalars().first()
        assert plan.is_restructured is True
        assert "salary schedule" in plan.restructure_reason
        assert plan.restructured_at is not None
