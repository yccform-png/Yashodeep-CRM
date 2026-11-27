import re
import uuid
from datetime import date, datetime
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.academic import AcademicYear
from app.models.fee import Invoice, Payment, Refund, Receipt
from app.models.enrollment import EnrollmentGroup


async def resolve_academic_year_string(
    db: AsyncSession,
    academic_year_id: Optional[uuid.UUID] = None,
    fallback_date: Optional[date] = None
) -> str:
    """
    Dynamically resolves the 4-digit academic session year string (e.g. '2026', '2027').
    Never hardcodes a year.
    Priority:
    1. AcademicYear.start_date.year or 4-digit year in AcademicYear.name
    2. fallback_date.year
    3. Current date's year
    """
    if academic_year_id:
        ay = await db.get(AcademicYear, academic_year_id)
        if ay:
            if ay.start_date:
                return str(ay.start_date.year)
            if ay.name:
                m = re.search(r"\d{4}", ay.name)
                if m:
                    return m.group(0)

    if fallback_date:
        return str(fallback_date.year)

    return str(date.today().year)


async def generate_invoice_number(
    db: AsyncSession,
    year_str: str
) -> str:
    """
    Generates the next unique, sequential invoice number for the given session year.
    Example: INV-2027-00001
    """
    prefix = f"INV-{year_str}-"
    stmt = select(func.count(Invoice.id)).where(Invoice.invoice_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    seq = count + 1
    num = f"{prefix}{seq:05d}"
    while (await db.execute(select(Invoice.id).where(Invoice.invoice_number == num))).scalar_one_or_none():
        seq += 1
        num = f"{prefix}{seq:05d}"
    return num


async def generate_payment_number(
    db: AsyncSession,
    year_str: str
) -> str:
    """
    Generates the next unique, sequential payment number for the given session year.
    Example: PAY-2027-00001
    """
    prefix = f"PAY-{year_str}-"
    stmt = select(func.count(Payment.id)).where(Payment.payment_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    seq = count + 1
    num = f"{prefix}{seq:05d}"
    while (await db.execute(select(Payment.id).where(Payment.payment_number == num))).scalar_one_or_none():
        seq += 1
        num = f"{prefix}{seq:05d}"
    return num


async def generate_receipt_number(
    db: AsyncSession,
    year_str: str
) -> str:
    """
    Generates the next unique, sequential receipt number for the given session year.
    Example: RCP-2027-00001
    """
    prefix = f"RCP-{year_str}-"
    stmt = select(func.count(Receipt.id)).where(Receipt.receipt_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    seq = count + 1
    num = f"{prefix}{seq:05d}"
    while (await db.execute(select(Receipt.id).where(Receipt.receipt_number == num))).scalar_one_or_none():
        seq += 1
        num = f"{prefix}{seq:05d}"
    return num


async def generate_form_receipt_number(
    db: AsyncSession,
    year_str: str
) -> str:
    """
    Generates the next unique, sequential application form receipt number.
    Example: REC-FORM-2027-00001
    """
    prefix = f"REC-FORM-{year_str}-"
    stmt = select(func.count(Payment.id)).where(Payment.payment_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    seq = count + 1
    num = f"{prefix}{seq:05d}"
    while (await db.execute(select(Payment.id).where(Payment.payment_number == num))).scalar_one_or_none():
        seq += 1
        num = f"{prefix}{seq:05d}"
    return num


async def generate_refund_number(
    db: AsyncSession,
    year_str: str
) -> str:
    """
    Generates the next unique, sequential refund reference number.
    Example: REF-2027-00001
    """
    prefix = f"REF-{year_str}-"
    stmt = select(func.count(Refund.id)).where(Refund.refund_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    seq = count + 1
    num = f"{prefix}{seq:05d}"
    while (await db.execute(select(Refund.id).where(Refund.refund_number == num))).scalar_one_or_none():
        seq += 1
        num = f"{prefix}{seq:05d}"
    return num


async def generate_group_code(
    db: AsyncSession,
    year_str: str
) -> str:
    """
    Generates the next unique, sequential multi-year enrollment group code.
    Example: GRP-2027-0001
    """
    prefix = f"GRP-{year_str}-"
    stmt = select(func.count(EnrollmentGroup.id)).where(EnrollmentGroup.group_code.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    seq = count + 1
    num = f"{prefix}{seq:04d}"
    while (await db.execute(select(EnrollmentGroup.id).where(EnrollmentGroup.group_code == num))).scalar_one_or_none():
        seq += 1
        num = f"{prefix}{seq:04d}"
    return num
