import uuid
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import get_password_hash
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.student import (
    Student, Guardian, StudentGuardian, StudentDocument,
    StudentUserAccount, GuardianUserAccount
)
from app.models.academic import BatchStudent, BatchSubject, Batch, Subject, Teacher, Course, CourseVersion, CourseVersionSubject
from app.models.enrollment import Enrollment, EnrollmentSubject
from app.models.service import StudentService, ServicePlan, ServiceType
from app.models.fee import Invoice, Payment, InstallmentPlan, PaymentAllocation, Receipt, InvoiceItem, Installment
from app.models.hostel import BedAllocation, HostelBed, HostelRoom
from app.models.study_room import SeatAllocation, StudySeat
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.examination import ExamMarks, ExamSubject, Examination, ExamResult
from app.modules.students.schemas import (
    StudentCreate, StudentUpdate, StudentListResponse, StudentProfileResponse,
    GuardianCreate, GuardianResponse, GuardianResponseItem,
    ResetPasswordTarget, ResetPasswordToDobRequest, ResetPasswordToDobResponse
)
from app.modules.students.service import generate_student_code_and_prn

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=List[StudentListResponse])
async def list_students(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    gender_filter: Optional[str] = None,
    academic_year_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Student)
    if academic_year_id:
        stmt = (
            stmt
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(Enrollment.academic_year_id == academic_year_id)
            .distinct()
        )
        count_stmt = (
            select(func.count(func.distinct(Student.id)))
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(Enrollment.academic_year_id == academic_year_id)
        )
    else:
        count_stmt = select(func.count(Student.id))

    if search:
        term = f"%{search}%"
        search_filter = or_(
            Student.first_name.ilike(term),
            Student.last_name.ilike(term),
            Student.student_code.ilike(term),
            Student.prn.ilike(term),
            Student.email.ilike(term),
            Student.mobile.ilike(term)
        )
        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    if status_filter:
        stmt = stmt.where(Student.status == status_filter)
        count_stmt = count_stmt.where(Student.status == status_filter)

    if gender_filter:
        stmt = stmt.where(Student.gender == gender_filter)
        count_stmt = count_stmt.where(Student.gender == gender_filter)

    total_count = (await db.execute(count_stmt)).scalar() or 0
    response.headers["X-Total-Count"] = str(total_count)

    stmt = (
        stmt
        .options(
            selectinload(Student.enrollments).selectinload(Enrollment.academic_class),
            selectinload(Student.enrollments).selectinload(Enrollment.course),
            selectinload(Student.enrollments).selectinload(Enrollment.batch),
            selectinload(Student.guardians).selectinload(StudentGuardian.guardian),
        )
        .offset(skip)
        .limit(limit)
        .order_by(Student.created_at.desc())
    )
    result = await db.execute(stmt)
    students = result.scalars().all()

    return [_build_student_list_response(s, academic_year_id) for s in students]


def _build_student_list_response(s: Student, academic_year_id: Optional[uuid.UUID] = None) -> StudentListResponse:
    target_enr = None
    if academic_year_id:
        target_enr = next((e for e in (s.enrollments or []) if e.academic_year_id == academic_year_id), None)
    if not target_enr and s.enrollments:
        target_enr = next((e for e in s.enrollments if e.status == "ACTIVE"), s.enrollments[0])

    primary_sg = next((sg for sg in (s.guardians or []) if sg.is_primary), (s.guardians[0] if s.guardians else None))
    g_obj = primary_sg.guardian if (primary_sg and primary_sg.guardian) else None

    g_list = [
        GuardianResponseItem(
            id=sg.guardian.id,
            first_name=sg.guardian.first_name,
            last_name=sg.guardian.last_name,
            relation=sg.guardian.relation,
            mobile=sg.guardian.mobile,
            email=sg.guardian.email,
            occupation=sg.guardian.occupation,
            address=sg.guardian.address,
            is_primary=sg.is_primary,
            receives_notifications=sg.receives_notifications
        )
        for sg in (s.guardians or []) if sg.guardian
    ]

    return StudentListResponse(
        id=s.id,
        student_code=s.student_code,
        prn=s.prn,
        first_name=s.first_name,
        middle_name=s.middle_name,
        last_name=s.last_name,
        date_of_birth=s.date_of_birth,
        gender=s.gender,
        mobile=s.mobile,
        email=s.email,
        status=s.status,
        admission_date=s.admission_date,
        blood_group=s.blood_group,
        institution_type=s.institution_type,
        school_college_name=s.school_college_name,
        education_board=s.education_board,
        previous_percentage=float(s.previous_percentage) if s.previous_percentage is not None else None,
        aadhar_number=s.aadhar_number,
        category=s.category,
        village=s.village,
        taluka=s.taluka,
        district=s.district,
        address_line1=s.address_line1,
        address_line2=s.address_line2,
        city=s.city,
        state=s.state,
        pincode=s.pincode,
        emergency_contact_name=s.emergency_contact_name,
        emergency_contact_phone=s.emergency_contact_phone,
        emergency_contact_relation=s.emergency_contact_relation,
        guardian_name=f"{g_obj.first_name} {g_obj.last_name}".strip() if g_obj else None,
        guardian_relation=g_obj.relation if g_obj else None,
        guardian_mobile=g_obj.mobile if g_obj else None,
        guardian_email=g_obj.email if g_obj else None,
        guardian_occupation=g_obj.occupation if g_obj else None,
        guardians=g_list,
        enrollment_status=target_enr.status if target_enr else s.status,
        promotion_status=target_enr.promotion_status if target_enr else None,
        class_name=target_enr.academic_class.name if target_enr and target_enr.academic_class else None,
        course_name=target_enr.course.name if target_enr and target_enr.course else None,
        batch_name=target_enr.batch.name if target_enr and target_enr.batch else None,
    )


