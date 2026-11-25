from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.student import Student
from app.models.fee import Invoice, Payment
from app.models.study_room import StudySeat
from app.models.hostel import HostelBed
from app.models.attendance import AttendanceRecord
from app.models.academic import Course

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/dashboard")
async def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Computes real-time ERP analytics from PostgreSQL tables.
    Never hardcoded sample data.
    Cached in Redis for 60 seconds with active write-invalidation.
    Financial metrics are strictly shielded from non-SUPER_ADMIN users.
    """
    is_super_admin = current_user.user_type == "SUPER_ADMIN"
    cache_key = f"{CacheKeys.dashboard_metrics()}:{is_super_admin}"
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached

    # 1. Students Count
    total_students = (await db.execute(select(func.count(Student.id)))).scalar() or 0
    active_students = (await db.execute(select(func.count(Student.id)).where(Student.status == "ACTIVE"))).scalar() or 0

    # 2. Financial Metrics (Computed ONLY if Super Admin)
    total_invoiced = Decimal("0.00")
    total_collected = Decimal("0.00")
    total_outstanding = Decimal("0.00")
    recent_payments = []

    if is_super_admin:
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
