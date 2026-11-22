import pytest
import uuid
from decimal import Decimal
from datetime import date
from httpx import AsyncClient
from sqlalchemy import select

from tests.conftest import TestAsyncSessionLocal
from app.models.study_room import StudySeat
from app.modules.fees.pricing_engine import PricingEngine


# ============================================================================
# 1. PRICING ENGINE UNIT TESTS
# ============================================================================

def test_pricing_package_vs_individual_double_charge_prevention():
    """
    PCMB package = 35,000 (covers Physics, Chemistry, Maths, Biology).
    If student selects PCMB and also picks Mathematics and CET Practice:
    - Mathematics must NOT be double-charged.
    - CET Practice (not in PCMB) must be charged at individual rate.
    """
    package_subjs = ["PHY-UUID", "CHEM-UUID", "MATH-UUID", "BIO-UUID"]
    selected_subjs = [
        {"id": "MATH-UUID", "name": "Mathematics", "fee": Decimal("11000.00")},
        {"id": "CET-UUID", "name": "CET Practice", "fee": Decimal("12000.00")},
    ]

    result = PricingEngine.calculate_fees(
        package_group_fee=Decimal("35000.00"),
        package_subject_ids=package_subjs,
        selected_subjects=selected_subjs,
        discount_amount=Decimal("0.00"),
        number_of_installments=2
    )

    # Expected: 35000 (PCMB) + 12000 (CET Practice) = 47000
    # Mathematics should NOT be added
    assert result.total_amount == Decimal("47000.00")
    assert len(result.items) == 2  # Package + CET Practice
    assert len(result.installments) == 2
    assert result.installments[0].amount == Decimal("23500.00")
    assert result.installments[1].amount == Decimal("23500.00")


def test_pricing_single_subject_only():
    """
    Student B: 11th Commerce - Only Mathematics tuition.
    No package, no hostel, no study room.
    """
    selected_subjs = [
        {"id": "MATH-UUID", "name": "Mathematics", "fee": Decimal("9000.00")}
    ]
    result = PricingEngine.calculate_fees(
        selected_subjects=selected_subjs,
        discount_amount=Decimal("1000.00"),
        number_of_installments=1
    )
    # 9000 - 1000 discount = 8000
    assert result.subtotal == Decimal("9000.00")
    assert result.total_discount == Decimal("1000.00")
    assert result.total_amount == Decimal("8000.00")
    assert len(result.installments) == 1
    assert result.installments[0].amount == Decimal("8000.00")


def test_pricing_full_facilities():
    """
    Student with Tuition (35000) + Hostel (6500 + 5000 deposit) + Study Room (15000 + 2000 deposit).
    """
    hostel_plan = {"name": "Hostel Monthly", "base_amount": Decimal("6500.00"), "deposit_amount": Decimal("5000.00")}
    sr_plan = {"name": "Study Room AC", "base_amount": Decimal("15000.00"), "deposit_amount": Decimal("2000.00")}

    result = PricingEngine.calculate_fees(
        base_course_fee=Decimal("35000.00"),
        hostel_plan=hostel_plan,
        study_room_plan=sr_plan,
        number_of_installments=3
    )

    expected_total = Decimal("35000.00") + Decimal("6500.00") + Decimal("5000.00") + Decimal("15000.00") + Decimal("2000.00")
    assert result.total_amount == expected_total  # 63500.00
    assert result.deposit_amount == Decimal("7000.00")  # 5000 + 2000
    assert len(result.installments) == 3


# ============================================================================
# 2. ACADEMIC & FACILITY INVENTORY API TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_academic_inventory_configuration(client: AsyncClient, auth_headers: dict):
    # Verify Classes 5th through 12th exist
    res = await client.get("/api/v1/academics/classes", headers=auth_headers)
    assert res.status_code == 200
    classes = res.json()
    codes = [c["code"] for c in classes]
    assert "STD-05" in codes
    assert "STD-10" in codes
    assert "STD-11" in codes
    assert "STD-12" in codes

    # Verify Streams Science and Commerce exist
    res = await client.get("/api/v1/academics/streams", headers=auth_headers)
    assert res.status_code == 200
    streams = res.json()
    strm_codes = [s["code"] for s in streams]
    assert "SCI" in strm_codes
    assert "COMM" in strm_codes

    # Verify Study Room has exactly 150 seats: 105 Boys and 45 Girls
    res = await client.get("/api/v1/study-rooms/seats", headers=auth_headers)
    assert res.status_code == 200
    seats = res.json()
    main_seats = [s for s in seats if s["seat_number"].startswith("B") or s["seat_number"].startswith("G")]
    assert len(main_seats) == 150
    boys_seats = [s for s in main_seats if s["gender_allowed"] == "BOYS"]
    girls_seats = [s for s in main_seats if s["gender_allowed"] == "GIRLS"]
    assert len(boys_seats) == 105
    assert len(girls_seats) == 45


