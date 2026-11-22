import uuid
from typing import Optional, List
from datetime import date, datetime, time
from sqlalchemy import String, Boolean, Date, DateTime, Time, Numeric, ForeignKey, Text, Integer, UniqueConstraint, CheckConstraint, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class Hostel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hostels"

    institute_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Boys Hostel Wing A"
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    gender_type: Mapped[str] = mapped_column(String(20), default="BOYS", nullable=False)  # BOYS, GIRLS
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    warden_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    buildings: Mapped[List["HostelBuilding"]] = relationship("HostelBuilding", back_populates="hostel", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("gender_type IN ('BOYS', 'GIRLS')", name="check_hostel_gender_type"),
    )


class HostelBuilding(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hostel_buildings"

    hostel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostels.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Block 1"
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    total_floors: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    hostel: Mapped["Hostel"] = relationship("Hostel", back_populates="buildings")
    floors: Mapped[List["HostelFloor"]] = relationship("HostelFloor", back_populates="building", cascade="all, delete-orphan")


class HostelFloor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hostel_floors"

    building_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostel_buildings.id", ondelete="CASCADE"), nullable=False, index=True)
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "First Floor"

    building: Mapped["HostelBuilding"] = relationship("HostelBuilding", back_populates="floors")
    rooms: Mapped[List["HostelRoom"]] = relationship("HostelRoom", back_populates="floor", cascade="all, delete-orphan")


class HostelRoom(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hostel_rooms"

    floor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostel_floors.id", ondelete="CASCADE"), nullable=False, index=True)
    room_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # e.g., "101"
    room_type: Mapped[str] = mapped_column(String(50), default="DOUBLE", nullable=False)  # SINGLE, DOUBLE, TRIPLE, DORMITORY
    capacity: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    has_attached_bathroom: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_ac: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    floor: Mapped["HostelFloor"] = relationship("HostelFloor", back_populates="rooms")
    beds: Mapped[List["HostelBed"]] = relationship("HostelBed", back_populates="room", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("floor_id", "room_number", name="uq_floor_room_number"),
        CheckConstraint("room_type IN ('SINGLE', 'DOUBLE', 'TRIPLE', 'DORMITORY')", name="check_room_type"),
        CheckConstraint("capacity > 0", name="check_hostel_room_capacity"),
    )


class HostelBed(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hostel_beds"

    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostel_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    bed_number: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "101-A", "101-B"
    bed_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="AVAILABLE", nullable=False, index=True)  # AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    room: Mapped["HostelRoom"] = relationship("HostelRoom", back_populates="beds")
    allocations: Mapped[List["BedAllocation"]] = relationship("BedAllocation", back_populates="hostel_bed", cascade="all, delete-orphan", passive_deletes=True)

    __table_args__ = (
        UniqueConstraint("room_id", "bed_number", name="uq_room_bed"),
        CheckConstraint("status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE')", name="check_hostel_bed_status"),
    )


class BedAllocation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "bed_allocations"

    hostel_bed_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostel_beds.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    student_service_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("student_services.id", ondelete="SET NULL"), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    check_out_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False, index=True)  # ACTIVE, VACATED, TRANSFERRED
    allocated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    deposit_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    hostel_bed: Mapped["HostelBed"] = relationship("HostelBed", back_populates="allocations")
    student: Mapped["Student"] = relationship("Student", back_populates="bed_allocations")
    student_service: Mapped[Optional["StudentService"]] = relationship("StudentService")

    __table_args__ = (
        Index(
            "uq_active_hostel_bed",
            "hostel_bed_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'")
        ),
        Index(
            "uq_active_student_hostel_bed",
            "student_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'")
        ),
        CheckConstraint("deposit_amount >= 0", name="check_bed_deposit_amount"),
        CheckConstraint("end_date >= start_date", name="check_bed_allocation_dates"),
        CheckConstraint("status IN ('ACTIVE', 'VACATED', 'TRANSFERRED', 'CANCELLED')", name="check_bed_allocation_status"),
    )


class HostelAttendance(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hostel_attendance"

    hostel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostels.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="PRESENT", nullable=False)  # PRESENT, ABSENT, ON_LEAVE, LATE
    remarks: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    marked_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    hostel: Mapped["Hostel"] = relationship("Hostel")
    student: Mapped["Student"] = relationship("Student")

    __table_args__ = (
        UniqueConstraint("hostel_id", "student_id", "date", name="uq_hostel_student_date"),
        CheckConstraint("status IN ('PRESENT', 'ABSENT', 'ON_LEAVE', 'LATE')", name="check_hostel_attendance_status"),
    )


class HostelVisitor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hostel_visitors"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    visitor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    visitor_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    relation: Mapped[str] = mapped_column(String(50), nullable=False)
    visit_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    in_time: Mapped[time] = mapped_column(Time, nullable=False)
    out_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    purpose: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gate_pass_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    student: Mapped["Student"] = relationship("Student")


class HostelMaintenance(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hostel_maintenance"

    hostel_room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hostel_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    reported_by_student_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    issue_type: Mapped[str] = mapped_column(String(100), nullable=False)  # PLUMBING, ELECTRICAL, FURNITURE, CLEANING
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, URGENT
    status: Mapped[str] = mapped_column(String(50), default="OPEN", nullable=False)  # OPEN, IN_PROGRESS, RESOLVED
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    room: Mapped["HostelRoom"] = relationship("HostelRoom")
    reported_by: Mapped[Optional["Student"]] = relationship("Student")

    __table_args__ = (
        CheckConstraint("priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')", name="check_maintenance_priority"),
        CheckConstraint("status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')", name="check_maintenance_status"),
    )

