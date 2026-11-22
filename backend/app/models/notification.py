import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="GENERAL", nullable=False)  # ADMISSION, FEE, ATTENDANCE, EXAM, FACILITY, GENERAL
    action_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User")


class NotificationOutbox(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notification_outbox"

    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # ADMISSION_CONFIRMED, INVOICE_GENERATED, FEE_DUE_REMINDER, etc.
    recipient_target: Mapped[str] = mapped_column(String(255), nullable=False)  # email, phone number, or user_id
    channel: Mapped[str] = mapped_column(String(50), default="IN_APP", nullable=False)  # EMAIL, SMS, WHATSAPP, IN_APP
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False, index=True)  # PENDING, SENT, FAILED
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_attempted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'SENT', 'FAILED')", name="check_outbox_status"),
    )

