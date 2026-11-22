import uuid
from typing import Optional, List
from datetime import date, time
from sqlalchemy import String, Boolean, Date, Time, Integer, Numeric, ForeignKey, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class AcademicYear(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "academic_years"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "2026-2027"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., "AY-2026-27"
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    batches: Mapped[List["Batch"]] = relationship("Batch", back_populates="academic_year")

    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="check_academic_year_dates"),
    )


class AcademicLevel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "academic_levels"

    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Secondary", "Higher Secondary"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    classes: Mapped[List["Class"]] = relationship("Class", back_populates="level")


class Class(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "classes"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True, index=True)
    level_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_levels.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "11th Standard", "12th Standard"
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # e.g., "STD-11", "STD-12"
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    level: Mapped[Optional["AcademicLevel"]] = relationship("AcademicLevel", back_populates="classes")
    courses: Mapped[List["Course"]] = relationship("Course", back_populates="academic_class")


class Stream(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "streams"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Science", "Commerce"
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # e.g., "SCI", "COMM"
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    courses: Mapped[List["Course"]] = relationship("Course", back_populates="stream")


class Subject(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subjects"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Physics", "Chemistry", "Mathematics", "Biology"
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # e.g., "PHY", "CHEM", "MATH", "BIO"
    default_theory_marks: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    default_practical_marks: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    default_individual_fee: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint("default_individual_fee >= 0", name="check_subject_fee"),
        CheckConstraint("default_theory_marks >= 0 AND default_practical_marks >= 0", name="check_subject_marks"),
    )


class ClassSubject(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "class_subjects"

    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    stream_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="CASCADE"), nullable=True, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    subject: Mapped["Subject"] = relationship("Subject")
    academic_class: Mapped["Class"] = relationship("Class")
    stream: Mapped[Optional["Stream"]] = relationship("Stream")

    __table_args__ = (
        UniqueConstraint("class_id", "stream_id", "subject_id", name="uq_class_stream_subject"),
    )


class CourseType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "course_types"

    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Regular", "Competitive", "Integrated", "Crash Course"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class Course(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "courses"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True, index=True)
    course_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("course_types.id", ondelete="RESTRICT"), nullable=False)
    class_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="RESTRICT"), nullable=True)
    stream_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="RESTRICT"), nullable=True)
    is_universal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)  # e.g., "11th Science - Regular + CET"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_months: Mapped[int] = mapped_column(Integer, default=12, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    course_type: Mapped["CourseType"] = relationship("CourseType")
    academic_class: Mapped[Optional["Class"]] = relationship("Class", back_populates="courses")
    stream: Mapped[Optional["Stream"]] = relationship("Stream", back_populates="courses")
    versions: Mapped[List["CourseVersion"]] = relationship("CourseVersion", back_populates="course", cascade="all, delete-orphan")
    batches: Mapped[List["Batch"]] = relationship("Batch", back_populates="course")

    __table_args__ = (
        CheckConstraint("duration_months > 0", name="check_course_duration"),
        CheckConstraint("is_universal = True OR class_id IS NOT NULL", name="check_course_class_or_universal"),
    )


class CourseVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "course_versions"

    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    base_fee: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    one_time_fee: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2), nullable=True)
    installment_fee: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    course: Mapped["Course"] = relationship("Course", back_populates="versions")
    version_subjects: Mapped[List["CourseVersionSubject"]] = relationship("CourseVersionSubject", back_populates="course_version", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("course_id", "version_number", name="uq_course_version"),
        CheckConstraint("base_fee >= 0", name="check_course_version_base_fee"),
        CheckConstraint("one_time_fee IS NULL OR one_time_fee >= 0", name="check_course_version_one_time_fee"),
        CheckConstraint("installment_fee IS NULL OR installment_fee >= 0", name="check_course_version_installment_fee"),
        CheckConstraint("effective_to IS NULL OR effective_to >= effective_from", name="check_course_version_dates"),
    )


