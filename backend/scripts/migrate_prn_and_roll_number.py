import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text


async def run_migration():
    async with AsyncSessionLocal() as session:
        async with session.begin():
            print("🚀 Starting migration for PRN, Division, and Roll Numbers...")

            # 1. Add prn column to students
            await session.execute(
                text("""
                    ALTER TABLE students 
                    ADD COLUMN IF NOT EXISTS prn VARCHAR(50);
                """)
            )
            # Create unique index if not exists
            await session.execute(
                text("""
                    CREATE UNIQUE INDEX IF NOT EXISTS ix_students_prn ON students (prn);
                """)
            )
            print("✅ Verified/Added column 'prn' to students table")

            # 2. Add division column to batches
            await session.execute(
                text("""
                    ALTER TABLE batches 
                    ADD COLUMN IF NOT EXISTS division VARCHAR(20) DEFAULT 'A' NOT NULL;
                """)
            )
            print("✅ Verified/Added column 'division' to batches table")

            # 3. Add roll_number column to batch_students
            await session.execute(
                text("""
                    ALTER TABLE batch_students 
                    ADD COLUMN IF NOT EXISTS roll_number INTEGER;
                """)
            )
            # Create unique constraint per (batch_id, roll_number) if not exists
            await session.execute(
                text("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'uq_batch_student_roll'
                        ) THEN
                            ALTER TABLE batch_students
                            ADD CONSTRAINT uq_batch_student_roll UNIQUE (batch_id, roll_number);
                        END IF;
                    END $$;
                """)
            )
            # Create positive check constraint if not exists
            await session.execute(
                text("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'check_positive_roll_number'
                        ) THEN
                            ALTER TABLE batch_students
                            ADD CONSTRAINT check_positive_roll_number CHECK (roll_number IS NULL OR roll_number > 0);
                        END IF;
                    END $$;
                """)
            )
            print("✅ Verified/Added column 'roll_number' and unique constraint to batch_students table")

            # 4. Backfill PRN for any existing students where PRN is null
            res = await session.execute(
                text("SELECT id, student_code FROM students WHERE prn IS NULL ORDER BY created_at ASC")
            )
            students_to_backfill = res.fetchall()
            print(f"Backfilling PRN for {len(students_to_backfill)} students...")
            for idx, stu in enumerate(students_to_backfill, start=1):
                # If student_code is e.g. STU-2026-00001, PRN can be PRN-2026-00001
                if stu.student_code and stu.student_code.startswith("STU-"):
                    prn_val = stu.student_code.replace("STU-", "PRN-")
                else:
                    prn_val = f"PRN-2026-{idx:05d}"
                await session.execute(
                    text("UPDATE students SET prn = :prn WHERE id = :id"),
                    {"prn": prn_val, "id": stu.id}
                )
            print("✅ Backfilled student PRNs")

            # 5. Backfill batch division if empty
            await session.execute(
                text("UPDATE batches SET division = 'A' WHERE division IS NULL OR division = ''")
            )
            print("✅ Backfilled batch divisions")

    print("🎉 Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())
