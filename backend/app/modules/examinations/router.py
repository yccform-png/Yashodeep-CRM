import uuid
from typing import List, Optional
from datetime import date, datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException, BadRequestException
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.student import Student, Guardian, StudentGuardian
from app.models.academic import Subject, Class, Stream, Course, Batch, BatchStudent
from app.models.enrollment import Enrollment, EnrollmentSubject
from app.models.examination import (
    Examination, ExamSubject, ExamMarks, ExamResult, ExamType
)
from app.modules.examinations.schemas import (
    ExaminationCreate, ExaminationResponse, BulkMarksSubmission, StudentResultResponse
)
from app.modules.notifications.service import notification_dispatcher
from app.modules.notifications.providers.meta_whatsapp import meta_whatsapp_client
from app.modules.notifications.templates import format_exam_result_whatsapp_text, build_whatsapp_click_url

router = APIRouter(prefix="/examinations", tags=["Examinations"])


@router.get("/types")
async def list_exam_types(db: AsyncSession = Depends(get_db)):
    """Lists all configured examination types."""
    result = await db.execute(select(ExamType))
    types = result.scalars().all()
    return [{"id": t.id, "name": t.name, "code": t.code, "weightage_percent": t.weightage_percent} for t in types]


@router.get("", response_model=List[ExaminationResponse])
async def list_examinations(
    academic_year_id: Optional[uuid.UUID] = None,
    class_id: Optional[uuid.UUID] = None,
    course_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Examination)
        .options(
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.academic_class),
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.course),
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.subject)
        )
    )
    if academic_year_id:
        stmt = stmt.where(Examination.academic_year_id == academic_year_id)
    if class_id:
        stmt = stmt.where(Examination.exam_subjects.any(ExamSubject.class_id == class_id))
    if course_id:
        stmt = stmt.where(Examination.exam_subjects.any(ExamSubject.course_id == course_id))
    stmt = stmt.order_by(Examination.start_date.desc())
    result = await db.execute(stmt)
    exams = result.scalars().all()

    output = []
    for ex in exams:
        first_es = ex.exam_subjects[0] if ex.exam_subjects else None
        output.append(
            ExaminationResponse(
                id=ex.id,
                academic_year_id=ex.academic_year_id,
                exam_type_id=ex.exam_type_id,
                name=ex.name,
                code=ex.code,
                start_date=ex.start_date,
                end_date=ex.end_date,
                is_published=ex.is_published,
                class_id=first_es.class_id if first_es else None,
                class_name=first_es.academic_class.name if first_es and first_es.academic_class else None,
                course_id=first_es.course_id if first_es else None,
                course_name=first_es.course.name if first_es and first_es.course else None,
                subject_name=first_es.subject.name if first_es and first_es.subject else None,
                max_marks=first_es.max_marks if first_es else None,
                passing_marks=first_es.passing_marks if first_es else None
            )
        )
    return output