class CourseVersionSubject(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "course_version_subjects"

    course_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("course_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    course_version: Mapped["CourseVersion"] = relationship("CourseVersion", back_populates="version_subjects")
    subject: Mapped["Subject"] = relationship("Subject")

    __table_args__ = (
        UniqueConstraint("course_version_id", "subject_id", name="uq_course_version_subject"),
    )


class SubjectGroup(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subject_groups"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    stream_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "PCM", "PCB", "PCMB"
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    package_fee: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    one_time_package_fee: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2), nullable=True)
    installment_package_fee: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    items: Mapped[List["SubjectGroupItem"]] = relationship("SubjectGroupItem", back_populates="subject_group", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("package_fee >= 0", name="check_subject_group_package_fee"),
        CheckConstraint("one_time_package_fee IS NULL OR one_time_package_fee >= 0", name="check_subject_group_one_time_fee"),
        CheckConstraint("installment_package_fee IS NULL OR installment_package_fee >= 0", name="check_subject_group_installment_fee"),
        UniqueConstraint("class_id", "stream_id", "code", name="uq_subject_group_code"),
    )


class SubjectGroupItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subject_group_items"

    subject_group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subject_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)

    subject_group: Mapped["SubjectGroup"] = relationship("SubjectGroup", back_populates="items")
    subject: Mapped["Subject"] = relationship("Subject")

    __table_args__ = (
        UniqueConstraint("subject_group_id", "subject_id", name="uq_subject_group_item"),
    )


class Teacher(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "teachers"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    employee_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    specialization: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    qualification: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship("User")
    batch_subjects: Mapped[List["BatchSubject"]] = relationship("BatchSubject", back_populates="teacher")


class Classroom(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "classrooms"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Hall A", "Lab 2"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    has_projector: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint("capacity > 0", name="check_classroom_capacity"),
    )


class Batch(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "batches"

    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False, index=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)  # e.g., "12th Sci Morning Batch 2026"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    division: Mapped[str] = mapped_column(String(20), default="A", nullable=False)  # e.g., "A", "B", "C"
    max_capacity: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    course: Mapped["Course"] = relationship("Course", back_populates="batches")
    academic_year: Mapped["AcademicYear"] = relationship("AcademicYear", back_populates="batches")
    batch_subjects: Mapped[List["BatchSubject"]] = relationship("BatchSubject", back_populates="batch", cascade="all, delete-orphan")
    students: Mapped[List["BatchStudent"]] = relationship("BatchStudent", back_populates="batch")

    __table_args__ = (
        CheckConstraint("max_capacity > 0", name="check_batch_capacity"),
        CheckConstraint("end_date >= start_date", name="check_batch_dates"),
    )


class BatchSubject(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "batch_subjects"

    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True)
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    classroom_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="batch_subjects")
    subject: Mapped["Subject"] = relationship("Subject")
    teacher: Mapped[Optional["Teacher"]] = relationship("Teacher", back_populates="batch_subjects")
    classroom: Mapped[Optional["Classroom"]] = relationship("Classroom")
    timetable_entries: Mapped[List["TimetableEntry"]] = relationship("TimetableEntry", back_populates="batch_subject", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("batch_id", "subject_id", name="uq_batch_subject"),
    )


class BatchStudent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "batch_students"

    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    roll_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)  # Standard-prefixed roll number e.g. 501, 1001
    enrolled_at: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="students")
    student: Mapped["Student"] = relationship("Student")

    __table_args__ = (
        UniqueConstraint("batch_id", "student_id", name="uq_batch_student"),
        UniqueConstraint("batch_id", "roll_number", name="uq_batch_student_roll"),
        CheckConstraint("roll_number IS NULL OR roll_number > 0", name="check_positive_roll_number"),
    )


class TimetableEntry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "timetable_entries"

    batch_subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batch_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    classroom_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    batch_subject: Mapped["BatchSubject"] = relationship("BatchSubject", back_populates="timetable_entries")
    classroom: Mapped[Optional["Classroom"]] = relationship("Classroom")

    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="check_day_of_week"),
        CheckConstraint("end_time > start_time", name="check_timetable_times"),
    )


class TimetableException(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "timetable_exceptions"

    batch_subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batch_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    exception_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rescheduled_start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    rescheduled_end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
