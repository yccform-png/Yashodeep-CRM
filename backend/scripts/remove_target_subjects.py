import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text


async def remove_subjects():
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # 1. Find target subject IDs
            res = await session.execute(
                text("SELECT id, code, name FROM subjects WHERE code IN ('ACC', 'BST', 'ECO')")
            )
            targets = res.fetchall()
            print("Found target subjects to remove:")
            for r in targets:
                print(f"  - {r.code}: {r.name} (id: {r.id})")

            if not targets:
                print("No matching subjects found. Nothing to delete.")
                return

            target_ids = [str(r.id) for r in targets]
            id_list_str = "', '".join(target_ids)

            # 2. Delete ExamMarks referencing ExamSubjects of target subjects
            res_em = await session.execute(
                text(f"""
                    DELETE FROM exam_marks 
                    WHERE exam_subject_id IN (
                        SELECT id FROM exam_subjects WHERE subject_id IN ('{id_list_str}')
                    )
                """)
            )
            print(f"Deleted exam_marks: {res_em.rowcount}")

            # 3. Delete ExamSubjects
            res_es = await session.execute(
                text(f"DELETE FROM exam_subjects WHERE subject_id IN ('{id_list_str}')")
            )
            print(f"Deleted exam_subjects: {res_es.rowcount}")

            # 4. Delete EnrollmentSubjects
            res_ens = await session.execute(
                text(f"DELETE FROM enrollment_subjects WHERE subject_id IN ('{id_list_str}')")
            )
            print(f"Deleted enrollment_subjects: {res_ens.rowcount}")

            # 5. Delete CourseVersionSubjects
            res_cvs = await session.execute(
                text(f"DELETE FROM course_version_subjects WHERE subject_id IN ('{id_list_str}')")
            )
            print(f"Deleted course_version_subjects: {res_cvs.rowcount}")

            # 6. Delete BatchSubjects
            res_bs = await session.execute(
                text(f"DELETE FROM batch_subjects WHERE subject_id IN ('{id_list_str}')")
            )
            print(f"Deleted batch_subjects: {res_bs.rowcount}")

            # 7. Delete ClassSubjects
            res_cs = await session.execute(
                text(f"DELETE FROM class_subjects WHERE subject_id IN ('{id_list_str}')")
            )
            print(f"Deleted class_subjects: {res_cs.rowcount}")

            # 8. Delete SubjectGroupItems
            res_sgi = await session.execute(
                text(f"DELETE FROM subject_group_items WHERE subject_id IN ('{id_list_str}')")
            )
            print(f"Deleted subject_group_items: {res_sgi.rowcount}")

            # 9. Delete COMM-CORE subject group (Commerce Core Package)
            res_sg = await session.execute(
                text("DELETE FROM subject_groups WHERE code = 'COMM-CORE'")
            )
            print(f"Deleted subject_groups (COMM-CORE): {res_sg.rowcount}")

            # 10. Delete Subjects themselves
            res_sub = await session.execute(
                text(f"DELETE FROM subjects WHERE id IN ('{id_list_str}')")
            )
            print(f"Deleted subjects: {res_sub.rowcount}")

        # Verification step in a new transaction
        async with session.begin():
            remaining = await session.execute(
                text("SELECT code, name FROM subjects WHERE code IN ('ACC', 'BST', 'ECO')")
            )
            rem_list = remaining.fetchall()
            print(f"Verification: remaining target subjects count = {len(rem_list)}")
            assert len(rem_list) == 0, f"Error: Still found {rem_list}"

            total_subjects = await session.execute(text("SELECT count(*) FROM subjects"))
            print(f"Verification: total subjects in database = {total_subjects.scalar()}")


if __name__ == "__main__":
    asyncio.run(remove_subjects())
