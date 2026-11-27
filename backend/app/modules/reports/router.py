import uuid
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, distinct
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.student import Student, StudentGuardian, Guardian
from app.models.fee import Invoice, InvoiceItem, Payment, PaymentAllocation, Installment, InstallmentPlan
from app.models.study_room import StudySeat
from app.models.hostel import HostelBed
from app.models.attendance import AttendanceRecord
from app.models.academic import Course, Class, Batch, BatchStudent, AcademicYear
from app.models.enrollment import Enrollment

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/dashboard")
async def get_dashboard_metrics(
    academic_year_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(require_role(["ADMIN", "SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Computes real-time ERP analytics from PostgreSQL tables.
    Never hardcoded sample data.
    Cached in Redis for 60 seconds with active write-invalidation.
    Financial metrics are strictly shielded from non-SUPER_ADMIN users.
    Optionally scoped to selected academic year.
    """
    is_super_admin = current_user.user_type == "SUPER_ADMIN"
    cache_key = f"{CacheKeys.dashboard_metrics()}:{is_super_admin}:{academic_year_id}"
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached

    # 1. Students Count
    if academic_year_id:
        total_students = (await db.execute(
            select(func.count(distinct(Student.id)))
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(Enrollment.academic_year_id == academic_year_id)
        )).scalar() or 0
        active_students = (await db.execute(
            select(func.count(distinct(Student.id)))
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(Enrollment.academic_year_id == academic_year_id, Enrollment.status == "ACTIVE")
        )).scalar() or 0
    else:
        total_students = (await db.execute(select(func.count(Student.id)))).scalar() or 0
        active_students = (await db.execute(select(func.count(Student.id)).where(Student.status == "ACTIVE"))).scalar() or 0

    # 2. Financial Metrics (Computed ONLY if Super Admin)
    total_invoiced = Decimal("0.00")
    total_collected = Decimal("0.00")
    total_outstanding = Decimal("0.00")
    recent_payments = []

    if is_super_admin:
        if academic_year_id:
            target_ay = await db.get(AcademicYear, academic_year_id)
            ay_scope_cond = or_(
                Invoice.enrollment.has(Enrollment.academic_year_id == academic_year_id),
                and_(
                    Invoice.enrollment_id.is_(None),
                    Invoice.issue_date >= target_ay.start_date,
                    Invoice.issue_date <= target_ay.end_date
                ) if target_ay else False
            )
            total_invoiced = (await db.execute(
                select(func.coalesce(func.sum(Invoice.total_amount), 0.00)).where(ay_scope_cond)
            )).scalar() or Decimal("0.00")
            total_outstanding = (await db.execute(
                select(func.coalesce(func.sum(Invoice.balance_amount), 0.00)).where(ay_scope_cond)
            )).scalar() or Decimal("0.00")
            total_collected = (await db.execute(
                select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0.00))
                .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
                .where(ay_scope_cond)
            )).scalar() or Decimal("0.00")

            recent_pay_stmt = (
                select(Payment)
                .join(PaymentAllocation, PaymentAllocation.payment_id == Payment.id)
                .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
                .where(ay_scope_cond)
                .distinct()
                .order_by(Payment.created_at.desc())
                .limit(5)
            )
        else:
            total_invoiced = (await db.execute(select(func.coalesce(func.sum(Invoice.total_amount), 0.00)))).scalar() or Decimal("0.00")
            total_collected = (await db.execute(select(func.coalesce(func.sum(Payment.amount), 0.00)))).scalar() or Decimal("0.00")
            total_outstanding = (await db.execute(select(func.coalesce(func.sum(Invoice.balance_amount), 0.00)))).scalar() or Decimal("0.00")

            recent_pay_stmt = select(Payment).order_by(Payment.created_at.desc()).limit(5)
        recent_payments_res = (await db.execute(recent_pay_stmt)).scalars().all()
        recent_payments = [
            {
                "id": str(p.id),
                "payment_number": p.payment_number,
                "amount": float(p.amount),
                "method": p.payment_method,
                "date": p.payment_date.isoformat(),
                "status": p.status
            } for p in recent_payments_res
        ]

    # 3. Facilities Occupancy
    total_study_seats = (await db.execute(select(func.count(StudySeat.id)).where(StudySeat.is_active.is_(True)))).scalar() or 0
    occupied_study_seats = (await db.execute(select(func.count(StudySeat.id)).where(StudySeat.status == "OCCUPIED"))).scalar() or 0

    total_beds = (await db.execute(select(func.count(HostelBed.id)).where(HostelBed.is_active.is_(True)))).scalar() or 0
    occupied_beds = (await db.execute(select(func.count(HostelBed.id)).where(HostelBed.status == "OCCUPIED"))).scalar() or 0

    # 4. Courses Count
    total_courses = (await db.execute(select(func.count(Course.id)).where(Course.is_active.is_(True)))).scalar() or 0

    # 5. Recent Admissions (Last 5)
    recent_stu_stmt = select(Student).order_by(Student.created_at.desc()).limit(5)
    recent_students = (await db.execute(recent_stu_stmt)).scalars().all()
    recent_admissions = [
        {
            "id": str(s.id),
            "code": s.student_code,
            "name": f"{s.first_name} {s.last_name}",
            "gender": s.gender,
            "date": s.admission_date.isoformat(),
            "status": s.status
        } for s in recent_students
    ]

    metrics = {
        "total_students": total_students,
        "active_students": active_students,
        "active_courses": total_courses,
        "is_financial_shielded": not is_super_admin,
        "total_collections": float(total_collected),
        "total_outstanding": float(total_outstanding),
        "total_invoiced": float(total_invoiced),
        "study_room": {
            "total_seats": total_study_seats,
            "occupied_seats": occupied_study_seats,
            "available_seats": max(0, total_study_seats - occupied_study_seats),
            "occupancy_rate": round((occupied_study_seats / total_study_seats * 100), 1) if total_study_seats > 0 else 0.0
        },
        "hostel": {
            "total_beds": total_beds,
            "occupied_beds": occupied_beds,
            "available_beds": max(0, total_beds - occupied_beds),
            "occupancy_rate": round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0.0
        },
        "recent_admissions": recent_admissions,
        "recent_payments": recent_payments
    }
    await cache_service.set(cache_key, metrics, ttl=60)
    return metrics


# =========================================================================
# SUPER_ADMIN DEDICATED FINANCIAL & BATCHWISE ANALYTICS ENGINE
# =========================================================================

@router.get("/finance/overview")
async def get_finance_overview(
    academic_year_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Comprehensive financial intelligence for Superadmin:
    - Invoiced, Collected, Balance, Recovery rate
    - Revenue streams breakdown (Tuition, Hostel, Study Room, Arrears, etc.)
    - Payment methods distribution (UPI, Cash, Net Banking, etc.)
    - Multi-year comparison & YoY growth trajectory
    """
    # 1. Base scoping condition for invoices & payments
    target_ay = await db.get(AcademicYear, academic_year_id) if academic_year_id else None

    ay_invoice_cond = True
    if target_ay:
        ay_invoice_cond = or_(
            Invoice.enrollment.has(Enrollment.academic_year_id == target_ay.id),
            and_(
                Invoice.enrollment_id.is_(None),
                Invoice.issue_date >= target_ay.start_date,
                Invoice.issue_date <= target_ay.end_date
            )
        )

    # Invoiced & Balance
    inv_totals_stmt = select(
        func.coalesce(func.sum(Invoice.total_amount), 0.0),
        func.coalesce(func.sum(Invoice.paid_amount), 0.0),
        func.coalesce(func.sum(Invoice.balance_amount), 0.0),
        func.count(Invoice.id)
    ).where(ay_invoice_cond)
    res_inv = (await db.execute(inv_totals_stmt)).first()
    gross_invoiced = float(res_inv[0] or 0.0)
    total_collected_from_inv = float(res_inv[1] or 0.0)
    total_outstanding = float(res_inv[2] or 0.0)
    total_invoices_count = int(res_inv[3] or 0)

    # Invoices by status counts
    paid_count = (await db.execute(select(func.count(Invoice.id)).where(ay_invoice_cond, Invoice.status == "PAID"))).scalar() or 0
    partial_count = (await db.execute(select(func.count(Invoice.id)).where(ay_invoice_cond, Invoice.status == "PARTIALLY_PAID"))).scalar() or 0
    unpaid_count = (await db.execute(select(func.count(Invoice.id)).where(ay_invoice_cond, Invoice.status == "ISSUED"))).scalar() or 0

    # Total collected via PaymentAllocations for precision
    if target_ay:
        collected_alloc = (await db.execute(
            select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0.0))
            .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
            .where(ay_invoice_cond)
        )).scalar() or Decimal("0.00")
        total_collected = float(collected_alloc)
    else:
        total_collected = float((await db.execute(select(func.coalesce(func.sum(Payment.amount), 0.0)))).scalar() or 0.0)

    recovery_rate = round((total_collected / gross_invoiced * 100), 1) if gross_invoiced > 0 else 0.0

    # 2. Payment methods breakdown
    if target_ay:
        methods_stmt = (
            select(
                Payment.payment_method,
                func.sum(PaymentAllocation.allocated_amount),
                func.count(distinct(Payment.id))
            )
            .join(PaymentAllocation, PaymentAllocation.payment_id == Payment.id)
            .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
            .where(ay_invoice_cond)
            .group_by(Payment.payment_method)
        )
    else:
        methods_stmt = (
            select(
                Payment.payment_method,
                func.sum(Payment.amount),
                func.count(Payment.id)
            )
            .group_by(Payment.payment_method)
        )
    methods_res = (await db.execute(methods_stmt)).all()
    payment_methods = []
    for m, amt, count in methods_res:
        f_amt = float(amt or 0.0)
        pct = round((f_amt / total_collected * 100), 1) if total_collected > 0 else 0.0
        payment_methods.append({
            "method": m or "OTHER",
            "amount": f_amt,
            "count": int(count or 0),
            "percentage": pct
        })
    payment_methods.sort(key=lambda x: x["amount"], reverse=True)

    # 3. Revenue streams from InvoiceItem
    streams_stmt = (
        select(
            InvoiceItem.service_type_code,
            func.sum(InvoiceItem.total_amount)
        )
        .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
        .where(ay_invoice_cond)
        .group_by(InvoiceItem.service_type_code)
    )
    streams_res = (await db.execute(streams_stmt)).all()
    stream_labels = {
        "TUITION": "Tuition & Curriculum Packages",
        "HOSTEL": "Hostel Boarding & Lodging",
        "STUDY_ROOM": "Study Room Desk Allocations",
        "REGISTRATION": "Admission & Registration Fees",
        "ARREARS": "Prior Year Carryforward Arrears",
        "EXAM_FEE": "Examination & Test Series Fees",
        "MISC": "Miscellaneous & Other Fees"
    }
    revenue_streams = []
    for code, amt in streams_res:
        f_amt = float(amt or 0.0)
        pct = round((f_amt / gross_invoiced * 100), 1) if gross_invoiced > 0 else 0.0
        c = code or "TUITION"
        revenue_streams.append({
            "code": c,
            "label": stream_labels.get(c, c.replace("_", " ").title()),
            "amount": f_amt,
            "percentage": pct
        })
    revenue_streams.sort(key=lambda x: x["amount"], reverse=True)

    # 4. Multi-year comparison & YoY growth trajectory
    all_ays = (await db.execute(select(AcademicYear).order_by(AcademicYear.start_date.asc()))).scalars().all()
    multi_year_comparison = []
    prev_invoiced = None

    for ay in all_ays:
        cond = or_(
            Invoice.enrollment.has(Enrollment.academic_year_id == ay.id),
            and_(
                Invoice.enrollment_id.is_(None),
                Invoice.issue_date >= ay.start_date,
                Invoice.issue_date <= ay.end_date
            )
        )
        ay_invoiced = float((await db.execute(select(func.coalesce(func.sum(Invoice.total_amount), 0.0)).where(cond))).scalar() or 0.0)
        ay_collected = float((await db.execute(
            select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0.0))
            .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
            .where(cond)
        )).scalar() or 0.0)
        ay_balance = float((await db.execute(select(func.coalesce(func.sum(Invoice.balance_amount), 0.0)).where(cond))).scalar() or 0.0)
        ay_stu_count = (await db.execute(
            select(func.count(distinct(Enrollment.student_id))).where(Enrollment.academic_year_id == ay.id)
        )).scalar() or 0

        ay_recovery = round((ay_collected / ay_invoiced * 100), 1) if ay_invoiced > 0 else 0.0
        yoy_growth = 0.0
        if prev_invoiced is not None and prev_invoiced > 0:
            yoy_growth = round(((ay_invoiced - prev_invoiced) / prev_invoiced * 100), 1)
        prev_invoiced = ay_invoiced

        multi_year_comparison.append({
            "academic_year_id": str(ay.id),
            "year_name": ay.name,
            "start_date": ay.start_date.isoformat(),
            "end_date": ay.end_date.isoformat(),
            "is_current": ay.is_current,
            "student_count": ay_stu_count,
            "gross_invoiced": ay_invoiced,
            "total_collected": ay_collected,
            "total_outstanding": ay_balance,
            "recovery_rate": ay_recovery,
            "yoy_growth": yoy_growth
        })

    return {
        "selected_academic_year_id": str(target_ay.id) if target_ay else None,
        "selected_academic_year_name": target_ay.name if target_ay else "All Academic Years (Cumulative)",
        "gross_invoiced": gross_invoiced,
        "total_collected": total_collected,
        "total_outstanding": total_outstanding,
        "recovery_rate": recovery_rate,
        "invoices_count": {
            "total": total_invoices_count,
            "paid": paid_count,
            "partial": partial_count,
            "unpaid": unpaid_count
        },
        "payment_methods": payment_methods,
        "revenue_streams": revenue_streams,
        "multi_year_comparison": multi_year_comparison
    }