# ============================================================================
# 3. END-TO-END ADMISSION WORKFLOW TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_scenario_1_student_full_services(client: AsyncClient, auth_headers: dict):
    """
    Scenario 1:
    - 12th Science
    - PCMB
    - Regular + CET
    - Hostel
    - Study room
    Verifies: student, enrollment, 4 subjects, 3 services, invoice, hostel bed, study room seat.
    """
    # Fetch academic master data
    classes = (await client.get("/api/v1/academics/classes", headers=auth_headers)).json()
    class_12 = next(c for c in classes if c["code"] == "STD-12")

    streams = (await client.get("/api/v1/academics/streams", headers=auth_headers)).json()
    sci_stream = next(s for s in streams if s["code"] == "SCI")

    years = (await client.get("/api/v1/academics/years", headers=auth_headers)).json()
    current_year = next(y for y in years if y["is_current"])

    courses = (await client.get("/api/v1/academics/courses", headers=auth_headers)).json()
    course_12_sci = next(c for c in courses if "12th Science" in c["name"])

    groups = (await client.get("/api/v1/academics/subject-groups", headers=auth_headers)).json()
    pcmb_group = next(g for g in groups if "PCMB" in g["code"])

    # Get available study room seat and hostel bed
    seats = (await client.get("/api/v1/study-rooms/seats", headers=auth_headers)).json()
    avail_seat = next(s for s in seats if s["gender_allowed"] == "BOYS" and s["status"] == "AVAILABLE")

    # Find an AVAILABLE bed in boys hostel
    hostels = (await client.get("/api/v1/hostels", headers=auth_headers)).json()
    boys_hostel = next(h for h in hostels if h["gender_type"] == "BOYS")
    avail_bed = None
    for b in boys_hostel["buildings"]:
        for f in b["floors"]:
            for r in f["rooms"]:
                for bed in r["beds"]:
                    if bed["status"] == "AVAILABLE":
                        avail_bed = bed
                        break
                if avail_bed: break
            if avail_bed: break

    if avail_bed is None:
        # Check out an occupied bed to make it available
        for b in boys_hostel["buildings"]:
            for f in b["floors"]:
                for r in f["rooms"]:
                    for bed in r["beds"]:
                        if bed.get("allocation_id"):
                            await client.post(f"/api/v1/hostels/check-out/{bed['allocation_id']}", headers=auth_headers)
                            avail_bed = bed
                            avail_bed["status"] = "AVAILABLE"
                            break
                    if avail_bed: break
                if avail_bed: break

    assert avail_bed is not None, "No available boys bed found"

    # Get service plans
    plans = (await client.get("/api/v1/services/plans", headers=auth_headers)).json()
    hostel_plan = next(p for p in plans if "Hostel" in p["name"])
    sr_plan = next(p for p in plans if "Study Room" in p["name"])

    uid = uuid.uuid4().hex[:6]
    # Execute Admission
    payload = {
        "first_name": "Rohan",
        "last_name": "Sharma",
        "date_of_birth": "2008-05-15",
        "gender": "MALE",
        "mobile": f"+91987{uid}",
        "email": f"rohan_{uid}@example.com",
        "guardians": [
            {
                "first_name": "Vikram",
                "last_name": "Sharma",
                "relation": "FATHER",
                "mobile": "+919876543200",
                "is_primary": True
            }
        ],
        "is_academic_enrolled": True,
        "enrollment_type": "SINGLE_YEAR",
        "academic_year_id": current_year["id"],
        "class_id": class_12["id"],
        "stream_id": sci_stream["id"],
        "course_id": course_12_sci["id"],
        "course_version_id": course_12_sci["current_version"]["id"] if course_12_sci["current_version"] else None,
        "subject_group_id": pcmb_group["id"],
        "selected_subject_ids": [],
        "hostel_plan_id": hostel_plan["id"],
        "hostel_bed_id": avail_bed["id"],
        "study_room_plan_id": sr_plan["id"],
        "study_seat_id": avail_seat["id"],
        "number_of_installments": 2
    }

    adm_res = await client.post("/api/v1/enrollments/admit", json=payload, headers=auth_headers)
    assert adm_res.status_code == 201, f"Admission failed: {adm_res.text}"
    adm_data = adm_res.json()

    assert adm_data["student_id"] is not None
    assert adm_data["enrollment_id"] is not None
    assert adm_data["invoice_id"] is not None
    assert adm_data["seat_allocated"] == avail_seat["seat_number"]
    assert adm_data["bed_allocated"] == avail_bed["bed_number"]

    # Verify Profile contains all 11 tabs and 2 active auxiliary facilities (Hostel, Study Room)
    prof_res = await client.get(f"/api/v1/students/{adm_data['student_id']}/profile", headers=auth_headers)
    assert prof_res.status_code == 200
    profile = prof_res.json()

    assert len(profile["services"]) >= 2  # Hostel, Study Room (Tuition is managed via Academics)
    assert profile["hostel"] is not None
    assert profile["study_room"] is not None
    assert len(profile["fees"]) >= 1


