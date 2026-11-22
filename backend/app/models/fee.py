import uuid
from typing import Optional, List
from datetime import date, datetime
from sqlalchemy import String, Boolean, Date, DateTime, Numeric, ForeignKey, Text, Integer, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class FeeStructure(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "fee_structures"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False, index=True)
    stream_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="RESTRICT"), nullable=True)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="RESTRICT"), nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    items: Mapped[List["FeeStructureItem"]] = relationship("FeeStructureItem", back_populates="fee_structure", cascade="all, delete-orphan")


class FeeStructureItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "fee_structure_items"

    fee_structure_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_structures.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # Tuition, Exam Fee, Lab Fee, Admission Fee
    fee_type: Mapped[str] = mapped_column(String(50), default="TUITION", nullable=False)  # TUITION, EXAM, ADMISSION, MATERIAL, DEPOSIT, MISC
    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    is_refundable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    fee_structure: Mapped["FeeStructure"] = relationship("FeeStructure", back_populates="items")

    __table_args__ = (
        CheckConstraint("amount >= 0", name="check_fee_item_amount"),
    )


class DiscountType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "discount_types"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Merit Scholarship", "Sibling Discount"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    discount_nature: Mapped[str] = mapped_column(String(20), default="PERCENTAGE", nullable=False)  # PERCENTAGE, FLAT
    value: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint("value >= 0", name="check_discount_value"),
        CheckConstraint("discount_nature IN ('PERCENTAGE', 'FLAT')", name="check_discount_nature"),
    )


class StudentDiscount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_discounts"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    discount_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("discount_types.id", ondelete="RESTRICT"), nullable=False)
    applied_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    approved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approval_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    discount_type: Mapped["DiscountType"] = relationship("DiscountType")

    __table_args__ = (
        CheckConstraint("applied_amount >= 0", name="check_applied_discount_amount"),
    )


class Invoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoices"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="RESTRICT"), nullable=False, index=True)
    enrollment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="SET NULL"), nullable=True, index=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., "INV-2026-0001"
    issue_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    discount_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    paid_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ISSUED", nullable=False, index=True)  # DRAFT, ISSUED, PARTIALLY_PAID, PAID, CANCELLED, OVERDUE

    student: Mapped["Student"] = relationship("Student", back_populates="invoices")
    enrollment: Mapped[Optional["Enrollment"]] = relationship("Enrollment", back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    installment_plan: Mapped[Optional["InstallmentPlan"]] = relationship("InstallmentPlan", back_populates="invoice", uselist=False, cascade="all, delete-orphan")
    payment_allocations: Mapped[List["PaymentAllocation"]] = relationship("PaymentAllocation", back_populates="invoice")

    __table_args__ = (
        CheckConstraint("subtotal >= 0", name="check_invoice_subtotal"),
        CheckConstraint("discount_amount >= 0", name="check_invoice_discount"),
        CheckConstraint("tax_amount >= 0", name="check_invoice_tax"),
        CheckConstraint("total_amount >= 0", name="check_invoice_total"),
        CheckConstraint("paid_amount >= 0 AND paid_amount <= total_amount", name="check_invoice_paid_amount"),
        CheckConstraint("balance_amount >= 0 AND balance_amount <= total_amount", name="check_invoice_balance_amount"),
        CheckConstraint("status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'OVERDUE', 'REFUNDED')", name="check_invoice_status"),
        CheckConstraint("due_date >= issue_date", name="check_invoice_dates"),
    )


class InvoiceItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    service_type_code: Mapped[str] = mapped_column(String(50), default="TUITION", nullable=False)  # TUITION, HOSTEL, STUDY_ROOM, MISC
    service_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("student_services.id", ondelete="SET NULL"), nullable=True)
    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    unit_price: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    discount_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")

    __table_args__ = (
        CheckConstraint("unit_price >= 0", name="check_invoice_item_unit_price"),
        CheckConstraint("quantity > 0", name="check_invoice_item_quantity"),
        CheckConstraint("discount_amount >= 0", name="check_invoice_item_discount"),
        CheckConstraint("total_amount >= 0", name="check_invoice_item_total"),
    )


class InstallmentPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "installment_plans"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), unique=True, nullable=False)
    number_of_installments: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    total_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    is_restructured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    restructure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    restructured_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    restructured_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="installment_plan")
    installments: Mapped[List["Installment"]] = relationship("Installment", back_populates="installment_plan", cascade="all, delete-orphan", order_by="Installment.installment_number")
    restructured_by_user: Mapped[Optional["User"]] = relationship("User")

    __table_args__ = (
        CheckConstraint("number_of_installments > 0", name="check_plan_num_installments"),
        CheckConstraint("total_amount >= 0", name="check_plan_total_amount"),
    )


class Installment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "installments"

    installment_plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("installment_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    installment_number: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    paid_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, PARTIALLY_PAID, PAID, OVERDUE

    installment_plan: Mapped["InstallmentPlan"] = relationship("InstallmentPlan", back_populates="installments")
    payment_allocations: Mapped[List["PaymentAllocation"]] = relationship("PaymentAllocation", back_populates="installment")

    __table_args__ = (
        UniqueConstraint("installment_plan_id", "installment_number", name="uq_plan_installment_number"),
        CheckConstraint("installment_number > 0", name="check_installment_number"),
        CheckConstraint("amount > 0", name="check_installment_amount"),
        CheckConstraint("paid_amount >= 0 AND paid_amount <= amount", name="check_installment_paid_amount"),
        CheckConstraint("status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')", name="check_installment_status"),
    )


class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="RESTRICT"), nullable=False, index=True)
    payment_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., "PAY-2026-0001"
    payment_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), default="CASH", nullable=False)  # CASH, UPI, CARD, NET_BANKING, CHEQUE, DEMAND_DRAFT, RAZORPAY
    transaction_reference: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True, index=True)
    gateway_payment_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gateway_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="SUCCESS", nullable=False)  # SUCCESS, PENDING, FAILED, REFUNDED
    collected_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    student: Mapped["Student"] = relationship("Student", back_populates="payments")
    allocations: Mapped[List["PaymentAllocation"]] = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")
    receipt: Mapped[Optional["Receipt"]] = relationship("Receipt", back_populates="payment", uselist=False, cascade="all, delete-orphan")
    refunds: Mapped[List["Refund"]] = relationship("Refund", back_populates="payment")

    __table_args__ = (
        CheckConstraint("amount > 0", name="check_payment_amount_positive"),
        CheckConstraint("status IN ('SUCCESS', 'PENDING', 'FAILED', 'REFUNDED', 'CANCELLED')", name="check_payment_status"),
    )


class PaymentAllocation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payment_allocations"

    payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    installment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("installments.id", ondelete="SET NULL"), nullable=True)
    allocated_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)

    payment: Mapped["Payment"] = relationship("Payment", back_populates="allocations")
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payment_allocations")
    installment: Mapped[Optional["Installment"]] = relationship("Installment", back_populates="payment_allocations")

    __table_args__ = (
        CheckConstraint("allocated_amount > 0", name="check_allocated_amount_positive"),
        UniqueConstraint("payment_id", "invoice_id", "installment_id", name="uq_payment_alloc"),
    )


class Receipt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "receipts"

    payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), unique=True, nullable=False)
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., "RCP-2026-0001"
    pdf_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    payment: Mapped["Payment"] = relationship("Payment", back_populates="receipt")


class Refund(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "refunds"

    payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False)
    refund_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    approved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="COMPLETED", nullable=False)
    refund_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)

    payment: Mapped["Payment"] = relationship("Payment", back_populates="refunds")

    __table_args__ = (
        CheckConstraint("amount > 0", name="check_refund_amount_positive"),
        CheckConstraint("status IN ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED')", name="check_refund_status"),
    )

