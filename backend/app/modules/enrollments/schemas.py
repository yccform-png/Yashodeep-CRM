import uuid
from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, EmailStr, field_validator
from app.modules.students.schemas import GuardianCreate


class CustomInstallmentInput(BaseModel):
    installment_number: int
    due_date: date
    amount: Optional[Decimal] = None


class AdmissionWizardRequest(BaseModel):
    # Step 1: Student Details
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    date_of_birth: date
    gender: str  # MALE, FEMALE
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    blood_group: Optional[str] = None
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
    guardians: Optional[List[GuardianCreate]] = []

    # Step 2: Academic Program & Model
    is_academic_enrolled: bool = True  # Can be False for Study Room Only / Hostel Only
    enrollment_type: str = "SINGLE_YEAR"  # SINGLE_YEAR or COMBINED_MULTI_YEAR (11th + 12th)
    academic_year_id: Optional[uuid.UUID] = None
    class_id: Optional[uuid.UUID] = None
    stream_id: Optional[uuid.UUID] = None
    course_id: Optional[uuid.UUID] = None
    course_version_id: Optional[uuid.UUID] = None
    subject_group_id: Optional[uuid.UUID] = None
    selected_subject_ids: Optional[List[uuid.UUID]] = []
    batch_id: Optional[uuid.UUID] = None

    # Step 3: Optional Facilities & Services
    hostel_plan_id: Optional[uuid.UUID] = None
    hostel_bed_id: Optional[uuid.UUID] = None
    study_room_plan_id: Optional[uuid.UUID] = None
    study_seat_id: Optional[uuid.UUID] = None

    # Step 4: Fees, Discounts & Billing
    discount_amount: Decimal = Decimal("0.00")
    number_of_installments: int = 1
    custom_installments: Optional[List[CustomInstallmentInput]] = None
    admission_date: Optional[date] = None
    admission_type: str = "CONFIRMED"  # CONFIRMED or PROVISIONAL_TRIAL
    form_fee_payment_mode: Optional[str] = "CASH"

    @field_validator(
        "middle_name", "mobile", "email", "blood_group",
        "village", "taluka", "district",
        "address_line1", "address_line2", "city", "state", "pincode",
        "institution_type", "school_college_name", "education_board", "aadhar_number", "category",
        "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
        "academic_year_id", "class_id", "stream_id", "course_id",
        "course_version_id", "subject_group_id", "batch_id",
        "hostel_plan_id", "hostel_bed_id", "study_room_plan_id", "study_seat_id",
        mode="before"
    )
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class AdmissionConfirmationResponse(BaseModel):
    student_id: uuid.UUID
    student_code: str
    prn: Optional[str] = None
    enrollment_id: Optional[uuid.UUID] = None
    enrollment_group_id: Optional[uuid.UUID] = None
    invoice_id: Optional[uuid.UUID] = None
    invoice_number: Optional[str] = None
    total_fee: Decimal
    seat_allocated: Optional[str] = None
    bed_allocated: Optional[str] = None
    is_trial: bool = False
    trial_end_date: Optional[date] = None
    trial_receipt_number: Optional[str] = None
    message: str


class TrialConversionRequest(BaseModel):
    discount_amount: Decimal = Decimal("0.00")
    number_of_installments: int = 1
    custom_installments: Optional[List[CustomInstallmentInput]] = None
    joining_date: Optional[date] = None


class PromotionRequest(BaseModel):
    next_academic_year_id: uuid.UUID
    next_class_id: uuid.UUID
    next_stream_id: Optional[uuid.UUID] = None
    next_course_id: Optional[uuid.UUID] = None
    next_course_version_id: Optional[uuid.UUID] = None
    subject_ids: List[uuid.UUID]
    next_batch_id: Optional[uuid.UUID] = None


class MidSessionSkillEnrollmentRequest(BaseModel):
    student_id: uuid.UUID
    course_id: uuid.UUID
    course_version_id: Optional[uuid.UUID] = None
    batch_id: Optional[uuid.UUID] = None
    discount_amount: Decimal = Decimal("0.00")
    number_of_installments: int = 1
    custom_installments: Optional[List[CustomInstallmentInput]] = None
    billing_mode: str = "SEPARATE_INVOICE"  # "SEPARATE_INVOICE" or "MERGE_INTO_OPEN_INVOICE"
    target_invoice_id: Optional[uuid.UUID] = None


class SkillEnrollmentResponse(BaseModel):
    student_id: uuid.UUID
    enrollment_id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str
    course_name: str
    total_fee: Decimal
    billing_mode: str = "SEPARATE_INVOICE"  # "SEPARATE_INVOICE" or "MERGED"
    updated_installments_count: Optional[int] = None
    message: str


class CohortReviewStudentItem(BaseModel):
    student_id: uuid.UUID
    enrollment_id: uuid.UUID
    student_name: str
    student_code: str
    prn: Optional[str] = None
    roll_number: Optional[int] = None
    gender: str
    enrollment_status: str
    promotion_status: str
    attendance_rate: float
    total_invoiced: Decimal
    total_paid: Decimal
    balance_due: Decimal
    has_hostel_bed: bool
    hostel_bed_code: Optional[str] = None
    has_study_desk: bool
    study_desk_code: Optional[str] = None


class CohortReviewResponse(BaseModel):
    batch_id: uuid.UUID
    batch_name: str
    batch_code: str
    division: str
    class_id: uuid.UUID
    class_name: str
    academic_year_id: uuid.UUID
    academic_year_name: str
    total_enrolled: int
    students: List[CohortReviewStudentItem]


class StudentCohortActionItem(BaseModel):
    student_id: uuid.UUID
    enrollment_id: uuid.UUID
    action: str = "PROMOTE"  # "PROMOTE", "GRADUATE", "WITHDRAW"
    custom_concession: Decimal = Decimal("0.00")
    override_batch_id: Optional[uuid.UUID] = None


class BulkCohortPromotionRequest(BaseModel):
    source_academic_year_id: uuid.UUID
    source_batch_id: uuid.UUID
    target_academic_year_id: uuid.UUID
    target_class_id: Optional[uuid.UUID] = None
    target_stream_id: Optional[uuid.UUID] = None
    target_course_id: Optional[uuid.UUID] = None
    target_course_version_id: Optional[uuid.UUID] = None
    target_fee_structure_id: Optional[uuid.UUID] = None
    target_tuition_fee: Optional[Decimal] = None
    number_of_installments: int = 1
    custom_installments: Optional[List[CustomInstallmentInput]] = None
    prior_dues_action: str = "CARRY_FORWARD"  # "CARRY_FORWARD" or "BLOCK_IF_DUE"
    notify_parents: bool = True
    students: List[StudentCohortActionItem]


class BulkCohortPromotionResponse(BaseModel):
    promoted_count: int
    graduated_count: int
    withdrawn_count: int
    total_invoiced_amount: Decimal
    new_invoices: List[dict]
    messages: List[str]
