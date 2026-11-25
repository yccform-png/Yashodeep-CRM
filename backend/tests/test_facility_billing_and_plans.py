import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy import select

from tests.conftest import TestAsyncSessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.service import ServiceType, ServicePlan, StudentService
from app.models.study_room import StudySeat, SeatAllocation
from app.models.hostel import HostelBed, BedAllocation
from app.models.student import Student
from app.models.fee import Invoice, InvoiceItem


@pytest.fixture
async def manager_auth_headers() -> dict:
    """Non-admin user with STUDY_ROOM_MANAGER role."""
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "study_manager@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="study_manager@institute.edu",
                hashed_password="hashed_dummy_pw",
                first_name="Study",
                last_name="Manager",
                user_type="ADMIN",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        user_id = str(user.id)

    token = create_access_token(
        subject=user_id,
        extra_claims={
            "email": "study_manager@institute.edu",
            "user_type": "ADMIN",
            "roles": ["ADMIN"]
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_facility_service_plans_crud(client: AsyncClient, auth_headers: dict):
    # 1. List Service Types
    types_res = await client.get("/api/v1/services/types", headers=auth_headers)
    assert types_res.status_code == 200
    types = types_res.json()
    sr_type = next((t for t in types if t["code"] == "STUDY_ROOM"), None)
    assert sr_type is not None

    # 2. Create Service Plan
    plan_code = f"PLN-TEST-{uuid.uuid4().hex[:6].upper()}"
    create_res = await client.post(
        "/api/v1/services/plans",
        headers=auth_headers,
        json={
            "service_type_id": sr_type["id"],
            "name": "Test Evening Study Desk",
            "code": plan_code,
            "billing_frequency": "MONTHLY",
            "base_amount": 1800.00,
            "deposit_amount": 1200.00,
            "features": {"wifi": True, "locker": True}
        }
    )
    assert create_res.status_code == 201
    created_plan = create_res.json()
    assert created_plan["code"] == plan_code
    assert float(created_plan["base_amount"]) == 1800.00
    assert float(created_plan["deposit_amount"]) == 1200.00

    # 3. Update Service Plan
    update_res = await client.put(
        f"/api/v1/services/plans/{created_plan['id']}",
        headers=auth_headers,
        json={
            "base_amount": 1950.00,
            "deposit_amount": 1300.00
        }
    )
    assert update_res.status_code == 200
    assert float(update_res.json()["base_amount"]) == 1950.00
    assert float(update_res.json()["deposit_amount"]) == 1300.00

    # 4. Deactivate Service Plan
    del_res = await client.delete(f"/api/v1/services/plans/{created_plan['id']}", headers=auth_headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "DEACTIVATED"


@pytest.mark.asyncio
async def test_study_room_seat_allocation_billing_and_renewal(client: AsyncClient, auth_headers: dict, manager_auth_headers: dict):
    async with TestAsyncSessionLocal() as session:
        # Create an isolated active student (boy)
        uid = uuid.uuid4().hex[:6]
        student = Student(
            student_code=f"STU-SR-{uid}",
            prn=f"PRN-SR-{uid}",
            first_name="Rohan",
            last_name="Patil",
            gender="MALE",
            date_of_birth=date(2008, 5, 12),
            status="ACTIVE"
        )
        session.add(student)

        # Fetch an available BOYS seat
        seat = (await session.execute(
            select(StudySeat).where(StudySeat.status == "AVAILABLE", StudySeat.gender_allowed == "BOYS")
        )).scalars().first()
        assert seat is not None, "An available boys study seat must exist"

        # Fetch standard monthly study plan
        plan = (await session.execute(
            select(ServicePlan).where(ServicePlan.code == "PLN-SR-MONTHLY")
        )).scalars().first()
        assert plan is not None, "PLN-SR-MONTHLY plan must exist"

        await session.commit()
        await session.refresh(student)

        seat_id = str(seat.id)
        student_id = str(student.id)
        plan_id = str(plan.id)

    # 1. Non-admin attempting custom pricing without plan gets 403 Forbidden
    forbidden_res = await client.post(
        "/api/v1/study-rooms/allocate",
        headers=manager_auth_headers,
        json={
            "study_seat_id": seat_id,
            "student_id": student_id,
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=30)).isoformat(),
            "service_plan_id": None,
            "custom_rent_amount": 2500.00,
            "custom_deposit_amount": 1500.00
        }
    )
    assert forbidden_res.status_code == 403

    # 2. Allocate with valid standard plan and immediate payment collection
    alloc_res = await client.post(
        "/api/v1/study-rooms/allocate",
        headers=auth_headers,
        json={
            "study_seat_id": seat_id,
            "student_id": student_id,
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=30)).isoformat(),
            "service_plan_id": plan_id,
            "collect_payment": True,
            "payment_mode": "UPI"
        }
    )
    assert alloc_res.status_code == 200
    alloc_data = alloc_res.json()
    allocation_id = alloc_data["allocation_id"]
    invoice_id = alloc_data["invoice_id"]
    assert alloc_data["status"] == "PAID"
    expected_total = float(plan.base_amount + plan.deposit_amount)
    assert alloc_data["total_amount"] == expected_total
    assert alloc_data["paid_amount"] == expected_total

    # 3. 1-Click Renewal: Extends subscription by 30 days & generates renewal invoice WITHOUT deposit
    renew_res = await client.post(
        f"/api/v1/study-rooms/renew/{allocation_id}",
        headers=auth_headers,
        json={
            "allocation_id": allocation_id,
            "extension_days": 30,
            "collect_payment": True,
            "payment_mode": "CASH"
        }
    )
    assert renew_res.status_code == 200
    renew_data = renew_res.json()
    assert renew_data["status"] == "PAID"
    # Renewal rent must only be the recurring base fee (NOT deposit)
    assert renew_data["total_amount"] == float(plan.base_amount)

    # 4. Vacate Desk: Calculates security deposit refund minus damage deductions
    vacate_res = await client.post(
        f"/api/v1/study-rooms/vacate/{allocation_id}",
        headers=auth_headers,
        json={
            "allocation_id": allocation_id,
            "refund_deposit": True,
            "damage_deduction": 200.00,
            "remarks": "Returned key, minor scratch on desk."
        }
    )
    assert vacate_res.status_code == 200
    vacate_data = vacate_res.json()
    assert vacate_data["deposit_amount"] == float(plan.deposit_amount)
    assert vacate_data["damage_deduction"] == 200.00
    assert vacate_data["refund_amount"] == float(plan.deposit_amount) - 200.00

    # 5. Verify seat is marked AVAILABLE again
    async with TestAsyncSessionLocal() as session:
        freed_seat = await session.get(StudySeat, uuid.UUID(seat_id))
        assert freed_seat.status == "AVAILABLE"


