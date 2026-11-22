import uuid
from typing import Optional, List
from datetime import date, time
from pydantic import BaseModel


class SessionCreate(BaseModel):
    batch_subject_id: uuid.UUID
    session_date: date = date.today()
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic_covered: Optional[str] = None


class AttendanceRecordInput(BaseModel):
    student_id: uuid.UUID
    status: str = "PRESENT"  # PRESENT, ABSENT, LATE, EXCUSED_LEAVE
    remarks: Optional[str] = None


class BulkAttendanceSubmission(BaseModel):
    session_id: uuid.UUID
    records: List[AttendanceRecordInput]


class AttendanceCorrectionRequest(BaseModel):
    attendance_record_id: uuid.UUID
    new_status: str
    reason: str


class SessionResponse(BaseModel):
    id: uuid.UUID
    batch_subject_id: uuid.UUID
    session_date: date
    topic_covered: Optional[str] = None
    is_cancelled: bool

    class Config:
        from_attributes = True