@router.get("/finance/batchwise")
async def get_batchwise_finance(
    academic_year_id: Optional[uuid.UUID] = Query(None),
    class_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Granular collection, billing, and recovery rate broken down by batch and division.
    """
    stmt = (
        select(Batch, Course, Class, AcademicYear)
        .join(Course, Batch.course_id == Course.id)
        .outerjoin(Class, Course.class_id == Class.id)
        .join(AcademicYear, Batch.academic_year_id == AcademicYear.id)
        .order_by(AcademicYear.name.desc(), Course.name.asc(), Batch.division.asc())
    )
    if academic_year_id:
        stmt = stmt.where(Batch.academic_year_id == academic_year_id)
    if class_id:
        stmt = stmt.where(Course.class_id == class_id)

    batches_data = (await db.execute(stmt)).all()
    results = []

    for batch, course, cls, ay in batches_data:
        # Find enrolled students in this batch
        e_subquery = select(Enrollment.id, Enrollment.student_id).where(
            or_(
                Enrollment.batch_id == batch.id,
                Enrollment.student_id.in_(
                    select(BatchStudent.student_id).where(BatchStudent.batch_id == batch.id)
                )
            ),
            Enrollment.academic_year_id == batch.academic_year_id
        )
        enrollments = (await db.execute(e_subquery)).all()
        e_ids = [e[0] for e in enrollments]
        stu_ids = list(set([e[1] for e in enrollments]))

        invoiced = 0.0
        collected = 0.0
        balance = 0.0
        fully_paid = 0
        partial_paid = 0
        unpaid = 0

        if e_ids or stu_ids:
            inv_stmt = select(Invoice).where(
                or_(
                    Invoice.enrollment_id.in_(e_ids),
                    and_(Invoice.student_id.in_(stu_ids), Invoice.enrollment_id.is_(None))
                )
            )
            invoices = (await db.execute(inv_stmt)).scalars().all()
            for inv in invoices:
                invoiced += float(inv.total_amount)
                collected += float(inv.paid_amount)
                balance += float(inv.balance_amount)
                if float(inv.balance_amount) == 0 and float(inv.total_amount) > 0:
                    fully_paid += 1
                elif float(inv.paid_amount) > 0 and float(inv.balance_amount) > 0:
                    partial_paid += 1
                else:
                    unpaid += 1

        recovery = round((collected / invoiced * 100), 1) if invoiced > 0 else 0.0

        results.append({
            "batch_id": str(batch.id),
            "batch_name": batch.name,
            "batch_code": batch.code,
            "division": batch.division or "A",
            "course_id": str(course.id),
            "course_name": course.name,
            "class_id": str(cls.id) if cls else None,
            "class_name": cls.name if cls else "Universal",
            "academic_year_id": str(ay.id),
            "academic_year_name": ay.name,
            "max_capacity": batch.max_capacity,
            "enrolled_count": len(stu_ids),
            "total_invoiced": invoiced,
            "total_collected": collected,
            "total_outstanding": balance,
            "recovery_rate": recovery,
            "fully_paid_students": fully_paid,
            "partial_students": partial_paid,
            "unpaid_students": unpaid
        })

    return results


@router.get("/finance/batch-students")
async def get_batch_student_finances(
    batch_id: uuid.UUID = Query(...),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Individual student fee ledger and installment status within a specific batch.
    """
    batch = await db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    e_stmt = (
        select(Enrollment, Student)
        .join(Student, Enrollment.student_id == Student.id)
        .where(
            or_(
                Enrollment.batch_id == batch.id,
                Enrollment.student_id.in_(
                    select(BatchStudent.student_id).where(BatchStudent.batch_id == batch.id)
                )
            ),
            Enrollment.academic_year_id == batch.academic_year_id
        )
    )
    enrollment_students = (await db.execute(e_stmt)).all()
    results = []

    for enr, stu in enrollment_students:
        inv_stmt = (
            select(Invoice)
            .options(selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments))
            .where(
                or_(
                    Invoice.enrollment_id == enr.id,
                    and_(Invoice.student_id == stu.id, Invoice.enrollment_id.is_(None))
                )
            )
            .order_by(Invoice.created_at.desc())
        )
        invs = (await db.execute(inv_stmt)).scalars().all()

        total_billed = sum(float(i.total_amount) for i in invs)
        total_paid = sum(float(i.paid_amount) for i in invs)
        total_balance = sum(float(i.balance_amount) for i in invs)

        overdue_installments = []
        today = date.today()
        for i in invs:
            if i.installment_plan and i.installment_plan.installments:
                for inst in i.installment_plan.installments:
                    if inst.status != "PAID" and inst.due_date < today:
                        overdue_installments.append({
                            "installment_number": inst.installment_number,
                            "due_date": inst.due_date.isoformat(),
                            "amount": float(inst.amount),
                            "pending_amount": float(inst.amount) - float(inst.paid_amount),
                            "days_overdue": (today - inst.due_date).days
                        })

        results.append({
            "student_id": str(stu.id),
            "student_name": f"{stu.first_name} {stu.last_name}",
            "student_code": stu.student_code,
            "prn": stu.prn,
            "guardian_name": stu.emergency_contact_name or "Parent / Guardian",
            "guardian_mobile": stu.emergency_contact_phone or stu.mobile or "—",
            "invoices": [
                {
                    "invoice_id": str(i.id),
                    "invoice_number": i.invoice_number,
                    "total_amount": float(i.total_amount),
                    "paid_amount": float(i.paid_amount),
                    "balance_amount": float(i.balance_amount),
                    "status": i.status,
                    "issue_date": i.issue_date.isoformat(),
                    "due_date": i.due_date.isoformat()
                } for i in invs
            ],
            "total_billed": total_billed,
            "total_paid": total_paid,
            "balance_due": total_balance,
            "overdue_installments": overdue_installments
        })

    results.sort(key=lambda x: x["balance_due"], reverse=True)
    return {
        "batch_id": str(batch.id),
        "batch_name": batch.name,
        "batch_code": batch.code,
        "students": results
    }