@pytest.mark.asyncio
async def test_hostel_bed_allocation_billing_and_checkout(client: AsyncClient, auth_headers: dict):
    async with TestAsyncSessionLocal() as session:
        # Create an isolated active student
        uid = uuid.uuid4().hex[:6]
        student = Student(
            student_code=f"STU-HB-{uid}",
            prn=f"PRN-HB-{uid}",
            first_name="Amit",
            last_name="Shinde",
            gender="MALE",
            date_of_birth=date(2008, 3, 20),
            status="ACTIVE"
        )
        session.add(student)

        # Fetch an available bed with no active allocation
        bed = (await session.execute(
            select(HostelBed).where(
                HostelBed.status == "AVAILABLE",
                ~HostelBed.allocations.any(BedAllocation.status == "ACTIVE")
            )
        )).scalars().first()
        assert bed is not None, "An available hostel bed must exist"

        # Fetch standard hostel monthly plan
        plan = (await session.execute(
            select(ServicePlan).where(ServicePlan.code == "PLN-HOST-MONTHLY")
        )).scalars().first()
        assert plan is not None, "PLN-HOST-MONTHLY must exist"

        await session.commit()
        await session.refresh(student)

        bed_id = str(bed.id)
        student_id = str(student.id)
        plan_id = str(plan.id)

    # 1. Allocate bed with standard plan
    alloc_res = await client.post(
        "/api/v1/hostels/allocate",
        headers=auth_headers,
        json={
            "hostel_bed_id": bed_id,
            "student_id": student_id,
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=30)).isoformat(),
            "service_plan_id": plan_id,
            "collect_payment": True,
            "payment_mode": "BANK_TRANSFER"
        }
    )
    assert alloc_res.status_code == 200
    alloc_data = alloc_res.json()
    allocation_id = alloc_data["allocation_id"]
    expected_total = float(plan.base_amount + plan.deposit_amount)
    assert alloc_data["total_amount"] == expected_total
    assert alloc_data["status"] == "PAID"

    # 2. 1-Click Renew Bed: Extends validity and issues rent-only invoice
    renew_res = await client.post(
        f"/api/v1/hostels/renew/{allocation_id}",
        headers=auth_headers,
        json={
            "allocation_id": allocation_id,
            "extension_days": 30,
            "collect_payment": True,
            "payment_mode": "UPI"
        }
    )
    assert renew_res.status_code == 200
    renew_data = renew_res.json()
    assert renew_data["total_amount"] == float(plan.base_amount)
    assert renew_data["status"] == "PAID"

    # 3. Check-Out Bed: Calculates caution deposit refund
    co_res = await client.post(
        f"/api/v1/hostels/check-out/{allocation_id}",
        headers=auth_headers,
        json={
            "allocation_id": allocation_id,
            "refund_deposit": True,
            "damage_deduction": 500.00,
            "remarks": "Room key returned, mattress in perfect condition."
        }
    )
    assert co_res.status_code == 200
    co_data = co_res.json()
    assert co_data["deposit_amount"] == float(plan.deposit_amount)
    assert co_data["damage_deduction"] == 500.00
    assert co_data["refund_amount"] == float(plan.deposit_amount) - 500.00

    # 4. Verify bed is available
    async with TestAsyncSessionLocal() as session:
        freed_bed = await session.get(HostelBed, uuid.UUID(bed_id))
        assert freed_bed.status == "AVAILABLE"
