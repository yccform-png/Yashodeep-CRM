import uuid
from typing import Optional, List
from datetime import date, time
from decimal import Decimal
from pydantic import BaseModel, model_validator


# Academic Year
class AcademicYearCreate(BaseModel):
    name: str
    code: str
    start_date: date
    end_date: date
    is_current: bool = False


class AcademicYearResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    start_date: date
    end_date: date
    is_current: bool
    is_active: bool

    class Config:
        from_attributes = True


# Class
class ClassCreate(BaseModel):
    name: str
    code: str
    level_id: Optional[uuid.UUID] = None
    order_index: int = 0


class ClassResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    level_id: Optional[uuid.UUID] = None
    order_index: int
    is_active: bool

    class Config:
        from_attributes = True


# Stream
class StreamCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class StreamResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# Subject
class SubjectCreate(BaseModel):
    name: str
    code: str
    default_theory_marks: int = 70
    default_practical_marks: int = 30
    default_individual_fee: Decimal = Decimal("0.00")


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    default_theory_marks: Optional[int] = None
    default_practical_marks: Optional[int] = None
    default_individual_fee: Optional[Decimal] = None
    is_active: Optional[bool] = None


class SubjectDeleteResponse(BaseModel):
    message: str
    subject_id: uuid.UUID
    status: str


class SubjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    default_theory_marks: int
    default_practical_marks: int
    default_individual_fee: Decimal
    is_active: bool

    class Config:
        from_attributes = True


# Subject Group (e.g. PCM, PCB, PCMB)
class SubjectGroupCreate(BaseModel):
    class_id: uuid.UUID
    stream_id: Optional[uuid.UUID] = None
    name: str
    code: str
    package_fee: Decimal
    one_time_package_fee: Optional[Decimal] = None
    installment_package_fee: Optional[Decimal] = None
    subject_ids: List[uuid.UUID] = []


class SubjectGroupUpdate(BaseModel):
    class_id: Optional[uuid.UUID] = None
    stream_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    code: Optional[str] = None
    package_fee: Optional[Decimal] = None
    one_time_package_fee: Optional[Decimal] = None
    installment_package_fee: Optional[Decimal] = None
    is_active: Optional[bool] = None
    subject_ids: Optional[List[uuid.UUID]] = None


class SubjectGroupDeleteResponse(BaseModel):
    message: str
    group_id: uuid.UUID
    status: str