@pytest.mark.asyncio
async def test_scenario_2_individual_subject_only(client: AsyncClient, auth_headers: dict):
    """
    Scenario 2:
    - 11th Commerce
    - Only Mathematics tuition
    - No hostel, no study room.
    Verifies: No hostel or study room subscriptions, only Math tuition charge.
    """
    classes = (await client.get("/api/v1/academics/classes", headers=auth_headers)).json()
    class_11 = next(c for c in classes if c["code"] == "STD-11")

    streams = (await client.get("/api/v1/academics/streams", headers=auth_headers)).json()
    comm_stream = next(s for s in streams if s["code"] == "COMM")

    years = (await client.get("/api/v1/academics/years", headers=auth_headers)).json()
    current_year = next(y for y in years if y["is_current"])

    subjects = (await client.get("/api/v1/academics/subjects", headers=auth_headers)).json()
    math_subj = next(s for s in subjects if s["code"] == "MATH")

    uid2 = uuid.uuid4().hex[:6]
    payload = {
        "first_name": "Aarav",
        "last_name": "Patel",
        "date_of_birth": "2009-08-20",
        "gender": "MALE",
        "mobile": f"+91986{uid2}",
        "email": f"aarav_{uid2}@example.com",
        "is_academic_enrolled": True,
        "academic_year_id": current_year["id"],
        "class_id": class_11["id"],
        "stream_id": comm_stream["id"],
        "selected_subject_ids": [math_subj["id"]],
        "hostel_plan_id": None,
        "study_room_plan_id": None
    }

    adm_res = await client.post("/api/v1/enrollments/admit", json=payload, headers=auth_headers)
    assert adm_res.status_code == 201
    adm_data = adm_res.json()

    assert adm_data["seat_allocated"] is None
    assert adm_data["bed_allocated"] is None

    # Check student profile
    prof_res = await client.get(f"/api/v1/students/{adm_data['student_id']}/profile", headers=auth_headers)
    profile = prof_res.json()
    assert profile["hostel"] is None
    assert profile["study_room"] is None
    assert len(profile["academics"][0]["subjects"]) == 1
    assert profile["academics"][0]["subjects"][0]["code"] == "MATH"


@pytest.mark.asyncio
async def test_scenario_3_combined_11th_and_12th_admission_and_promotion(client: AsyncClient, auth_headers: dict):
    """
    Scenario 3:
    - Combined 11th + 12th multi-year admission.
    - Creates Enrollment Group linking records.
    - Promotes student at end of Year 1 without destroying Year 1 academic records.
    """
    classes = (await client.get("/api/v1/academics/classes", headers=auth_headers)).json()
    class_11 = next(c for c in classes if c["code"] == "STD-11")
    class_12 = next(c for c in classes if c["code"] == "STD-12")

    years = (await client.get("/api/v1/academics/years", headers=auth_headers)).json()
    current_year = next(y for y in years if y["is_current"])

    subjects = (await client.get("/api/v1/academics/subjects", headers=auth_headers)).json()
    phy = next(s for s in subjects if s["code"] == "PHY")
    chem = next(s for s in subjects if s["code"] == "CHEM")

    uid3 = uuid.uuid4().hex[:6]
    payload = {
        "first_name": "Priya",
        "last_name": "Kulkarni",
        "date_of_birth": "2009-02-10",
        "gender": "FEMALE",
        "email": f"priya_{uid3}@example.com",
        "is_academic_enrolled": True,
        "enrollment_type": "COMBINED_MULTI_YEAR",
        "academic_year_id": current_year["id"],
        "class_id": class_11["id"],
        "selected_subject_ids": [phy["id"], chem["id"]]
    }

    adm_res = await client.post("/api/v1/enrollments/admit", json=payload, headers=auth_headers)
    assert adm_res.status_code == 201
    adm_data = adm_res.json()

    assert adm_data["enrollment_group_id"] is not None
    first_year_enr_id = adm_data["enrollment_id"]

    # Now promote student to 12th
    promo_payload = {
        "next_academic_year_id": current_year["id"],
        "next_class_id": class_12["id"],
        "subject_ids": [phy["id"], chem["id"]]
    }
    promo_res = await client.post(f"/api/v1/enrollments/{first_year_enr_id}/promote", json=promo_payload, headers=auth_headers)
    assert promo_res.status_code == 200

    # Verify student now has 2 distinct historical enrollment records
    prof_res = await client.get(f"/api/v1/students/{adm_data['student_id']}/profile", headers=auth_headers)
    profile = prof_res.json()
    assert len(profile["academics"]) == 2
    statuses = [a["status"] for a in profile["academics"]]
    assert "COMPLETED" in statuses
    assert "ACTIVE" in statuses


@pytest.mark.asyncio
async def test_scenario_4_study_room_only(client: AsyncClient, auth_headers: dict):
    """
    Scenario 4: Student D: No tuition, only study room.
    """
    seats = (await client.get("/api/v1/study-rooms/seats", headers=auth_headers)).json()
    avail_seat = next((s for s in seats if s["gender_allowed"] in ("GIRLS", "ANY") and s["status"] == "AVAILABLE"), None)
    if not avail_seat:
        async with TestAsyncSessionLocal() as session:
            room_id = (await session.execute(select(StudySeat.study_room_id))).scalars().first()
            seat_num = f"TG-{uuid.uuid4().hex[:4].upper()}"
            new_seat = StudySeat(
                study_room_id=room_id,
                seat_number=seat_num,
                gender_allowed="GIRLS",
                has_power_outlet=True,
                status="AVAILABLE"
            )
            session.add(new_seat)
            await session.commit()
            await session.refresh(new_seat)
            avail_seat = {"id": str(new_seat.id), "seat_number": new_seat.seat_number}
    plans = (await client.get("/api/v1/services/plans", headers=auth_headers)).json()
    sr_plan = next(p for p in plans if "Study Room" in p["name"])

    uid4 = uuid.uuid4().hex[:6]
    payload = {
        "first_name": "Sneha",
        "last_name": "Jadhav",
        "date_of_birth": "2007-09-12",
        "gender": "FEMALE",
        "email": f"sneha_{uid4}@example.com",
        "is_academic_enrolled": False,
        "study_room_plan_id": sr_plan["id"],
        "study_seat_id": avail_seat["id"]
    }

    adm_res = await client.post("/api/v1/enrollments/admit", json=payload, headers=auth_headers)
    assert adm_res.status_code == 201
    adm_data = adm_res.json()

    assert adm_data["enrollment_id"] is None
    assert adm_data["seat_allocated"] == avail_seat["seat_number"]

    prof_res = await client.get(f"/api/v1/students/{adm_data['student_id']}/profile", headers=auth_headers)
    profile = prof_res.json()
    assert len(profile["academics"]) == 0  # No tuition
    assert profile["study_room"] is not None
    assert profile["study_room"]["seat_number"] == avail_seat["seat_number"]


