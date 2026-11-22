import uuid
from typing import Optional, List
from datetime import date
from sqlalchemy import String, Boolean, Date, Numeric, ForeignKey, Text, Integer, UniqueConstraint, CheckConstraint, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class EnrollmentGroup(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "enrollment_groups"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    group_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., "GRP-2026-0001"
    enrollment_type: Mapped[str] = mapped_column(String(50), default="COMBINED_MULTI_YEAR", nullable=False)  # SINGLE_YEAR, COMBINED_MULTI_YEAR
    total_years: Mapped[int] = mapped_column(default=2, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    enrollments: Mapped[List["Enrollment"]] = relationship("Enrollment", back_populates="enrollment_group")
    years: Mapped[List["EnrollmentYear"]] = relationship("EnrollmentYear", back_populates="enrollment_group", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("total_years > 0", name="check_group_total_years"),
        CheckConstraint("enrollment_type IN ('SINGLE_YEAR', 'COMBINED_MULTI_YEAR')", name="check_enrollment_type"),
    )


class EnrollmentYear(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "enrollment_years"

    enrollment_group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollment_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False, index=True)
    year_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # 1 for 11th, 2 for 12th
    status: Mapped[str] = mapped_column(String(50), default="PLANNED", nullable=False)  # PLANNED, ACTIVE, COMPLETED, CANCELLED
    enrollment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="SET NULL"), nullable=True)

    enrollment_group: Mapped["EnrollmentGroup"] = relationship("EnrollmentGroup", back_populates="years")
    academic_year: Mapped["AcademicYear"] = relationship("AcademicYear")
    academic_class: Mapped["Class"] = relationship("Class")
    enrollment: Mapped[Optional["Enrollment"]] = relationship("Enrollment")

    __table_args__ = (
        UniqueConstraint("enrollment_group_id", "year_order", name="uq_enrollment_group_year_order"),
        UniqueConstraint("enrollment_group_id", "academic_year_id", name="uq_enrollment_group_academic_year"),
        CheckConstraint("year_order > 0", name="check_enrollment_year_order"),
        CheckConstraint("status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')", name="check_enrollment_year_status"),
    )


class Enrollment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "enrollments"

    enrollment_group_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollment_groups.id", ondelete="SET NULL"), nullable=True, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True)
    class_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="RESTRICT"), nullable=True, index=True)
    stream_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="RESTRICT"), nullable=True)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="RESTRICT"), nullable=True)
    course_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("course_versions.id", ondelete="RESTRICT"), nullable=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True, index=True)
    enrollment_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False, index=True)  # ACTIVE, PROMOTED, COMPLETED, WITHDRAWN, CANCELLED
    promotion_status: Mapped[str] = mapped_column(String(50), default="NOT_PROMOTED", nullable=False)  # NOT_PROMOTED, PROMOTED_TO_NEXT, RETAINED
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    enrollment_group: Mapped[Optional["EnrollmentGroup"]] = relationship("EnrollmentGroup", back_populates="enrollments")
    student: Mapped["Student"] = relationship("Student", back_populates="enrollments")
    academic_year: Mapped["AcademicYear"] = relationship("AcademicYear")
    academic_class: Mapped[Optional["Class"]] = relationship("Class")
    stream: Mapped[Optional["Stream"]] = relationship("Stream")
    course: Mapped[Optional["Course"]] = relationship("Course")
    course_version: Mapped[Optional["CourseVersion"]] = relationship("CourseVersion")
    batch: Mapped[Optional["Batch"]] = relationship("Batch")
    enrolled_subjects: Mapped[List["EnrollmentSubject"]] = relationship("EnrollmentSubject", back_populates="enrollment", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="enrollment")

    __table_args__ = (
        Index(
            "uq_active_student_regular_class",
            "student_id",
            "academic_year_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE' AND class_id IS NOT NULL")
        ),
        Index(
            "uq_active_student_course",
            "student_id",
            "academic_year_id",
            "course_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE' AND course_id IS NOT NULL")
        ),
        CheckConstraint("status IN ('ACTIVE', 'PROVISIONAL_TRIAL', 'TRIAL_DROPOUT', 'PROMOTED', 'COMPLETED', 'WITHDRAWN', 'CANCELLED', 'SUSPENDED')", name="check_enrollment_status"),
        CheckConstraint("promotion_status IN ('NOT_PROMOTED', 'PROMOTED_TO_NEXT', 'RETAINED', 'COMPLETED')", name="check_promotion_status"),
    )


class EnrollmentSubject(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "enrollment_subjects"

    enrollment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True)
    is_package_subject: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    individual_fee: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True)

    enrollment: Mapped["Enrollment"] = relationship("Enrollment", back_populates="enrolled_subjects")
    subject: Mapped["Subject"] = relationship("Subject")
    batch: Mapped[Optional["Batch"]] = relationship("Batch")

    __table_args__ = (
        UniqueConstraint("enrollment_id", "subject_id", name="uq_enrollment_subject"),
        CheckConstraint("individual_fee >= 0", name="check_enrollment_subject_fee"),
    )

