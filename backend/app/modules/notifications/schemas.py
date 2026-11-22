import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class NotificationOutboxResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    recipient_target: str
    channel: str
    payload: Dict[str, Any]
    status: str
    retry_count: int
    last_attempted_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class NotificationOutboxListResponse(BaseModel):
    total: int
    items: List[NotificationOutboxResponse]


class ManualTestDispatchSchema(BaseModel):
    channel: str = Field(..., description="WHATSAPP or EMAIL")
    recipient: str = Field(..., description="Phone number (e.g. 919822012345) or email address")
    event_type: str = Field("TEST_DISPATCH", description="e.g. ATTENDANCE_ABSENT, PAYMENT_RECEIPT, TEST_DISPATCH")
    sample_name: Optional[str] = "Student Name"
    sample_text: Optional[str] = "This is a test notification from Yashodeep Coaching Classes."


class TestDispatchResult(BaseModel):
    status: str
    channel: str
    recipient: str
    message_id: Optional[str] = None
    is_mock: bool
    details: Optional[Dict[str, Any]] = None
