import pytest
import uuid
from datetime import date, timedelta
from sqlalchemy import select
from app.core.config import settings
from app.models.user import User
from app.models.student import Student
from app.models.study_room import StudySeat, SeatAllocation
from app.models.hostel import HostelBed, BedAllocation
from tests.conftest import TestAsyncSessionLocal

@pytest.mark.asyncio
async def test_update_and_delete_student_flow(client, auth_headers):
    async with TestAsyncSessionLocal() as session:
        # 1. Fetch super admin user
        stmt = select(User).where(User.email == settings.FIRST_SUPERUSER_EMAIL)
        user = (await session.execute(stmt)).scalars().first()
        assert user is not None

        # Create a test student
        test_student = Student(
            institute_id=user.institute_id,
            student_code=f"STU-CRUD-{uuid.uuid4().hex[:6]}",
            prn=f"PRN-CRUD-{uuid.uuid4().hex[:6]}",
            first_name="OriginalName",
            last_name="OriginalLast",
            date_of_birth=date(2005, 1, 1),
            gender="MALE",
            mobile="+919876500001",
            email=f"crud_{uuid.uuid4().hex[:4]}@example.com",
            blood_group="B+",
            institution_type="SCHOOL",
            school_college_name="Modern High School",
            education_board="STATE_BOARD",
            previous_percentage=82.50,
            aadhar_number="1234-5678-9012",
            category="OBC",
            status="ACTIVE"
        )
        session.add(test_student)
        await session.commit()
        await session.refresh(test_student)
        student_id = test_student.id

    # 2. Test PATCH /api/v1/students/{student_id}
    patch_payload = {
        "first_name": "UpdatedFirst",
        "last_name": "UpdatedLast",
        "date_of_birth": "2005-02-15",
        "gender": "FEMALE",
        "status": "SUSPENDED",
        "mobile": "+919876500002",
        "blood_group": "AB+",
        "institution_type": "COLLEGE",
        "school_college_name": "Fergusson Junior College",
        "education_board": "CBSE",
        "previous_percentage": 91.25,
        "aadhar_number": "9876-5432-1098",
        "category": "EWS",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001"
    }
    res_patch = await client.patch(f"/api/v1/students/{student_id}", json=patch_payload, headers=auth_headers)
    assert res_patch.status_code == 200, res_patch.text
    patch_data = res_patch.json()
    assert patch_data["first_name"] == "UpdatedFirst"
    assert patch_data["last_name"] == "UpdatedLast"
    assert patch_data["gender"] == "FEMALE"
    assert patch_data["status"] == "SUSPENDED"
    assert patch_data["city"] == "Mumbai"
    assert patch_data["institution_type"] == "COLLEGE"
    assert patch_data["school_college_name"] == "Fergusson Junior College"
    assert patch_data["education_board"] == "CBSE"
    assert float(patch_data["previous_percentage"]) == 91.25
    assert patch_data["aadhar_number"] == "9876-5432-1098"
    assert patch_data["category"] == "EWS"
    assert patch_data["blood_group"] == "AB+"

    # Verify 360 profile reflects updated demographic, regular education & address fields
    res_profile = await client.get(f"/api/v1/students/{student_id}/profile", headers=auth_headers)
    assert res_profile.status_code == 200, res_profile.text
    ov = res_profile.json()["overview"]
    assert ov["institution_type"] == "COLLEGE"
    assert ov["school_college_name"] == "Fergusson Junior College"
    assert ov["education_board"] == "CBSE"
    assert float(ov["previous_percentage"]) == 91.25
    assert ov["aadhar_number"] == "9876-5432-1098"
    assert ov["category"] == "EWS"
    assert ov["blood_group"] == "AB+"
    assert ov["city"] == "Mumbai"

    # 3. Allocate a study seat and hostel bed to verify automatic inventory release upon delete
    async with TestAsyncSessionLocal() as session:
        seat = (await session.execute(select(StudySeat).where(StudySeat.status == "AVAILABLE"))).scalars().first()
        seat_id = None
        if seat:
            seat_id = seat.id
            seat.status = "OCCUPIED"
            seat_alloc = SeatAllocation(
                student_id=student_id,
                study_seat_id=seat.id,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=30),
                status="ACTIVE"
            )
            session.add(seat_alloc)

        bed = (await session.execute(select(HostelBed).where(HostelBed.status == "AVAILABLE"))).scalars().first()
        bed_id = None
        if bed:
            bed_id = bed.id
            bed.status = "OCCUPIED"
            bed_alloc = BedAllocation(
                student_id=student_id,
                hostel_bed_id=bed.id,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=30),
                status="ACTIVE"
            )
            session.add(bed_alloc)

        await session.commit()

    # 4. Test DELETE /api/v1/students/{student_id}
    res_del = await client.delete(f"/api/v1/students/{student_id}", headers=auth_headers)
    assert res_del.status_code == 204, res_del.text

    # 5. Verify student is deleted and facility seat/bed statuses are restored to AVAILABLE
    async with TestAsyncSessionLocal() as session:
        check_student = await session.get(Student, student_id)
        assert check_student is None

        if seat_id:
            refreshed_seat = await session.get(StudySeat, seat_id)
            assert refreshed_seat.status == "AVAILABLE"

        if bed_id:
            refreshed_bed = await session.get(HostelBed, bed_id)
            assert refreshed_bed.status == "AVAILABLE"
