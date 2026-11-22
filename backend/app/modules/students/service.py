import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.student import Student


async def generate_student_code_and_prn(db: AsyncSession, year: int = 2026) -> tuple[str, str]:
    """
    Safely generates the next sequential student_code (e.g. STU-2026-00252)
    and prn (e.g. PRN-2026-00252) without relying on simple row counts,
    preventing duplicate key collisions when records are deleted or test runs leave gaps.
    """
    # 1. Query highest existing student_code for this year
    stmt_code = (
        select(Student.student_code)
        .where(Student.student_code.like(f"STU-{year}-%"))
        .order_by(Student.student_code.desc())
        .limit(1)
    )
    last_code = (await db.execute(stmt_code)).scalar_one_or_none()
    code_seq = 0
    if last_code:
        match = re.search(r'\d+$', last_code)
        if match:
            code_seq = int(match.group(0))

    # 2. Query highest existing PRN for this year
    stmt_prn = (
        select(Student.prn)
        .where(Student.prn.like(f"PRN-{year}-%"))
        .order_by(Student.prn.desc())
        .limit(1)
    )
    last_prn = (await db.execute(stmt_prn)).scalar_one_or_none()
    prn_seq = 0
    if last_prn:
        match = re.search(r'\d+$', last_prn)
        if match:
            prn_seq = int(match.group(0))

    next_seq = max(code_seq, prn_seq) + 1

    # 3. Collision check loop to ensure absolute uniqueness
    while True:
        candidate_code = f"STU-{year}-{next_seq:05d}"
        candidate_prn = f"PRN-{year}-{next_seq:05d}"
        exists_stmt = select(Student.id).where(
            (Student.student_code == candidate_code) | (Student.prn == candidate_prn)
        )
        if not (await db.execute(exists_stmt)).first():
            return candidate_code, candidate_prn
        next_seq += 1
