import uuid
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException, BadRequestException, ConflictException, ForbiddenException
from app.models.user import User
from app.models.academic import AcademicYear
from app.models.fee import Invoice, Payment
from app.models.expense import StaffMember, ExpenseTransaction
from app.modules.expenses.schemas import (
    StaffMemberCreate, StaffMemberUpdate, StaffMemberResponse,
    ExpenseCreate, ExpenseResponse, SalaryDisbursementRequest,
    MonthlyStaffPayrollItem, MonthlyPayrollSummaryResponse, ExpenseAnalyticsSummary
)

router = APIRouter(prefix="/expenses", tags=["Operational Expenses & Staff Payroll"])


async def generate_expense_voucher_number(db: AsyncSession, year_str: str) -> str:
    prefix = f"EXP-{year_str}-"
    stmt = select(func.count(ExpenseTransaction.id)).where(ExpenseTransaction.voucher_number.like(f"{prefix}%"))
    count = (await db.execute(stmt)).scalar() or 0
    return f"{prefix}{count + 1:05d}"


# =========================================================================
# STAFF MEMBERS MANAGEMENT (SUPERADMIN ONLY)
# =========================================================================

@router.get("/staff", response_model=List[StaffMemberResponse])
async def list_staff_members(
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    List all staff members and faculty under the institute.
    Restricted to SuperAdmin.
    """
    stmt = select(StaffMember).where(StaffMember.institute_id == current_user.institute_id)
    if is_active is not None:
        stmt = stmt.where(StaffMember.is_active == is_active)
    stmt = stmt.order_by(StaffMember.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/staff", response_model=StaffMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_staff_member(
    data: StaffMemberCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new staff member or teacher for payroll management.
    """
    staff = StaffMember(
        institute_id=current_user.institute_id,
        name=data.name.strip(),
        role_designation=data.role_designation.strip(),
        phone=data.phone.strip() if data.phone else None,
        email=str(data.email).strip() if data.email else None,
        base_monthly_salary=data.base_monthly_salary,
        bank_name=data.bank_name.strip() if data.bank_name else None,
        bank_account_no=data.bank_account_no.strip() if data.bank_account_no else None,
        bank_ifsc=data.bank_ifsc.strip().upper() if data.bank_ifsc else None,
        upi_id=data.upi_id.strip() if data.upi_id else None,
        is_active=data.is_active,
        joining_date=data.joining_date or date.today(),
        user_id=data.user_id
    )
    db.add(staff)
    await db.commit()
    await db.refresh(staff)
    return staff


@router.put("/staff/{staff_id}", response_model=StaffMemberResponse)
async def update_staff_member(
    staff_id: uuid.UUID,
    data: StaffMemberUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Update staff member compensation or bank details.
    """
    staff = await db.get(StaffMember, staff_id)
    if not staff or staff.institute_id != current_user.institute_id:
        raise NotFoundException("Staff member not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if val is not None and isinstance(val, str):
            val = val.strip()
        setattr(staff, field, val)

    await db.commit()
    await db.refresh(staff)
    return staff


@router.delete("/staff/{staff_id}")
async def delete_staff_member(
    staff_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete or deactivate a staff member.
    """
    staff = await db.get(StaffMember, staff_id)
    if not staff or staff.institute_id != current_user.institute_id:
        raise NotFoundException("Staff member not found")

    # If they have salary history, soft-delete by deactivating to preserve financial audit trail
    has_history = (await db.execute(
        select(func.count(ExpenseTransaction.id)).where(ExpenseTransaction.staff_id == staff_id)
    )).scalar() or 0

    if has_history > 0:
        staff.is_active = False
        await db.commit()
        return {"message": "Staff member deactivated (salary disbursement history preserved)."}

    await db.delete(staff)
    await db.commit()
    return {"message": "Staff member removed successfully."}


# =========================================================================
# MONTHLY PAYROLL MATRIX & DISBURSEMENTS
# =========================================================================

@router.get("/payroll/monthly", response_model=MonthlyPayrollSummaryResponse)
async def get_monthly_payroll_matrix(
    month: int = Query(..., ge=1, le=12, description="Month number 1-12"),
    year: int = Query(..., ge=2000, le=2100, description="Calendar Year"),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns monthly salary status for every staff member for the requested month & year.
    Enables SuperAdmin to see who has been paid, who is pending, and disburse with 1-click.
    """
    # 1. Fetch active staff
    staff_stmt = select(StaffMember).where(
        StaffMember.institute_id == current_user.institute_id,
        StaffMember.is_active.is_(True)
    ).order_by(StaffMember.name.asc())
    all_staff = (await db.execute(staff_stmt)).scalars().all()

    # 2. Fetch existing salary payments for this month & year
    salary_stmt = select(ExpenseTransaction).where(
        ExpenseTransaction.institute_id == current_user.institute_id,
        ExpenseTransaction.expense_category == "SALARY",
        ExpenseTransaction.pay_period_month == month,
        ExpenseTransaction.pay_period_year == year
    )
    salaries = (await db.execute(salary_stmt)).scalars().all()
    salary_by_staff_id = {s.staff_id: s for s in salaries if s.staff_id}

    items: List[MonthlyStaffPayrollItem] = []
    total_budget = Decimal("0.00")
    total_disbursed = Decimal("0.00")
    paid_count = 0

    for s in all_staff:
        base_sal = s.base_monthly_salary or Decimal("0.00")
        total_budget += base_sal
        exp = salary_by_staff_id.get(s.id)

        if exp:
            is_paid = True
            paid_count += 1
            total_disbursed += exp.amount
            items.append(MonthlyStaffPayrollItem(
                staff_id=s.id,
                staff_name=s.name,
                role_designation=s.role_designation,
                phone=s.phone,
                base_monthly_salary=base_sal,
                bank_account_no=s.bank_account_no,
                bank_ifsc=s.bank_ifsc,
                upi_id=s.upi_id,
                is_active=s.is_active,
                is_paid=True,
                paid_amount=exp.amount,
                payment_date=exp.payment_date,
                payment_mode=exp.payment_mode,
                voucher_number=exp.voucher_number,
                reference_number=exp.reference_number,
                expense_id=exp.id,
                notes=exp.notes
            ))
        else:
            items.append(MonthlyStaffPayrollItem(
                staff_id=s.id,
                staff_name=s.name,
                role_designation=s.role_designation,
                phone=s.phone,
                base_monthly_salary=base_sal,
                bank_account_no=s.bank_account_no,
                bank_ifsc=s.bank_ifsc,
                upi_id=s.upi_id,
                is_active=s.is_active,
                is_paid=False,
                paid_amount=None,
                payment_date=None,
                payment_mode=None,
                voucher_number=None,
                reference_number=None,
                expense_id=None,
                notes=None
            ))

    return MonthlyPayrollSummaryResponse(
        pay_period_month=month,
        pay_period_year=year,
        total_staff_count=len(all_staff),
        paid_staff_count=paid_count,
        unpaid_staff_count=len(all_staff) - paid_count,
        total_payroll_budget=total_budget,
        total_payroll_disbursed=total_disbursed,
        payroll_pending_balance=max(Decimal("0.00"), total_budget - total_disbursed),
        staff_roster=items
    )


@router.post("/payroll/disburse", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def disburse_staff_salary(
    data: SalaryDisbursementRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Log monthly salary payment to a staff member. Generates sequential EXP voucher.
    """
    staff = await db.get(StaffMember, data.staff_id)
    if not staff or staff.institute_id != current_user.institute_id:
        raise NotFoundException("Staff member not found")

    # Check if salary already paid for this staff for this month & year
    existing = (await db.execute(
        select(ExpenseTransaction).where(
            ExpenseTransaction.institute_id == current_user.institute_id,
            ExpenseTransaction.staff_id == data.staff_id,
            ExpenseTransaction.expense_category == "SALARY",
            ExpenseTransaction.pay_period_month == data.pay_period_month,
            ExpenseTransaction.pay_period_year == data.pay_period_year
        )
    )).scalar_one_or_none()

    if existing:
        raise ConflictException(f"Salary for {staff.name} for {data.pay_period_month}/{data.pay_period_year} has already been disbursed under voucher {existing.voucher_number}.")

    voucher_num = await generate_expense_voucher_number(db, str(data.pay_period_year))

    month_name = date(2000, data.pay_period_month, 1).strftime("%B")
    title = f"Salary - {month_name} {data.pay_period_year} - {staff.name}"

    expense = ExpenseTransaction(
        institute_id=current_user.institute_id,
        academic_year_id=data.academic_year_id,
        staff_id=data.staff_id,
        expense_category="SALARY",
        title=title,
        pay_period_month=data.pay_period_month,
        pay_period_year=data.pay_period_year,
        amount=data.amount,
        payment_date=data.payment_date,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number.strip() if data.reference_number else None,
        voucher_number=voucher_num,
        status="PAID",
        notes=data.notes.strip() if data.notes else None,
        created_by=current_user.id
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)

    return ExpenseResponse(
        id=expense.id,
        institute_id=expense.institute_id,
        academic_year_id=expense.academic_year_id,
        staff_id=expense.staff_id,
        staff_name=staff.name,
        staff_role=staff.role_designation,
        expense_category=expense.expense_category,
        title=expense.title,
        pay_period_month=expense.pay_period_month,
        pay_period_year=expense.pay_period_year,
        amount=expense.amount,
        payment_date=expense.payment_date,
        payment_mode=expense.payment_mode,
        reference_number=expense.reference_number,
        voucher_number=expense.voucher_number,
        status=expense.status,
        notes=expense.notes,
        created_at=expense.created_at
    )


# =========================================================================
# GENERAL EXPENSES & TRANSACTIONS LEDGER
# =========================================================================

@router.get("", response_model=List[ExpenseResponse])
async def list_expenses(
    academic_year_id: Optional[uuid.UUID] = Query(None),
    category: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    List expense transactions (salaries and operational expenditures) with filtering.
    """
    stmt = (
        select(ExpenseTransaction)
        .options(selectinload(ExpenseTransaction.staff_member))
        .where(ExpenseTransaction.institute_id == current_user.institute_id)
    )

    if academic_year_id:
        stmt = stmt.where(ExpenseTransaction.academic_year_id == academic_year_id)
    if category:
        stmt = stmt.where(ExpenseTransaction.expense_category == category)
    if month:
        stmt = stmt.where(ExpenseTransaction.pay_period_month == month)
    if year:
        stmt = stmt.where(ExpenseTransaction.pay_period_year == year)
    if search:
        search_fmt = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                ExpenseTransaction.title.ilike(search_fmt),
                ExpenseTransaction.voucher_number.ilike(search_fmt),
                ExpenseTransaction.reference_number.ilike(search_fmt)
            )
        )

    stmt = stmt.order_by(desc(ExpenseTransaction.payment_date), desc(ExpenseTransaction.created_at)).offset(offset).limit(limit)
    res = (await db.execute(stmt)).scalars().all()

    output = []
    for exp in res:
        output.append(ExpenseResponse(
            id=exp.id,
            institute_id=exp.institute_id,
            academic_year_id=exp.academic_year_id,
            staff_id=exp.staff_id,
            staff_name=exp.staff_member.name if exp.staff_member else None,
            staff_role=exp.staff_member.role_designation if exp.staff_member else None,
            expense_category=exp.expense_category,
            title=exp.title,
            pay_period_month=exp.pay_period_month,
            pay_period_year=exp.pay_period_year,
            amount=exp.amount,
            payment_date=exp.payment_date,
            payment_mode=exp.payment_mode,
            reference_number=exp.reference_number,
            voucher_number=exp.voucher_number,
            status=exp.status,
            notes=exp.notes,
            created_at=exp.created_at
        ))
    return output


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_general_expense(
    data: ExpenseCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Log general operational expense (Rent, Electricity, Maintenance, Stationery, etc.).
    """
    year_str = str(data.pay_period_year or data.payment_date.year)
    voucher_num = await generate_expense_voucher_number(db, year_str)

    expense = ExpenseTransaction(
        institute_id=current_user.institute_id,
        academic_year_id=data.academic_year_id,
        staff_id=data.staff_id,
        expense_category=data.expense_category.upper(),
        title=data.title.strip(),
        pay_period_month=data.pay_period_month or data.payment_date.month,
        pay_period_year=data.pay_period_year or data.payment_date.year,
        amount=data.amount,
        payment_date=data.payment_date,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number.strip() if data.reference_number else None,
        voucher_number=voucher_num,
        status=data.status,
        notes=data.notes.strip() if data.notes else None,
        created_by=current_user.id
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)

    return ExpenseResponse(
        id=expense.id,
        institute_id=expense.institute_id,
        academic_year_id=expense.academic_year_id,
        staff_id=expense.staff_id,
        staff_name=None,
        staff_role=None,
        expense_category=expense.expense_category,
        title=expense.title,
        pay_period_month=expense.pay_period_month,
        pay_period_year=expense.pay_period_year,
        amount=expense.amount,
        payment_date=expense.payment_date,
        payment_mode=expense.payment_mode,
        reference_number=expense.reference_number,
        voucher_number=expense.voucher_number,
        status=expense.status,
        notes=expense.notes,
        created_at=expense.created_at
    )


@router.delete("/{expense_id}")
async def delete_expense_transaction(
    expense_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an expense or salary voucher record.
    """
    expense = await db.get(ExpenseTransaction, expense_id)
    if not expense or expense.institute_id != current_user.institute_id:
        raise NotFoundException("Expense transaction not found")

    await db.delete(expense)
    await db.commit()
    return {"message": f"Expense voucher {expense.voucher_number} deleted successfully."}


# =========================================================================
# FINANCIAL INTEGRATION & NET MARGIN ANALYTICS
# =========================================================================

@router.get("/summary", response_model=ExpenseAnalyticsSummary)
async def get_expense_and_net_balance_summary(
    academic_year_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Computes total payroll disbursed, other expenses, total student fee revenue collected,
    and Net Institute Operating Balance (Surplus / Deficit).
    """
    target_ay = await db.get(AcademicYear, academic_year_id) if academic_year_id else None

    # 1. Total Student Fee Collections Realized
    ay_inv_cond = True
    if target_ay:
        from app.models.enrollment import Enrollment
        ay_inv_cond = or_(
            Invoice.enrollment.has(Enrollment.academic_year_id == target_ay.id),
            and_(
                Invoice.enrollment_id.is_(None),
                Invoice.issue_date >= target_ay.start_date,
                Invoice.issue_date <= target_ay.end_date
            )
        )

    gross_collections_stmt = select(func.coalesce(func.sum(Invoice.paid_amount), 0.0)).where(
        Invoice.institute_id == current_user.institute_id,
        ay_inv_cond
    )
    gross_student_revenue = float((await db.execute(gross_collections_stmt)).scalar() or 0.0)

    # 2. Expenses breakdown
    exp_cond = ExpenseTransaction.institute_id == current_user.institute_id
    if target_ay:
        exp_cond = and_(
            exp_cond,
            or_(
                ExpenseTransaction.academic_year_id == target_ay.id,
                and_(
                    ExpenseTransaction.academic_year_id.is_(None),
                    ExpenseTransaction.payment_date >= target_ay.start_date,
                    ExpenseTransaction.payment_date <= target_ay.end_date
                )
            )
        )

    # Salaries
    sal_stmt = select(func.coalesce(func.sum(ExpenseTransaction.amount), 0.0)).where(
        exp_cond,
        ExpenseTransaction.expense_category == "SALARY"
    )
    total_salaries_paid = float((await db.execute(sal_stmt)).scalar() or 0.0)

    # Other Operational Expenses
    other_stmt = select(func.coalesce(func.sum(ExpenseTransaction.amount), 0.0)).where(
        exp_cond,
        ExpenseTransaction.expense_category != "SALARY"
    )
    total_other_expenses = float((await db.execute(other_stmt)).scalar() or 0.0)

    total_expenses = total_salaries_paid + total_other_expenses
    net_operating_balance = gross_student_revenue - total_expenses

    # Category breakdown
    cat_stmt = select(
        ExpenseTransaction.expense_category,
        func.coalesce(func.sum(ExpenseTransaction.amount), 0.0),
        func.count(ExpenseTransaction.id)
    ).where(exp_cond).group_by(ExpenseTransaction.expense_category)
    cat_res = (await db.execute(cat_stmt)).all()
    category_breakdown = [
        {"category": row[0], "total_amount": float(row[1]), "count": int(row[2])}
        for row in cat_res
    ]

    # Monthly trend
    month_stmt = select(
        ExpenseTransaction.pay_period_year,
        ExpenseTransaction.pay_period_month,
        func.coalesce(func.sum(ExpenseTransaction.amount), 0.0),
        func.count(ExpenseTransaction.id)
    ).where(exp_cond, ExpenseTransaction.pay_period_month.is_not(None)).group_by(
        ExpenseTransaction.pay_period_year,
        ExpenseTransaction.pay_period_month
    ).order_by(
        ExpenseTransaction.pay_period_year.asc(),
        ExpenseTransaction.pay_period_month.asc()
    )
    month_res = (await db.execute(month_stmt)).all()
    monthly_trend = [
        {
            "year": int(row[0]),
            "month": int(row[1]),
            "total_amount": float(row[2]),
            "count": int(row[3])
        }
        for row in month_res
    ]

    return ExpenseAnalyticsSummary(
        total_salaries_paid=total_salaries_paid,
        total_other_expenses=total_other_expenses,
        total_expenses=total_expenses,
        gross_student_revenue=gross_student_revenue,
        net_operating_balance=net_operating_balance,
        category_breakdown=category_breakdown,
        monthly_trend=monthly_trend
    )
