"""
Safe Database Cleanup Script:
Purges all transient test data created during test executions while strictly preserving:
- Harshvardhan Patil (STU-2026-00001 / PRN-2026-00001) & all related invoices, payments, enrollments, allocations
- Real Institute Admin & Staff Users (yccform@gmail.com, teacher@institute.edu)
- Real Seeded Courses (5th to 12th standard regular board / CET courses)
- Real Teaching Batches (BAT-09-BOARD-A, BAT-06A, BAT-07A, BAT-12SCI-A, BAT-12COMM-A)
- Real Hostel Rooms (101, 102, 103, 104, 201, 202) and Floors
- Real Study Seats & Study Rooms
- Real Service Plans & Examinations
"""
import sys
from datetime import datetime
from sqlalchemy import text
from app.core.database import sync_engine
from app.core.config import settings

REAL_STUDENT_ID = 'c8173ae3-6e50-4eda-9804-ac5f0fe1c788'
TEST_CUTOFF = '2026-11-23 16:00:00+00'

def purge_test_data_sync(cutoff=None):
    if cutoff is None:
        cutoff_str = TEST_CUTOFF
    elif isinstance(cutoff, datetime):
        cutoff_str = cutoff.isoformat()
    else:
        cutoff_str = str(cutoff)

    print(f"\n>>> Starting Safe Synchronous Purge of Test Data (cutoff={cutoff_str})...")

    with sync_engine.begin() as conn:
        # 1. Restore beds occupied by test students back to AVAILABLE
        conn.execute(text(f"""
            UPDATE hostel_beds 
            SET status = 'AVAILABLE' 
            WHERE id IN (
                SELECT hostel_bed_id FROM bed_allocations 
                WHERE student_id != '{REAL_STUDENT_ID}'
            ) AND id != 'fd4ceee0-3319-4737-b09c-9cdb71dc2457'
        """))
        print("Restored real hostel beds occupied by test students back to AVAILABLE.")

        # 2. Restore seats occupied by test students back to AVAILABLE
        conn.execute(text(f"""
            UPDATE study_seats 
            SET status = 'AVAILABLE' 
            WHERE id IN (
                SELECT study_seat_id FROM seat_allocations 
                WHERE student_id != '{REAL_STUDENT_ID}'
            ) AND id != '84e14276-9b51-459a-a2a2-6466590f1ed2'
        """))
        print("Restored real study seats occupied by test students back to AVAILABLE.")

        # 3. Delete Bed & Seat Allocations for test students
        r_ba = conn.execute(text(f"DELETE FROM bed_allocations WHERE student_id != '{REAL_STUDENT_ID}'"))
        r_sa = conn.execute(text(f"DELETE FROM seat_allocations WHERE student_id != '{REAL_STUDENT_ID}'"))
        print(f"Purged {r_ba.rowcount} test bed allocations, {r_sa.rowcount} test seat allocations.")

        # 4. Delete Test Beds, Test Rooms, Test Floors
        r_tb = conn.execute(text(f"DELETE FROM hostel_beds WHERE created_at >= '{cutoff_str}'"))
        r_tr = conn.execute(text(f"DELETE FROM hostel_rooms WHERE created_at >= '{cutoff_str}'"))
        r_tf = conn.execute(text(f"DELETE FROM hostel_floors WHERE created_at >= '{cutoff_str}'"))
        print(f"Purged {r_tb.rowcount} test beds, {r_tr.rowcount} test rooms, {r_tf.rowcount} test floors.")

        # 5. Delete Test Student Services & Test Service Plans
        r_ss = conn.execute(text(f"DELETE FROM student_services WHERE student_id != '{REAL_STUDENT_ID}'"))
        r_sp = conn.execute(text(f"DELETE FROM service_plans WHERE created_at >= '{cutoff_str}'"))
        print(f"Purged {r_ss.rowcount} test student services, {r_sp.rowcount} test service plans.")

        # 6. Delete Test Receipts, Refunds, Payment Allocations & Payments
        r_rcp = conn.execute(text(f"DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE student_id != '{REAL_STUDENT_ID}')"))
        r_ref = conn.execute(text(f"DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE student_id != '{REAL_STUDENT_ID}')"))
        r_pa = conn.execute(text(f"DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE student_id != '{REAL_STUDENT_ID}')"))
        r_pay = conn.execute(text(f"DELETE FROM payments WHERE student_id != '{REAL_STUDENT_ID}'"))
        print(f"Purged {r_rcp.rowcount} test receipts, {r_ref.rowcount} test refunds, {r_pa.rowcount} test payment allocations, {r_pay.rowcount} test payments.")

        # 7. Delete Test Installments, Plans, Invoice Items & Invoices
        r_inst = conn.execute(text(f"""
            DELETE FROM installments WHERE installment_plan_id IN (
                SELECT ip.id FROM installment_plans ip
                JOIN invoices inv ON inv.id = ip.invoice_id
                WHERE inv.student_id != '{REAL_STUDENT_ID}'
            )
        """))
        r_ip = conn.execute(text(f"""
            DELETE FROM installment_plans WHERE invoice_id IN (
                SELECT id FROM invoices WHERE student_id != '{REAL_STUDENT_ID}'
            )
        """))
        r_ii = conn.execute(text(f"""
            DELETE FROM invoice_items WHERE invoice_id IN (
                SELECT id FROM invoices WHERE student_id != '{REAL_STUDENT_ID}'
            )
        """))
        r_inv = conn.execute(text(f"DELETE FROM invoices WHERE student_id != '{REAL_STUDENT_ID}'"))
        print(f"Purged {r_inst.rowcount} test installments, {r_ip.rowcount} test plans, {r_ii.rowcount} test invoice items, {r_inv.rowcount} test invoices.")

        # 8. Delete Test Discounts
        r_disc = conn.execute(text(f"DELETE FROM student_discounts WHERE student_id != '{REAL_STUDENT_ID}'"))
        print(f"Purged {r_disc.rowcount} test student discounts.")

        # 9. Delete Test Attendance Records & Sessions
        r_ar = conn.execute(text(f"DELETE FROM attendance_records WHERE student_id != '{REAL_STUDENT_ID}'"))
        r_as = conn.execute(text(f"DELETE FROM attendance_sessions WHERE created_at >= '{cutoff_str}'"))
        print(f"Purged {r_ar.rowcount} test attendance records, {r_as.rowcount} test attendance sessions.")

        # 10. Delete Test Exam Marks, Results & Exams
        conn.execute(text(f"DELETE FROM exam_marks WHERE student_id != '{REAL_STUDENT_ID}'"))
        conn.execute(text(f"DELETE FROM exam_results WHERE student_id != '{REAL_STUDENT_ID}'"))
        r_ex = conn.execute(text(f"DELETE FROM examinations WHERE created_at >= '{cutoff_str}'"))
        print(f"Purged test exam marks, results, and {r_ex.rowcount} test examinations.")

        # 11. Delete Batch Students for test batches or test students
        r_bs = conn.execute(text(f"""
            DELETE FROM batch_students 
            WHERE student_id != '{REAL_STUDENT_ID}' 
               OR batch_id IN (SELECT id FROM batches WHERE created_at >= '{cutoff_str}')
        """))
        print(f"Purged {r_bs.rowcount} test batch student assignments.")

        # 12. Delete Test Enrollment Subjects, Enrollments, Enrollment Groups
        r_es = conn.execute(text(f"""
            DELETE FROM enrollment_subjects 
            WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id != '{REAL_STUDENT_ID}')
        """))
        r_enr = conn.execute(text(f"DELETE FROM enrollments WHERE student_id != '{REAL_STUDENT_ID}'"))
        r_eg = conn.execute(text(f"DELETE FROM enrollment_groups WHERE created_at >= '{cutoff_str}'"))
        print(f"Purged {r_es.rowcount} test enrollment subjects, {r_enr.rowcount} test enrollments, {r_eg.rowcount} test enrollment groups.")

        # 13. Delete Batch Subjects for test batches, and Test Batches
        r_bsubj = conn.execute(text(f"DELETE FROM batch_subjects WHERE batch_id IN (SELECT id FROM batches WHERE created_at >= '{cutoff_str}')"))
        r_batch = conn.execute(text(f"DELETE FROM batches WHERE created_at >= '{cutoff_str}'"))
        print(f"Purged {r_bsubj.rowcount} test batch subjects, {r_batch.rowcount} test batches.")

        # 14. Delete Course Version Subjects, Course Versions & Test Courses
        conn.execute(text(f"""
            DELETE FROM course_version_subjects WHERE course_version_id IN (
                SELECT id FROM course_versions WHERE course_id IN (SELECT id FROM courses WHERE created_at >= '{cutoff_str}')
            )
        """))
        r_cv = conn.execute(text(f"DELETE FROM course_versions WHERE course_id IN (SELECT id FROM courses WHERE created_at >= '{cutoff_str}')"))
        r_crs = conn.execute(text(f"DELETE FROM courses WHERE created_at >= '{cutoff_str}'"))
        print(f"Purged {r_cv.rowcount} test course versions, {r_crs.rowcount} test courses.")

        # 15. Delete Test Notifications & Outbox
        r_notif = conn.execute(text(f"DELETE FROM notifications WHERE created_at >= '{cutoff_str}'"))
        r_outbox = conn.execute(text(f"DELETE FROM notification_outbox WHERE created_at >= '{cutoff_str}'"))
        print(f"Purged {r_notif.rowcount} test notifications, {r_outbox.rowcount} test notification outbox records.")

        # 16. Delete Test Student Guardians & Guardians
        r_sg = conn.execute(text(f"DELETE FROM student_guardians WHERE student_id != '{REAL_STUDENT_ID}'"))
        r_g = conn.execute(text(f"""
            DELETE FROM guardians 
            WHERE id NOT IN (SELECT guardian_id FROM student_guardians WHERE student_id = '{REAL_STUDENT_ID}')
        """))
        print(f"Purged {r_sg.rowcount} test student guardians, {r_g.rowcount} test guardians.")

        # 17. Delete Test Users
        r_users = conn.execute(text(f"""
            DELETE FROM users 
            WHERE email NOT IN ('yccform@gmail.com', 'teacher@institute.edu', 'harshalpatil9949@gmail.com', 'harshvardhanpatil090@gmail.com')
              AND id NOT IN (SELECT user_id FROM students WHERE id = '{REAL_STUDENT_ID}' AND user_id IS NOT NULL)
              AND id NOT IN (SELECT user_id FROM guardians WHERE id IN (SELECT guardian_id FROM student_guardians WHERE student_id = '{REAL_STUDENT_ID}') AND user_id IS NOT NULL)
        """))
        print(f"Purged {r_users.rowcount} test users.")

        # 18. Delete Test Students
        r_stus = conn.execute(text(f"DELETE FROM students WHERE id != '{REAL_STUDENT_ID}'"))
        print(f"Purged {r_stus.rowcount} test students.")

    # 19. Flush Cache
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL)
        r.flushdb()
        print("Backend Redis cache flushed successfully.")
    except Exception as e:
        print(f"Cache flush warning: {e}")

    print(">>> All test data successfully purged! Real records completely intact.\n")

async def purge_test_data(cutoff=None):
    purge_test_data_sync(cutoff)

if __name__ == '__main__':
    purge_test_data_sync()