class SubjectGroupResponse(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    stream_id: Optional[uuid.UUID] = None
    name: str
    code: str
    package_fee: Decimal
    one_time_package_fee: Optional[Decimal] = None
    installment_package_fee: Optional[Decimal] = None
    is_active: bool
    subject_ids: List[uuid.UUID] = []
    subjects: List[SubjectResponse] = []

    class Config:
        from_attributes = True


# Course & Course Version
class CourseVersionCreate(BaseModel):
    version_number: int
    effective_from: date
    effective_to: Optional[date] = None
    base_fee: Decimal
    one_time_fee: Optional[Decimal] = None
    installment_fee: Optional[Decimal] = None
    subject_ids: List[uuid.UUID]


class CourseTypeResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str

    class Config:
        from_attributes = True


class CourseCreate(BaseModel):
    course_type_id: Optional[uuid.UUID] = None
    class_id: Optional[uuid.UUID] = None
    stream_id: Optional[uuid.UUID] = None
    is_universal: bool = False
    name: str
    code: str
    description: Optional[str] = None
    duration_months: int = 12
    initial_base_fee: Decimal
    one_time_fee: Optional[Decimal] = None
    installment_fee: Optional[Decimal] = None
    subject_ids: List[uuid.UUID] = []


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    course_type_id: Optional[uuid.UUID] = None
    class_id: Optional[uuid.UUID] = None
    stream_id: Optional[uuid.UUID] = None
    is_universal: Optional[bool] = None
    description: Optional[str] = None
    duration_months: Optional[int] = None
    is_active: Optional[bool] = None
    base_fee: Optional[Decimal] = None
    one_time_fee: Optional[Decimal] = None
    installment_fee: Optional[Decimal] = None
    subject_ids: Optional[List[uuid.UUID]] = None


class CourseDeleteResponse(BaseModel):
    message: str
    course_id: uuid.UUID
    status: str


class CourseVersionResponse(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    version_number: int
    effective_from: date
    effective_to: Optional[date] = None
    base_fee: Decimal
    one_time_fee: Optional[Decimal] = None
    installment_fee: Optional[Decimal] = None
    is_active: bool
    subjects: List[SubjectResponse] = []

    class Config:
        from_attributes = True


class CourseResponse(BaseModel):
    id: uuid.UUID
    course_type_id: uuid.UUID
    class_id: Optional[uuid.UUID] = None
    stream_id: Optional[uuid.UUID] = None
    is_universal: bool = False
    name: str
    code: str
    description: Optional[str] = None
    duration_months: int
    is_active: bool
    current_version: Optional[CourseVersionResponse] = None

    class Config:
        from_attributes = True


# Batch & Timetable
class BatchSubjectAssignment(BaseModel):
    subject_id: uuid.UUID
    teacher_id: Optional[uuid.UUID] = None
    classroom_id: Optional[uuid.UUID] = None


class BatchSubjectItem(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    teacher_name: Optional[str] = None
    classroom_name: Optional[str] = None

    class Config:
        from_attributes = True


class BatchCreate(BaseModel):
    course_id: uuid.UUID
    academic_year_id: uuid.UUID
    name: str
    code: str
    division: str = "A"
    max_capacity: int = 60
    start_date: date
    end_date: date
    subject_assignments: Optional[List[BatchSubjectAssignment]] = []

    @model_validator(mode="after")
    def validate_batch_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("Batch end_date cannot be earlier than start_date")
        return self


class BatchUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    division: Optional[str] = None
    max_capacity: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    subject_assignments: Optional[List[BatchSubjectAssignment]] = None

    @model_validator(mode="after")
    def validate_batch_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("Batch end_date cannot be earlier than start_date")
        return self


class BatchDeleteResponse(BaseModel):
    message: str
    batch_id: uuid.UUID
    status: str


class BatchResponse(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    academic_year_id: uuid.UUID
    name: str
    code: str
    division: str = "A"
    max_capacity: int
    enrolled_count: Optional[int] = 0
    start_date: date
    end_date: date
    is_active: bool
    batch_subjects: Optional[List[BatchSubjectItem]] = []

    class Config:
        from_attributes = True


class BatchStudentRosterItem(BaseModel):
    student_id: uuid.UUID
    student_code: str
    prn: Optional[str] = None
    first_name: str
    last_name: str
    gender: str
    roll_number: Optional[int] = None
    status: str
    enrolled_at: date

    class Config:
        from_attributes = True


class RollNumberUpdateRequest(BaseModel):
    roll_number: int


class AddStudentToBatchRequest(BaseModel):
    student_id: uuid.UUID
    roll_number: Optional[int] = None


class AutoRollNumberResponse(BaseModel):
    message: str
    batch_id: uuid.UUID
    division: str
    standard_number: int
    base_prefix: int
    division_offset: int
    assigned_count: int
    roster: List[BatchStudentRosterItem]


class TimetableEntryCreate(BaseModel):
    batch_subject_id: uuid.UUID
    classroom_id: Optional[uuid.UUID] = None
    day_of_week: int
    start_time: time
    end_time: time


class TimetableEntryResponse(BaseModel):
    id: uuid.UUID
    batch_subject_id: uuid.UUID
    classroom_id: Optional[uuid.UUID] = None
    day_of_week: int
    start_time: time
    end_time: time

    class Config:
        from_attributes = True


class BatchSyncPreviewItem(BaseModel):
    student_id: uuid.UUID
    student_code: str
    prn: Optional[str] = None
    first_name: str
    last_name: str
    gender: str
    enrolled_batch_id: Optional[uuid.UUID] = None
    enrolled_batch_name: Optional[str] = None
    enrolled_division: Optional[str] = None
    current_batch_id: Optional[uuid.UUID] = None
    current_batch_name: Optional[str] = None
    current_division: Optional[str] = None
    current_roll_number: Optional[int] = None
    is_assigned_to_this_batch: bool = False
    is_assigned_to_other_batch: bool = False
    is_matched_for_this_batch: bool = False


class BatchSyncPreviewResponse(BaseModel):
    batch_id: uuid.UUID
    batch_name: str
    division: str
    course_id: uuid.UUID
    course_name: str
    total_course_enrollments: int
    matched_count: int
    unassigned_count: int
    other_division_count: int
    already_in_this_batch_count: int
    students: List[BatchSyncPreviewItem]


class BatchSyncRequest(BaseModel):
    mode: str = "AUTO"  # AUTO or MANUAL
    selected_student_ids: Optional[List[uuid.UUID]] = None


class BatchTransferRequest(BaseModel):
    target_batch_id: uuid.UUID


class BatchTransferResponse(BaseModel):
    message: str
    student_id: uuid.UUID
    source_batch_id: uuid.UUID
    target_batch_id: uuid.UUID
    new_roll_number: int
    target_division: str
