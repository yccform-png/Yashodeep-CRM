import uuid
from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from app.modules.fees.pricing_engine import FeeItemCalculation, InstallmentBreakdown, FeePreviewResult


class CustomInstallmentInput(BaseModel):
    installment_number: int
    due_date: date
    amount: Optional[Decimal] = None


class FeePreviewRequest(BaseModel):
    course_version_id: Optional[uuid.UUID] = None
    subject_group_id: Optional[uuid.UUID] = None
    selected_subject_ids: Optional[List[uuid.UUID]] = []
    hostel_plan_id: Optional[uuid.UUID] = None
    study_room_plan_id: Optional[uuid.UUID] = None
    discount_amount: Decimal = Decimal("0.00")
    number_of_installments: int = 1
    custom_installments: Optional[List[CustomInstallmentInput]] = None
    admission_date: Optional[date] = None
    include_admission_fee: bool = False


class InstallmentRescheduleRequest(BaseModel):
    new_due_date: date
    reason: Optional[str] = "Parent requested extension"


class InstallmentRestructureItem(BaseModel):
    installment_number: int
    due_date: date
    amount: Decimal


class PlanRestructureRequest(BaseModel):
    number_of_installments: int
    installments: List[InstallmentRestructureItem]
    reason: str


class InvoiceItemResponse(BaseModel):
    id: uuid.UUID
    description: str
    service_type_code: str
    unit_price: Decimal
    quantity: int
    discount_amount: Decimal
    total_amount: Decimal

    class Config:
        from_attributes = True


class InstallmentResponse(BaseModel):
    id: uuid.UUID
    installment_number: int
    due_date: date
    amount: Decimal
    paid_amount: Decimal
    status: str

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_prn: Optional[str] = None
    student_code: Optional[str] = None
    student_mobile: Optional[str] = None
    invoice_number: str
    issue_date: date
    due_date: date
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    status: str
    class_id: Optional[uuid.UUID] = None
    class_name: Optional[str] = None
    batch_id: Optional[uuid.UUID] = None
    batch_name: Optional[str] = None
    course_name: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    installments: List[InstallmentResponse] = []

    class Config:
        from_attributes = True


class PaymentAllocationRequest(BaseModel):
    invoice_id: uuid.UUID
    installment_id: Optional[uuid.UUID] = None
    allocated_amount: Decimal


class PaymentCreate(BaseModel):
    student_id: uuid.UUID
    amount: Decimal
    payment_method: str = "CASH"  # CASH, UPI, CARD, NET_BANKING, CHEQUE, RAZORPAY
    transaction_reference: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    notes: Optional[str] = None
    allocations: List[PaymentAllocationRequest]


class PaymentAllocationResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    installment_id: Optional[uuid.UUID] = None
    allocated_amount: Decimal

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    payment_number: str
    payment_date: date
    amount: Decimal
    payment_method: str
    transaction_reference: Optional[str] = None
    status: str
    receipt_number: Optional[str] = None
    allocations: List[PaymentAllocationResponse] = []

    class Config:
        from_attributes = True


class RefundCreate(BaseModel):
    payment_id: uuid.UUID
    invoice_id: uuid.UUID
    amount: Decimal
    reason: str


class RefundResponse(BaseModel):
    id: uuid.UUID
    payment_id: uuid.UUID
    invoice_id: uuid.UUID
    refund_number: str
    amount: Decimal
    reason: str
    status: str
    refund_date: date

    class Config:
        from_attributes = True


class InvoicePaymentHistoryItem(BaseModel):
    payment_id: uuid.UUID
    payment_number: str
    receipt_number: Optional[str] = None
    payment_date: date
    payment_method: str
    transaction_reference: Optional[str] = None
    allocated_amount: Decimal


class DetailedInvoiceStudentInfo(BaseModel):
    id: uuid.UUID
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    prn: Optional[str] = None
    student_code: str
    date_of_birth: Optional[date] = None
    gender: str
    blood_group: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
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
    category: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_relation: Optional[str] = None
    guardian_mobile: Optional[str] = None


class DetailedInvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    issue_date: date
    due_date: date
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    status: str
    student: DetailedInvoiceStudentInfo
    class_name: Optional[str] = None
    course_name: Optional[str] = None
    study_seat_number: Optional[str] = None
    hostel_bed_number: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    installments: List[InstallmentResponse] = []
    payments: List[InvoicePaymentHistoryItem] = []


class ReceiptAllocationItem(BaseModel):
    invoice_id: uuid.UUID
    invoice_number: str
    installment_id: Optional[uuid.UUID] = None
    installment_number: Optional[int] = None
    allocated_amount: Decimal
    invoice_total: Decimal
    invoice_balance: Decimal


class DetailedReceiptResponse(BaseModel):
    payment_id: uuid.UUID
    payment_number: str
    receipt_number: str
    payment_date: date
    amount: Decimal
    amount_in_words: str
    payment_method: str
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    student: DetailedInvoiceStudentInfo
    class_name: Optional[str] = None
    course_name: Optional[str] = None
    allocations: List[ReceiptAllocationItem] = []
    total_student_balance: Decimal

