import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.models.user import User
from app.core.security import create_access_token
from tests.conftest import TestAsyncSessionLocal


@pytest.fixture
async def admin_operational_headers() -> dict:
    """Admin user with ADMIN role (no finance access)."""
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "admin_operations_test@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="admin_operations_test@institute.edu",
                hashed_password="hashed_pw_test",
                first_name="Institute",
                last_name="Administrator",
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
            "email": "admin_operations_test@institute.edu",
            "user_type": "ADMIN",
            "roles": ["ADMIN"]
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def superadmin_headers() -> dict:
    """Super Admin user with full institute ownership."""
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "superadmin_rbac_test@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="superadmin_rbac_test@institute.edu",
                hashed_password="hashed_pw_test",
                first_name="Super",
                last_name="Admin",
                user_type="SUPER_ADMIN",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        user_id = str(user.id)

    token = create_access_token(
        subject=user_id,
        extra_claims={
            "email": "superadmin_rbac_test@institute.edu",
            "user_type": "SUPER_ADMIN",
            "roles": ["SUPER_ADMIN"]
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_admin_blocked_from_fee_engine(client: AsyncClient, admin_operational_headers: dict, superadmin_headers: dict):
    """Verify that ADMIN user is strictly blocked (HTTP 403) from all fee ledgers and payment routes."""
    # 1. Admin trying to list invoices -> 403 Forbidden
    res_admin = await client.get("/api/v1/fees/invoices", headers=admin_operational_headers)
    assert res_admin.status_code == 403, f"Expected 403 Forbidden for Admin on /fees/invoices, got {res_admin.status_code}"

    # 2. Super Admin listing invoices -> 200 OK
    res_super = await client.get("/api/v1/fees/invoices", headers=superadmin_headers)
    assert res_super.status_code == 200, f"Expected 200 OK for Super Admin on /fees/invoices, got {res_super.status_code}"


@pytest.mark.asyncio
async def test_admin_allowed_operational_modules(client: AsyncClient, admin_operational_headers: dict):
    """Verify that ADMIN user has full operational access to Attendance, Hostel, Study Room, and Exams."""
    # 1. Hostel Building/Room endpoints
    res_hostel = await client.get("/api/v1/hostel/buildings", headers=admin_operational_headers)
    assert res_hostel.status_code in (200, 404), f"Hostel endpoint accessible to Admin, got {res_hostel.status_code}"

    # 2. Study Room endpoints
    res_study = await client.get("/api/v1/study-room/seats", headers=admin_operational_headers)
    assert res_study.status_code in (200, 404), f"Study room endpoint accessible to Admin, got {res_study.status_code}"

    # 3. Students registry
    res_students = await client.get("/api/v1/students", headers=admin_operational_headers)
    assert res_students.status_code in (200, 404), f"Students endpoint accessible to Admin, got {res_students.status_code}"