@router.get("/papers/{paper_id}/eligible-students")
async def list_eligible_students_for_paper(
    paper_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Returns active students belonging strictly to the class/course of this test paper."""
    stmt = (
        select(ExamSubject)
        .options(
            selectinload(ExamSubject.marks).selectinload(ExamMarks.student),
            selectinload(ExamSubject.academic_class),
            selectinload(ExamSubject.course)
        )
        .where(ExamSubject.id == paper_id)
    )
    paper = (await db.execute(stmt)).scalar_one_or_none()
    if not paper:
        raise NotFoundException("Exam paper not found")

    students_map = {}
    student_roll_map = {}

    # 1. Scoped by Course: if course_id is specified on the paper
    if paper.course_id:
        # A. Active students enrolled in this course
        enr_course_stmt = (
            select(Student)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(
                and_(
                    Enrollment.course_id == paper.course_id,
                    Enrollment.status == "ACTIVE"
                )
            )
            .distinct()
        )
        for s in (await db.execute(enr_course_stmt)).scalars().all():
            students_map[s.id] = s

        # B. Students in batches belonging to this course
        batch_course_stmt = (
            select(Student, BatchStudent.roll_number)
            .join(BatchStudent, BatchStudent.student_id == Student.id)
            .join(Batch, Batch.id == BatchStudent.batch_id)
            .where(Batch.course_id == paper.course_id)
        )
        for s, roll in (await db.execute(batch_course_stmt)).all():
            students_map[s.id] = s
            if roll is not None:
                student_roll_map[s.id] = roll

        # C. Modular subject enrollment specifically scoped to this course
        if paper.subject_id:
            subj_enr_stmt = (
                select(Student)
                .join(Enrollment, Enrollment.student_id == Student.id)
                .join(EnrollmentSubject, EnrollmentSubject.enrollment_id == Enrollment.id)
                .where(
                    and_(
                        EnrollmentSubject.subject_id == paper.subject_id,
                        Enrollment.course_id == paper.course_id,
                        Enrollment.status == "ACTIVE"
                    )
                )
                .distinct()
            )
            for s in (await db.execute(subj_enr_stmt)).scalars().all():
                students_map[s.id] = s

    # 2. Scoped by Class: if course_id is not specified, but class_id is
    elif paper.class_id:
        # A. Active students enrolled in this class
        enr_cls_stmt = (
            select(Student)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(
                and_(
                    Enrollment.class_id == paper.class_id,
                    Enrollment.status == "ACTIVE"
                )
            )
            .distinct()
        )
        for s in (await db.execute(enr_cls_stmt)).scalars().all():
            students_map[s.id] = s

        # B. Students in batches belonging to courses under this class
        batch_cls_stmt = (
            select(Student, BatchStudent.roll_number)
            .join(BatchStudent, BatchStudent.student_id == Student.id)
            .join(Batch, Batch.id == BatchStudent.batch_id)
            .join(Course, Course.id == Batch.course_id)
            .where(Course.class_id == paper.class_id)
        )
        for s, roll in (await db.execute(batch_cls_stmt)).all():
            students_map[s.id] = s
            if roll is not None:
                student_roll_map[s.id] = roll

        # C. Modular subject enrollment specifically scoped to this class
        if paper.subject_id:
            subj_enr_stmt = (
                select(Student)
                .join(Enrollment, Enrollment.student_id == Student.id)
                .join(EnrollmentSubject, EnrollmentSubject.enrollment_id == Enrollment.id)
                .where(
                    and_(
                        EnrollmentSubject.subject_id == paper.subject_id,
                        Enrollment.class_id == paper.class_id,
                        Enrollment.status == "ACTIVE"
                    )
                )
                .distinct()
            )
            for s in (await db.execute(subj_enr_stmt)).scalars().all():
                students_map[s.id] = s

    # 3. Always preserve any student who already has marks entered for this paper
    for m in paper.marks:
        if m.student and m.student_id not in students_map:
            students_map[m.student_id] = m.student

    # 4. Fallback only if no course, class, or roster match
    if not students_map and not paper.course_id and not paper.class_id:
        all_students = (await db.execute(select(Student).where(Student.status == "ACTIVE"))).scalars().all()
        for s in all_students:
            students_map[s.id] = s

    existing_marks = {m.student_id: m for m in paper.marks}

    def sort_key(s_id):
        roll = student_roll_map.get(s_id)
        stu = students_map[s_id]
        return (
            0 if roll is not None else 1,
            roll if roll is not None else 0,
            stu.first_name or "",
            stu.last_name or ""
        )

    output = []
    sorted_ids = sorted(students_map.keys(), key=sort_key)
    for s_id in sorted_ids:
        s = students_map[s_id]
        existing = existing_marks.get(s_id)
        s_code = s.student_code or ""
        s_prn = s.prn or (s_code.replace("STU-", "PRN-") if s_code else "")
        roll_num = student_roll_map.get(s_id)
        output.append({
            "student_id": s.id,
            "student_name": f"{s.first_name} {s.last_name}",
            "student_code": s_code,
            "prn": s_prn,
            "roll_number": roll_num,
            "marks_obtained": float(existing.total_marks_obtained) if existing else None,
            "is_absent": existing.is_absent if existing else False
        })
    return output


@router.get("/{examination_id}/details")
async def get_examination_details(
    examination_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Returns examination with subject papers, student marks entries, and published result cards."""
    stmt = (
        select(Examination)
        .options(
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.subject),
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.academic_class),
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.course),
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.marks).selectinload(ExamMarks.student),
            selectinload(Examination.results).selectinload(ExamResult.student).selectinload(Student.guardians).selectinload(StudentGuardian.guardian)
        )
        .where(Examination.id == examination_id)
    )
    exam = (await db.execute(stmt)).scalar_one_or_none()
    if not exam:
        raise NotFoundException("Examination not found")

    subjects_out = []
    for es in exam.exam_subjects:
        marks_out = []
        for m in es.marks:
            s_name = f"{m.student.first_name} {m.student.last_name}" if m.student else ""
            s_code = m.student.student_code if m.student else ""
            s_prn = m.student.prn if m.student and m.student.prn else (s_code.replace("STU-", "PRN-") if s_code else "")
            marks_out.append({
                "student_id": m.student_id,
                "student_name": s_name,
                "student_code": s_code,
                "prn": s_prn,
                "marks_obtained": m.total_marks_obtained,
                "theory_marks_obtained": m.theory_marks_obtained,
                "practical_marks_obtained": m.practical_marks_obtained,
                "total_marks_obtained": m.total_marks_obtained,
                "is_absent": m.is_absent,
                "is_withheld": m.is_withheld,
                "status": m.status
            })

        subjects_out.append({
            "id": es.id,
            "subject_id": es.subject_id,
            "subject_name": es.subject.name if es.subject else "",
            "subject_code": es.subject.code if es.subject else "",
            "class_id": es.class_id,
            "class_name": es.academic_class.name if es.academic_class else "",
            "course_id": es.course_id,
            "course_name": es.course.name if es.course else None,
            "exam_date": es.exam_date,
            "duration_minutes": es.duration_minutes,
            "max_marks": es.max_marks,
            "passing_marks": es.passing_marks,
            "has_negative_marking": es.has_negative_marking,
            "negative_mark_weight": es.negative_mark_weight,
            "theory_max_marks": es.theory_max_marks,
            "practical_max_marks": es.practical_max_marks,
            "marks": marks_out
        })

    results_out = []
    subject_names = [es.subject.name for es in (exam.exam_subjects or []) if es.subject]
    subject_name = ", ".join(subject_names) if subject_names else (exam.name or "Curriculum Evaluation")

    for r in exam.results:
        stu = r.student
        s_name = f"{stu.first_name} {stu.last_name}".strip() if stu else ""
        s_code = stu.student_code if stu else ""
        s_prn = stu.prn if stu and stu.prn else (s_code.replace("STU-", "PRN-") if s_code else "")
        parent_name, parent_phone, parent_email = notification_dispatcher._resolve_contact(stu) if stu else ("Parent / Guardian", None, None)

        marks_obtained = float(r.total_obtained) if r.total_obtained is not None else 0.0
        max_marks = float(r.total_possible) if r.total_possible is not None else 100.0
        percentage = float(r.percentage) if r.percentage is not None else (round((marks_obtained / max_marks) * 100, 2) if max_marks else 0.0)
        grade = r.grade or ("A+" if percentage >= 90 else ("A" if percentage >= 80 else ("B+" if percentage >= 70 else ("B" if percentage >= 60 else "C"))))
        is_pass = bool(r.is_pass) if r.is_pass is not None else (percentage >= 35.0)

        wa_text = format_exam_result_whatsapp_text(
            parent_name=parent_name,
            exam_name=exam.name,
            subject_name=subject_name,
            student_name=s_name,
            marks_obtained=marks_obtained,
            max_marks=max_marks,
            percentage=percentage,
            grade=grade,
            is_pass=is_pass,
            rank=r.rank
        )
        wa_url = build_whatsapp_click_url(parent_phone, wa_text) if parent_phone else ""

        results_out.append({
            "student_id": r.student_id,
            "student_name": s_name,
            "student_code": s_code,
            "prn": s_prn,
            "parent_name": parent_name,
            "parent_phone": parent_phone,
            "parent_email": parent_email,
            "total_obtained": r.total_obtained,
            "total_possible": r.total_possible,
            "percentage": r.percentage,
            "grade": r.grade,
            "rank": r.rank,
            "is_pass": r.is_pass,
            "whatsapp_message": wa_text,
            "whatsapp_url": wa_url,
            "whatsapp_configured": meta_whatsapp_client.enabled
        })

    return {
        "id": exam.id,
        "name": exam.name,
        "code": exam.code,
        "start_date": exam.start_date,
        "end_date": exam.end_date,
        "is_published": exam.is_published,
        "whatsapp_configured": meta_whatsapp_client.enabled,
        "subjects": subjects_out,
        "results": results_out
    }


