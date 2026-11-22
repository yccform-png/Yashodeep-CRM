import uuid
from typing import Optional, List
from decimal import Decimal
from sqlalchemy import String, Boolean, Text, ForeignKey, UniqueConstraint, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class Institute(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "institutes"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    tagline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    registration_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    secondary_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    signatory_title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_account_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_ifsc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_branch: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    upi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    invoice_terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admission_form_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("200.00"), nullable=False)
    trial_period_days: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    grace_period_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    enable_admission_form_fee: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_trial_admission: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    settings: Mapped[List["InstituteSetting"]] = relationship("InstituteSetting", back_populates="institute", cascade="all, delete-orphan")


class InstituteSetting(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "institute_settings"

    institute_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), default="GENERAL", nullable=False)
    setting_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    setting_value: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    institute: Mapped["Institute"] = relationship("Institute", back_populates="settings")

    __table_args__ = (
        UniqueConstraint("institute_id", "setting_key", name="uq_institute_setting_key"),
    )

