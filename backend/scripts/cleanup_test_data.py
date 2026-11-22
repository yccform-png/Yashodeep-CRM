"""
Database cleanup script to purge test data while strictly preserving:
- Harshvardhan Patil (STU-2026-00001 / PRN-2026-00001)
- Harshvardhan's Invoices (INV-2026-00001, INV-2026-00028)
- Harshvardhan's Payment (PAY-2026-00006) & Receipt (RCP-2026-00006)
- Harshvardhan's Hostel Bed (102-A) and Study Seat (B005)
- Standard required courses (5th to 12th + Skill English + Combined 9th/10th)
"""
import asyncio
import uuid
from decimal import Decimal
from datetime import date
from sqlalchemy import select, delete, update
from app.core.database import AsyncSessionLocal

from app.models.student import Student, Guardian, StudentGuardian, StudentDocument, StudentUserAccount
from app.models.fee import Invoice, InvoiceItem, InstallmentPlan, Installment, Payment, PaymentAllocation, Receipt, Refund, StudentDiscount
from app.models.hostel import HostelBed, BedAllocation, HostelAttendance
from app.models.study_room import StudySeat, SeatAllocation, StudyRoomAttendance
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.service import StudentService
from app.models.enrollment import Enrollment, EnrollmentSubject, EnrollmentYear, EnrollmentGroup
from app.models.academic import Course, CourseVersion, CourseVersionSubject, CourseType, Class, Batch, BatchStudent, BatchSubject, AcademicYear, Subject
from app.models.examination import Examination, ExamSubject, ExamMarks, ExamResult
from app.models.institute import Institute

