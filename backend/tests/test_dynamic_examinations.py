import pytest
import uuid
from decimal import Decimal
from datetime import date
from httpx import AsyncClient
from sqlalchemy import select

from tests.conftest import TestAsyncSessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.academic import AcademicYear, Class, Course, Subject
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.examination import ExamType, Examination, ExamSubject, ExamMarks


@pytest.fixture
async def admin_auth_headers() -> dict:
    """Super Admin user fixture."""
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "exam_admin_test@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="exam_admin_test@institute.edu",
                hashed_password="hashed_dummy_pw",
                first_name="Exam",
                last_name="Administrator",
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
            "email": "exam_admin_test@institute.edu",
            "user_type": "SUPER_ADMIN",
            "roles": ["SUPER_ADMIN"]
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def exam_base_data() -> dict:
    """Retrieves or sets up base academic records: Year, Class, Course, Subject, ExamType, and Enrolled Student."""
    async with TestAsyncSessionLocal() as session:
        # Find a course that has an actively enrolled student
        stmt = (
            select(Course, Student, Enrollment)
            .join(Enrollment, Enrollment.course_id == Course.id)
            .join(Student, Student.id == Enrollment.student_id)
            .where(Enrollment.status == "ACTIVE", Course.class_id.isnot(None))
        )
        found = (await session.execute(stmt)).first()
        
        if found:
            crs, stu, enr = found
            cls_id = str(crs.class_id)
            ay_id = str(enr.academic_year_id)
        else:
            crs = (await session.execute(select(Course))).scalars().first()
            cls_id = str(crs.class_id)
            ay = (await session.execute(select(AcademicYear))).scalars().first()
            ay_id = str(ay.id)
            stu = (await session.execute(select(Student))).scalars().first()
            # Enroll stu in crs
            enr = Enrollment(
                student_id=stu.id,
                academic_year_id=ay.id,
                class_id=crs.class_id,
                course_id=crs.id,
                status="ACTIVE"
            )
            session.add(enr)
            await session.commit()

        sub = (await session.execute(select(Subject))).scalars().first()
        et = (await session.execute(select(ExamType))).scalars().first()

        return {
            "academic_year_id": ay_id,
            "class_id": cls_id,
            "course_id": str(crs.id),
            "subject_id": str(sub.id),
            "exam_type_id": str(et.id),
            "student_id": str(stu.id),
            "student_name": f"{stu.first_name} {stu.last_name}",
            "student_code": stu.student_code,
        }


@pytest.mark.asyncio
async def test_dynamic_tests_creation_and_flexible_marks(
    client: AsyncClient,
    admin_auth_headers: dict,
    exam_base_data: dict
):
    """
    Validates:
    1. Creating a NEET Mock test paper with custom flexible marks (720 Max Marks, 0 Practical).
    2. Filtering examinations by class_id and course_id.
    3. Fetching eligible students for the test paper.
    4. Submitting marks directly with marks_obtained (no practical marks required).
    5. Publishing exam results and verifying grade calculations.
    """
    # 1. Create Examination with 720 marks (NEET style) - practical marks: 0
    exam_payload = {
        "academic_year_id": exam_base_data["academic_year_id"],
        "exam_type_id": exam_base_data["exam_type_id"],
        "name": f"NEET Major Mock Test {uuid.uuid4().hex[:6]}",
        "code": f"NEET-M-{uuid.uuid4().hex[:6]}",
        "start_date": "2026-11-20",
        "end_date": "2026-11-20",
        "subjects": [
            {
                "subject_id": exam_base_data["subject_id"],
                "class_id": exam_base_data["class_id"],
                "course_id": exam_base_data["course_id"],
                "exam_date": "2026-11-20",
                "duration_minutes": 200,
                "max_marks": 720.0,
                "passing_marks": 360.0,
                "theory_max_marks": 720.0,
                "practical_max_marks": 0.0,
                "has_negative_marking": True,
                "negative_mark_weight": 1.0
            }
        ]
    }

    create_resp = await client.post("/api/v1/examinations", json=exam_payload, headers=admin_auth_headers)
    assert create_resp.status_code == 201, f"Failed: {create_resp.text}"
    exam_data = create_resp.json()
    assert exam_data["class_id"] == exam_base_data["class_id"]
    assert exam_data["course_id"] == exam_base_data["course_id"]
    assert float(exam_data["max_marks"]) == 720.0
    exam_id = exam_data["id"]

    # 2. Query Examinations with class_id and course_id filters
    filter_resp = await client.get(
        f"/api/v1/examinations?class_id={exam_base_data['class_id']}&course_id={exam_base_data['course_id']}",
        headers=admin_auth_headers
    )
    assert filter_resp.status_code == 200
    filter_data = filter_resp.json()
    assert any(e["id"] == exam_id for e in filter_data)

    # 3. Retrieve detailed exam with paper
    detail_resp = await client.get(f"/api/v1/examinations/{exam_id}/details", headers=admin_auth_headers)
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    papers = detail_data["subjects"]
    assert len(papers) == 1
    paper = papers[0]
    paper_id = paper["id"]
    assert float(paper["max_marks"]) == 720.0
    assert float(paper["practical_max_marks"]) == 0.0

    # 4. Get eligible students for this test paper
    eligible_resp = await client.get(
        f"/api/v1/examinations/papers/{paper_id}/eligible-students",
        headers=admin_auth_headers
    )
    assert eligible_resp.status_code == 200
    students = eligible_resp.json()
    assert len(students) >= 1
    target_student = next((s for s in students if s["student_id"] == exam_base_data["student_id"]), None)
    assert target_student is not None
    assert target_student["student_code"] == exam_base_data["student_code"]

    # 5. Submit Marks with direct marks_obtained (655 out of 720) - NO practical marks!
    marks_payload = {
        "exam_subject_id": paper_id,
        "marks": [
            {
                "student_id": exam_base_data["student_id"],
                "marks_obtained": 655.0,
                "is_absent": False,
                "is_withheld": False
            }
        ]
    }
    marks_resp = await client.post(
        "/api/v1/examinations/marks",
        json=marks_payload,
        headers=admin_auth_headers
    )
    assert marks_resp.status_code == 200
    marks_result = marks_resp.json()
    assert "recorded successfully" in marks_result["message"]

    # 6. Publish examination and check report cards
    pub_resp = await client.post(f"/api/v1/examinations/{exam_id}/publish", headers=admin_auth_headers)
    assert pub_resp.status_code == 200

    # Retrieve published exam details
    pub_detail = await client.get(f"/api/v1/examinations/{exam_id}/details", headers=admin_auth_headers)
    assert pub_detail.status_code == 200
    pub_data = pub_detail.json()
    assert pub_data["is_published"] is True
    assert len(pub_data["results"]) >= 1
    result = next((r for r in pub_data["results"] if r["student_id"] == exam_base_data["student_id"]), None)
    assert result is not None
    assert float(result["total_obtained"]) == 655.0
    assert float(result["total_possible"]) == 720.0
    assert result["is_pass"] is True

    # 7. Update marks to 690.0 (editing marks on an already published/calculated exam)
    update_marks_payload = {
        "exam_subject_id": paper_id,
        "marks": [
            {
                "student_id": exam_base_data["student_id"],
                "marks_obtained": 690.0,
                "is_absent": False,
                "is_withheld": False
            }
        ]
    }
    upd_resp = await client.post(
        "/api/v1/examinations/marks",
        json=update_marks_payload,
        headers=admin_auth_headers
    )
    assert upd_resp.status_code == 200

    # Retrieve exam details again - results, percentage, and merit list must immediately reflect 690.0
    updated_detail = await client.get(f"/api/v1/examinations/{exam_id}/details", headers=admin_auth_headers)
    assert updated_detail.status_code == 200
    updated_data = updated_detail.json()
    updated_result = next((r for r in updated_data["results"] if r["student_id"] == exam_base_data["student_id"]), None)
    assert updated_result is not None
    assert float(updated_result["total_obtained"]) == 690.0
    expected_pct = round((690.0 / 720.0) * 100, 2)
    assert float(updated_result["percentage"]) == expected_pct
    assert updated_result["grade"] == "A+"
    assert updated_result["rank"] == 1



