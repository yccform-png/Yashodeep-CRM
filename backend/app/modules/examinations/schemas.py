import uuid
from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class ExamSubjectCreate(BaseModel):
    subject_id: uuid.UUID
    class_id: uuid.UUID
    stream_id: Optional[uuid.UUID] = None
    course_id: Optional[uuid.UUID] = None
    exam_date: date
    duration_minutes: int = 180
    max_marks: Decimal = Decimal("100.00")
    passing_marks: Decimal = Decimal("35.00")
    has_negative_marking: bool = False
    negative_mark_weight: Decimal = Decimal("0.25")
    theory_max_marks: Optional[Decimal] = None
    practical_max_marks: Decimal = Decimal("0.00")


class ExaminationCreate(BaseModel):
    academic_year_id: uuid.UUID
    exam_type_id: uuid.UUID
    name: str
    code: str
    start_date: date
    end_date: date
    subjects: List[ExamSubjectCreate]


class ExamMarksEntry(BaseModel):
    student_id: uuid.UUID
    marks_obtained: Optional[Decimal] = None
    theory_marks_obtained: Optional[Decimal] = None
    practical_marks_obtained: Decimal = Decimal("0.00")
    is_absent: bool = False
    is_withheld: bool = False


class BulkMarksSubmission(BaseModel):
    exam_subject_id: uuid.UUID
    marks: List[ExamMarksEntry]


class ExaminationResponse(BaseModel):
    id: uuid.UUID
    academic_year_id: uuid.UUID
    exam_type_id: uuid.UUID
    name: str
    code: str
    start_date: date
    end_date: date
    is_published: bool
    class_id: Optional[uuid.UUID] = None
    class_name: Optional[str] = None
    course_id: Optional[uuid.UUID] = None
    course_name: Optional[str] = None
    subject_name: Optional[str] = None
    max_marks: Optional[Decimal] = None
    passing_marks: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


class StudentResultResponse(BaseModel):
    examination_id: uuid.UUID
    student_id: uuid.UUID
    total_obtained: Decimal
    total_possible: Decimal
    percentage: Decimal
    grade: Optional[str] = None
    rank: Optional[int] = None
    is_pass: bool

    model_config = ConfigDict(from_attributes=True)
