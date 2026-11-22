import uuid
from typing import Optional, List
from datetime import date
from sqlalchemy import String, Boolean, Date, Numeric, ForeignKey, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class ServiceType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "service_types"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # TUITION, HOSTEL, STUDY_ROOM
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    plans: Mapped[List["ServicePlan"]] = relationship("ServicePlan", back_populates="service_type")


class ServicePlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "service_plans"

    service_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("service_types.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Full Year Study Room - AC", "Hostel 3-Bed Sharing"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    billing_frequency: Mapped[str] = mapped_column(String(50), default="YEARLY", nullable=False)  # ONE_TIME, MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY
    base_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    deposit_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    features: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    service_type: Mapped["ServiceType"] = relationship("ServiceType", back_populates="plans")
    subscriptions: Mapped[List["StudentService"]] = relationship("StudentService", back_populates="service_plan")

    __table_args__ = (
        CheckConstraint("base_amount >= 0", name="check_plan_base_amount"),
        CheckConstraint("deposit_amount >= 0", name="check_plan_deposit_amount"),
        CheckConstraint("billing_frequency IN ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY')", name="check_plan_billing_frequency"),
    )


class StudentService(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_services"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    service_plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("service_plans.id", ondelete="RESTRICT"), nullable=False, index=True)
    academic_year_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="SET NULL"), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    billing_frequency: Mapped[str] = mapped_column(String(50), default="YEARLY", nullable=False)
    unit_price: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    deposit_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False, index=True)  # ACTIVE, EXPIRED, CANCELLED, SUSPENDED

    student: Mapped["Student"] = relationship("Student", back_populates="services")
    service_plan: Mapped["ServicePlan"] = relationship("ServicePlan", back_populates="subscriptions")
    academic_year: Mapped[Optional["AcademicYear"]] = relationship("AcademicYear")

    __table_args__ = (
        CheckConstraint("unit_price >= 0", name="check_service_unit_price"),
        CheckConstraint("deposit_amount >= 0", name="check_service_deposit_amount"),
        CheckConstraint("end_date >= start_date", name="check_service_dates"),
        CheckConstraint("status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED')", name="check_student_service_status"),
    )

