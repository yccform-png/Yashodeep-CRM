import pytest
import uuid
from datetime import date
from sqlalchemy import select
from app.core.config import settings
from app.models.user import User
from app.models.student import Student, Guardian, StudentGuardian
from tests.conftest import TestAsyncSessionLocal

@pytest.mark.asyncio
async def test_student_and_guardian_mobile_swap_and_sync(client, auth_headers):
    """
    Verifies that:
    1. Student and guardian can safely swap mobile numbers without triggering unique constraint violation.
    2. Student and guardian sharing the same mobile does not crash the transaction.
    """
    async with TestAsyncSessionLocal() as session:
        # Get super admin user
        stmt = select(User).where(User.email == settings.FIRST_SUPERUSER_EMAIL)
        admin = (await session.execute(stmt)).scalars().first()
        assert admin is not None

        # Create two linked users (one student user, one guardian user)
        stu_mob_orig = f"+9199{uuid.uuid4().hex[:8]}"
        guard_mob_orig = f"+9198{uuid.uuid4().hex[:8]}"

        stu_user = User(
            institute_id=admin.institute_id,
            email=f"stu_{uuid.uuid4().hex[:6]}@test.com",
            mobile=stu_mob_orig,
            hashed_password="hashed_dummy_password",
            first_name="TestStudent",
            last_name="Patil",
            user_type="STUDENT",
            is_active=True,
            is_verified=True
        )
        session.add(stu_user)

        guard_user = User(
            institute_id=admin.institute_id,
            email=f"guard_{uuid.uuid4().hex[:6]}@test.com",
            mobile=guard_mob_orig,
            hashed_password="hashed_dummy_password",
            first_name="TestGuardian",
            last_name="Patil",
            user_type="PARENT",
            is_active=True,
            is_verified=True
        )
        session.add(guard_user)
        await session.flush()

        test_student = Student(
            institute_id=admin.institute_id,
            user_id=stu_user.id,
            student_code=f"STU-TEST-{uuid.uuid4().hex[:6]}",
            prn=f"2026{uuid.uuid4().hex[:8]}",
            first_name="TestStudent",
            last_name="Patil",
            date_of_birth=date(2008, 5, 10),
            gender="MALE",
            mobile=stu_mob_orig,
            email=stu_user.email,
            status="ACTIVE"
        )
        session.add(test_student)
        await session.flush()

        guardian = Guardian(
            institute_id=admin.institute_id,
            user_id=guard_user.id,
            first_name="TestGuardian",
            last_name="Patil",
            relation="FATHER",
            mobile=guard_mob_orig,
            email=guard_user.email
        )
        session.add(guardian)
        await session.flush()

        sg = StudentGuardian(
            student_id=test_student.id,
            guardian_id=guardian.id,
            is_primary=True,
            can_pickup=True,
            receives_notifications=True
        )
        session.add(sg)
        await session.commit()
        await session.refresh(test_student)
        student_id = str(test_student.id)

    # TEST 1: Swap mobile numbers (Student gets guardian's old mobile, guardian gets student's old mobile)
    swap_payload = {
        "mobile": guard_mob_orig,
        "guardian_first_name": "TestGuardian",
        "guardian_last_name": "Patil",
        "guardian_relation": "FATHER",
        "guardian_mobile": stu_mob_orig
    }

    res = await client.patch(f"/api/v1/students/{student_id}", json=swap_payload, headers=auth_headers)
    assert res.status_code == 200, f"Swap failed with {res.status_code}: {res.text}"
    data = res.json()
    assert data["mobile"] == guard_mob_orig
    assert data["guardian_mobile"] == stu_mob_orig

    # TEST 2: Both student and guardian set to the exact same mobile number
    same_mob = f"+9197{uuid.uuid4().hex[:8]}"
    same_mob_payload = {
        "mobile": same_mob,
        "guardian_first_name": "TestGuardian",
        "guardian_last_name": "Patil",
        "guardian_relation": "FATHER",
        "guardian_mobile": same_mob
    }

    res2 = await client.patch(f"/api/v1/students/{student_id}", json=same_mob_payload, headers=auth_headers)
    assert res2.status_code == 200, f"Same mobile failed with {res2.status_code}: {res2.text}"
    data2 = res2.json()
    assert data2["mobile"] == same_mob
    assert data2["guardian_mobile"] == same_mob
