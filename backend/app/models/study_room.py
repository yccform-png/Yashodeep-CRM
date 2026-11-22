import uuid
from typing import Optional, List
from datetime import date, datetime
from sqlalchemy import String, Boolean, Date, DateTime, Numeric, ForeignKey, Text, Integer, UniqueConstraint, CheckConstraint, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class StudyRoom(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "study_rooms"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Main Library Study Hall"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    floor_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    gender_restriction: Mapped[str] = mapped_column(String(20), default="ANY", nullable=False)  # ANY, BOYS, GIRLS
    total_capacity: Mapped[int] = mapped_column(Integer, default=150, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    seats: Mapped[List["StudySeat"]] = relationship("StudySeat", back_populates="study_room", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("gender_restriction IN ('ANY', 'BOYS', 'GIRLS')", name="check_room_gender_restriction"),
        CheckConstraint("total_capacity > 0", name="check_room_capacity"),
    )


class StudyRoomCategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "study_room_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Standard", "AC Premium"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    price_multiplier: Mapped[Numeric] = mapped_column(Numeric(4, 2), default=1.00, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    seats: Mapped[List["StudySeat"]] = relationship("StudySeat", back_populates="category")


class StudySeat(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "study_seats"

    study_room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("study_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("study_room_categories.id", ondelete="SET NULL"), nullable=True)
    seat_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # B001 to B105, G001 to G045
    row_identifier: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    column_identifier: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    gender_allowed: Mapped[str] = mapped_column(String(20), default="ANY", nullable=False)  # BOYS, GIRLS, ANY
    has_power_outlet: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    has_locker: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="AVAILABLE", nullable=False, index=True)  # AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    study_room: Mapped["StudyRoom"] = relationship("StudyRoom", back_populates="seats")
    category: Mapped[Optional["StudyRoomCategory"]] = relationship("StudyRoomCategory", back_populates="seats")
    allocations: Mapped[List["SeatAllocation"]] = relationship("SeatAllocation", back_populates="study_seat")

    __table_args__ = (
        UniqueConstraint("study_room_id", "seat_number", name="uq_room_seat"),
        CheckConstraint("gender_allowed IN ('BOYS', 'GIRLS', 'ANY')", name="check_seat_gender_allowed"),
        CheckConstraint("status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE')", name="check_seat_status"),
    )


class SeatAllocation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "seat_allocations"

    study_seat_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("study_seats.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    student_service_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("student_services.id", ondelete="SET NULL"), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False, index=True)  # ACTIVE, EXPIRED, CANCELLED, TRANSFERRED
    allocated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    vacated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    study_seat: Mapped["StudySeat"] = relationship("StudySeat", back_populates="allocations")
    student: Mapped["Student"] = relationship("Student", back_populates="seat_allocations")
    student_service: Mapped[Optional["StudentService"]] = relationship("StudentService")

    __table_args__ = (
        Index(
            "uq_active_study_seat",
            "study_seat_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'")
        ),
        Index(
            "uq_active_student_study_seat",
            "student_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'")
        ),
        CheckConstraint("end_date >= start_date", name="check_seat_allocation_dates"),
        CheckConstraint("status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'TRANSFERRED')", name="check_seat_allocation_status"),
    )


class SeatReservation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "seat_reservations"

    study_seat_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("study_seats.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    reserved_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reserved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    study_seat: Mapped["StudySeat"] = relationship("StudySeat")
    student: Mapped["Student"] = relationship("Student")


class StudyRoomAttendance(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "study_room_attendance"

    study_seat_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("study_seats.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    check_out_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attendance_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False, index=True)
    recorded_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    study_seat: Mapped["StudySeat"] = relationship("StudySeat")
    student: Mapped["Student"] = relationship("Student")

    __table_args__ = (
        CheckConstraint("check_out_time IS NULL OR check_out_time >= check_in_time", name="check_study_attendance_times"),
    )

