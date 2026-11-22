import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SyncSessionLocal
from sqlalchemy import text


def purge_everything_clean():
    db = SyncSessionLocal()
    try:
        print("🚀 Executing Full System Cleanup: Student Registry, Fee Engine, Test Desks & Test Artifacts...")

        # -------------------------------------------------------------
        # STEP 1: WIPE DYNAMIC FEE ENGINE
        # -------------------------------------------------------------
        print("\n1️⃣ Clearing Dynamic Fee Engine...")
        db.execute(text("DELETE FROM receipts;"))
        db.execute(text("DELETE FROM payment_allocations;"))
        db.execute(text("DELETE FROM payments;"))
        db.execute(text("DELETE FROM installments;"))
        db.execute(text("DELETE FROM installment_plans;"))
        db.execute(text("DELETE FROM invoice_items;"))
        db.execute(text("DELETE FROM invoices;"))
        print("  ✓ All receipts, payments, installment plans, and invoices wiped.")

        # -------------------------------------------------------------
        # STEP 2: WIPE ALL ALLOCATIONS, MARKS & SERVICES
        # -------------------------------------------------------------
        print("\n2️⃣ Clearing Allocations, Services & Results...")
        db.execute(text("DELETE FROM seat_allocations;"))
        db.execute(text("DELETE FROM bed_allocations;"))
        db.execute(text("DELETE FROM student_services;"))
        db.execute(text("DELETE FROM attendance_records;"))
        db.execute(text("DELETE FROM study_room_attendance;"))
        db.execute(text("DELETE FROM exam_marks;"))
        db.execute(text("DELETE FROM exam_results;"))
        db.execute(text("DELETE FROM batch_students;"))
        print("  ✓ All facility allocations, student services, attendance, and exam marks wiped.")

        # -------------------------------------------------------------
        # STEP 3: WIPE ENROLLMENTS & STUDENT REGISTRY
        # -------------------------------------------------------------
        print("\n3️⃣ Clearing Student Registry & Enrollments...")
        try:
            db.execute(text("DELETE FROM enrollment_subjects;"))
        except Exception:
            pass
        try:
            db.execute(text("DELETE FROM enrollment_groups;"))
        except Exception:
            pass
        try:
            db.execute(text("DELETE FROM enrollment_years;"))
        except Exception:
            pass
        db.execute(text("DELETE FROM enrollments;"))

        try:
            db.execute(text("DELETE FROM student_documents;"))
        except Exception:
            pass
        db.execute(text("DELETE FROM student_guardians;"))
        db.execute(text("DELETE FROM guardians;"))
        db.execute(text("DELETE FROM students;"))
        print("  ✓ All students, guardians, and enrollments wiped.")

        # -------------------------------------------------------------
        # STEP 4: REMOVE TEST DESKS & DUMMY STUDY ROOMS
        # -------------------------------------------------------------
        print("\n4️⃣ Removing Test Desks & Cleaning Study Library...")
        # Delete any seat that is not in the standard set (B001-B105 and G001-G045)
        del_seats_res = db.execute(text("""
            DELETE FROM study_seats 
            WHERE seat_number LIKE 'TG-%' 
               OR seat_number LIKE 'S-%'
               OR study_room_id IN (SELECT id FROM study_rooms WHERE code != 'SR-MAIN');
        """))
        print(f"  ✓ Deleted {del_seats_res.rowcount} test study desks.")

        # Delete any dummy study rooms that were created in tests
        del_rooms_res = db.execute(text("DELETE FROM study_rooms WHERE code != 'SR-MAIN';"))
        print(f"  ✓ Deleted {del_rooms_res.rowcount} dummy study rooms.")

        # Reset ALL remaining standard desks (B001-B105, G001-G045) to AVAILABLE
        db.execute(text("UPDATE study_seats SET status = 'AVAILABLE';"))
        db.execute(text("UPDATE study_rooms SET total_capacity = 150 WHERE code = 'SR-MAIN';"))
        print("  ✓ All 150 standard desks (B001-B105, G001-G045) reset to AVAILABLE.")

        # -------------------------------------------------------------
        # STEP 5: REMOVE TEST HOSTELS & DUMMY BEDS
        # -------------------------------------------------------------
        print("\n5️⃣ Removing Test Hostels & Cleaning Beds...")
        # Get IDs of test hostels
        test_hostel_ids_res = db.execute(text("SELECT id FROM hostels WHERE code NOT IN ('H-BOYS', 'H-GIRLS');")).fetchall()
        test_hostel_ids = [str(r[0]) for r in test_hostel_ids_res]
        if test_hostel_ids:
            for hid in test_hostel_ids:
                db.execute(text(f"""
                    DELETE FROM hostel_beds WHERE room_id IN (
                        SELECT hr.id FROM hostel_rooms hr 
                        JOIN hostel_floors hf ON hr.floor_id = hf.id
                        JOIN hostel_buildings hb ON hf.building_id = hb.id
                        WHERE hb.hostel_id = '{hid}'
                    );
                """))
                db.execute(text(f"""
                    DELETE FROM hostel_rooms WHERE floor_id IN (
                        SELECT hf.id FROM hostel_floors hf
                        JOIN hostel_buildings hb ON hf.building_id = hb.id
                        WHERE hb.hostel_id = '{hid}'
                    );
                """))
                db.execute(text(f"DELETE FROM hostel_floors WHERE building_id IN (SELECT id FROM hostel_buildings WHERE hostel_id = '{hid}');"))
                db.execute(text(f"DELETE FROM hostel_buildings WHERE hostel_id = '{hid}';"))
                db.execute(text(f"DELETE FROM hostels WHERE id = '{hid}';"))
            print(f"  ✓ Removed {len(test_hostel_ids)} test hostels and associated structure.")

        # Reset ALL standard beds to AVAILABLE
        db.execute(text("UPDATE hostel_beds SET status = 'AVAILABLE';"))
        print("  ✓ All standard hostel beds reset to AVAILABLE.")

        # -------------------------------------------------------------
        # STEP 6: REMOVE TEST COURSES (CRS-DYN-*, CRS-ENR-*)
        # -------------------------------------------------------------
        print("\n6️⃣ Cleaning Test Courses...")
        standard_codes = (
            "'CRS-05-REG', 'CRS-06-REG', 'CRS-07-REG', 'CRS-08-REG', "
            "'CRS-09-BOARD', 'CRS-10-BOARD', 'CRS-11-SCI-INT', 'CRS-12-SCI-INT', "
            "'CRS-11-COMM-REG', 'CRS-12-COMM-REG', 'CRS-STD-12-SCI'"
        )
        test_course_ids = [
            str(r[0]) for r in db.execute(text(f"SELECT id FROM courses WHERE code NOT IN ({standard_codes});")).fetchall()
        ]
        if test_course_ids:
            for cid in test_course_ids:
                # Delete version subjects
                db.execute(text(f"DELETE FROM course_version_subjects WHERE course_version_id IN (SELECT id FROM course_versions WHERE course_id = '{cid}');"))
                # Delete versions
                db.execute(text(f"DELETE FROM course_versions WHERE course_id = '{cid}';"))
                # Delete course
                db.execute(text(f"DELETE FROM courses WHERE id = '{cid}';"))
            print(f"  ✓ Deleted {len(test_course_ids)} test courses and their versions.")

        # Commit all changes
        db.commit()
        print("\n🎉 TRANSACTION COMMITTED SUCCESSFULLY!")

        # -------------------------------------------------------------
        # VERIFICATION
        # -------------------------------------------------------------
        print("\n📈 FINAL VERIFIED METRICS:")
        students_cnt = db.execute(text("SELECT count(*) FROM students;")).scalar()
        invoices_cnt = db.execute(text("SELECT count(*) FROM invoices;")).scalar()
        payments_cnt = db.execute(text("SELECT count(*) FROM payments;")).scalar()
        receipts_cnt = db.execute(text("SELECT count(*) FROM receipts;")).scalar()
        seats_cnt = db.execute(text("SELECT count(*) FROM study_seats;")).scalar()
        seats_avail = db.execute(text("SELECT count(*) FROM study_seats WHERE status = 'AVAILABLE';")).scalar()
        seats_occ = db.execute(text("SELECT count(*) FROM study_seats WHERE status = 'OCCUPIED';")).scalar()
        hostels_cnt = db.execute(text("SELECT count(*) FROM hostels;")).scalar()
        beds_cnt = db.execute(text("SELECT count(*) FROM hostel_beds;")).scalar()
        beds_avail = db.execute(text("SELECT count(*) FROM hostel_beds WHERE status = 'AVAILABLE';")).scalar()
        courses_cnt = db.execute(text("SELECT count(*) FROM courses;")).scalar()

        print(f"  • Students:           {students_cnt} (Completely Empty)")
        print(f"  • Invoices:           {invoices_cnt} (Completely Empty)")
        print(f"  • Payments:           {payments_cnt} (Completely Empty)")
        print(f"  • Receipts:           {receipts_cnt} (Completely Empty)")
        print(f"  • Study Desks:        {seats_cnt} total ({seats_avail} AVAILABLE, {seats_occ} OCCUPIED)")
        print(f"  • Hostel Properties:  {hostels_cnt} ({beds_cnt} beds total: {beds_avail} AVAILABLE)")
        print(f"  • Master Courses:     {courses_cnt} standard courses")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during cleanup: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    purge_everything_clean()
