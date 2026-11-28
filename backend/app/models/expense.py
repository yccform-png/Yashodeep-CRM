import uuid
from typing import Optional, List
from datetime import date
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, Date, Boolean, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class StaffMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "staff_members"

    institute_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    role_designation: Mapped[str] = mapped_column(String(100), nullable=False)  # Senior Faculty, Hostel Warden, Accountant, Peon, Security, Lab Assistant
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    base_monthly_salary: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_account_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_ifsc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    upi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    joining_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User")
    expenses: Mapped[List["ExpenseTransaction"]] = relationship("ExpenseTransaction", back_populates="staff_member", cascade="all, delete-orphan")


class ExpenseTransaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "expense_transactions"

    institute_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_year_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="SET NULL"), nullable=True, index=True)
    staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("staff_members.id", ondelete="SET NULL"), nullable=True, index=True)
    expense_category: Mapped[str] = mapped_column(String(50), default="SALARY", nullable=False)  # SALARY, RENT, UTILITIES, STATIONERY_PRINTING, MAINTENANCE, EQUIPMENT, MARKETING, MISCELLANEOUS
    title: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g. "Monthly Salary - Nov 2026 - Ramesh Patil"
    pay_period_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1 - 12
    pay_period_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # e.g. 2026
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(30), default="BANK_TRANSFER", nullable=False)  # BANK_TRANSFER, UPI, CASH, CHEQUE
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # UTR / Cheque No / Txn ID
    voucher_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # EXP-2026-00001
    status: Mapped[str] = mapped_column(String(30), default="PAID", nullable=False)  # PAID, PENDING
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    staff_member: Mapped[Optional["StaffMember"]] = relationship("StaffMember", back_populates="expenses")
    academic_year: Mapped[Optional["AcademicYear"]] = relationship("AcademicYear")
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])
