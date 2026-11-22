import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SyncSessionLocal
from sqlalchemy import text


def purge_students_and_fees():
    db = SyncSessionLocal()
    try:
        print("🚀 Starting clean purge of Student Registry & Dynamic Fee Engine test data...")

        # 1. Inspect current counts
        counts_to_check = [
            "students", "guardians", "student_guardians", "student_services",
            "enrollments", "enrollment_subjects", "enrollment_groups", "enrollment_years",
            "invoices", "invoice_items", "installment_plans", "installments",
            "payments", "payment_allocations", "receipts",
            "seat_allocations", "bed_allocations", "batch_students",
            "attendance_records", "study_room_attendance", "exam_results", "exam_marks"
        ]

        print("\n📊 Counts BEFORE purge:")
        for tbl in counts_to_check:
            try:
                cnt = db.execute(text(f'SELECT count(*) FROM "{tbl}";')).scalar()
                if cnt > 0:
                    print(f"  - {tbl}: {cnt}")
            except Exception:
                pass

        # 2. Execute deletion inside transaction
        print("\n🧹 Executing cascaded database purge...")

        # Step A: Dynamic Fee Engine
        db.execute(text("DELETE FROM receipts;"))
        db.execute(text("DELETE FROM payment_allocations;"))
        db.execute(text("DELETE FROM payments;"))
        db.execute(text("DELETE FROM installments;"))
        db.execute(text("DELETE FROM installment_plans;"))
        db.execute(text("DELETE FROM invoice_items;"))
        db.execute(text("DELETE FROM invoices;"))

        # Step B: Student Academics, Results & Facility Allocations
        db.execute(text("DELETE FROM seat_allocations;"))
        db.execute(text("DELETE FROM bed_allocations;"))
        db.execute(text("DELETE FROM student_services;"))
        db.execute(text("DELETE FROM attendance_records;"))
        db.execute(text("DELETE FROM study_room_attendance;"))
        db.execute(text("DELETE FROM exam_marks;"))
        db.execute(text("DELETE FROM exam_results;"))
        db.execute(text("DELETE FROM batch_students;"))

        # Enrollment mappings
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

        # Student Documents & Guardians
        try:
            db.execute(text("DELETE FROM student_documents;"))
        except Exception:
            pass
        db.execute(text("DELETE FROM student_guardians;"))
        db.execute(text("DELETE FROM guardians;"))

        # Step C: Delete Students
        db.execute(text("DELETE FROM students;"))

        # Step D: Reset Facility Inventory Status to 100% AVAILABLE
        db.execute(text("UPDATE study_seats SET status = 'AVAILABLE';"))
        db.execute(text("UPDATE hostel_beds SET status = 'AVAILABLE';"))

        db.commit()
        print("✅ Purge transaction successfully committed!")

        # 3. Verify counts after purge
        print("\n📊 Counts AFTER purge:")
        for tbl in counts_to_check:
            try:
                cnt = db.execute(text(f'SELECT count(*) FROM "{tbl}";')).scalar()
                print(f"  - {tbl}: {cnt}")
            except Exception:
                pass

        seats_occupied = db.execute(text("SELECT count(*) FROM study_seats WHERE status = 'OCCUPIED';")).scalar()
        seats_available = db.execute(text("SELECT count(*) FROM study_seats WHERE status = 'AVAILABLE';")).scalar()
        beds_occupied = db.execute(text("SELECT count(*) FROM hostel_beds WHERE status = 'OCCUPIED';")).scalar()
        beds_available = db.execute(text("SELECT count(*) FROM hostel_beds WHERE status = 'AVAILABLE';")).scalar()

        print(f"\n🪑 Study Seats: {seats_available} AVAILABLE, {seats_occupied} OCCUPIED")
        print(f"🛏️ Hostel Beds: {beds_available} AVAILABLE, {beds_occupied} OCCUPIED")
        print("\n🎉 Student Registry and Dynamic Fee Engine test data cleared cleanly!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during purge: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    purge_students_and_fees()