@pytest.mark.asyncio
async def test_examination_deletion_and_cascade_cleanup(client: AsyncClient, admin_auth_headers: dict, exam_base_data: dict):
    """Verifies that deleting an examination cascades cleanly to subjects, marks, and results."""
    # 1. Create a test examination
    delete_exam_code = f"DEL-TEST-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "academic_year_id": exam_base_data["academic_year_id"],
        "exam_type_id": exam_base_data["exam_type_id"],
        "name": "Deletable Assessment Test",
        "code": delete_exam_code,
        "start_date": str(date.today()),
        "end_date": str(date.today()),
        "subjects": [
            {
                "subject_id": exam_base_data["subject_id"],
                "class_id": exam_base_data["class_id"],
                "course_id": exam_base_data["course_id"],
                "exam_date": str(date.today()),
                "duration_minutes": 60,
                "max_marks": 50.0,
                "passing_marks": 20.0,
                "has_negative_marking": False,
                "negative_mark_weight": 0.0,
                "theory_max_marks": 50.0,
                "practical_max_marks": 0.0
            }
        ]
    }
    create_resp = await client.post("/api/v1/examinations", json=payload, headers=admin_auth_headers)
    assert create_resp.status_code == 201
    exam_id = create_resp.json()["id"]

    # 2. Add marks
    detail_resp = await client.get(f"/api/v1/examinations/{exam_id}/details", headers=admin_auth_headers)
    paper_id = detail_resp.json()["subjects"][0]["id"]
    marks_payload = {
        "exam_subject_id": paper_id,
        "marks": [
            {
                "student_id": exam_base_data["student_id"],
                "marks_obtained": 45.0,
                "is_absent": False,
                "is_withheld": False
            }
        ]
    }
    await client.post("/api/v1/examinations/marks", json=marks_payload, headers=admin_auth_headers)

    # 3. Publish results
    await client.post(f"/api/v1/examinations/{exam_id}/publish", headers=admin_auth_headers)

    # 4. Perform Delete
    del_resp = await client.delete(f"/api/v1/examinations/{exam_id}", headers=admin_auth_headers)
    assert del_resp.status_code == 200
    assert "deleted successfully" in del_resp.json()["message"]

    # 5. Verify 404 on fetch
    get_after_del = await client.get(f"/api/v1/examinations/{exam_id}/details", headers=admin_auth_headers)
    assert get_after_del.status_code == 404

    # 6. Verify database records are purged
    async with TestAsyncSessionLocal() as session:
        exam_check = (await session.execute(select(Examination).where(Examination.id == uuid.UUID(exam_id)))).scalar_one_or_none()
        assert exam_check is None

        paper_check = (await session.execute(select(ExamSubject).where(ExamSubject.examination_id == uuid.UUID(exam_id)))).scalars().all()
        assert len(paper_check) == 0

        marks_check = (await session.execute(select(ExamMarks).where(ExamMarks.exam_subject_id == uuid.UUID(paper_id)))).scalars().all()
        assert len(marks_check) == 0

    # 7. Verify 404 when deleting already deleted examination
    del_again = await client.delete(f"/api/v1/examinations/{exam_id}", headers=admin_auth_headers)
    assert del_again.status_code == 404