@router.get("/finance/defaulters")
async def get_fee_defaulters_aging(
    academic_year_id: Optional[uuid.UUID] = Query(None),
    batch_id: Optional[uuid.UUID] = Query(None),
    bucket: Optional[str] = Query(None),  # '1_30', '31_60', '61_90', '90_plus', 'upcoming'
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Overdue installment aging radar categorized by delinquency brackets:
    - 1-30 days overdue
    - 31-60 days overdue
    - 61-90 days overdue
    - 90+ days overdue
    - upcoming (due within next 15 days)
    """
    today = date.today()
    stmt = (
        select(Installment, InstallmentPlan, Invoice, Student, Enrollment, Batch)
        .join(InstallmentPlan, Installment.installment_plan_id == InstallmentPlan.id)
        .join(Invoice, InstallmentPlan.invoice_id == Invoice.id)
        .join(Student, Invoice.student_id == Student.id)
        .outerjoin(Enrollment, Invoice.enrollment_id == Enrollment.id)
        .outerjoin(Batch, Enrollment.batch_id == Batch.id)
        .where(Installment.status != "PAID")
        .order_by(Installment.due_date.asc())
    )

    if academic_year_id:
        target_ay = await db.get(AcademicYear, academic_year_id)
        if target_ay:
            stmt = stmt.where(
                or_(
                    Enrollment.academic_year_id == academic_year_id,
                    and_(Invoice.issue_date >= target_ay.start_date, Invoice.issue_date <= target_ay.end_date)
                )
            )

    if batch_id:
        stmt = stmt.where(Batch.id == batch_id)

    raw_items = (await db.execute(stmt)).all()

    buckets = {
        "upcoming": [],
        "1_30": [],
        "31_60": [],
        "61_90": [],
        "90_plus": []
    }

    for inst, plan, inv, stu, enr, bth in raw_items:
        days_diff = (today - inst.due_date).days
        pending_amt = float(inst.amount) - float(inst.paid_amount)
        if pending_amt <= 0:
            continue

        item = {
            "installment_id": str(inst.id),
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "student_id": str(stu.id),
            "student_name": f"{stu.first_name} {stu.last_name}",
            "student_code": stu.student_code,
            "guardian_name": stu.emergency_contact_name or "Parent / Guardian",
            "guardian_mobile": stu.emergency_contact_phone or stu.mobile or "—",
            "batch_name": bth.name if bth else "General / Unassigned",
            "batch_code": bth.code if bth else "—",
            "installment_number": inst.installment_number,
            "due_date": inst.due_date.isoformat(),
            "amount": float(inst.amount),
            "paid_amount": float(inst.paid_amount),
            "pending_amount": pending_amt,
            "days_overdue": max(0, days_diff),
            "is_overdue": days_diff > 0
        }

        if days_diff <= 0:
            if days_diff >= -15:
                buckets["upcoming"].append(item)
        elif 1 <= days_diff <= 30:
            buckets["1_30"].append(item)
        elif 31 <= days_diff <= 60:
            buckets["31_60"].append(item)
        elif 61 <= days_diff <= 90:
            buckets["61_90"].append(item)
        else:
            buckets["90_plus"].append(item)

    summary = {
        "upcoming_total": sum(x["pending_amount"] for x in buckets["upcoming"]),
        "upcoming_count": len(buckets["upcoming"]),
        "b1_30_total": sum(x["pending_amount"] for x in buckets["1_30"]),
        "b1_30_count": len(buckets["1_30"]),
        "b31_60_total": sum(x["pending_amount"] for x in buckets["31_60"]),
        "b31_60_count": len(buckets["31_60"]),
        "b61_90_total": sum(x["pending_amount"] for x in buckets["61_90"]),
        "b61_90_count": len(buckets["61_90"]),
        "b90_plus_total": sum(x["pending_amount"] for x in buckets["90_plus"]),
        "b90_plus_count": len(buckets["90_plus"]),
        "total_overdue_amount": (
            sum(x["pending_amount"] for x in buckets["1_30"]) +
            sum(x["pending_amount"] for x in buckets["31_60"]) +
            sum(x["pending_amount"] for x in buckets["61_90"]) +
            sum(x["pending_amount"] for x in buckets["90_plus"])
        ),
        "total_overdue_count": (
            len(buckets["1_30"]) + len(buckets["31_60"]) + len(buckets["61_90"]) + len(buckets["90_plus"])
        )
    }

    if bucket and bucket in buckets:
        return {
            "summary": summary,
            "items": buckets[bucket]
        }

    return {
        "summary": summary,
        "buckets": buckets
    }