@router.post("", response_model=ExaminationResponse, status_code=status.HTTP_201_CREATED)
async def create_examination(
    data: ExaminationCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    code = data.code.strip()
    if not code:
        raise BadRequestException("Test code is required.")

    # Check for existing code
    existing_code = (await db.execute(select(Examination).where(Examination.code == code))).scalar_one_or_none()
    if existing_code:
        raise BadRequestException(f"Test code '{code}' already exists. Please choose a different test code.")

    # Resolve academic year if not provided
    ay_id = data.academic_year_id
    if not ay_id:
        curr_ay = (await db.execute(select(AcademicYear).where(AcademicYear.is_current.is_(True)))).scalars().first()
        if not curr_ay:
            curr_ay = (await db.execute(select(AcademicYear))).scalars().first()
        if not curr_ay:
            raise BadRequestException("No academic year configured.")
        ay_id = curr_ay.id

    # Resolve exam type if not provided
    et_id = data.exam_type_id
    if not et_id:
        et = (await db.execute(select(ExamType))).scalars().first()
        if not et:
            raise BadRequestException("No examination type configured.")
        et_id = et.id

    exam = Examination(
        institute_id=current_user.institute_id,
        academic_year_id=ay_id,
        exam_type_id=et_id,
        name=data.name.strip(),
        code=code,
        start_date=data.start_date,
        end_date=data.end_date,
        is_published=False,
        created_by_user_id=current_user.id
    )
    db.add(exam)
    await db.flush()

    for s_data in data.subjects:
        th_max = s_data.theory_max_marks if s_data.theory_max_marks is not None else s_data.max_marks
        pr_max = s_data.practical_max_marks if s_data.practical_max_marks is not None else Decimal("0.00")
        
        stream_id = s_data.stream_id
        if not stream_id and s_data.course_id:
            crs = await db.get(Course, s_data.course_id)
            if crs and crs.stream_id:
                stream_id = crs.stream_id

        es = ExamSubject(
            examination_id=exam.id,
            subject_id=s_data.subject_id,
            class_id=s_data.class_id,
            stream_id=stream_id,
            course_id=s_data.course_id,
            exam_date=s_data.exam_date,
            duration_minutes=s_data.duration_minutes,
            max_marks=s_data.max_marks,
            passing_marks=s_data.passing_marks,
            has_negative_marking=s_data.has_negative_marking,
            negative_mark_weight=s_data.negative_mark_weight,
            theory_max_marks=th_max,
            practical_max_marks=pr_max
        )
        db.add(es)

    await db.commit()

    # Invalidate cache
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete_pattern(CacheKeys.examinations_pattern())
    
    # Reload with relationships so ExaminationResponse has class, course, subject, and marks
    stmt = (
        select(Examination)
        .options(
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.academic_class),
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.course),
            selectinload(Examination.exam_subjects).selectinload(ExamSubject.subject),
        )
        .where(Examination.id == exam.id)
    )
    loaded_exam = (await db.execute(stmt)).scalar_one()
    first_es = loaded_exam.exam_subjects[0] if loaded_exam.exam_subjects else None
    return ExaminationResponse(
        id=loaded_exam.id,
        academic_year_id=loaded_exam.academic_year_id,
        exam_type_id=loaded_exam.exam_type_id,
        name=loaded_exam.name,
        code=loaded_exam.code,
        start_date=loaded_exam.start_date,
        end_date=loaded_exam.end_date,
        is_published=loaded_exam.is_published,
        class_id=first_es.class_id if first_es else None,
        class_name=first_es.academic_class.name if first_es and first_es.academic_class else None,
        course_id=first_es.course_id if first_es else None,
        course_name=first_es.course.name if first_es and first_es.course else None,
        subject_name=first_es.subject.name if first_es and first_es.subject else None,
        max_marks=first_es.max_marks if first_es else None,
        passing_marks=first_es.passing_marks if first_es else None
    )


