import uuid
from typing import List, Optional, Any
from datetime import date
from fastapi import APIRouter, Depends, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException, BadRequestException
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.student import Student
from app.models.academic import Batch, BatchSubject, BatchStudent, Subject, Teacher, Classroom, Course
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceCorrection
from app.modules.attendance.schemas import (
    SessionCreate, SessionResponse, BulkAttendanceSubmission, AttendanceCorrectionRequest
)
from app.modules.notifications.service import notification_dispatcher

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/batch-subjects")
async def list_attendance_batch_subjects(
    academic_year_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """Returns available batch-subject combinations for attendance taking."""
    stmt = (
        select(BatchSubject)
        .join(Batch, BatchSubject.batch_id == Batch.id)
        .options(
            selectinload(BatchSubject.batch).selectinload(Batch.students),
            selectinload(BatchSubject.subject),
            selectinload(BatchSubject.teacher).selectinload(Teacher.user),
            selectinload(BatchSubject.classroom)
        )
        .where(Batch.is_active == True)
    )
    if academic_year_id:
        stmt = stmt.where(Batch.academic_year_id == academic_year_id)
    res = await db.execute(stmt)
    bss = res.scalars().all()
    out = []
    for bs in bss:
        t_name = f"{bs.teacher.user.first_name} {bs.teacher.user.last_name}" if bs.teacher and bs.teacher.user else None
        enrolled_c = len([s for s in bs.batch.students if s.status == "ACTIVE"]) if bs.batch and bs.batch.students else 0
        out.append({
            "id": bs.id,
            "batch_id": bs.batch_id,
            "batch_name": bs.batch.name if bs.batch else "Unknown Batch",
            "batch_code": bs.batch.code if bs.batch else "",
            "division": bs.batch.division if bs.batch else "A",
            "enrolled_count": enrolled_c,
            "start_date": bs.batch.start_date.isoformat() if bs.batch and bs.batch.start_date else None,
            "end_date": bs.batch.end_date.isoformat() if bs.batch and bs.batch.end_date else None,
            "is_active": bs.batch.is_active if bs.batch else True,
            "subject_id": bs.subject_id,
            "subject_name": bs.subject.name if bs.subject else "Unknown Subject",
            "subject_code": bs.subject.code if bs.subject else "",
            "teacher_name": t_name,
            "classroom_name": bs.classroom.name if bs.classroom else "Standard Hall"
        })
    out.sort(key=lambda x: (x["batch_name"], x["division"], x["subject_name"]))
    return out


@router.get("/batch-subjects/{batch_subject_id}/students")
async def get_batch_subject_students(
    batch_subject_id: uuid.UUID,
    session_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """Returns all active students enrolled in this batch for attendance marking."""
    bs_stmt = (
        select(BatchSubject)
        .options(
            selectinload(BatchSubject.batch).selectinload(Batch.course).selectinload(Course.academic_class)
        )
        .where(BatchSubject.id == batch_subject_id)
    )
    bs = (await db.execute(bs_stmt)).scalar_one_or_none()
    if not bs:
        raise NotFoundException("Batch Subject not found")

    stmt = (
        select(BatchStudent)
        .options(selectinload(BatchStudent.student))
        .where(
            and_(
                BatchStudent.batch_id == bs.batch_id,
                BatchStudent.status == "ACTIVE"
            )
        )
        .order_by(
            BatchStudent.roll_number.asc().nulls_last(),
            BatchStudent.created_at.asc()
        )
    )
    records = (await db.execute(stmt)).scalars().all()

    # If BatchStudent has 0 students, auto-sync from course enrollments
    if not records and bs.batch and bs.batch.course_id:
        from app.models.enrollment import Enrollment
        import re

        # Check if course has multiple active batches in this academic year (e.g. Div A, Div B)
        course_batches_stmt = select(Batch).where(
            Batch.course_id == bs.batch.course_id,
            Batch.academic_year_id == bs.batch.academic_year_id,
            Batch.is_active == True
        )
        course_batches = (await db.execute(course_batches_stmt)).scalars().all()
        has_multiple_batches = len(course_batches) > 1

        ay_filter = [Enrollment.academic_year_id == bs.batch.academic_year_id] if (bs.batch and bs.batch.academic_year_id) else []
        if has_multiple_batches:
            # Strictly pull only students enrolled for this specific batch
            enr_stmt = (
                select(Enrollment)
                .options(selectinload(Enrollment.student))
                .where(
                    or_(
                        and_(Enrollment.course_id == bs.batch.course_id, Enrollment.batch_id == bs.batch_id),
                        Enrollment.batch_id == bs.batch_id
                    ),
                    Enrollment.status == "ACTIVE",
                    *ay_filter
                )
            )
        else:
            enr_stmt = (
                select(Enrollment)
                .options(selectinload(Enrollment.student))
                .where(
                    or_(
                        Enrollment.course_id == bs.batch.course_id,
                        Enrollment.batch_id == bs.batch_id,
                        and_(
                            Enrollment.class_id == bs.batch.course.class_id,
                            Enrollment.enrollment_group_id.isnot(None)
                        )
                    ),
                    Enrollment.status == "ACTIVE",
                    *ay_filter
                )
            )
        enrs = (await db.execute(enr_stmt)).scalars().all()
        if enrs:
            # Prevent double-enrolling students who already belong to another batch in this course
            assigned_stmt = (
                select(BatchStudent.student_id)
                .join(Batch, BatchStudent.batch_id == Batch.id)
                .where(
                    Batch.course_id == bs.batch.course_id,
                    BatchStudent.status == "ACTIVE"
                )
            )
            already_assigned_ids = set((await db.execute(assigned_stmt)).scalars().all())

            std_num = 10
            if bs.batch.course and bs.batch.course.academic_class and bs.batch.course.academic_class.name:
                match = re.search(r'\d+', bs.batch.course.academic_class.name)
                if match:
                    std_num = int(match.group(0))
            div_char = (bs.batch.division or "A").upper()
            div_offset = 50 if div_char == "B" else (100 if div_char == "C" else 0)
            base_prefix = std_num * 100

            max_roll_stmt = select(BatchStudent.roll_number).where(
                BatchStudent.batch_id == bs.batch_id,
                BatchStudent.roll_number != None
            ).order_by(BatchStudent.roll_number.desc()).limit(1)
            max_roll = (await db.execute(max_roll_stmt)).scalar_one_or_none()
            next_roll = (max_roll + 1) if (max_roll is not None and max_roll >= (base_prefix + div_offset)) else (base_prefix + div_offset + 1)

            unique_students = []
            seen_ids = set()
            for e in enrs:
                if e.student and e.student.id not in seen_ids and e.student.id not in already_assigned_ids:
                    seen_ids.add(e.student.id)
                    unique_students.append(e.student)

            for stu in unique_students:
                new_bs = BatchStudent(
                    batch_id=bs.batch_id,
                    student_id=stu.id,
                    roll_number=next_roll,
                    status="ACTIVE"
                )
                next_roll += 1
                db.add(new_bs)
            await db.commit()

            records = (await db.execute(stmt)).scalars().all()

    existing_marks = {}
    existing_topic = None
    if session_date:
        sess_stmt = (
            select(AttendanceSession)
            .options(selectinload(AttendanceSession.records))
            .where(
                AttendanceSession.batch_subject_id == batch_subject_id,
                AttendanceSession.session_date == session_date,
                AttendanceSession.is_cancelled == False
            )
        )
        existing_sess = (await db.execute(sess_stmt)).scalar_one_or_none()
        if existing_sess:
            existing_topic = existing_sess.topic_covered
            for rec in existing_sess.records:
                existing_marks[rec.student_id] = {
                    "status": rec.status,
                    "remarks": rec.remarks
                }

    students_out = []
    for r in records:
        if r.student:
            marked = existing_marks.get(r.student.id)
            students_out.append({
                "student_id": r.student.id,
                "student_code": r.student.student_code,
                "prn": r.student.prn or r.student.student_code.replace("STU-", "PRN-"),
                "roll_number": r.roll_number,
                "first_name": r.student.first_name,
                "last_name": r.student.last_name,
                "gender": r.student.gender,
                "marked_status": marked["status"] if marked else None,
                "remarks": marked["remarks"] if marked else None,
                "session_topic": existing_topic
            })
    return students_out


@router.get("/sessions")
async def list_attendance_sessions(
    academic_year_id: Optional[uuid.UUID] = None,
    batch_subject_id: Optional[uuid.UUID] = None,
    session_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """Lists attendance sessions with aggregated attendance stats."""
    stmt = (
        select(AttendanceSession)
        .options(
            selectinload(AttendanceSession.batch_subject).selectinload(BatchSubject.batch),
            selectinload(AttendanceSession.batch_subject).selectinload(BatchSubject.subject),
            selectinload(AttendanceSession.records)
        )
    )
    if academic_year_id:
        stmt = (
            stmt
            .join(BatchSubject, AttendanceSession.batch_subject_id == BatchSubject.id)
            .join(Batch, BatchSubject.batch_id == Batch.id)
            .where(Batch.academic_year_id == academic_year_id)
        )
    if batch_subject_id:
        stmt = stmt.where(AttendanceSession.batch_subject_id == batch_subject_id)
    if session_date:
        stmt = stmt.where(AttendanceSession.session_date == session_date)

    stmt = stmt.order_by(AttendanceSession.session_date.desc(), AttendanceSession.created_at.desc())
    res = await db.execute(stmt)
    sessions = res.scalars().all()

    out = []
    for s in sessions:
        present_count = sum(1 for r in s.records if r.status == "PRESENT")
        absent_count = sum(1 for r in s.records if r.status == "ABSENT")
        late_count = sum(1 for r in s.records if r.status == "LATE")
        total = len(s.records)
        batch_name = s.batch_subject.batch.name if s.batch_subject and s.batch_subject.batch else ""
        subject_name = s.batch_subject.subject.name if s.batch_subject and s.batch_subject.subject else ""

        out.append({
            "id": s.id,
            "session_date": s.session_date,
            "start_time": str(s.start_time) if s.start_time else None,
            "end_time": str(s.end_time) if s.end_time else None,
            "topic_covered": s.topic_covered,
            "batch_name": batch_name,
            "subject_name": subject_name,
            "present_count": present_count,
            "absent_count": absent_count,
            "late_count": late_count,
            "total_marked": total,
            "attendance_rate": round(present_count / total * 100, 1) if total > 0 else 0
        })
    return out


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance_session(
    data: SessionCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    bs = await db.get(BatchSubject, data.batch_subject_id)
    if not bs:
        raise NotFoundException("Batch Subject not found")

    # If an attendance session already exists for this subject on this date, reuse it (idempotent)
    existing_stmt = select(AttendanceSession).where(
        AttendanceSession.batch_subject_id == data.batch_subject_id,
        AttendanceSession.session_date == data.session_date,
        AttendanceSession.is_cancelled == False
    )
    existing_session = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing_session:
        if data.topic_covered:
            existing_session.topic_covered = data.topic_covered
        if data.start_time:
            existing_session.start_time = data.start_time
        if data.end_time:
            existing_session.end_time = data.end_time
        await db.commit()
        await db.refresh(existing_session)
        return existing_session

    session = AttendanceSession(
        batch_subject_id=data.batch_subject_id,
        teacher_id=bs.teacher_id,
        session_date=data.session_date,
        start_time=data.start_time,
        end_time=data.end_time,
        topic_covered=data.topic_covered
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/records")
async def mark_bulk_attendance(
    data: BulkAttendanceSubmission,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    session = await db.get(AttendanceSession, data.session_id)
    if not session:
        raise NotFoundException("Attendance session not found")

    saved_count = 0
    has_absent = False
    for r in data.records:
        if r.status == "ABSENT":
            has_absent = True
        # Check if record already exists
        stmt = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.session_id == data.session_id,
                AttendanceRecord.student_id == r.student_id
            )
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.status = r.status
            existing.remarks = r.remarks
        else:
            rec = AttendanceRecord(
                session_id=data.session_id,
                student_id=r.student_id,
                status=r.status,
                remarks=r.remarks
            )
            db.add(rec)
        saved_count += 1

    await db.commit()

    # Trigger async absence WhatsApp/Email notifications to parents
    if has_absent:
        background_tasks.add_task(
            notification_dispatcher.dispatch_attendance_absent_alerts,
            session_id=data.session_id
        )

    # Invalidate student profiles and attendance caches
    for r in data.records:
        await cache_service.delete(CacheKeys.student_profile(r.student_id))
    await cache_service.delete_pattern(CacheKeys.student_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete_pattern(CacheKeys.attendance_pattern())

    return {"message": f"Successfully recorded attendance for {saved_count} students"}


@router.post("/corrections")
async def correct_attendance(
    data: AttendanceCorrectionRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    record = await db.get(AttendanceRecord, data.attendance_record_id)
    if not record:
        raise NotFoundException("Attendance record not found")

    correction = AttendanceCorrection(
        attendance_record_id=record.id,
        old_status=record.status,
        new_status=data.new_status,
        reason=data.reason,
        changed_by_user_id=current_user.id
    )
    db.add(correction)
    record.status = data.new_status
    await db.commit()

    # Invalidate student profile and attendance caches
    await cache_service.delete(CacheKeys.student_profile(record.student_id))
    await cache_service.delete_pattern(CacheKeys.student_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete_pattern(CacheKeys.attendance_pattern())

    return {"message": "Attendance correction recorded with audit trail"}

