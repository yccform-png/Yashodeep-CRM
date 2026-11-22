import uuid
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, EmailStr, field_validator


class InstituteResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    tagline: Optional[str] = None
    registration_number: Optional[str] = None
    gstin: Optional[str] = None
    logo_url: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    secondary_phone: Optional[str] = None
    website: Optional[str] = None
    signatory_title: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_branch: Optional[str] = None
    upi_id: Optional[str] = None
    invoice_terms: Optional[str] = None
    admission_form_fee: Decimal = Decimal("200.00")
    trial_period_days: int = 14
    grace_period_days: int = 7
    enable_admission_form_fee: bool = True
    enable_trial_admission: bool = True
    is_active: bool = True

    class Config:
        from_attributes = True


class InstituteUpdate(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    registration_number: Optional[str] = None
    gstin: Optional[str] = None
    logo_url: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    secondary_phone: Optional[str] = None
    website: Optional[str] = None
    signatory_title: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_branch: Optional[str] = None
    upi_id: Optional[str] = None
    invoice_terms: Optional[str] = None
    admission_form_fee: Optional[Decimal] = None
    trial_period_days: Optional[int] = None
    grace_period_days: Optional[int] = None
    enable_admission_form_fee: Optional[bool] = None
    enable_trial_admission: Optional[bool] = None

    @field_validator(
        "tagline", "registration_number", "gstin", "logo_url", "address",
        "contact_email", "contact_phone", "secondary_phone", "website",
        "signatory_title", "bank_name", "bank_account_name", "bank_account_number",
        "bank_ifsc", "bank_branch", "upi_id", "invoice_terms",
        mode="before"
    )
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v
