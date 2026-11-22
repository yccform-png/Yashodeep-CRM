import uuid
from typing import Optional, List
from datetime import date, time, datetime, timezone
from sqlalchemy import String, Boolean, Date, DateTime, Time, ForeignKey, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class AttendanceSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attendance_sessions"

    batch_subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batch_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    session_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False, index=True)
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    topic_covered: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    batch_subject: Mapped["BatchSubject"] = relationship("BatchSubject")
    teacher: Mapped[Optional["Teacher"]] = relationship("Teacher")
    records: Mapped[List["AttendanceRecord"]] = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("batch_subject_id", "session_date", name="uq_batch_subject_date"),
        CheckConstraint("end_time IS NULL OR start_time IS NULL OR end_time >= start_time", name="check_session_times"),
    )


class AttendanceRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attendance_records"

    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="PRESENT", nullable=False)  # PRESENT, ABSENT, LATE, EXCUSED_LEAVE
    remarks: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    session: Mapped["AttendanceSession"] = relationship("AttendanceSession", back_populates="records")
    student: Mapped["Student"] = relationship("Student")
    corrections: Mapped[List["AttendanceCorrection"]] = relationship("AttendanceCorrection", back_populates="record", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_session_student"),
        CheckConstraint("status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED_LEAVE')", name="check_attendance_status"),
    )


class AttendanceCorrection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attendance_corrections"

    attendance_record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status: Mapped[str] = mapped_column(String(50), nullable=False)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    changed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    record: Mapped["AttendanceRecord"] = relationship("AttendanceRecord", back_populates="corrections")

