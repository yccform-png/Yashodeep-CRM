import uuid
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, EmailStr, field_validator


class StaffMemberBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    role_designation: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    base_monthly_salary: Decimal = Field(default=Decimal("0.00"), ge=0)
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    is_active: bool = True
    joining_date: Optional[date] = None
    user_id: Optional[uuid.UUID] = None

    @field_validator("email", "phone", "bank_name", "bank_account_no", "bank_ifsc", "upi_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class StaffMemberCreate(StaffMemberBase):
    pass


class StaffMemberUpdate(BaseModel):
    name: Optional[str] = None
    role_designation: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    base_monthly_salary: Optional[Decimal] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    is_active: Optional[bool] = None
    joining_date: Optional[date] = None
    user_id: Optional[uuid.UUID] = None


class StaffMemberResponse(StaffMemberBase):
    id: uuid.UUID
    institute_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    expense_category: str = Field(default="SALARY")  # SALARY, RENT, UTILITIES, STATIONERY_PRINTING, MAINTENANCE, EQUIPMENT, MARKETING, MISCELLANEOUS
    title: str = Field(..., min_length=3, max_length=200)
    amount: Decimal = Field(..., gt=0)
    payment_date: date
    payment_mode: str = Field(default="BANK_TRANSFER")  # BANK_TRANSFER, UPI, CASH, CHEQUE
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    academic_year_id: Optional[uuid.UUID] = None
    staff_id: Optional[uuid.UUID] = None
    pay_period_month: Optional[int] = Field(None, ge=1, le=12)
    pay_period_year: Optional[int] = Field(None, ge=2000, le=2100)
    status: str = Field(default="PAID")


class SalaryDisbursementRequest(BaseModel):
    staff_id: uuid.UUID
    pay_period_month: int = Field(..., ge=1, le=12)
    pay_period_year: int = Field(..., ge=2000, le=2100)
    amount: Decimal = Field(..., gt=0)
    payment_date: date
    payment_mode: str = Field(default="BANK_TRANSFER")  # BANK_TRANSFER, UPI, CASH, CHEQUE
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    academic_year_id: Optional[uuid.UUID] = None


class ExpenseResponse(BaseModel):
    id: uuid.UUID
    institute_id: uuid.UUID
    academic_year_id: Optional[uuid.UUID] = None
    staff_id: Optional[uuid.UUID] = None
    staff_name: Optional[str] = None
    staff_role: Optional[str] = None
    expense_category: str
    title: str
    pay_period_month: Optional[int] = None
    pay_period_year: Optional[int] = None
    amount: Decimal
    payment_date: date
    payment_mode: str
    reference_number: Optional[str] = None
    voucher_number: str
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MonthlyStaffPayrollItem(BaseModel):
    staff_id: uuid.UUID
    staff_name: str
    role_designation: str
    phone: Optional[str] = None
    base_monthly_salary: Decimal
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    is_active: bool
    # Disbursement state for queried month
    is_paid: bool
    paid_amount: Optional[Decimal] = None
    payment_date: Optional[date] = None
    payment_mode: Optional[str] = None
    voucher_number: Optional[str] = None
    reference_number: Optional[str] = None
    expense_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class MonthlyPayrollSummaryResponse(BaseModel):
    pay_period_month: int
    pay_period_year: int
    total_staff_count: int
    paid_staff_count: int
    unpaid_staff_count: int
    total_payroll_budget: Decimal
    total_payroll_disbursed: Decimal
    payroll_pending_balance: Decimal
    staff_roster: List[MonthlyStaffPayrollItem]


class ExpenseAnalyticsSummary(BaseModel):
    total_salaries_paid: float
    total_other_expenses: float
    total_expenses: float
    gross_student_revenue: float
    net_operating_balance: float
    category_breakdown: List[Dict[str, Any]]
    monthly_trend: List[Dict[str, Any]]
