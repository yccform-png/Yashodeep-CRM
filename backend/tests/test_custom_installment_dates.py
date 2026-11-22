import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy import select

from tests.conftest import TestAsyncSessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.academic import Course, CourseVersion, CourseType
from app.models.student import Student
from app.models.institute import Institute
from app.models.fee import Invoice, InstallmentPlan, Installment


@pytest.fixture
async def accountant_auth_headers() -> dict:
    """Accountant user with ACCOUNTANT role."""
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "accountant_test@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="accountant_test@institute.edu",
                hashed_password="hashed_dummy_pw",
                first_name="Finance",
                last_name="Accountant",
                user_type="ACCOUNTANT",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        user_id = str(user.id)

    token = create_access_token(
        subject=user_id,
        extra_claims={
            "email": "accountant_test@institute.edu",
            "user_type": "ACCOUNTANT",
            "roles": ["ACCOUNTANT"]
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def counselor_auth_headers() -> dict:
    """Counselor/Teacher user with non-admin, non-finance role."""
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "counselor_test@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="counselor_test@institute.edu",
                hashed_password="hashed_dummy_pw",
                first_name="Counselor",
                last_name="Staff",
                user_type="TEACHER",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        user_id = str(user.id)

    token = create_access_token(
        subject=user_id,
        extra_claims={
            "email": "counselor_test@institute.edu",
            "user_type": "TEACHER",
            "roles": ["TEACHER"]
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_fee_preview_custom_installments(client: AsyncClient, auth_headers: dict):
    """Test previewing fee calculation with custom installment due dates and amounts."""
    # Get an active course version
    async with TestAsyncSessionLocal() as session:
        cv = (await session.execute(select(CourseVersion).where(CourseVersion.is_active == True))).scalars().first()
        assert cv is not None, "At least one active course version required"
        cv_id = str(cv.id)

    today = date.today()
    d1 = today
    d2 = today + timedelta(days=25)
    d3 = today + timedelta(days=55)

    # 1. Custom due dates with automatic equal split
    res = await client.post(
        "/api/v1/fees/preview",
        headers=auth_headers,
        json={
            "course_version_id": cv_id,
            "number_of_installments": 3,
            "custom_installments": [
                {"installment_number": 1, "due_date": d1.isoformat()},
                {"installment_number": 2, "due_date": d2.isoformat()},
                {"installment_number": 3, "due_date": d3.isoformat()}
            ]
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["installments"]) == 3
    assert data["installments"][0]["due_date"] == d1.isoformat()
    assert data["installments"][1]["due_date"] == d2.isoformat()
    assert data["installments"][2]["due_date"] == d3.isoformat()

    # 2. Chronological ordering validation: installment 2 due before installment 1
    bad_res = await client.post(
        "/api/v1/fees/preview",
        headers=auth_headers,
        json={
            "course_version_id": cv_id,
            "number_of_installments": 2,
            "custom_installments": [
                {"installment_number": 1, "due_date": d2.isoformat()},
                {"installment_number": 2, "due_date": d1.isoformat()}
            ]
        }
    )
    assert bad_res.status_code == 400
    assert "earlier" in bad_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admission_with_custom_installment_dates_and_amounts(
    client: AsyncClient,
    auth_headers: dict,
    counselor_auth_headers: dict
):
    """Test student admission wizard with custom installment due dates and role-restricted amounts."""
    async with TestAsyncSessionLocal() as session:
        cv = (await session.execute(select(CourseVersion).where(CourseVersion.is_active == True))).scalars().first()
        cv_id = str(cv.id)
        inst = (await session.execute(select(Institute).where(Institute.is_active == True))).scalars().first()
        form_fee = inst.admission_form_fee if (inst and inst.enable_admission_form_fee) else Decimal("0.00")
        total_fee = cv.base_fee + form_fee

    today = date.today()
    d1 = today
    d2 = today + timedelta(days=40)

    # Calculate custom amounts totaling total_fee
    amt1 = Decimal(str(total_fee * Decimal("0.60"))).quantize(Decimal("0.01"))
    amt2 = Decimal(str(total_fee - amt1)).quantize(Decimal("0.01"))

    # Non-admin attempting custom amounts should be rejected (403)
    non_admin_payload = {
        "first_name": "NonAdmin",
        "last_name": "Student",
        "date_of_birth": "2008-01-01",
        "gender": "MALE",
        "course_version_id": cv_id,
        "number_of_installments": 2,
        "custom_installments": [
            {"installment_number": 1, "due_date": d1.isoformat(), "amount": float(amt1)},
            {"installment_number": 2, "due_date": d2.isoformat(), "amount": float(amt2)}
        ]
    }
    rejected_res = await client.post(
        "/api/v1/enrollments/admit",
        headers=counselor_auth_headers,
        json=non_admin_payload
    )
    assert rejected_res.status_code == 403
    assert "roles" in rejected_res.json()["detail"].lower() or "administrators" in rejected_res.json()["detail"].lower()

    # Admin performing admission with custom dates and amounts should succeed
    admin_payload = {
        "first_name": "Installment",
        "last_name": "Student",
        "date_of_birth": "2008-01-01",
        "gender": "MALE",
        "course_version_id": cv_id,
        "number_of_installments": 2,
        "custom_installments": [
            {"installment_number": 1, "due_date": d1.isoformat(), "amount": float(amt1)},
            {"installment_number": 2, "due_date": d2.isoformat(), "amount": float(amt2)}
        ]
    }
    admit_res = await client.post(
        "/api/v1/enrollments/admit",
        headers=auth_headers,
        json=admin_payload
    )
    assert admit_res.status_code in [200, 201], admit_res.text
    admit_data = admit_res.json()
    invoice_id = admit_data["invoice_id"]

    # Verify database records
    async with TestAsyncSessionLocal() as session:
        inv = (await session.execute(
            select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
        )).scalars().first()
        assert inv is not None
        plan = (await session.execute(
            select(InstallmentPlan).where(InstallmentPlan.invoice_id == inv.id)
        )).scalars().first()
        assert plan is not None

        insts = (await session.execute(
            select(Installment).where(Installment.installment_plan_id == plan.id).order_by(Installment.installment_number)
        )).scalars().all()
        assert len(insts) == 2
        assert insts[0].due_date == d1
        assert insts[0].amount == amt1
        assert insts[1].due_date == d2
        assert insts[1].amount == amt2


@pytest.mark.asyncio
async def test_reschedule_installment(
    client: AsyncClient,
    auth_headers: dict,
    accountant_auth_headers: dict,
    counselor_auth_headers: dict
):
    """Test rescheduling installment due date with role checks and validation."""
    # Find a pending installment
    async with TestAsyncSessionLocal() as session:
        inst = (await session.execute(
            select(Installment).where(Installment.status == "PENDING")
        )).scalars().first()
        assert inst is not None, "Pending installment required for test"
        inst_id = str(inst.id)
        original_due = inst.due_date

    new_due = date.today() + timedelta(days=90)

    try:
        # 1. Non-admin / non-accountant should fail (403)
        res_forbidden = await client.patch(
            f"/api/v1/fees/installments/{inst_id}/reschedule",
            headers=counselor_auth_headers,
            json={"new_due_date": new_due.isoformat()}
        )
        assert res_forbidden.status_code == 403

        # 2. Rescheduling to past date should fail (400)
        past_due = date.today() - timedelta(days=5)
        res_past = await client.patch(
            f"/api/v1/fees/installments/{inst_id}/reschedule",
            headers=auth_headers,
            json={"new_due_date": past_due.isoformat()}
        )
        assert res_past.status_code == 400
        assert "past" in res_past.json()["detail"].lower()

        # 3. Accountant successfully reschedules
        res_ok = await client.patch(
            f"/api/v1/fees/installments/{inst_id}/reschedule",
            headers=accountant_auth_headers,
            json={"new_due_date": new_due.isoformat(), "reason": "Parent granted exam extension"}
        )
        assert res_ok.status_code == 200
        data = res_ok.json()
        assert data["due_date"] == new_due.isoformat()
    finally:
        async with TestAsyncSessionLocal() as session:
            i_rec = await session.get(Installment, inst.id)
            if i_rec:
                i_rec.due_date = original_due
                await session.commit()