@router.post("", response_model=StudentListResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    data: StudentCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    # Generate collision-free sequential student code and 12-digit numeric PRN (YYYYDDMMNNNN)
    generated_code, generated_prn = await generate_student_code_and_prn(
        db,
        year=data.admission_date.year if data.admission_date else 2026,
        admission_date=data.admission_date or date.today()
    )
    student_code = generated_code
    prn_number = data.prn or generated_prn

    student = Student(
        institute_id=current_user.institute_id,
        student_code=student_code,
        prn=prn_number,
        first_name=data.first_name,
        middle_name=data.middle_name,
        last_name=data.last_name,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        blood_group=data.blood_group,
        mobile=data.mobile,
        email=data.email,
        village=data.village or data.city,
        taluka=data.taluka,
        district=data.district or data.city or "Kolhapur",
        address_line1=data.address_line1,
        address_line2=data.address_line2,
        city=data.city,
        state=data.state,
        pincode=data.pincode,
        institution_type=data.institution_type or "SCHOOL",
        school_college_name=data.school_college_name,
        education_board=data.education_board,
        previous_percentage=data.previous_percentage,
        aadhar_number=data.aadhar_number,
        category=data.category or "GENERAL",
        admission_date=data.admission_date or date.today(),
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone,
        emergency_contact_relation=data.emergency_contact_relation,
        status="ACTIVE"
    )
    db.add(student)
    await db.flush()

    if data.guardians:
        for g_data in data.guardians:
            guardian = Guardian(
                institute_id=current_user.institute_id,
                first_name=g_data.first_name,
                last_name=g_data.last_name,
                relation=g_data.relation,
                mobile=g_data.mobile,
                email=g_data.email,
                occupation=g_data.occupation,
                address=g_data.address
            )
            db.add(guardian)
            await db.flush()

            sg = StudentGuardian(
                student_id=student.id,
                guardian_id=guardian.id,
                is_primary=g_data.is_primary,
                can_pickup=True,
                receives_notifications=True
            )
            db.add(sg)

    await db.commit()
    await db.refresh(student)
    await cache_service.delete(CacheKeys.student_profile(student.id))
    await cache_service.delete(CacheKeys.dashboard_metrics())
    return student


@router.get("/{student_id}/profile", response_model=StudentProfileResponse)
async def get_student_profile(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns complete multi-tab student profile across all modules.
    Cached for 300 seconds with active write-invalidation.
    """
    cache_key = CacheKeys.student_profile(student_id)
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached

    student = await db.get(Student, student_id)
    if not student:
        raise NotFoundException("Student not found")

    # 1. Overview Tab
    guardians_stmt = select(StudentGuardian).options(selectinload(StudentGuardian.guardian)).where(StudentGuardian.student_id == student_id)
    guardians_res = (await db.execute(guardians_stmt)).scalars().all()
    guardians_list = [
        {
            "id": str(sg.guardian.id),
            "name": f"{sg.guardian.first_name} {sg.guardian.last_name}",
            "relation": sg.guardian.relation,
            "mobile": sg.guardian.mobile,
            "is_primary": sg.is_primary
        } for sg in guardians_res
    ]

    # Query active batch and roll number (prioritizing core standard classroom batch over elective skill courses)
    batch_stmt = (
        select(BatchStudent)
        .options(selectinload(BatchStudent.batch).selectinload(Batch.course))
        .where(BatchStudent.student_id == student_id, BatchStudent.status == "ACTIVE")
        .order_by(BatchStudent.created_at.desc())
    )
    batch_students = (await db.execute(batch_stmt)).scalars().all()
    core_bs = [bs for bs in batch_students if bs.batch and bs.batch.course and not bs.batch.course.is_universal]
    active_bs = core_bs[0] if core_bs else (batch_students[0] if batch_students else None)

    overview = {
        "id": str(student.id),
        "student_code": student.student_code,
        "prn": student.prn or student.student_code.replace("STU-", "PRN-"),
        "first_name": student.first_name,
        "middle_name": student.middle_name,
        "last_name": student.last_name,
        "gender": student.gender,
        "date_of_birth": student.date_of_birth.isoformat(),
        "blood_group": student.blood_group,
        "mobile": student.mobile,
        "email": student.email,
        "institution_type": student.institution_type or "SCHOOL",
        "school_college_name": student.school_college_name,
        "education_board": student.education_board,
        "previous_percentage": float(student.previous_percentage) if student.previous_percentage is not None else None,
        "aadhar_number": student.aadhar_number,
        "category": student.category,
        "village": student.village,
        "taluka": student.taluka,
        "district": student.district,
        "address": (
            f"{student.village or ''}, Tal. {student.taluka or ''}, Dist. {student.district or ''}".strip(', ')
            if (student.village or student.taluka or student.district)
            else f"{student.address_line1 or ''} {student.city or ''} {student.state or ''} {student.pincode or ''}".strip()
        ),
        "address_line1": student.address_line1,
        "address_line2": student.address_line2,
        "city": student.city,
        "state": student.state,
        "pincode": student.pincode,
        "emergency_contact_name": student.emergency_contact_name,
        "emergency_contact_phone": student.emergency_contact_phone,
        "emergency_contact_relation": student.emergency_contact_relation,
        "admission_date": student.admission_date.isoformat(),
        "status": student.status,
        "trial_end_date": student.trial_end_date.isoformat() if student.trial_end_date else None,
        "trial_form_fee_paid": student.trial_form_fee_paid,
        "trial_receipt_number": student.trial_receipt_number,
        "batch_id": str(active_bs.batch.id) if active_bs and active_bs.batch else None,
        "batch_name": active_bs.batch.name if active_bs and active_bs.batch else None,
        "division": active_bs.batch.division if active_bs and active_bs.batch else None,
        "roll_number": active_bs.roll_number if active_bs else None,
        "batch_start_date": active_bs.batch.start_date.isoformat() if active_bs and active_bs.batch and active_bs.batch.start_date else None,
        "batch_end_date": active_bs.batch.end_date.isoformat() if active_bs and active_bs.batch and active_bs.batch.end_date else None,
        "batch_is_active": active_bs.batch.is_active if active_bs and active_bs.batch else True,
        "guardians": guardians_list
    }

    # 2. Academics & Enrollments Tab
    enrollments_stmt = (
        select(Enrollment)
        .options(
            selectinload(Enrollment.academic_year),
            selectinload(Enrollment.academic_class),
            selectinload(Enrollment.stream),
            selectinload(Enrollment.batch),
            selectinload(Enrollment.course).selectinload(Course.versions).selectinload(CourseVersion.version_subjects).selectinload(CourseVersionSubject.subject),
            selectinload(Enrollment.enrollment_group),
            selectinload(Enrollment.enrolled_subjects).selectinload(EnrollmentSubject.subject)
        )
        .where(Enrollment.student_id == student_id)
        .order_by(Enrollment.created_at.desc())
    )
    enrollments_res = (await db.execute(enrollments_stmt)).scalars().all()
    academics = []
    for enr in enrollments_res:
        subjs = [{"id": str(es.subject.id), "name": es.subject.name, "code": es.subject.code} for es in enr.enrolled_subjects]
        if not subjs and enr.course and enr.course.versions:
            active_v = next((v for v in enr.course.versions if v.is_active), enr.course.versions[-1])
            if active_v and active_v.version_subjects:
                subjs = [{"id": str(vs.subject.id), "name": vs.subject.name, "code": vs.subject.code} for vs in active_v.version_subjects if vs.subject]

        academics.append({
            "enrollment_id": str(enr.id),
            "enrollment_group_id": str(enr.enrollment_group_id) if enr.enrollment_group_id else None,
            "enrollment_type": enr.enrollment_group.enrollment_type if enr.enrollment_group else "SINGLE_YEAR",
            "group_remarks": enr.enrollment_group.remarks if enr.enrollment_group else None,
            "academic_year": enr.academic_year.name if enr.academic_year else None,
            "start_date": enr.academic_year.start_date.isoformat() if enr.academic_year and enr.academic_year.start_date else None,
            "end_date": enr.academic_year.end_date.isoformat() if enr.academic_year and enr.academic_year.end_date else None,
            "enrollment_date": enr.enrollment_date.isoformat() if enr.enrollment_date else None,
            "class_name": enr.academic_class.name if enr.academic_class else None,
            "stream_name": enr.stream.name if enr.stream else None,
            "course_name": enr.course.name if enr.course else None,
            "course_code": enr.course.code if enr.course else None,
            "batch_name": enr.batch.name if enr.batch else None,
            "batch_code": enr.batch.code if enr.batch else None,
            "division": enr.batch.division if enr.batch else None,
            "is_universal": enr.course.is_universal if enr.course else False,
            "status": enr.status,
            "promotion_status": enr.promotion_status,
            "subjects": subjs
        })

    # Prioritize core academic curriculum courses over elective / universal skill courses
    academics.sort(key=lambda x: (1 if x.get("is_universal") else 0))

    # 3. Services Subscriptions Tab
    services_stmt = (
        select(StudentService)
        .options(selectinload(StudentService.service_plan).selectinload(ServicePlan.service_type))
        .where(StudentService.student_id == student_id)
    )
    services_res = (await db.execute(services_stmt)).scalars().all()
    services_list = []
    for s in services_res:
        st_code = s.service_plan.service_type.code if (s.service_plan and s.service_plan.service_type) else None
        if st_code == "TUITION":
            continue
        services_list.append({
            "id": str(s.id),
            "service_type": st_code,
            "plan_name": s.service_plan.name if s.service_plan else None,
            "billing_frequency": s.billing_frequency,
            "unit_price": float(s.unit_price),
            "start_date": s.start_date.isoformat(),
            "end_date": s.end_date.isoformat(),
            "status": s.status
        })

    # 4. Hostel Tab
    hostel_stmt = (
        select(BedAllocation)
        .options(selectinload(BedAllocation.hostel_bed).selectinload(HostelBed.room))
        .where(BedAllocation.student_id == student_id, BedAllocation.status == "ACTIVE")
    )
    active_bed = (await db.execute(hostel_stmt)).scalar_one_or_none()
    hostel_data = None
    if active_bed and active_bed.hostel_bed:
        hostel_data = {
            "bed_id": str(active_bed.hostel_bed.id),
            "bed_number": active_bed.hostel_bed.bed_number,
            "room_number": active_bed.hostel_bed.room.room_number if active_bed.hostel_bed.room else None,
            "start_date": active_bed.start_date.isoformat(),
            "end_date": active_bed.end_date.isoformat(),
            "status": active_bed.status
        }

    # 5. Study Room Tab
    seat_stmt = (
        select(SeatAllocation)
        .options(selectinload(SeatAllocation.study_seat))
        .where(SeatAllocation.student_id == student_id, SeatAllocation.status == "ACTIVE")
    )
    active_seat = (await db.execute(seat_stmt)).scalar_one_or_none()
    study_room_data = None
    if active_seat and active_seat.study_seat:
        study_room_data = {
            "seat_id": str(active_seat.study_seat.id),
            "seat_number": active_seat.study_seat.seat_number,
            "gender_allowed": active_seat.study_seat.gender_allowed,
            "has_power_outlet": active_seat.study_seat.has_power_outlet,
            "start_date": active_seat.start_date.isoformat(),
            "end_date": active_seat.end_date.isoformat(),
            "status": active_seat.status
        }

    # 6. Fees / Invoices Tab
    inv_stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments),
            selectinload(Invoice.items)
        )
        .where(Invoice.student_id == student_id)
        .order_by(Invoice.created_at.desc())
    )
    invoices_res = (await db.execute(inv_stmt)).scalars().all()
    fees_list = [
        {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "issue_date": inv.issue_date.isoformat(),
            "due_date": inv.due_date.isoformat(),
            "total_amount": float(inv.total_amount),
            "paid_amount": float(inv.paid_amount),
            "balance_amount": float(inv.balance_amount),
            "status": inv.status,
            "items": [
                {
                    "description": it.description,
                    "amount": float(it.total_amount)
                } for it in (inv.items or [])
            ],
            "installments": [
                {
                    "id": str(inst.id),
                    "installment_number": inst.installment_number,
                    "due_date": inst.due_date.isoformat(),
                    "amount": float(inst.amount),
                    "paid_amount": float(inst.paid_amount),
                    "status": inst.status
                } for inst in (sorted(inv.installment_plan.installments, key=lambda x: x.installment_number) if inv.installment_plan and inv.installment_plan.installments else [])
            ]
        } for inv in invoices_res
    ]

    # 7. Payments Tab
    pay_stmt = select(Payment).where(Payment.student_id == student_id).order_by(Payment.created_at.desc())
    payments_res = (await db.execute(pay_stmt)).scalars().all()
    payments_list = [
        {
            "id": str(p.id),
            "payment_number": p.payment_number,
            "amount": float(p.amount),
            "payment_method": p.payment_method,
            "payment_date": p.payment_date.isoformat(),
            "status": p.status
        } for p in payments_res
    ]

    # 8. Attendance Tab
    att_stmt = (
        select(AttendanceRecord)
        .outerjoin(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
        .options(
            selectinload(AttendanceRecord.session)
            .selectinload(AttendanceSession.batch_subject)
            .selectinload(BatchSubject.subject),
            selectinload(AttendanceRecord.session)
            .selectinload(AttendanceSession.batch_subject)
            .selectinload(BatchSubject.batch),
            selectinload(AttendanceRecord.session)
            .selectinload(AttendanceSession.teacher)
        )
        .where(AttendanceRecord.student_id == student_id)
        .order_by(AttendanceSession.session_date.desc().nulls_last(), AttendanceRecord.marked_at.desc())
    )
    att_records = (await db.execute(att_stmt)).scalars().all()
    total_sessions = len(att_records)
    present_count = sum(1 for r in att_records if r.status == "PRESENT")
    absent_count = sum(1 for r in att_records if r.status == "ABSENT")
    late_count = sum(1 for r in att_records if r.status == "LATE")
    excused_count = sum(1 for r in att_records if r.status == "EXCUSED_LEAVE")
    attended_count = present_count + late_count
    att_percent = round((attended_count / total_sessions * 100), 1) if total_sessions > 0 else 100.0

    subject_stats = {}
    records_list = []
    for r in att_records:
        sess = r.session
        bs = sess.batch_subject if sess else None
        subj_name = bs.subject.name if bs and bs.subject else "General Lecture"
        subj_code = bs.subject.code if bs and bs.subject else ""
        batch_name = bs.batch.name if bs and bs.batch else ""
        topic = sess.topic_covered if sess else ""
        sess_date = sess.session_date.isoformat() if sess and sess.session_date else r.marked_at.date().isoformat()
        t_name = f"{sess.teacher.first_name} {sess.teacher.last_name}" if sess and sess.teacher else None

        if subj_name not in subject_stats:
            subject_stats[subj_name] = {"subject_name": subj_name, "total": 0, "present": 0, "absent": 0, "late": 0}
        subject_stats[subj_name]["total"] += 1
        if r.status in ("PRESENT", "LATE"):
            subject_stats[subj_name]["present"] += 1
        if r.status == "ABSENT":
            subject_stats[subj_name]["absent"] += 1
        if r.status == "LATE":
            subject_stats[subj_name]["late"] += 1

        records_list.append({
            "id": str(r.id),
            "session_id": str(sess.id) if sess else None,
            "date": sess_date,
            "start_time": sess.start_time.isoformat() if sess and sess.start_time else None,
            "end_time": sess.end_time.isoformat() if sess and sess.end_time else None,
            "subject_name": subj_name,
            "subject_code": subj_code,
            "batch_name": batch_name,
            "topic_covered": topic or "Regular Lecture",
            "status": r.status,
            "remarks": r.remarks,
            "teacher_name": t_name,
            "marked_at": r.marked_at.isoformat() if r.marked_at else None
        })

    subject_breakdown = []
    for s_name, s_data in subject_stats.items():
        s_pct = round((s_data["present"] / s_data["total"] * 100), 1) if s_data["total"] > 0 else 100.0
        subject_breakdown.append({
            "subject_name": s_name,
            "total_sessions": s_data["total"],
            "present_sessions": s_data["present"],
            "absent_sessions": s_data["absent"],
            "late_sessions": s_data["late"],
            "percentage": s_pct
        })
    subject_breakdown.sort(key=lambda x: x["subject_name"])

    attendance_data = {
        "total_sessions": total_sessions,
        "present_sessions": present_count,
        "attended_sessions": attended_count,
        "absent_sessions": absent_count,
        "late_sessions": late_count,
        "excused_sessions": excused_count,
        "attendance_percentage": att_percent,
        "subject_breakdown": subject_breakdown,
        "records": records_list
    }

    # 9. Examinations Tab
    marks_stmt = (
        select(ExamMarks)
        .options(
            selectinload(ExamMarks.exam_subject).selectinload(ExamSubject.examination),
            selectinload(ExamMarks.exam_subject).selectinload(ExamSubject.subject),
            selectinload(ExamMarks.exam_subject).selectinload(ExamSubject.academic_class),
            selectinload(ExamMarks.exam_subject).selectinload(ExamSubject.course)
        )
        .where(ExamMarks.student_id == student_id)
        .order_by(ExamMarks.created_at.desc())
    )
    marks_res = (await db.execute(marks_stmt)).scalars().all()

    result_stmt = (
        select(ExamResult)
        .options(selectinload(ExamResult.examination))
        .where(ExamResult.student_id == student_id)
    )
    exam_results_res = (await db.execute(result_stmt)).scalars().all()
    exam_results_map = {r.examination_id: r for r in exam_results_res}

    exams_list = []
    seen_exam_ids = set()
    for m in marks_res:
        es = m.exam_subject
        exam = es.examination if es else None
        subj = es.subject if es else None
        cls = es.academic_class if es else None
        crs = es.course if es else None
        er = exam_results_map.get(exam.id) if exam else None
        if exam:
            seen_exam_ids.add(exam.id)

        max_m = float(es.max_marks) if es and es.max_marks else 100.0
        pass_m = float(es.passing_marks) if es and es.passing_marks else 35.0
        obt_m = float(m.total_marks_obtained)
        pct = round((obt_m / max_m * 100), 1) if max_m > 0 and not m.is_absent else 0.0
        is_pass = obt_m >= pass_m and not m.is_absent
        grade = (
            er.grade if er and er.grade
            else ("A+" if pct >= 90 else ("A" if pct >= 80 else ("B+" if pct >= 70 else ("B" if pct >= 60 else ("C" if pct >= 50 else ("D" if pct >= 35 else "F"))))))
        )

        exams_list.append({
            "id": str(m.id),
            "examination_id": str(exam.id) if exam else None,
            "exam_name": exam.name if exam else "Assessment Test",
            "exam_code": exam.code if exam else "",
            "exam_date": es.exam_date.isoformat() if es and es.exam_date else (exam.start_date.isoformat() if exam and exam.start_date else None),
            "is_published": exam.is_published if exam else False,
            "subject_name": subj.name if subj else "General",
            "subject_code": subj.code if subj else "",
            "class_name": cls.name if cls else None,
            "course_name": crs.name if crs else None,
            "max_marks": max_m,
            "passing_marks": pass_m,
            "marks_obtained": obt_m,
            "percentage": pct,
            "is_pass": is_pass,
            "is_absent": m.is_absent,
            "is_withheld": m.is_withheld,
            "status": m.status,
            "grade": grade,
            "rank": er.rank if er else None
        })

    # Add any published overall results not covered by subject marks
    for r in exam_results_res:
        if r.examination_id not in seen_exam_ids:
            exam = r.examination
            pct = float(r.percentage)
            exams_list.append({
                "id": str(r.id),
                "examination_id": str(exam.id) if exam else None,
                "exam_name": exam.name if exam else "Published Examination",
                "exam_code": exam.code if exam else "",
                "exam_date": exam.start_date.isoformat() if exam and exam.start_date else None,
                "is_published": True,
                "subject_name": "Overall Assessment",
                "subject_code": "ALL",
                "class_name": None,
                "course_name": None,
                "max_marks": float(r.total_possible),
                "passing_marks": float(r.total_possible * 0.35),
                "marks_obtained": float(r.total_obtained),
                "percentage": pct,
                "is_pass": r.is_pass,
                "is_absent": False,
                "is_withheld": False,
                "status": "PUBLISHED",
                "grade": r.grade,
                "rank": r.rank
            })

    # 10. Documents Tab
    doc_stmt = select(StudentDocument).where(StudentDocument.student_id == student_id)
    docs_res = (await db.execute(doc_stmt)).scalars().all()
    docs_list = [
        {
            "id": str(d.id),
            "document_type": d.document_type,
            "file_name": d.file_name,
            "file_url": d.file_url,
            "is_verified": d.is_verified
        } for d in docs_res
    ]

    # 11. Activity History Tab
    activity_history = [
        {
            "timestamp": student.created_at.isoformat(),
            "action": "STUDENT_ADMISSION_REGISTERED",
            "description": f"Student registered with code {student.student_code}"
        }
    ]

    profile_response = StudentProfileResponse(
        overview=overview,
        academics=academics,
        services=services_list,
        hostel=hostel_data,
        study_room=study_room_data,
        fees=fees_list,
        payments=payments_list,
        attendance=attendance_data,
        examinations=exams_list,
        documents=docs_list,
        activity_history=activity_history
    )
    await cache_service.set(cache_key, profile_response.model_dump(), ttl=300)
    return profile_response


@router.get("/{student_id}/guardians", response_model=List[GuardianResponseItem])
async def get_student_guardians(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Returns all guardian records associated with a student."""
    stmt = (
        select(StudentGuardian)
        .options(selectinload(StudentGuardian.guardian))
        .where(StudentGuardian.student_id == student_id)
        .order_by(StudentGuardian.is_primary.desc())
    )
    sgs = (await db.execute(stmt)).scalars().all()
    return [
        GuardianResponseItem(
            id=sg.guardian.id,
            first_name=sg.guardian.first_name,
            last_name=sg.guardian.last_name,
            relation=sg.guardian.relation,
            mobile=sg.guardian.mobile,
            email=sg.guardian.email,
            occupation=sg.guardian.occupation,
            address=sg.guardian.address,
            is_primary=sg.is_primary,
            receives_notifications=sg.receives_notifications
        )
        for sg in sgs if sg.guardian
    ]


@router.patch("/{student_id}", response_model=StudentListResponse)
async def update_student(
    student_id: uuid.UUID,
    data: StudentUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    student = await db.get(Student, student_id)
    if not student:
        raise NotFoundException(f"Student with ID {student_id} not found.")

    update_dict = data.model_dump(exclude_unset=True)

    # Extract guardian update parameters
    g_first = update_dict.pop("guardian_first_name", None)
    g_last = update_dict.pop("guardian_last_name", None)
    g_name = update_dict.pop("guardian_name", None)
    g_rel = update_dict.pop("guardian_relation", None)
    g_mob = update_dict.pop("guardian_mobile", None)
    g_email = update_dict.pop("guardian_email", None)
    g_occ = update_dict.pop("guardian_occupation", None)

    if g_name and not g_first:
        parts = g_name.strip().split(maxsplit=1)
        g_first = parts[0]
        if len(parts) > 1 and not g_last:
            g_last = parts[1]

    # Update basic student attributes
    for field, val in update_dict.items():
        if field == "gender" and isinstance(val, str):
            setattr(student, field, val.upper())
        elif field == "status" and isinstance(val, str):
            setattr(student, field, val.upper())
        else:
            setattr(student, field, val)

    # Process Parent / Guardian updates if provided
    has_guardian_data = any(v is not None for v in [g_first, g_last, g_rel, g_mob, g_email, g_occ])
    if has_guardian_data:
        sg_stmt = (
            select(StudentGuardian)
            .options(selectinload(StudentGuardian.guardian))
            .where(StudentGuardian.student_id == student_id)
            .order_by(StudentGuardian.is_primary.desc())
        )
        sgs = (await db.execute(sg_stmt)).scalars().all()

        if sgs and sgs[0].guardian:
            primary_g = sgs[0].guardian
            if g_first is not None and g_first.strip():
                primary_g.first_name = g_first.strip()
            if g_last is not None and g_last.strip():
                primary_g.last_name = g_last.strip()
            if g_rel is not None and g_rel.strip():
                primary_g.relation = g_rel.strip().upper()
            if g_mob is not None and g_mob.strip():
                primary_g.mobile = g_mob.strip()
            if g_email is not None:
                primary_g.email = g_email.strip() if g_email else None
            if g_occ is not None:
                primary_g.occupation = g_occ.strip() if g_occ else None

            # Sync linked parent user account if provisioned
            if primary_g.user_id:
                g_user = await db.get(User, primary_g.user_id)
                if g_user:
                    if g_first is not None and g_first.strip():
                        g_user.first_name = g_first.strip()
                    if g_last is not None and g_last.strip():
                        g_user.last_name = g_last.strip()
                    if g_mob is not None and g_mob.strip():
                        g_user.mobile = g_mob.strip()
                    if g_email is not None:
                        g_user.email = g_email.strip() if g_email else None
        else:
            # Student currently has no guardian record; create primary guardian
            if (g_first or g_name) and g_mob:
                new_g = Guardian(
                    institute_id=student.institute_id,
                    first_name=(g_first or "Parent").strip(),
                    last_name=(g_last or student.last_name).strip(),
                    relation=(g_rel or "FATHER").strip().upper(),
                    mobile=g_mob.strip(),
                    email=g_email.strip() if g_email else None,
                    occupation=g_occ.strip() if g_occ else None
                )
                db.add(new_g)
                await db.flush()

                new_sg = StudentGuardian(
                    student_id=student.id,
                    guardian_id=new_g.id,
                    is_primary=True,
                    can_pickup=True,
                    receives_notifications=True
                )
                db.add(new_sg)

    await db.commit()

    # Re-fetch student with all relations for full response
    refetch_stmt = (
        select(Student)
        .options(
            selectinload(Student.enrollments).selectinload(Enrollment.academic_class),
            selectinload(Student.enrollments).selectinload(Enrollment.course),
            selectinload(Student.enrollments).selectinload(Enrollment.batch),
            selectinload(Student.guardians).selectinload(StudentGuardian.guardian),
        )
        .where(Student.id == student_id)
    )
    student_refreshed = (await db.execute(refetch_stmt)).scalar_one()

    await cache_service.delete(CacheKeys.student_profile(student.id))
    await cache_service.delete(CacheKeys.dashboard_metrics())
    return _build_student_list_response(student_refreshed)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    student = await db.get(Student, student_id)
    if not student:
        raise NotFoundException(f"Student with ID {student_id} not found.")

    # 1. Free any allocated Study Seats
    seat_alloc_stmt = select(SeatAllocation).where(
        SeatAllocation.student_id == student_id,
        SeatAllocation.status == "ACTIVE"
    )
    seat_allocs = (await db.execute(seat_alloc_stmt)).scalars().all()
    for sa in seat_allocs:
        sa.status = "CANCELLED"
        seat = await db.get(StudySeat, sa.study_seat_id)
        if seat and seat.status == "OCCUPIED":
            seat.status = "AVAILABLE"

    # 2. Free any allocated Hostel Beds
    bed_alloc_stmt = select(BedAllocation).where(
        BedAllocation.student_id == student_id,
        BedAllocation.status == "ACTIVE"
    )
    bed_allocs = (await db.execute(bed_alloc_stmt)).scalars().all()
    for ba in bed_allocs:
        ba.status = "CANCELLED"
        bed = await db.get(HostelBed, ba.hostel_bed_id)
        if bed and bed.status == "OCCUPIED":
            bed.status = "AVAILABLE"

    # 3. Clean up facility allocations, payments, allocations, receipts, invoices
    await db.execute(delete(SeatAllocation).where(SeatAllocation.student_id == student_id))
    await db.execute(delete(BedAllocation).where(BedAllocation.student_id == student_id))

    payments_stmt = select(Payment).where(Payment.student_id == student_id)
    payments = (await db.execute(payments_stmt)).scalars().all()
    for p in payments:
        await db.execute(delete(Receipt).where(Receipt.payment_id == p.id))
        await db.execute(delete(PaymentAllocation).where(PaymentAllocation.payment_id == p.id))
        await db.delete(p)

    invoices_stmt = select(Invoice).where(Invoice.student_id == student_id)
    invoices = (await db.execute(invoices_stmt)).scalars().all()
    for inv in invoices:
        await db.execute(delete(PaymentAllocation).where(PaymentAllocation.invoice_id == inv.id))
        inst_plan = (await db.execute(select(InstallmentPlan).where(InstallmentPlan.invoice_id == inv.id))).scalar_one_or_none()
        if inst_plan:
            await db.execute(delete(Installment).where(Installment.installment_plan_id == inst_plan.id))
            await db.delete(inst_plan)
        await db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id == inv.id))
        await db.delete(inv)

    # 4. Delete student (all CASCADE relations will delete automatically)
    await db.delete(student)
    await db.commit()
    await cache_service.delete(CacheKeys.student_profile(student_id))
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete_pattern(CacheKeys.study_room_pattern())
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    return None


@router.post("/{student_id}/reset-password-to-dob", response_model=ResetPasswordToDobResponse)
async def reset_student_password_to_dob(
    student_id: uuid.UUID,
    payload: ResetPasswordToDobRequest = ResetPasswordToDobRequest(),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Super Admin single-click credential reset.
    Recalculates the student's date of birth in DDMMYYYY format (e.g. 17092002)
    and resets the password for Student, Parent, or Both accounts.
    """
    student = await db.get(Student, student_id)
    if not student:
        raise NotFoundException(f"Student with ID {student_id} not found")

    if not student.date_of_birth:
        raise BadRequestException("Student does not have a date of birth recorded. Please update their profile first.")

    dob_pwd = student.date_of_birth.strftime("%d%m%Y")
    hashed_pwd = get_password_hash(dob_pwd)
    reset_accounts: List[str] = []

    # 1. Reset Student Account
    if payload.target in (ResetPasswordTarget.STUDENT, ResetPasswordTarget.BOTH):
        stu_user = None
        if student.user_id:
            stu_user = await db.get(User, student.user_id)
        if not stu_user:
            sua_stmt = select(User).join(StudentUserAccount, StudentUserAccount.user_id == User.id).where(StudentUserAccount.student_id == student.id)
            stu_user = (await db.execute(sua_stmt)).scalars().first()
        if not stu_user and student.email:
            stu_user = (await db.execute(select(User).where(User.email == student.email))).scalars().first()
        if not stu_user and student.mobile:
            stu_user = (await db.execute(select(User).where(User.mobile == student.mobile))).scalars().first()

        if stu_user:
            stu_user.hashed_password = hashed_pwd
            stu_user.is_active = True
            reset_accounts.append(f"Student ({stu_user.email or stu_user.mobile})")
        else:
            # Auto-provision if missing
            new_stu_user = User(
                institute_id=current_user.institute_id,
                email=student.email or f"{student.student_code.lower()}@yashodeep.local",
                mobile=student.mobile,
                hashed_password=hashed_pwd,
                first_name=student.first_name,
                last_name=student.last_name,
                user_type="STUDENT",
                is_active=True,
                is_verified=True
            )
            db.add(new_stu_user)
            await db.flush()
            student.user_id = new_stu_user.id
            db.add(StudentUserAccount(student_id=student.id, user_id=new_stu_user.id, is_primary=True))
            reset_accounts.append(f"Student ({new_stu_user.email or new_stu_user.mobile})")

    # 2. Reset Parent Account(s)
    if payload.target in (ResetPasswordTarget.PARENT, ResetPasswordTarget.BOTH):
        sg_stmt = select(Guardian).join(StudentGuardian, StudentGuardian.guardian_id == Guardian.id).where(StudentGuardian.student_id == student.id)
        guardians = (await db.execute(sg_stmt)).scalars().all()
        for g in guardians:
            g_user = None
            if g.user_id:
                g_user = await db.get(User, g.user_id)
            if not g_user:
                gua_stmt = select(User).join(GuardianUserAccount, GuardianUserAccount.user_id == User.id).where(GuardianUserAccount.guardian_id == g.id)
                g_user = (await db.execute(gua_stmt)).scalars().first()
            if not g_user and g.mobile:
                g_user = (await db.execute(select(User).where(User.mobile == g.mobile))).scalars().first()
            if not g_user and g.email:
                g_user = (await db.execute(select(User).where(User.email == g.email))).scalars().first()

            if g_user:
                g_user.hashed_password = hashed_pwd
                g_user.is_active = True
                reset_accounts.append(f"Parent ({g.first_name}: {g_user.mobile or g_user.email})")
            else:
                # Auto-provision if missing
                new_g_user = User(
                    institute_id=current_user.institute_id,
                    email=g.email or f"guardian_{student.student_code.lower()}@yashodeep.local",
                    mobile=g.mobile,
                    hashed_password=hashed_pwd,
                    first_name=g.first_name,
                    last_name=g.last_name or student.last_name,
                    user_type="PARENT",
                    is_active=True,
                    is_verified=True
                )
                db.add(new_g_user)
                await db.flush()
                g.user_id = new_g_user.id
                db.add(GuardianUserAccount(guardian_id=g.id, user_id=new_g_user.id, is_primary=True))
                reset_accounts.append(f"Parent ({g.first_name}: {new_g_user.mobile or new_g_user.email})")

    await db.commit()

    return ResetPasswordToDobResponse(
        message="Password successfully reset to default Date of Birth (DDMMYYYY)",
        target=payload.target.value,
        student_name=f"{student.first_name} {student.last_name}",
        default_password_hint=dob_pwd,
        reset_accounts=reset_accounts
    )

