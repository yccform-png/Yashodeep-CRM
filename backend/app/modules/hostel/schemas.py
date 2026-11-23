import uuid
from typing import Optional, List
from datetime import date, time
from decimal import Decimal
from pydantic import BaseModel


class HostelBedResponse(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    bed_number: str
    bed_label: Optional[str] = None
    tier: str = "LOWER"
    bunk_group: int = 1
    status: str
    occupant_name: Optional[str] = None
    occupant_code: Optional[str] = None
    allocation_id: Optional[uuid.UUID] = None
    allocation_start_date: Optional[date] = None
    allocation_end_date: Optional[date] = None
    deposit_amount: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    plan_name: Optional[str] = None
    billing_frequency: Optional[str] = None

    class Config:
        from_attributes = True


class HostelRoomResponse(BaseModel):
    id: uuid.UUID
    room_number: str
    room_type: str
    capacity: int
    has_attached_bathroom: bool
    is_ac: bool
    beds: List[HostelBedResponse] = []

    class Config:
        from_attributes = True


class HostelFloorResponse(BaseModel):
    id: uuid.UUID
    floor_number: int
    name: str
    rooms: List[HostelRoomResponse] = []

    class Config:
        from_attributes = True


class HostelBuildingResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    floors: List[HostelFloorResponse] = []

    class Config:
        from_attributes = True


class HostelResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    gender_type: str
    address: Optional[str] = None
    buildings: List[HostelBuildingResponse] = []

    class Config:
        from_attributes = True


class BedAllocationRequest(BaseModel):
    hostel_bed_id: uuid.UUID
    student_id: uuid.UUID
    start_date: date
    end_date: date
    service_plan_id: Optional[uuid.UUID] = None
    custom_rent_amount: Optional[Decimal] = None
    deposit_amount: Decimal = Decimal("5000.00")
    collect_payment: bool = False
    payment_mode: Optional[str] = "CASH"


class BedRenewalRequest(BaseModel):
    allocation_id: uuid.UUID
    extension_days: int = 30
    renewal_rent_amount: Optional[Decimal] = None
    collect_payment: bool = False
    payment_mode: Optional[str] = "CASH"


class BedCheckOutRequest(BaseModel):
    allocation_id: uuid.UUID
    refund_deposit: bool = True
    damage_deduction: Decimal = Decimal("0.00")
    remarks: Optional[str] = None


class BedTransferRequest(BaseModel):
    current_allocation_id: uuid.UUID
    new_hostel_bed_id: uuid.UUID
    remarks: Optional[str] = None


class HostelVisitorCreate(BaseModel):
    student_id: uuid.UUID
    visitor_name: str
    visitor_phone: str
    relation: str
    in_time: time
    purpose: Optional[str] = None


class HostelMaintenanceCreate(BaseModel):
    hostel_room_id: uuid.UUID
    issue_type: str  # PLUMBING, ELECTRICAL, FURNITURE, CLEANING
    description: str
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT


class HostelFloorCreate(BaseModel):
    floor_number: int
    name: str


class HostelRoomCreate(BaseModel):
    room_number: str
    room_type: str = "DOUBLE"  # SINGLE, DOUBLE, TRIPLE, DORMITORY
    capacity: int = 2
    has_attached_bathroom: bool = True
    is_ac: bool = False
    auto_create_beds: bool = True


class HostelRoomUpdate(BaseModel):
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    has_attached_bathroom: Optional[bool] = None
    is_ac: Optional[bool] = None


class HostelBedCreate(BaseModel):
    bed_number: Optional[str] = None
    bed_label: Optional[str] = None
    tier: Optional[str] = "LOWER"
    bunk_group: Optional[int] = 1
