import uuid
from typing import Optional, List
from datetime import date
from decimal import Decimal
from sqlalchemy import String, Boolean, Date, Integer, BigInteger, ForeignKey, Text, UniqueConstraint, CheckConstraint, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class Student(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "students"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    student_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., "STU-2026-00001"
    prn: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True, index=True)  # Permanent Registration Number e.g., "202601040216" (YYYYDDMMNNNN)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)  # MALE, FEMALE, OTHER
    blood_group: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(20), index=True, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    village: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    taluka: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    profile_photo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    admission_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    institution_type: Mapped[Optional[str]] = mapped_column(String(50), default="SCHOOL", nullable=True)  # SCHOOL, COLLEGE
    school_college_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    education_board: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    previous_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    aadhar_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    emergency_contact_relation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    trial_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    trial_form_fee_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trial_receipt_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False, index=True)  # ACTIVE, PROVISIONAL_TRIAL, TRIAL_DROPOUT, INACTIVE, etc.

    user: Mapped[Optional["User"]] = relationship("User")
    guardians: Mapped[List["StudentGuardian"]] = relationship("StudentGuardian", back_populates="student", cascade="all, delete-orphan", passive_deletes=True)
    documents: Mapped[List["StudentDocument"]] = relationship("StudentDocument", back_populates="student", cascade="all, delete-orphan", passive_deletes=True)
    enrollments: Mapped[List["Enrollment"]] = relationship("Enrollment", back_populates="student", passive_deletes=True)
    services: Mapped[List["StudentService"]] = relationship("StudentService", back_populates="student", passive_deletes=True)
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="student", passive_deletes=True)
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="student", passive_deletes=True)
    seat_allocations: Mapped[List["SeatAllocation"]] = relationship("SeatAllocation", back_populates="student", passive_deletes=True)
    bed_allocations: Mapped[List["BedAllocation"]] = relationship("BedAllocation", back_populates="student", passive_deletes=True)

    __table_args__ = (
        CheckConstraint("gender IN ('MALE', 'FEMALE', 'OTHER')", name="check_student_gender"),
        CheckConstraint("status IN ('ACTIVE', 'PROVISIONAL_TRIAL', 'TRIAL_DROPOUT', 'INACTIVE', 'PROMOTED', 'WITHDRAWN', 'GRADUATED', 'SUSPENDED')", name="check_student_status"),
    )


class Guardian(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "guardians"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    relation: Mapped[str] = mapped_column(String(50), nullable=False)  # FATHER, MOTHER, LEGAL_GUARDIAN
    mobile: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    occupation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped[Optional["User"]] = relationship("User")
    students: Mapped[List["StudentGuardian"]] = relationship("StudentGuardian", back_populates="guardian", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("relation IN ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'OTHER')", name="check_guardian_relation"),
    )


class StudentGuardian(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_guardians"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    guardian_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_pickup: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    receives_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    student: Mapped["Student"] = relationship("Student", back_populates="guardians")
    guardian: Mapped["Guardian"] = relationship("Guardian", back_populates="students")

    __table_args__ = (
        UniqueConstraint("student_id", "guardian_id", name="uq_student_guardian"),
    )


class StudentUserAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_user_accounts"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    student: Mapped["Student"] = relationship("Student")
    user: Mapped["User"] = relationship("User")


class GuardianUserAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "guardian_user_accounts"

    guardian_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("guardians.id", ondelete="CASCADE"), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    guardian: Mapped["Guardian"] = relationship("Guardian")
    user: Mapped["User"] = relationship("User")


class StudentDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_documents"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)  # AADHAR, PREVIOUS_MARKSHEET, PHOTO, BIRTH_CERTIFICATE
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    student: Mapped["Student"] = relationship("Student", back_populates="documents")