async def clean_database():
    h_id = uuid.UUID('561a7fe7-6a2e-4a9e-aace-2a5abb529a81')
    h_inv_ids = [uuid.UUID('8197c4fb-a31f-4db8-866b-2776062b9eba'), uuid.UUID('9be9d391-2985-47b1-b4da-184601d7df34')]
    h_pay_ids = [uuid.UUID('01261e32-15ae-4dd1-9157-48b2557e0960')]
    h_enr_ids = [uuid.UUID('ffccfde2-dac4-4700-8282-882bebde4deb'), uuid.UUID('50408976-1336-4b2a-b37d-01e36eca2b8f')]
    h_g_ids = [uuid.UUID('6c7953cc-4f03-4d68-a44f-33ecc1ac4618')]

    required_codes = [
        'CRS-05-REG', 'CRS-06-REG', 'CRS-07-REG', 'CRS-08-REG',
        'CRS-09-BOARD', 'CRS-10-BOARD', 'CRS-09-10-COMBINED',
        'CRS-11-SCI-INT', 'CRS-12-SCI-INT', 'CRS-12-COMM-REG',
        'CRS-SKILL-ENG'
    ]

    async with AsyncSessionLocal() as db:
        async with db.begin():
            print(">>> Starting Database Purge...")

            # 1. Receipts & Refunds (preserve all of Harshvardhan's receipts)
            r_rec = await db.execute(delete(Receipt).where(Receipt.payment_id.in_(
                select(Payment.id).where(Payment.student_id != h_id)
            )))
            r_ref = await db.execute(delete(Refund).where(Refund.payment_id.in_(
                select(Payment.id).where(Payment.student_id != h_id)
            )))
            print(f"Purged {r_rec.rowcount} test receipts, {r_ref.rowcount} refunds")

            # 2. Payment Allocations (preserve all of Harshvardhan's allocations)
            r_pa = await db.execute(delete(PaymentAllocation).where(PaymentAllocation.payment_id.in_(
                select(Payment.id).where(Payment.student_id != h_id)
            )))
            print(f"Purged {r_pa.rowcount} test payment allocations")

            # 3. Payments (preserve all of Harshvardhan's payments)
            r_pay = await db.execute(delete(Payment).where(Payment.student_id != h_id))
            print(f"Purged {r_pay.rowcount} test payments")

            # 4. Installments & Plans (preserve all of Harshvardhan's installments)
            r_inst = await db.execute(delete(Installment).where(Installment.installment_plan_id.in_(
                select(InstallmentPlan.id).where(InstallmentPlan.invoice_id.in_(
                    select(Invoice.id).where(Invoice.student_id != h_id)
                ))
            )))
            r_ip = await db.execute(delete(InstallmentPlan).where(InstallmentPlan.invoice_id.in_(
                select(Invoice.id).where(Invoice.student_id != h_id)
            )))
            print(f"Purged {r_inst.rowcount} test installments, {r_ip.rowcount} test plans")

            # 5. Invoice items & Invoices (preserve all of Harshvardhan's invoices)
            r_items = await db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id.in_(
                select(Invoice.id).where(Invoice.student_id != h_id)
            )))
            r_inv = await db.execute(delete(Invoice).where(Invoice.student_id != h_id))
            print(f"Purged {r_items.rowcount} test invoice items, {r_inv.rowcount} test invoices")

            # 6. Student Discounts
            r_sd = await db.execute(delete(StudentDiscount).where(StudentDiscount.student_id != h_id))
            print(f"Purged {r_sd.rowcount} test student discounts")

            # 7. Bed & Seat Allocations
            r_bed = await db.execute(delete(BedAllocation).where(BedAllocation.student_id != h_id))
            r_seat = await db.execute(delete(SeatAllocation).where(SeatAllocation.student_id != h_id))
            print(f"Purged {r_bed.rowcount} test bed allocations, {r_seat.rowcount} test seat allocations")

            # 8. Attendance & Services
            r_att = await db.execute(delete(AttendanceRecord).where(AttendanceRecord.student_id != h_id))
            r_asess = await db.execute(delete(AttendanceSession).where(~AttendanceSession.id.in_(
                select(AttendanceRecord.session_id)
            )))
            r_hatt = await db.execute(delete(HostelAttendance).where(HostelAttendance.student_id != h_id))
            r_satt = await db.execute(delete(StudyRoomAttendance).where(StudyRoomAttendance.student_id != h_id))
            r_srv = await db.execute(delete(StudentService).where(StudentService.student_id != h_id))
            print(f"Purged {r_att.rowcount} attendance records, {r_asess.rowcount} orphaned attendance sessions, {r_srv.rowcount} student services")

            # 9. Batch Students
            r_bs = await db.execute(delete(BatchStudent).where(BatchStudent.student_id != h_id))
            print(f"Purged {r_bs.rowcount} test batch students")

            # 10. Enrollments & subjects
            r_es = await db.execute(delete(EnrollmentSubject).where(~EnrollmentSubject.enrollment_id.in_(h_enr_ids)))
            r_ey = await db.execute(delete(EnrollmentYear).where(~EnrollmentYear.enrollment_id.in_(h_enr_ids)))
            r_enr = await db.execute(delete(Enrollment).where(~Enrollment.id.in_(h_enr_ids)))
            r_eg = await db.execute(delete(EnrollmentGroup))
            print(f"Purged {r_es.rowcount} enrollment subjects, {r_enr.rowcount} test enrollments, {r_eg.rowcount} groups")

            # 11. Guardians & Documents & User Accounts
            r_sg = await db.execute(delete(StudentGuardian).where(StudentGuardian.student_id != h_id))
            r_g = await db.execute(delete(Guardian).where(~Guardian.id.in_(h_g_ids)))
            r_doc = await db.execute(delete(StudentDocument).where(StudentDocument.student_id != h_id))
            r_sua = await db.execute(delete(StudentUserAccount).where(StudentUserAccount.student_id != h_id))
            print(f"Purged {r_sg.rowcount} student guardians, {r_g.rowcount} orphaned guardians")

            # 12. Students
            r_stu = await db.execute(delete(Student).where(Student.id != h_id))
            print(f"Purged {r_stu.rowcount} test students")

            # 13. Test Courses & their batches
            test_courses_res = await db.execute(select(Course.id).where(~Course.code.in_(required_codes)))
            test_course_ids = [c for c in test_courses_res.scalars().all()]
            print(f"Found {len(test_course_ids)} test courses to delete")

            if test_course_ids:
                test_batches_res = await db.execute(select(Batch.id).where(Batch.course_id.in_(test_course_ids)))
                test_batch_ids = [b for b in test_batches_res.scalars().all()]
                print(f"Found {len(test_batch_ids)} batches for test courses")

                if test_batch_ids:
                    await db.execute(delete(BatchStudent).where(BatchStudent.batch_id.in_(test_batch_ids)))
                    await db.execute(delete(BatchSubject).where(BatchSubject.batch_id.in_(test_batch_ids)))
                    await db.execute(delete(EnrollmentSubject).where(EnrollmentSubject.batch_id.in_(test_batch_ids)))
                    await db.execute(delete(Batch).where(Batch.id.in_(test_batch_ids)))

                await db.execute(delete(ExamMarks).where(ExamMarks.exam_subject_id.in_(
                    select(ExamSubject.id).where(ExamSubject.course_id.in_(test_course_ids))
                )))
                await db.execute(delete(ExamSubject).where(ExamSubject.course_id.in_(test_course_ids)))
                await db.execute(delete(CourseVersion).where(CourseVersion.course_id.in_(test_course_ids)))
                await db.execute(delete(Course).where(Course.id.in_(test_course_ids)))

            # 14. Test Examinations (preserve real institute assessment tests)
            test_exams = await db.execute(select(Examination.id).where(~Examination.code.in_(['EXAM-2026-MOCK-01', 'MATH-CH1-T1', 'MATH-STD08-T1'])))
            test_exam_ids = [te for te in test_exams.scalars().all()]
            print(f"Found {len(test_exam_ids)} test exams to delete")
            if test_exam_ids:
                await db.execute(delete(ExamMarks).where(ExamMarks.exam_subject_id.in_(
                    select(ExamSubject.id).where(ExamSubject.examination_id.in_(test_exam_ids))
                )))
                await db.execute(delete(ExamResult).where(ExamResult.examination_id.in_(test_exam_ids)))
                await db.execute(delete(ExamSubject).where(ExamSubject.examination_id.in_(test_exam_ids)))
                await db.execute(delete(Examination).where(Examination.id.in_(test_exam_ids)))

            # 15. Reset Hostel Beds and Study Seats Status
            await db.execute(update(HostelBed).where(HostelBed.bed_number != '102-A').values(status='AVAILABLE'))
            await db.execute(update(HostelBed).where(HostelBed.bed_number == '102-A').values(status='OCCUPIED'))
            await db.execute(update(StudySeat).where(StudySeat.seat_number != 'B005').values(status='AVAILABLE'))
            await db.execute(update(StudySeat).where(StudySeat.seat_number == 'B005').values(status='OCCUPIED'))
            print("Reset all beds and seats: 102-A and B005 remain OCCUPIED, all others AVAILABLE.")

            # 16. Ensure 7th Standard Course exists (CRS-07-REG)
            c7 = (await db.execute(select(Course).where(Course.code == 'CRS-07-REG'))).scalar_one_or_none()
            inst = (await db.execute(select(Institute))).scalars().first()
            ay = (await db.execute(select(AcademicYear).where(AcademicYear.is_active == True))).scalars().first()
            cls7 = (await db.execute(select(Class).where(Class.name == '7th Standard'))).scalar_one_or_none()
            ctype_reg = (await db.execute(select(CourseType).where(CourseType.code == 'REGULAR'))).scalars().first()

            if not c7 and cls7 and inst and ctype_reg:
                c7 = Course(
                    id=uuid.uuid4(),
                    institute_id=inst.id,
                    course_type_id=ctype_reg.id,
                    class_id=cls7.id,
                    stream_id=None,
                    is_universal=False,
                    name="7th Standard - Foundation Curriculum",
                    code="CRS-07-REG",
                    description="Comprehensive foundation coaching for 7th Standard State & CBSE boards.",
                    duration_months=12,
                    is_active=True
                )
                db.add(c7)
                await db.flush()

                cv7 = CourseVersion(
                    id=uuid.uuid4(),
                    course_id=c7.id,
                    version_number=1,
                    effective_from=date(2026, 4, 1),
                    effective_to=date(2027, 3, 31),
                    base_fee=Decimal('22000.00'),
                    is_active=True
                )
                db.add(cv7)
                await db.flush()

                # Seed subjects for 7th standard
                for sub_code in ['SCI', 'MATH', 'ENG']:
                    s_obj = (await db.execute(select(Subject).where(Subject.code == sub_code))).scalars().first()
                    if s_obj:
                        db.add(CourseVersionSubject(course_version_id=cv7.id, subject_id=s_obj.id, is_mandatory=True))
                print("Seeded missing CRS-07-REG (7th Standard - Foundation Curriculum, base fee ₹22,000)")

            # 17. Ensure 11th & 12th Science courses have active CourseVersions
            for sci_code, sci_fee in [('CRS-11-SCI-INT', Decimal('45000.00')), ('CRS-12-SCI-INT', Decimal('48000.00'))]:
                c_sci = (await db.execute(select(Course).where(Course.code == sci_code))).scalar_one_or_none()
                if c_sci:
                    active_cv = (await db.execute(select(CourseVersion).where(CourseVersion.course_id == c_sci.id, CourseVersion.is_active == True))).scalars().first()
                    if not active_cv:
                        latest_cv = (await db.execute(select(CourseVersion).where(CourseVersion.course_id == c_sci.id).order_by(CourseVersion.version_number.desc()))).scalars().first()
                        if latest_cv:
                            latest_cv.is_active = True
                        else:
                            new_cv = CourseVersion(
                                id=uuid.uuid4(),
                                course_id=c_sci.id,
                                version_number=1,
                                effective_from=date(2026, 4, 1),
                                effective_to=date(2027, 3, 31),
                                base_fee=sci_fee,
                                is_active=True
                            )
                            db.add(new_cv)
                        print(f"Activated CourseVersion for {sci_code}")

            # 18. Ensure production batches exist for standards with 0 batches
            course_batches_to_ensure = [
                ('CRS-06-REG', '6th Standard - Division A', 'BAT-06A', 'A'),
                ('CRS-07-REG', '7th Standard - Division A', 'BAT-07A', 'A'),
                ('CRS-12-SCI-INT', '12th Science - Division A', 'BAT-12SCI-A', 'A'),
                ('CRS-12-COMM-REG', '12th Commerce - Division A', 'BAT-12COMM-A', 'A'),
            ]
            for c_code, b_name, b_code, div in course_batches_to_ensure:
                crs = (await db.execute(select(Course).where(Course.code == c_code))).scalar_one_or_none()
                if crs:
                    existing_b = (await db.execute(select(Batch).where(Batch.course_id == crs.id))).scalars().first()
                    if not existing_b and ay:
                        new_b = Batch(
                            id=uuid.uuid4(),
                            academic_year_id=ay.id,
                            course_id=crs.id,
                            division=div,
                            name=b_name,
                            code=b_code,
                            max_capacity=50,
                            start_date=date(2026, 4, 1),
                            end_date=date(2027, 3, 31),
                            is_active=True
                        )
                        db.add(new_b)
                        await db.flush()
                        print(f"Created standard batch: {b_name} ({b_code}) for {c_code}")

            # 19. Ensure all active batches have subjects auto-provisioned from CourseVersion
            all_batches = (await db.execute(select(Batch))).scalars().all()
            for b in all_batches:
                existing_subs = (await db.execute(select(BatchSubject).where(BatchSubject.batch_id == b.id))).scalars().all()
                if not existing_subs:
                    cv = (await db.execute(select(CourseVersion).where(CourseVersion.course_id == b.course_id, CourseVersion.is_active == True))).scalars().first()
                    if cv:
                        cv_subs = (await db.execute(select(CourseVersionSubject).where(CourseVersionSubject.course_version_id == cv.id))).scalars().all()
                        for cvs in cv_subs:
                            db.add(BatchSubject(id=uuid.uuid4(), batch_id=b.id, subject_id=cvs.subject_id))
                            print(f"Auto-mapped subject {cvs.subject_id} to batch {b.name} ({b.code})")

            # 20. Ensure Spoken English batch (BT-ENG-WKD) strictly has English subject only
            eng_batch = (await db.execute(select(Batch).where(Batch.code == 'BT-ENG-WKD'))).scalar_one_or_none()
            if eng_batch:
                eng_sub = (await db.execute(select(Subject).where(Subject.code == 'ENG'))).scalars().first()
                if eng_sub:
                    # Remove any accidental non-English subjects (e.g., Physics)
                    await db.execute(delete(BatchSubject).where(BatchSubject.batch_id == eng_batch.id, BatchSubject.subject_id != eng_sub.id))
                    has_eng = (await db.execute(select(BatchSubject).where(BatchSubject.batch_id == eng_batch.id, BatchSubject.subject_id == eng_sub.id))).scalars().first()
                    if not has_eng:
                        db.add(BatchSubject(id=uuid.uuid4(), batch_id=eng_batch.id, subject_id=eng_sub.id))
                        print("Restored English subject to Spoken English batch BT-ENG-WKD")

            print(">>> DATABASE TRANSACTION COMMITTED SUCCESSFULLY!")

    # Invalidate Redis caches so test courses/data never linger in cache
    try:
        from app.core.cache import cache_service
        await cache_service.delete_pattern("ycc:v1:*")
        print(">>> REDIS CACHE FLUSHED SUCCESSFULLY!")
    except Exception as e:
        print(f"Notice: Cache cleanup skipped: {e}")

if __name__ == '__main__':
    asyncio.run(clean_database())