@router.post("/marks")
async def enter_marks(
    data: BulkMarksSubmission,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN", "TEACHER"])),
    db: AsyncSession = Depends(get_db)
):
    exam_subj = await db.get(ExamSubject, data.exam_subject_id)
    if not exam_subj:
        raise NotFoundException("Exam subject not found")

    saved_count = 0
    for m in data.marks:
        if m.marks_obtained is not None:
            th_obt = m.marks_obtained
            pr_obt = m.practical_marks_obtained or Decimal("0.00")
            tot = Decimal("0.00") if m.is_absent else m.marks_obtained
        else:
            th_obt = m.theory_marks_obtained or Decimal("0.00")
            pr_obt = m.practical_marks_obtained or Decimal("0.00")
            tot = Decimal("0.00") if m.is_absent else (th_obt + pr_obt)

        # Check existing marks record
        stmt = select(ExamMarks).where(
            and_(
                ExamMarks.exam_subject_id == data.exam_subject_id,
                ExamMarks.student_id == m.student_id
            )
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.theory_marks_obtained = th_obt
            existing.practical_marks_obtained = pr_obt
            existing.total_marks_obtained = tot
            existing.is_absent = m.is_absent
            existing.is_withheld = m.is_withheld
            existing.entered_by_user_id = current_user.id
        else:
            rec = ExamMarks(
                exam_subject_id=data.exam_subject_id,
                student_id=m.student_id,
                theory_marks_obtained=th_obt,
                practical_marks_obtained=pr_obt,
                total_marks_obtained=tot,
                is_absent=m.is_absent,
                is_withheld=m.is_withheld,
                status="SUBMITTED",
                entered_by_user_id=current_user.id
            )
            db.add(rec)
        saved_count += 1

    await db.commit()

    # Invalidate cache for students whose marks were entered
    for m in data.marks:
        await cache_service.delete(CacheKeys.student_profile(m.student_id))
    await cache_service.delete_pattern(CacheKeys.student_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete_pattern(CacheKeys.examinations_pattern())

    return {"message": f"Marks recorded successfully for {saved_count} students"}


@router.post("/{examination_id}/publish")
async def publish_results(
    examination_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    exam = await db.get(Examination, examination_id)
    if not exam:
        raise NotFoundException("Examination not found")

    # Calculate overall results for all students who sat for this exam
    stmt = (
        select(ExamSubject)
        .options(selectinload(ExamSubject.marks))
        .where(ExamSubject.examination_id == examination_id)
    )
    exam_subjects = (await db.execute(stmt)).scalars().all()

    student_totals = {}  # student_id -> {obtained, possible, is_pass}
    for es in exam_subjects:
        for m in es.marks:
            sid = m.student_id
            if sid not in student_totals:
                student_totals[sid] = {"obtained": Decimal("0.00"), "possible": Decimal("0.00"), "pass": True}
            student_totals[sid]["obtained"] += m.total_marks_obtained
            student_totals[sid]["possible"] += es.max_marks
            if m.total_marks_obtained < es.passing_marks:
                student_totals[sid]["pass"] = False

    # Save results
    for sid, stat in student_totals.items():
        pct = (stat["obtained"] / stat["possible"] * 100).quantize(Decimal("0.01")) if stat["possible"] > 0 else Decimal("0.00")
        grade = "A+" if pct >= 90 else ("A" if pct >= 80 else ("B+" if pct >= 70 else ("B" if pct >= 60 else ("C" if pct >= 50 else ("D" if pct >= 35 else "F")))))

        # Update or create ExamResult
        res_stmt = select(ExamResult).where(
            and_(
                ExamResult.examination_id == examination_id,
                ExamResult.student_id == sid
            )
        )
        existing_res = (await db.execute(res_stmt)).scalar_one_or_none()
        if existing_res:
            existing_res.total_obtained = stat["obtained"]
            existing_res.total_possible = stat["possible"]
            existing_res.percentage = pct
            existing_res.grade = grade
            existing_res.is_pass = stat["pass"]
        else:
            res = ExamResult(
                examination_id=examination_id,
                student_id=sid,
                total_obtained=stat["obtained"],
                total_possible=stat["possible"],
                percentage=pct,
                grade=grade,
                is_pass=stat["pass"]
            )
            db.add(res)

    exam.is_published = True
    exam.published_at = datetime.now(timezone.utc)
    await db.commit()

    # Trigger async scorecard WhatsApp messages to parents
    background_tasks.add_task(
        notification_dispatcher.dispatch_exam_results,
        exam_id=examination_id
    )

    # Invalidate student profiles and examination caches
    for sid in student_totals.keys():
        await cache_service.delete(CacheKeys.student_profile(sid))
    await cache_service.delete_pattern(CacheKeys.student_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete_pattern(CacheKeys.examinations_pattern())

    return {"message": "Examination published successfully and student report cards generated"}


@router.post("/{examination_id}/notify")
async def notify_exam_results(
    examination_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN", "TEACHER"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually triggers scorecard notification dispatch (WhatsApp & Email) to parents and students.
    """
    exam = await db.get(Examination, examination_id)
    if not exam:
        raise NotFoundException(f"Examination {examination_id} not found")

    background_tasks.add_task(
        notification_dispatcher.dispatch_exam_results,
        exam_id=examination_id
    )

    msg = "Official scorecard report emails dispatched to parents and students."
    if meta_whatsapp_client.enabled:
        msg += " Automated Meta WhatsApp messages scheduled."
    else:
        msg += " Click WhatsApp next to each student to send directly via WhatsApp Web / App."

    return {
        "success": True,
        "message": msg,
        "whatsapp_configured": meta_whatsapp_client.enabled
    }


@router.get("/results/student/{student_id}", response_model=List[StudentResultResponse])
async def get_student_results(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ExamResult)
        .join(Examination)
        .where(
            and_(
                ExamResult.student_id == student_id,
                Examination.is_published.is_(True)
            )
        )
    )
    results = (await db.execute(stmt)).scalars().all()
    return results


@router.delete("/{examination_id}", status_code=status.HTTP_200_OK)
async def delete_examination(
    examination_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Deletes an examination along with its papers, marks, and student scorecards."""
    exam = await db.get(Examination, examination_id)
    if not exam:
        raise NotFoundException("Examination not found")

    exam_name = exam.name

    # Identify all affected student IDs before cascade deletion
    stmt_students = select(ExamMarks.student_id).join(ExamSubject).where(ExamSubject.examination_id == examination_id)
    res_students = (await db.execute(stmt_students)).scalars().all()
    affected_student_ids = set(res_students)

    await db.delete(exam)
    await db.commit()

    # Invalidate dashboard metrics, examinations, and affected student profiles
    for sid in affected_student_ids:
        await cache_service.delete(CacheKeys.student_profile(sid))
    await cache_service.delete_pattern(CacheKeys.student_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete_pattern(CacheKeys.examinations_pattern())

    return {"message": f"Test '{exam_name}' deleted successfully."}

