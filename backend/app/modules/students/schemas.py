import uuid
from enum import Enum
from typing import Optional, List, Any
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, field_validator


class GuardianCreate(BaseModel):
    first_name: str
    last_name: str
    relation: str  # FATHER, MOTHER, LEGAL_GUARDIAN
    mobile: str
    email: Optional[EmailStr] = None
    occupation: Optional[str] = None
    address: Optional[str] = None
    is_primary: bool = True

    @field_validator("email", "occupation", "address", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("mobile", mode="before")
    @classmethod
    def fallback_mobile(cls, v):
        if isinstance(v, str) and not v.strip():
            return "+910000000000"
        return v or "+910000000000"


class GuardianResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    relation: str
    mobile: str
    email: Optional[str] = None
    occupation: Optional[str] = None
    is_primary: bool = False

    class Config:
        from_attributes = True


class StudentCreate(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    prn: Optional[str] = None  # Optional custom/external PRN; auto-generated if omitted
    date_of_birth: date
    gender: str  # MALE, FEMALE, OTHER
    blood_group: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    village: Optional[str] = None
    taluka: Optional[str] = None
    district: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    institution_type: Optional[str] = "SCHOOL"
    school_college_name: Optional[str] = None
    education_board: Optional[str] = None
    previous_percentage: Optional[float] = None
    aadhar_number: Optional[str] = None
    category: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    admission_date: Optional[date] = None
    guardians: Optional[List[GuardianCreate]] = []

    @field_validator(
        "middle_name", "prn", "blood_group", "mobile", "email",
        "village", "taluka", "district",
        "address_line1", "address_line2", "city", "state", "pincode",
        "institution_type", "school_college_name", "education_board", "aadhar_number", "category",
        "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
        mode="before"
    )
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[str] = None
    village: Optional[str] = None
    taluka: Optional[str] = None
    district: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    institution_type: Optional[str] = None
    school_college_name: Optional[str] = None
    education_board: Optional[str] = None
    previous_percentage: Optional[float] = None
    aadhar_number: Optional[str] = None
    category: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    # Parent / Guardian details
    guardian_first_name: Optional[str] = None
    guardian_last_name: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_relation: Optional[str] = None
    guardian_mobile: Optional[str] = None
    guardian_email: Optional[str] = None
    guardian_occupation: Optional[str] = None

    @field_validator(
        "middle_name", "blood_group", "mobile", "email",
        "village", "taluka", "district",
        "address_line1", "address_line2", "city", "state", "pincode",
        "institution_type", "school_college_name", "education_board", "aadhar_number", "category",
        "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
        "guardian_first_name", "guardian_last_name", "guardian_name", "guardian_relation",
        "guardian_mobile", "guardian_email", "guardian_occupation",
        mode="before"
    )
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class GuardianResponseItem(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    relation: str
    mobile: str
    email: Optional[str] = None
    occupation: Optional[str] = None
    is_primary: bool = True
    receives_notifications: bool = True

    class Config:
        from_attributes = True


class StudentListResponse(BaseModel):
    id: uuid.UUID
    student_code: str
    prn: Optional[str] = None
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    date_of_birth: Optional[date] = None
    gender: str
    mobile: Optional[str] = None
    email: Optional[str] = None
    status: str
    admission_date: date
    blood_group: Optional[str] = None
    institution_type: Optional[str] = None
    school_college_name: Optional[str] = None
    education_board: Optional[str] = None
    previous_percentage: Optional[float] = None
    aadhar_number: Optional[str] = None
    category: Optional[str] = None
    village: Optional[str] = None
    taluka: Optional[str] = None
    district: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    # Parent / Guardian Summary
    guardian_name: Optional[str] = None
    guardian_relation: Optional[str] = None
    guardian_mobile: Optional[str] = None
    guardian_email: Optional[str] = None
    guardian_occupation: Optional[str] = None
    guardians: Optional[List[GuardianResponseItem]] = []

    # Academic Session Scope Details
    enrollment_status: Optional[str] = None
    promotion_status: Optional[str] = None
    class_name: Optional[str] = None
    course_name: Optional[str] = None
    batch_name: Optional[str] = None

    class Config:
        from_attributes = True


# Detailed 11-Tab Profile Response
class StudentProfileResponse(BaseModel):
    overview: dict
    academics: List[dict]
    services: List[dict]
    hostel: Optional[dict] = None
    study_room: Optional[dict] = None
    fees: List[dict]
    payments: List[dict]
    attendance: dict
    examinations: List[dict]
    documents: List[dict]
    activity_history: List[dict]


class ResetPasswordTarget(str, Enum):
    STUDENT = "STUDENT"
    PARENT = "PARENT"
    BOTH = "BOTH"


class ResetPasswordToDobRequest(BaseModel):
    target: ResetPasswordTarget = ResetPasswordTarget.BOTH


class ResetPasswordToDobResponse(BaseModel):
    message: str
    target: str
    student_name: str
    default_password_hint: str
    reset_accounts: List[str]