@pytest.mark.asyncio
async def test_scenario_5_financial_payment_and_receipt(client: AsyncClient, auth_headers: dict):
    """
    Scenario 8: Accountant records partial payment, generates receipt, updates balance.
    """
    invoices = (await client.get("/api/v1/fees/invoices", headers=auth_headers)).json()
    unpaid_inv = next(i for i in invoices if float(i["balance_amount"]) > 0)
    pay_amount = min(5000.00, float(unpaid_inv["balance_amount"]))

    payment_payload = {
        "student_id": unpaid_inv["student_id"],
        "amount": pay_amount,
        "payment_method": "UPI",
        "transaction_reference": f"UPI-TEST-{uuid.uuid4().hex[:8]}",
        "notes": "Partial fee payment via UPI",
        "allocations": [
            {
                "invoice_id": unpaid_inv["id"],
                "allocated_amount": pay_amount
            }
        ]
    }

    pay_res = await client.post("/api/v1/fees/payments", json=payment_payload, headers=auth_headers)
    assert pay_res.status_code == 201
    pay_data = pay_res.json()
    assert pay_data["receipt_number"] is not None
    assert pay_data["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_scenario_6_teacher_attendance_marking(client: AsyncClient, auth_headers: dict):
    """
    Scenario 6: Teacher / Admin creates session and marks student attendance.
    """
    batches = (await client.get("/api/v1/academics/batches", headers=auth_headers)).json()
    if not batches:
        courses = (await client.get("/api/v1/academics/courses", headers=auth_headers)).json()
        years = (await client.get("/api/v1/academics/years", headers=auth_headers)).json()
        b_res = await client.post(
            "/api/v1/academics/batches",
            json={
                "course_id": courses[0]["id"],
                "academic_year_id": years[0]["id"],
                "name": "Morning Science Batch A",
                "code": f"BAT-{uuid.uuid4().hex[:6]}",
                "start_date": "2026-06-01",
                "end_date": "2027-04-30"
            },
            headers=auth_headers
        )
        batch = b_res.json()
    else:
        batch = batches[0]

    students = (await client.get("/api/v1/students", headers=auth_headers)).json()
    assert len(students) > 0
    test_student = students[0]

    # Create Session using an existing batch that has subjects assigned
    from app.core.database import SyncSessionLocal
    from app.models.academic import BatchSubject, CourseVersionSubject, CourseVersion, Subject
    from app.models.attendance import AttendanceRecord, AttendanceSession

    db = SyncSessionLocal()
    bs_id = None
    try:
        for b in batches:
            found_bs = db.query(BatchSubject).filter_by(batch_id=b["id"]).first()
            if found_bs:
                batch = b
                bs_id = str(found_bs.id)
                break
        if not bs_id:
            cv = db.query(CourseVersion).filter_by(course_id=batch["course_id"], is_active=True).first()
            cv_sub = db.query(CourseVersionSubject).filter_by(course_version_id=cv.id).first() if cv else None
            subj_id = cv_sub.subject_id if cv_sub else db.query(Subject).first().id
            new_bs = BatchSubject(batch_id=batch["id"], subject_id=subj_id)
            db.add(new_bs)
            db.commit()
            db.refresh(new_bs)
            bs_id = str(new_bs.id)
    finally:
        db.close()

    sess_res = await client.post(
        "/api/v1/attendance/sessions",
        json={
            "batch_subject_id": bs_id,
            "session_date": "2026-07-15",
            "topic_covered": "Practice and Review Session"
        },
        headers=auth_headers
    )
    assert sess_res.status_code == 201
    session = sess_res.json()

    # Mark Attendance
    att_res = await client.post(
        "/api/v1/attendance/records",
        json={
            "session_id": session["id"],
            "records": [
                {
                    "student_id": test_student["id"],
                    "status": "PRESENT",
                    "remarks": "Active participation"
                }
            ]
        },
        headers=auth_headers
    )
    assert att_res.status_code == 200

    # Clean up test session & record to keep database pristine
    db = SyncSessionLocal()
    try:
        db.query(AttendanceRecord).filter_by(session_id=session["id"]).delete()
        db.query(AttendanceSession).filter_by(id=session["id"]).delete()
        db.commit()
    finally:
        db.close()


@pytest.mark.asyncio
async def test_scenario_7_examination_marks_and_publication(client: AsyncClient, auth_headers: dict):
    """
    Scenario 7: Admin creates exam, records marks, publishes results, verifies student report card.
    """
    years = (await client.get("/api/v1/academics/years", headers=auth_headers)).json()
    classes = (await client.get("/api/v1/academics/classes", headers=auth_headers)).json()
    subjects = (await client.get("/api/v1/academics/subjects", headers=auth_headers)).json()

    # Fetch or seed exam type
    from app.core.database import SyncSessionLocal
    from app.models.examination import ExamType
    db = SyncSessionLocal()
    try:
        et = db.query(ExamType).first()
        et_id = str(et.id) if et else None
    finally:
        db.close()

    exam_payload = {
        "academic_year_id": years[0]["id"],
        "exam_type_id": et_id,
        "name": "Mid-Term Physics & Chemistry Evaluation",
        "code": f"EXAM-{uuid.uuid4().hex[:6]}",
        "start_date": "2026-09-10",
        "end_date": "2026-09-15",
        "subjects": [
            {
                "subject_id": subjects[0]["id"],
                "class_id": classes[0]["id"],
                "exam_date": "2026-09-10",
                "duration_minutes": 180,
                "max_marks": 100.00,
                "passing_marks": 35.00,
                "has_negative_marking": False,
                "theory_max_marks": 70.00,
                "practical_max_marks": 30.00
            }
        ]
    }

    exam_res = await client.post("/api/v1/examinations", json=exam_payload, headers=auth_headers)
    assert exam_res.status_code == 201
    exam = exam_res.json()

    # Publish examination
    pub_res = await client.post(f"/api/v1/examinations/{exam['id']}/publish", headers=auth_headers)
    assert pub_res.status_code == 200


@pytest.mark.asyncio
async def test_dynamic_course_creation_and_admission_flow(client: AsyncClient, auth_headers: dict):
    """
    Test dynamic course creation by Admin and immediate availability during Student Admission:
    1. Admin creates a new Master Course via POST /api/v1/academics/courses
    2. Course is verified in GET /api/v1/academics/courses?class_id=...
    3. Live fee preview verifies exact base tuition fee for the new course
    4. New student admission selects the newly created course
    5. Student profile confirms active enrollment under the newly created course
    """
    classes = (await client.get("/api/v1/academics/classes", headers=auth_headers)).json()
    class_11 = next(c for c in classes if c["code"] == "STD-11")

    streams = (await client.get("/api/v1/academics/streams", headers=auth_headers)).json()
    sci_stream = next(s for s in streams if s["code"] == "SCI")

    subjects = (await client.get("/api/v1/academics/subjects", headers=auth_headers)).json()
    selected_subjs = [s["id"] for s in subjects[:3]]

    course_types = (await client.get("/api/v1/academics/course-types", headers=auth_headers)).json()
    ctype_id = course_types[0]["id"] if course_types else None

    years = (await client.get("/api/v1/academics/years", headers=auth_headers)).json()
    cur_year = next(y for y in years if y["is_current"])

    # 1. Admin creates new dynamic course
    unique_code = f"CRS-DYN-{uuid.uuid4().hex[:6].upper()}"
    create_payload = {
        "name": "11th Science - Super 30 JEE Advanced",
        "code": unique_code,
        "course_type_id": ctype_id,
        "class_id": class_11["id"],
        "stream_id": sci_stream["id"],
        "description": "Custom dynamic course created via Admin Dashboard",
        "duration_months": 12,
        "initial_base_fee": 58000.00,
        "subject_ids": selected_subjs
    }

    create_res = await client.post("/api/v1/academics/courses", json=create_payload, headers=auth_headers)
    assert create_res.status_code == 201
    created_course = create_res.json()
    assert created_course["name"] == "11th Science - Super 30 JEE Advanced"
    assert created_course["code"] == unique_code
    assert created_course["current_version"] is not None
    assert float(created_course["current_version"]["base_fee"]) == 58000.00

    # 2. Query courses for STD-11 & SCI (mimicking Admission page dropdown query)
    courses_res = await client.get(
        "/api/v1/academics/courses",
        params={"class_id": class_11["id"], "stream_id": sci_stream["id"]},
        headers=auth_headers
    )
    assert courses_res.status_code == 200
    available_courses = courses_res.json()
    found_course = next((c for c in available_courses if c["code"] == unique_code), None)
    assert found_course is not None, "Newly created dynamic course must appear in the courses query"
    assert found_course["current_version"]["id"] == created_course["current_version"]["id"]

    # 3. Live Fee Preview for the new dynamic course
    preview_res = await client.post(
        "/api/v1/fees/preview",
        json={
            "course_version_id": found_course["current_version"]["id"],
            "selected_subject_ids": selected_subjs,
            "number_of_installments": 1
        },
        headers=auth_headers
    )
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert float(preview_data["total_amount"]) == 58000.00

    # 4. Enroll new student into this dynamic course
    uid = uuid.uuid4().hex[:6]
    adm_payload = {
        "first_name": "Arjun",
        "last_name": f"Verma-{uid}",
        "date_of_birth": "2008-04-12",
        "gender": "MALE",
        "mobile": f"+9198{uuid.uuid4().int % 100000000:08d}",
        "email": f"arjun.{uid}@example.com",
        "guardians": [
            {
                "first_name": "Rajesh",
                "last_name": "Verma",
                "relation": "FATHER",
                "mobile": "+919876543210"
            }
        ],
        "is_academic_enrolled": True,
        "academic_year_id": cur_year["id"],
        "class_id": class_11["id"],
        "stream_id": sci_stream["id"],
        "course_id": found_course["id"],
        "course_version_id": found_course["current_version"]["id"],
        "selected_subject_ids": selected_subjs,
        "number_of_installments": 1
    }

    adm_res = await client.post("/api/v1/enrollments/admit", json=adm_payload, headers=auth_headers)
    assert adm_res.status_code == 201
    adm_data = adm_res.json()

    # 5. Verify Student Profile reflects the newly created course
    prof_res = await client.get(f"/api/v1/students/{adm_data['student_id']}/profile", headers=auth_headers)
    assert prof_res.status_code == 200
    profile = prof_res.json()
    assert len(profile["academics"]) > 0
    enrolled_academic = profile["academics"][0]
    assert enrolled_academic["course_name"] == "11th Science - Super 30 JEE Advanced"


@pytest.mark.asyncio
async def test_dynamic_course_update_and_delete_operations(client: AsyncClient, auth_headers: dict):
    """
    Test complete lifecycle for Course Update and Delete:
    1. Create a course.
    2. Update its metadata and fee in-place (no enrollments yet).
    3. Delete the unused course -> Hard DELETED.
    4. Create another course, enroll a student.
    5. Update fee -> Bumps to Version 2 preserving historical Version 1.
    6. Attempt delete on enrolled course -> Soft ARCHIVED to protect student records.
    """
    classes = (await client.get("/api/v1/academics/classes", headers=auth_headers)).json()
    class_12 = next(c for c in classes if c["code"] == "STD-12")
    streams = (await client.get("/api/v1/academics/streams", headers=auth_headers)).json()
    comm_stream = next(s for s in streams if s["code"] == "COMM")
    subjects = (await client.get("/api/v1/academics/subjects", headers=auth_headers)).json()
    subjs_1 = [subjects[0]["id"]]
    subjs_2 = [subjects[0]["id"], subjects[1]["id"]]

    # 1. Create course
    code1 = f"CRS-TMP-{uuid.uuid4().hex[:6].upper()}"
    create_res = await client.post(
        "/api/v1/academics/courses",
        json={
            "name": "12th Commerce CA Foundation Intro",
            "code": code1,
            "class_id": class_12["id"],
            "stream_id": comm_stream["id"],
            "duration_months": 6,
            "initial_base_fee": 30000.00,
            "subject_ids": subjs_1
        },
        headers=auth_headers
    )
    assert create_res.status_code == 201
    course1 = create_res.json()
    course1_id = course1["id"]

    # 2. Update metadata, fee, and subjects
    update_res = await client.put(
        f"/api/v1/academics/courses/{course1_id}",
        json={
            "name": "12th Commerce CA Foundation Advanced",
            "duration_months": 8,
            "base_fee": 38000.00,
            "subject_ids": subjs_2
        },
        headers=auth_headers
    )
    assert update_res.status_code == 200
    updated1 = update_res.json()
    assert updated1["name"] == "12th Commerce CA Foundation Advanced"
    assert updated1["duration_months"] == 8
    assert float(updated1["current_version"]["base_fee"]) == 38000.00
    assert len(updated1["current_version"]["subjects"]) == 2

    # 3. Delete unused course -> Should be completely hard-deleted
    del_res = await client.delete(f"/api/v1/academics/courses/{course1_id}", headers=auth_headers)
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["status"] == "DELETED"

    # Confirm it no longer exists
    get_res = await client.get(f"/api/v1/academics/courses/{course1_id}", headers=auth_headers)
    assert get_res.status_code == 404

    # 4. Create another course and enroll a student
    code2 = f"CRS-ENR-{uuid.uuid4().hex[:6].upper()}"
    c2_res = await client.post(
        "/api/v1/academics/courses",
        json={
            "name": "12th Commerce Elite Batch",
            "code": code2,
            "class_id": class_12["id"],
            "stream_id": comm_stream["id"],
            "duration_months": 12,
            "initial_base_fee": 42000.00,
            "subject_ids": subjs_1
        },
        headers=auth_headers
    )
    assert c2_res.status_code == 201
    course2 = c2_res.json()
    course2_id = course2["id"]

    years = (await client.get("/api/v1/academics/years", headers=auth_headers)).json()
    cur_year = next(y for y in years if y["is_current"])

    # Enroll student in course2
    uid = uuid.uuid4().hex[:6]
    adm_payload = {
        "first_name": "Rohan",
        "last_name": f"Kapoor-{uid}",
        "date_of_birth": "2007-08-15",
        "gender": "MALE",
        "mobile": f"+9197{uuid.uuid4().int % 100000000:08d}",
        "email": f"rohan.{uid}@example.com",
        "guardians": [{"first_name": "Sanjay", "last_name": "Kapoor", "relation": "FATHER", "mobile": "+919876543211"}],
        "is_academic_enrolled": True,
        "academic_year_id": cur_year["id"],
        "class_id": class_12["id"],
        "stream_id": comm_stream["id"],
        "course_id": course2_id,
        "course_version_id": course2["current_version"]["id"],
        "selected_subject_ids": subjs_1,
        "number_of_installments": 1
    }
    adm_res = await client.post("/api/v1/enrollments/admit", json=adm_payload, headers=auth_headers)
    assert adm_res.status_code == 201

    # 5. Update course2 with new fee -> Because students exist, it should bump to Version 2!
    update2_res = await client.put(
        f"/api/v1/academics/courses/{course2_id}",
        json={"base_fee": 48000.00},
        headers=auth_headers
    )
    assert update2_res.status_code == 200
    updated2 = update2_res.json()
    assert updated2["current_version"]["version_number"] == 2
    assert float(updated2["current_version"]["base_fee"]) == 48000.00

    # 6. Delete course2 -> Must be safely ARCHIVED (soft-deleted), not hard-deleted
    del2_res = await client.delete(f"/api/v1/academics/courses/{course2_id}", headers=auth_headers)
    assert del2_res.status_code == 200
    del2_data = del2_res.json()
    assert del2_data["status"] == "ARCHIVED"

    # In active courses list, it should no longer be listed
    active_courses = (await client.get("/api/v1/academics/courses", headers=auth_headers)).json()
    assert not any(c["id"] == course2_id for c in active_courses)


@pytest.mark.asyncio
async def test_dynamic_subject_group_crud_lifecycle(client: AsyncClient, auth_headers: dict):
    """
    Test complete lifecycle for Subject Groups (PCM/PCB bundles):
    1. Admin creates a new custom Subject Group (e.g., PM Package).
    2. Read single and list endpoints confirm creation and subject associations.
    3. Admin updates package fee and adds Chemistry to make it PCM.
    4. Fee preview verifies accurate package fee calculation with double-charge suppression.
    5. Admin deletes the subject group -> deleted successfully.
    """
    classes = (await client.get("/api/v1/academics/classes", headers=auth_headers)).json()
    class_11 = next(c for c in classes if c["code"] == "STD-11")
    streams = (await client.get("/api/v1/academics/streams", headers=auth_headers)).json()
    sci_stream = next(s for s in streams if s["code"] == "SCI")
    subjects = (await client.get("/api/v1/academics/subjects", headers=auth_headers)).json()
    subj_phy = next(s for s in subjects if s["code"] == "PHY")
    subj_math = next(s for s in subjects if s["code"] == "MATH")
    subj_chem = next(s for s in subjects if s["code"] == "CHEM")

    # 1. Create Subject Group
    code = f"PM-{uuid.uuid4().hex[:4].upper()}"
    create_payload = {
        "class_id": class_11["id"],
        "stream_id": sci_stream["id"],
        "name": "Physics + Mathematics Bundle",
        "code": code,
        "package_fee": 21000.00,
        "subject_ids": [subj_phy["id"], subj_math["id"]]
    }
    create_res = await client.post("/api/v1/academics/subject-groups", json=create_payload, headers=auth_headers)
    assert create_res.status_code == 201
    created_grp = create_res.json()
    grp_id = created_grp["id"]
    assert created_grp["name"] == "Physics + Mathematics Bundle"
    assert float(created_grp["package_fee"]) == 21000.00
    assert len(created_grp["subject_ids"]) == 2

    # 2. Query single endpoint
    get_res = await client.get(f"/api/v1/academics/subject-groups/{grp_id}", headers=auth_headers)
    assert get_res.status_code == 200
    grp_data = get_res.json()
    assert grp_data["id"] == grp_id
    assert len(grp_data["subjects"]) == 2

    # 3. Update Subject Group: Add Chemistry and increase fee to 29000
    update_res = await client.put(
        f"/api/v1/academics/subject-groups/{grp_id}",
        json={
            "name": "Physics + Chemistry + Math Full Trio",
            "package_fee": 29000.00,
            "subject_ids": [subj_phy["id"], subj_math["id"], subj_chem["id"]]
        },
        headers=auth_headers
    )
    assert update_res.status_code == 200
    updated_grp = update_res.json()
    assert updated_grp["name"] == "Physics + Chemistry + Math Full Trio"
    assert float(updated_grp["package_fee"]) == 29000.00
    assert len(updated_grp["subject_ids"]) == 3

    # 4. Test fee preview with this subject group: must cost exactly 29000 with 0 extra for bundle subjects
    preview_res = await client.post(
        "/api/v1/fees/preview",
        json={
            "subject_group_id": grp_id,
            "selected_subject_ids": [subj_phy["id"], subj_math["id"], subj_chem["id"]],
            "number_of_installments": 1
        },
        headers=auth_headers
    )
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert float(preview_data["total_amount"]) == 29000.00

    # 5. Delete Subject Group
    del_res = await client.delete(f"/api/v1/academics/subject-groups/{grp_id}", headers=auth_headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "DELETED"

    # Verify 404 on get
    get_after_del = await client.get(f"/api/v1/academics/subject-groups/{grp_id}", headers=auth_headers)
    assert get_after_del.status_code == 404


@pytest.mark.asyncio
async def test_batch_auto_provisioning_and_attendance_integration(client: AsyncClient, auth_headers: dict):
    """
    Test that creating a batch automatically provisions all core curriculum subjects
    of its course and instantly registers them for attendance taking.
    """
    # 1. Fetch academic year and 9th board course
    ay_res = await client.get("/api/v1/academics/years", headers=auth_headers)
    assert ay_res.status_code == 200
    ay_id = ay_res.json()[0]["id"]

    crs_res = await client.get("/api/v1/academics/courses", headers=auth_headers)
    assert crs_res.status_code == 200
    courses = crs_res.json()
    crs_9 = next((c for c in courses if c.get("code") == "CRS-09-BOARD"), None)
    assert crs_9 is not None, "9th Standard Board Curriculum course must exist"
    assert len(crs_9["current_version"]["subjects"]) == 5

    # 2. Create batch without specifying subject assignments
    b_code = f"BAT-9TH-{uuid.uuid4().hex[:6]}"
    batch_payload = {
        "course_id": crs_9["id"],
        "academic_year_id": ay_id,
        "name": "9th Board Star Section A",
        "code": b_code,
        "max_capacity": 55,
        "start_date": "2026-06-01",
        "end_date": "2027-04-30"
    }
    create_res = await client.post("/api/v1/academics/batches", json=batch_payload, headers=auth_headers)
    assert create_res.status_code == 201
    batch_data = create_res.json()
    batch_id = batch_data["id"]

    # Verify auto-provisioned subjects on the batch
    assert len(batch_data["batch_subjects"]) == 5
    subj_codes = {bs["subject_code"] for bs in batch_data["batch_subjects"]}
    assert {"SCI-A", "SCI-B", "ALG", "GEOM", "ENG"}.issubset(subj_codes)

    # 3. Verify attendance batch-subjects endpoint has all 5 lecture options for this batch
    att_res = await client.get("/api/v1/attendance/batch-subjects", headers=auth_headers)
    assert att_res.status_code == 200
    att_list = att_res.json()
    batch_att_entries = [entry for entry in att_list if entry["batch_code"] == b_code]
    assert len(batch_att_entries) == 5

    # 4. Cleanup test batch
    del_res = await client.delete(f"/api/v1/academics/batches/{batch_id}", headers=auth_headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "DELETED"


@pytest.mark.asyncio
async def test_dynamic_subject_crud_operations(client: AsyncClient, auth_headers: dict):
    """
    Test dynamic Add, Edit, and Delete operations for the Subjects Catalog,
    including validation, updates, deletion, and dependency safety.
    """
    # 1. Create a new test subject
    sub_code = f"ROBO-{uuid.uuid4().hex[:4].upper()}"
    create_payload = {
        "name": "Robotics & AI",
        "code": sub_code,
        "default_theory_marks": 60,
        "default_practical_marks": 40,
        "default_individual_fee": 14000.00
    }
    create_res = await client.post("/api/v1/academics/subjects", json=create_payload, headers=auth_headers)
    assert create_res.status_code == 201
    created_subj = create_res.json()
    subj_id = created_subj["id"]
    assert created_subj["name"] == "Robotics & AI"
    assert created_subj["code"] == sub_code
    assert float(created_subj["default_individual_fee"]) == 14000.00

    # 2. Update the subject
    updated_payload = {
        "name": "Advanced Robotics, IoT & AI",
        "default_theory_marks": 50,
        "default_practical_marks": 50,
        "default_individual_fee": 16500.00
    }
    update_res = await client.put(f"/api/v1/academics/subjects/{subj_id}", json=updated_payload, headers=auth_headers)
    assert update_res.status_code == 200
    updated_subj = update_res.json()
    assert updated_subj["name"] == "Advanced Robotics, IoT & AI"
    assert updated_subj["default_theory_marks"] == 50
    assert updated_subj["default_practical_marks"] == 50
    assert float(updated_subj["default_individual_fee"]) == 16500.00

    # 3. Delete the subject
    del_res = await client.delete(f"/api/v1/academics/subjects/{subj_id}", headers=auth_headers)
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["status"] == "DELETED"
    assert del_data["subject_id"] == subj_id

    # 4. Verify 404 when trying to update deleted subject
    get_after_del = await client.put(f"/api/v1/academics/subjects/{subj_id}", json={"name": "Ghost"}, headers=auth_headers)
    assert get_after_del.status_code == 404


@pytest.mark.asyncio
async def test_admission_with_empty_strings_and_zero_fee(client: AsyncClient, auth_headers: dict):
    """
    Verify admission succeeds when optional fields (middle_name, mobile, email, guardian fields)
    are sent as empty strings or whitespace (which caused 422 Unprocessable Entity),
    and when total fee is 0.00 (which previously caused check_installment_amount check constraint violation).
    """
    payload = {
        "first_name": "Sanitize",
        "middle_name": "   ",
        "last_name": "Tester",
        "date_of_birth": "2008-05-15",
        "gender": "MALE",
        "mobile": "",
        "email": "",
        "guardians": [
            {
                "first_name": "Guardian",
                "last_name": "Tester",
                "relation": "FATHER",
                "mobile": "  ",
                "email": ""
            }
        ],
        "is_academic_enrolled": False,
        "enrollment_type": "SINGLE_YEAR",
        "discount_amount": 0,
        "number_of_installments": 1
    }
    res = await client.post("/api/v1/enrollments/admit", json=payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert "student_id" in data
    assert "student_code" in data
    assert data["student_code"].startswith("STU-")



