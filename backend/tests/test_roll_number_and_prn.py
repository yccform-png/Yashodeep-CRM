import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select, delete

from tests.conftest import TestAsyncSessionLocal
from app.models.academic import Class, Course, AcademicYear
from app.models.student import Student


@pytest.mark.asyncio
async def test_prn_and_roll_number_system(client: AsyncClient, auth_headers: dict):
    created_batch_ids = []
    created_student_ids = []
    crs_10_test_id = None
    crs_5_test_id = None

    try:
        async with TestAsyncSessionLocal() as db_session:
            # 1. Fetch academic year and classes
            ay_res = await db_session.execute(select(AcademicYear).where(AcademicYear.is_current == True))
            ay = ay_res.scalars().first()
            assert ay is not None, "Active AcademicYear must exist"

            cls_5_res = await db_session.execute(select(Class).where(Class.code == "STD-05"))
            cls_5 = cls_5_res.scalars().first()
            assert cls_5 is not None, "5th Standard class must exist"

            cls_10_res = await db_session.execute(select(Class).where(Class.code == "STD-10"))
            cls_10 = cls_10_res.scalars().first()
            assert cls_10 is not None, "10th Standard class must exist"

            # 2. Fetch base courses to copy course_type_id
            crs_5_res = await db_session.execute(select(Course).where(Course.class_id == cls_5.id))
            crs_5_base = crs_5_res.scalars().first()

            crs_10_res = await db_session.execute(select(Course).where(Course.class_id == cls_10.id))
            crs_10_base = crs_10_res.scalars().first()

            # Create isolated test courses so test batches never pollute production batches
            crs_10 = Course(
                course_type_id=crs_10_base.course_type_id,
                class_id=cls_10.id,
                name=f"10th Standard Test Course {uuid.uuid4().hex[:6]}",
                code=f"CRS-T10-{uuid.uuid4().hex[:6]}",
                duration_months=12,
                is_active=True
            )
            crs_5 = Course(
                course_type_id=crs_5_base.course_type_id,
                class_id=cls_5.id,
                name=f"5th Standard Test Course {uuid.uuid4().hex[:6]}",
                code=f"CRS-T5-{uuid.uuid4().hex[:6]}",
                duration_months=12,
                is_active=True
            )
            db_session.add(crs_10)
            db_session.add(crs_5)
            await db_session.commit()
            await db_session.refresh(crs_10)
            await db_session.refresh(crs_5)
            crs_10_test_id = crs_10.id
            crs_5_test_id = crs_5.id

        # 3. Create two students via API to test PRN auto-generation
        stu_a_resp = await client.post(
            "/api/v1/students",
            headers=auth_headers,
            json={
                "first_name": "Aarav",
                "last_name": "Deshmukh",
                "date_of_birth": "2010-05-15",
                "gender": "MALE",
                "mobile": "+919876500001",
                "email": f"aarav_{uuid.uuid4().hex[:6]}@test.edu"
            }
        )
        assert stu_a_resp.status_code == 201
        stu_a_data = stu_a_resp.json()
        created_student_ids.append(stu_a_data["id"])
        assert stu_a_data["prn"] is not None
        assert stu_a_data["prn"].startswith("PRN-")

        stu_b_resp = await client.post(
            "/api/v1/students",
            headers=auth_headers,
            json={
                "first_name": "Bhavna",
                "last_name": "Agarwal",
                "date_of_birth": "2010-08-20",
                "gender": "FEMALE",
                "mobile": "+919876500002",
                "email": f"bhavna_{uuid.uuid4().hex[:6]}@test.edu"
            }
        )
        assert stu_b_resp.status_code == 201
        stu_b_data = stu_b_resp.json()
        created_student_ids.append(stu_b_data["id"])
        assert stu_b_data["prn"] is not None
        assert stu_b_data["prn"].startswith("PRN-")
        assert stu_a_data["prn"] != stu_b_data["prn"]

        # 4. Create Batches for 10th Standard: Division A and Division B
        b_code_a = f"BAT-10A-{uuid.uuid4().hex[:6]}"
        batch_a_resp = await client.post(
            "/api/v1/academics/batches",
            headers=auth_headers,
            json={
                "course_id": str(crs_10_test_id),
                "academic_year_id": str(ay.id),
                "name": f"Test 10th Batch - Division A - {uuid.uuid4().hex[:4]}",
                "code": b_code_a,
                "division": "A",
                "max_capacity": 60,
                "start_date": "2026-06-01",
                "end_date": "2027-04-30"
            }
        )
        assert batch_a_resp.status_code == 201
        batch_a = batch_a_resp.json()
        created_batch_ids.append(batch_a["id"])
        assert batch_a["division"] == "A"

        b_code_b = f"BAT-10B-{uuid.uuid4().hex[:6]}"
        batch_b_resp = await client.post(
            "/api/v1/academics/batches",
            headers=auth_headers,
            json={
                "course_id": str(crs_10_test_id),
                "academic_year_id": str(ay.id),
                "name": f"Test 10th Batch - Division B - {uuid.uuid4().hex[:4]}",
                "code": b_code_b,
                "division": "B",
                "max_capacity": 60,
                "start_date": "2026-06-01",
                "end_date": "2027-04-30"
            }
        )
        assert batch_b_resp.status_code == 201
        batch_b = batch_b_resp.json()
        created_batch_ids.append(batch_b["id"])
        assert batch_b["division"] == "B"

        # 5. Enroll students into Batch A
        add_a1 = await client.post(
            f"/api/v1/academics/batches/{batch_a['id']}/students",
            headers=auth_headers,
            json={"student_id": stu_a_data["id"]}
        )
        assert add_a1.status_code == 201

        add_a2 = await client.post(
            f"/api/v1/academics/batches/{batch_a['id']}/students",
            headers=auth_headers,
            json={"student_id": stu_b_data["id"]}
        )
        assert add_a2.status_code == 201

        # 6. Auto-generate roll numbers for Batch A (10th Standard, Division A)
        # Expected:
        # Standard: 10 -> Base = 1000
        # Division A: offset = 0
        # Sorted by last name:
        # 1. Agarwal, Bhavna -> 1001
        # 2. Deshmukh, Aarav -> 1002
        gen_a_resp = await client.post(
            f"/api/v1/academics/batches/{batch_a['id']}/generate-roll-numbers",
            headers=auth_headers
        )
        assert gen_a_resp.status_code == 200
        gen_a_data = gen_a_resp.json()
        assert gen_a_data["assigned_count"] == 2
        assert gen_a_data["standard_number"] == 10
        assert gen_a_data["base_prefix"] == 1000
        assert gen_a_data["division_offset"] == 0

        roster_a = gen_a_data["roster"]
        assert len(roster_a) == 2
        # Chronological append: Deshmukh enrolled first (1001), Agarwal enrolled second (1002)
        assert roster_a[0]["last_name"] == "Deshmukh"
        assert roster_a[0]["roll_number"] == 1001
        assert roster_a[1]["last_name"] == "Agarwal"
        assert roster_a[1]["roll_number"] == 1002

        # 7. Test Division B roll numbers (+50 offset: 1051, 1052...)
        stu_c_resp = await client.post(
            "/api/v1/students",
            headers=auth_headers,
            json={
                "first_name": "Chetan",
                "last_name": "Kulkarni",
                "date_of_birth": "2010-03-10",
                "gender": "MALE",
                "mobile": "+919876500003"
            }
        )
        stu_c_data = stu_c_resp.json()
        created_student_ids.append(stu_c_data["id"])

        stu_d_resp = await client.post(
            "/api/v1/students",
            headers=auth_headers,
            json={
                "first_name": "Deepa",
                "last_name": "Joshi",
                "date_of_birth": "2010-09-12",
                "gender": "FEMALE",
                "mobile": "+919876500004"
            }
        )
        stu_d_data = stu_d_resp.json()
        created_student_ids.append(stu_d_data["id"])

        await client.post(
            f"/api/v1/academics/batches/{batch_b['id']}/students",
            headers=auth_headers,
            json={"student_id": stu_c_data["id"]}
        )
        await client.post(
            f"/api/v1/academics/batches/{batch_b['id']}/students",
            headers=auth_headers,
            json={"student_id": stu_d_data["id"]}
        )

        gen_b_resp = await client.post(
            f"/api/v1/academics/batches/{batch_b['id']}/generate-roll-numbers",
            headers=auth_headers
        )
        assert gen_b_resp.status_code == 200
        gen_b_data = gen_b_resp.json()
        assert gen_b_data["division_offset"] == 50
        roster_b = gen_b_data["roster"]
        assert len(roster_b) == 2
        # Chronological append: Kulkarni enrolled first (1051), Joshi enrolled second (1052)
        assert roster_b[0]["last_name"] == "Kulkarni"
        assert roster_b[0]["roll_number"] == 1051
        assert roster_b[1]["last_name"] == "Joshi"
        assert roster_b[1]["roll_number"] == 1052

        # 8. Test 5th Standard batch (Base = 500 -> 501, 502)
        b_code_5 = f"BAT-05A-{uuid.uuid4().hex[:6]}"
        batch_5_resp = await client.post(
            "/api/v1/academics/batches",
            headers=auth_headers,
            json={
                "course_id": str(crs_5_test_id),
                "academic_year_id": str(ay.id),
                "name": f"Test 5th Batch - Div A - {uuid.uuid4().hex[:4]}",
                "code": b_code_5,
                "division": "A",
                "max_capacity": 50,
                "start_date": "2026-06-01",
                "end_date": "2027-04-30"
            }
        )
        assert batch_5_resp.status_code == 201
        batch_5 = batch_5_resp.json()
        created_batch_ids.append(batch_5["id"])

        # Create 5th grade student
        stu_5_resp = await client.post(
            "/api/v1/students",
            headers=auth_headers,
            json={
                "first_name": "Om",
                "last_name": "Pawar",
                "date_of_birth": "2015-02-14",
                "gender": "MALE",
                "mobile": "+919876500005"
            }
        )
        stu_5_data = stu_5_resp.json()
        created_student_ids.append(stu_5_data["id"])

        await client.post(
            f"/api/v1/academics/batches/{batch_5['id']}/students",
            headers=auth_headers,
            json={"student_id": stu_5_data["id"]}
        )

        gen_5_resp = await client.post(
            f"/api/v1/academics/batches/{batch_5['id']}/generate-roll-numbers",
            headers=auth_headers
        )
        assert gen_5_resp.status_code == 200
        gen_5_data = gen_5_resp.json()
        assert gen_5_data["standard_number"] == 5
        assert gen_5_data["base_prefix"] == 500
        assert gen_5_data["roster"][0]["roll_number"] == 501

        # 9. Test Manual Override & Duplicate Prevention
        # Try to set student A's roll number to 1002 (which is already assigned to student B in Batch A)
        dup_resp = await client.put(
            f"/api/v1/academics/batches/{batch_a['id']}/students/{stu_a_data['id']}/roll-number",
            headers=auth_headers,
            json={"roll_number": 1002}
        )
        assert dup_resp.status_code == 409  # Conflict!

        # Update to an unassigned valid roll number (e.g. 1005)
        valid_upd = await client.put(
            f"/api/v1/academics/batches/{batch_a['id']}/students/{stu_a_data['id']}/roll-number",
            headers=auth_headers,
            json={"roll_number": 1005}
        )
        assert valid_upd.status_code == 200
        assert valid_upd.json()["roll_number"] == 1005

        # 10. Test Roster Query
        roster_final = await client.get(
            f"/api/v1/academics/batches/{batch_a['id']}/roster",
            headers=auth_headers
        )
        assert roster_final.status_code == 200
        r_items = roster_final.json()
        assert len(r_items) == 2
        # Ordered by roll_number: 1002 (Bhavna), then 1005 (Aarav overridden)
        assert r_items[0]["roll_number"] == 1002
        assert r_items[1]["roll_number"] == 1005

    finally:
        # Automatic teardown: clean up all test batches, students, and courses
        async with TestAsyncSessionLocal() as db_session:
            batch_uuids = [uuid.UUID(b) for b in created_batch_ids]
            if batch_uuids:
                from app.models.academic import BatchSubject, BatchStudent, Batch
                await db_session.execute(delete(BatchSubject).where(BatchSubject.batch_id.in_(batch_uuids)))
                await db_session.execute(delete(BatchStudent).where(BatchStudent.batch_id.in_(batch_uuids)))
                await db_session.execute(delete(Batch).where(Batch.id.in_(batch_uuids)))

            for s_id in created_student_ids:
                try:
                    await db_session.execute(delete(Student).where(Student.id == uuid.UUID(s_id)))
                except Exception:
                    pass
            for c_id in [crs_10_test_id, crs_5_test_id]:
                if c_id:
                    try:
                        await db_session.execute(delete(Course).where(Course.id == c_id))
                    except Exception:
                        pass
            await db_session.commit()
