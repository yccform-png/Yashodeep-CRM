import re
from typing import Optional
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.student import Student


async def generate_student_code_and_prn(
    db: AsyncSession,
    year: Optional[int] = None,
    admission_date: Optional[date] = None
) -> tuple[str, str]:
    """
    Safely generates the next sequential student_code (e.g. STU-2026-00001)
    and 12-digit numeric-only PRN (e.g. 202601040216: YYYY + DD + MM + NNNN)
    without relying on simple row counts, preventing duplicate collisions.

    Option A (Yearly Sequence):
      - YYYY: Enrollment year (4 digits, e.g. 2026)
      - DD: Day of enrollment (2 digits, e.g. 01)
      - MM: Month of enrollment (2 digits, e.g. 04)
      - NNNN: Sequential enrollment counter for that academic year (4 digits, e.g. 0001, 0216)
    """
    adm_date = admission_date or date.today()
    if year is None:
        year = adm_date.year

    year_str = f"{year:04d}"
    day_str = f"{adm_date.day:02d}"
    month_str = f"{adm_date.month:02d}"

    # 1. Query highest existing student_code sequence for this year
    stmt_code = (
        select(Student.student_code)
        .where(Student.student_code.like(f"STU-{year_str}-%"))
        .order_by(Student.student_code.desc())
        .limit(1)
    )
    last_code = (await db.execute(stmt_code)).scalar_one_or_none()
    code_seq = 0
    if last_code:
        match = re.search(r'\d+$', last_code)
        if match:
            code_seq = int(match.group(0))

    # 2. Query highest existing PRN sequence for this year
    # Check both 12-digit numeric PRNs starting with year_str (e.g. 2026...) and legacy PRN-2026-...
    stmt_prn = (
        select(Student.prn)
        .where(
            (Student.prn.like(f"{year_str}%")) | (Student.prn.like(f"PRN-{year_str}-%"))
        )
    )
    all_prns = (await db.execute(stmt_prn)).scalars().all()
    prn_seq = 0
    for p in all_prns:
        if not p:
            continue
        # 12-digit numeric format: YYYY DD MM NNNN -> sequence is last 4 digits
        if len(p) == 12 and p.isdigit() and p.startswith(year_str):
            try:
                seq = int(p[-4:])
                if seq > prn_seq:
                    prn_seq = seq
            except ValueError:
                pass
        else:
            # Legacy format PRN-YYYY-NNNNN
            match = re.search(r'\d+$', p)
            if match:
                seq = int(match.group(0))
                if seq > prn_seq:
                    prn_seq = seq

    next_seq = max(code_seq, prn_seq) + 1

    # 3. Collision check loop to ensure absolute uniqueness
    while True:
        candidate_code = f"STU-{year_str}-{next_seq:05d}"
        candidate_prn = f"{year_str}{day_str}{month_str}{next_seq:04d}"
        exists_stmt = select(Student.id).where(
            (Student.student_code == candidate_code) | (Student.prn == candidate_prn)
        )
        if not (await db.execute(exists_stmt)).first():
            return candidate_code, candidate_prn
        next_seq += 1

