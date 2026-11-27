import uuid
from typing import Optional, List
from datetime import date, datetime, timezone
from sqlalchemy import String, Boolean, Date, DateTime, Numeric, Integer, ForeignKey, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class ExamType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exam_types"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Weekly Test", "Unit Test", "CET Mock Exam"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    weightage_percent: Mapped[int] = mapped_column(Integer, default=100, nullable=False)


class Examination(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "examinations"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True)
    exam_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exam_types.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)  # e.g., "Mid-Term CET Evaluation 2026"
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    academic_year: Mapped["AcademicYear"] = relationship("AcademicYear")
    exam_type: Mapped["ExamType"] = relationship("ExamType")
    exam_subjects: Mapped[List["ExamSubject"]] = relationship("ExamSubject", back_populates="examination", cascade="all, delete-orphan")
    results: Mapped[List["ExamResult"]] = relationship("ExamResult", back_populates="examination", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("academic_year_id", "code", name="uq_examination_year_code"),
        CheckConstraint("end_date >= start_date", name="check_examination_dates"),
    )


class ExamSubject(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exam_subjects"

    examination_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False)
    stream_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="RESTRICT"), nullable=True)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True)
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=180, nullable=False)
    max_marks: Mapped[Numeric] = mapped_column(Numeric(6, 2), default=100.00, nullable=False)
    passing_marks: Mapped[Numeric] = mapped_column(Numeric(6, 2), default=35.00, nullable=False)
    has_negative_marking: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    negative_mark_weight: Mapped[Numeric] = mapped_column(Numeric(4, 2), default=0.25, nullable=False)
    theory_max_marks: Mapped[Numeric] = mapped_column(Numeric(6, 2), default=100.00, nullable=False)
    practical_max_marks: Mapped[Numeric] = mapped_column(Numeric(6, 2), default=0.00, nullable=False)

    examination: Mapped["Examination"] = relationship("Examination", back_populates="exam_subjects")
    subject: Mapped["Subject"] = relationship("Subject")
    academic_class: Mapped["Class"] = relationship("Class")
    stream: Mapped[Optional["Stream"]] = relationship("Stream")
    course: Mapped[Optional["Course"]] = relationship("Course")
    marks: Mapped[List["ExamMarks"]] = relationship("ExamMarks", back_populates="exam_subject", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("examination_id", "subject_id", "class_id", name="uq_exam_subject_class"),
        CheckConstraint("max_marks > 0", name="check_exam_max_marks"),
        CheckConstraint("passing_marks >= 0 AND passing_marks <= max_marks", name="check_exam_passing_marks"),
        CheckConstraint("theory_max_marks >= 0 AND practical_max_marks >= 0", name="check_exam_component_marks"),
        CheckConstraint("negative_mark_weight >= 0", name="check_negative_mark_weight"),
    )


class ExamMarks(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exam_marks"

    exam_subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exam_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    theory_marks_obtained: Mapped[Numeric] = mapped_column(Numeric(6, 2), default=0.00, nullable=False)
    practical_marks_obtained: Mapped[Numeric] = mapped_column(Numeric(6, 2), default=0.00, nullable=False)
    total_marks_obtained: Mapped[Numeric] = mapped_column(Numeric(6, 2), default=0.00, nullable=False)
    is_absent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_withheld: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="SUBMITTED", nullable=False)  # DRAFT, SUBMITTED, APPROVED
    entered_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    exam_subject: Mapped["ExamSubject"] = relationship("ExamSubject", back_populates="marks")
    student: Mapped["Student"] = relationship("Student")

    __table_args__ = (
        UniqueConstraint("exam_subject_id", "student_id", name="uq_exam_subject_student"),
        CheckConstraint("theory_marks_obtained >= 0", name="check_theory_marks"),
        CheckConstraint("practical_marks_obtained >= 0", name="check_practical_marks"),
    )


class GradingScale(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "grading_scales"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    grades: Mapped[dict] = mapped_column(JSONB, nullable=False)  # list of {min_percent, max_percent, grade, grade_point}


class ExamResult(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exam_results"

    examination_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    total_obtained: Mapped[Numeric] = mapped_column(Numeric(8, 2), nullable=False)
    total_possible: Mapped[Numeric] = mapped_column(Numeric(8, 2), nullable=False)
    percentage: Mapped[Numeric] = mapped_column(Numeric(5, 2), nullable=False)
    grade: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_pass: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    examination: Mapped["Examination"] = relationship("Examination", back_populates="results")
    student: Mapped["Student"] = relationship("Student")

    __table_args__ = (
        UniqueConstraint("examination_id", "student_id", name="uq_examination_student_result"),
        CheckConstraint("percentage >= 0 AND percentage <= 100", name="check_result_percentage"),
        CheckConstraint("total_obtained >= 0", name="check_result_total_obtained"),
        CheckConstraint("total_possible > 0", name="check_result_total_possible"),
    )

