import uuid
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


class StudySeatResponse(BaseModel):
    id: uuid.UUID
    study_room_id: uuid.UUID
    seat_number: str
    row_identifier: Optional[str] = None
    column_identifier: Optional[str] = None
    gender_allowed: str
    has_power_outlet: bool
    has_locker: bool
    status: str  # AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE
    occupant_name: Optional[str] = None
    occupant_code: Optional[str] = None
    allocation_id: Optional[uuid.UUID] = None
    allocation_start_date: Optional[date] = None
    allocation_end_date: Optional[date] = None
    plan_name: Optional[str] = None
    billing_frequency: Optional[str] = None
    unit_price: Optional[Decimal] = None
    deposit_amount: Optional[Decimal] = None

    class Config:
        from_attributes = True


class SeatAllocationRequest(BaseModel):
    study_seat_id: uuid.UUID
    student_id: uuid.UUID
    start_date: date
    end_date: date
    service_plan_id: Optional[uuid.UUID] = None
    custom_rent_amount: Optional[Decimal] = None
    custom_deposit_amount: Optional[Decimal] = None
    collect_payment: bool = False
    payment_mode: Optional[str] = "CASH"


class SeatRenewalRequest(BaseModel):
    allocation_id: uuid.UUID
    extension_days: int = 30
    renewal_rent_amount: Optional[Decimal] = None
    collect_payment: bool = False
    payment_mode: Optional[str] = "CASH"


class SeatVacateRequest(BaseModel):
    allocation_id: uuid.UUID
    refund_deposit: bool = True
    damage_deduction: Decimal = Decimal("0.00")
    remarks: Optional[str] = None


class SeatTransferRequest(BaseModel):
    current_allocation_id: uuid.UUID
    new_study_seat_id: uuid.UUID


class StudyRoomAttendanceRecord(BaseModel):
    study_seat_id: uuid.UUID
    student_id: uuid.UUID
    is_check_out: bool = False
