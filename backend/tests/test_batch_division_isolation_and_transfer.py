import pytest
import uuid
from datetime import date
from httpx import AsyncClient
from sqlalchemy import select, delete

from tests.conftest import TestAsyncSessionLocal
from app.models.academic import Class, Course, AcademicYear, Batch, BatchStudent
from app.models.student import Student
from app.models.enrollment import Enrollment


@pytest.mark.asyncio
async def test_batch_division_isolation_and_transfer(client: AsyncClient, auth_headers: dict):
    created_batch_ids = []
    created_student_ids = []
    created_course_id = None

    try:
        async with TestAsyncSessionLocal() as db_session:
            # 1. Fetch active AcademicYear and 10th Standard class
            ay_res = await db_session.execute(select(AcademicYear).where(AcademicYear.is_current == True))
            ay = ay_res.scalars().first()
            assert ay is not None, "Active AcademicYear must exist"

            cls_res = await db_session.execute(select(Class).where(Class.code == "STD-10"))
            cls_10 = cls_res.scalars().first()
            assert cls_10 is not None, "10th Standard class must exist"

            # Fetch a base course to get course_type_id
            base_crs_res = await db_session.execute(select(Course).where(Course.class_id == cls_10.id))
            base_crs = base_crs_res.scalars().first()
            assert base_crs is not None

            # 2. Create isolated test course
            test_course = Course(
                course_type_id=base_crs.course_type_id,
                class_id=cls_10.id,
                name="Test Division Isolation Course 10th",
                code=f"CRS-TEST-DIV-{uuid.uuid4().hex[:6].upper()}",
                duration_months=12,
                is_active=True
            )
            db_session.add(test_course)
            await db_session.flush()
            created_course_id = test_course.id

            # 3. Create Division A and Division B for this course
            batch_a = Batch(
                course_id=test_course.id,
                academic_year_id=ay.id,
                name="10th Test - Division A",
                code=f"BAT-TEST-10A-{uuid.uuid4().hex[:4].upper()}",
                division="A",
                max_capacity=50,
                start_date=date(2026, 4, 1),
                end_date=date(2027, 3, 31),
                is_active=True
            )
            batch_b = Batch(
                course_id=test_course.id,
                academic_year_id=ay.id,
                name="10th Test - Division B",
                code=f"BAT-TEST-10B-{uuid.uuid4().hex[:4].upper()}",
                division="B",
                max_capacity=50,
                start_date=date(2026, 4, 1),
                end_date=date(2027, 3, 31),
                is_active=True
            )
            db_session.add_all([batch_a, batch_b])
            await db_session.flush()
            created_batch_ids.extend([batch_a.id, batch_b.id])

            # 4. Create 3 test students:
            # Student 1: Enrolled in Division A
            # Student 2: Enrolled in Division B
            # Student 3: Enrolled in Course without batch (Unassigned)
            s1 = Student(
                first_name="Aarav",
                last_name="Agarwal",
                student_code=f"STU-TEST-{uuid.uuid4().hex[:6].upper()}",
                date_of_birth=date(2010, 5, 15),
                gender="MALE",
                status="ACTIVE"
            )
            s2 = Student(
                first_name="Bhavna",
                last_name="Bakshi",
                student_code=f"STU-TEST-{uuid.uuid4().hex[:6].upper()}",
                date_of_birth=date(2010, 6, 20),
                gender="FEMALE",
                status="ACTIVE"
            )
            s3 = Student(
                first_name="Chetan",
                last_name="Chopra",
                student_code=f"STU-TEST-{uuid.uuid4().hex[:6].upper()}",
                date_of_birth=date(2010, 7, 25),
                gender="MALE",
                status="ACTIVE"
            )
            db_session.add_all([s1, s2, s3])
            await db_session.flush()
            created_student_ids.extend([s1.id, s2.id, s3.id])

            # 5. Create enrollments with division bindings
            e1 = Enrollment(
                student_id=s1.id,
                academic_year_id=ay.id,
                class_id=cls_10.id,
                course_id=test_course.id,
                batch_id=batch_a.id,  # Bound to Div A
                enrollment_date=date.today(),
                status="ACTIVE"
            )
            e2 = Enrollment(
                student_id=s2.id,
                academic_year_id=ay.id,
                class_id=cls_10.id,
                course_id=test_course.id,
                batch_id=batch_b.id,  # Bound to Div B
                enrollment_date=date.today(),
                status="ACTIVE"
            )
            e3 = Enrollment(
                student_id=s3.id,
                academic_year_id=ay.id,
                class_id=cls_10.id,
                course_id=test_course.id,
                batch_id=None,  # Unassigned
                enrollment_date=date.today(),
                status="ACTIVE"
            )
            db_session.add_all([e1, e2, e3])
            await db_session.commit()

        # --- TEST 1: Sync Preview Endpoint ---
        res_preview_a = await client.get(f"/api/v1/academics/batches/{batch_a.id}/sync-preview", headers=auth_headers)
        assert res_preview_a.status_code == 200, res_preview_a.text
        preview_a = res_preview_a.json()
        assert preview_a["total_course_enrollments"] == 3
        assert preview_a["matched_count"] == 1  # s1
        assert preview_a["unassigned_count"] == 1  # s3
        assert preview_a["other_division_count"] == 1  # s2

        # --- TEST 2: Strict Division A Auto-Sync (Must ONLY pull s1, NEVER s2 or s3) ---
        res_sync_a = await client.post(
            f"/api/v1/academics/batches/{batch_a.id}/sync-enrolled-students",
            json={"mode": "AUTO"},
            headers=auth_headers
        )
        assert res_sync_a.status_code == 200, res_sync_a.text
        roster_a = res_sync_a.json()
        assert len(roster_a) == 1
        assert roster_a[0]["student_id"] == str(s1.id)
        assert roster_a[0]["roll_number"] == 1001  # 10th std base 1000 + Div A offset 0 + 1

        # --- TEST 3: Strict Division B Auto-Sync (Must ONLY pull s2, NEVER s1 or s3) ---
        res_sync_b = await client.post(
            f"/api/v1/academics/batches/{batch_b.id}/sync-enrolled-students",
            json={"mode": "AUTO"},
            headers=auth_headers
        )
        assert res_sync_b.status_code == 200, res_sync_b.text
        roster_b = res_sync_b.json()
        assert len(roster_b) == 1
        assert roster_b[0]["student_id"] == str(s2.id)
        assert roster_b[0]["roll_number"] == 1051  # 10th std base 1000 + Div B offset 50 + 1

        # --- TEST 4: Division Transfer (Move s1 from Division A to Division B) ---
        res_transfer = await client.post(
            f"/api/v1/academics/batches/{batch_a.id}/students/{s1.id}/transfer",
            json={"target_batch_id": str(batch_b.id)},
            headers=auth_headers
        )
        assert res_transfer.status_code == 200, res_transfer.text
        transfer_data = res_transfer.json()
        assert transfer_data["student_id"] == str(s1.id)
        assert transfer_data["target_division"] == "B"
        assert transfer_data["new_roll_number"] == 1052  # next in Div B (after 1051)

        # Verify Division A roster is now empty
        res_roster_a = await client.get(f"/api/v1/academics/batches/{batch_a.id}/roster", headers=auth_headers)
        assert len(res_roster_a.json()) == 0

        # Verify Division B roster now has 2 students (s2 at 1051, s1 at 1052)
        res_roster_b = await client.get(f"/api/v1/academics/batches/{batch_b.id}/roster", headers=auth_headers)
        assert len(res_roster_b.json()) == 2

    finally:
        # Automated cleanup
        async with TestAsyncSessionLocal() as clean_session:
            if created_student_ids:
                await clean_session.execute(delete(BatchStudent).where(BatchStudent.student_id.in_(created_student_ids)))
                await clean_session.execute(delete(Enrollment).where(Enrollment.student_id.in_(created_student_ids)))
                await clean_session.execute(delete(Student).where(Student.id.in_(created_student_ids)))
            if created_batch_ids:
                await clean_session.execute(delete(Batch).where(Batch.id.in_(created_batch_ids)))
            if created_course_id:
                await clean_session.execute(delete(Course).where(Course.id == created_course_id))
            await clean_session.commit()
