import uuid
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role, require_permission
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException
from app.core.cache import cache_service, CacheKeys, CacheInvalidator
import re
from app.models.user import User
from app.models.student import Student
from app.models.academic import (
    AcademicYear, Class, Stream, Subject, SubjectGroup, SubjectGroupItem,
    CourseType, Course, CourseVersion, CourseVersionSubject, Batch, BatchSubject, BatchStudent, TimetableEntry, Classroom, Teacher,
    ClassSubject
)
from app.models.enrollment import Enrollment, EnrollmentSubject
from app.models.examination import ExamSubject
from app.modules.academics.schemas import (
    AcademicYearCreate, AcademicYearResponse,
    ClassCreate, ClassResponse,
    StreamCreate, StreamResponse,
    SubjectCreate, SubjectUpdate, SubjectDeleteResponse, SubjectResponse,
    SubjectGroupCreate, SubjectGroupUpdate, SubjectGroupDeleteResponse, SubjectGroupResponse,
    CourseTypeResponse, CourseCreate, CourseUpdate, CourseDeleteResponse, CourseResponse, CourseVersionCreate, CourseVersionResponse,
    BatchCreate, BatchUpdate, BatchDeleteResponse, BatchResponse, BatchSubjectItem, TimetableEntryCreate, TimetableEntryResponse,
    BatchStudentRosterItem, RollNumberUpdateRequest, AddStudentToBatchRequest, AutoRollNumberResponse,
    BatchSyncPreviewItem, BatchSyncPreviewResponse, BatchSyncRequest, BatchTransferRequest, BatchTransferResponse
)

router = APIRouter(prefix="/academics", tags=["Academics"])


# --- Academic Years ---
@router.get("/years", response_model=List[AcademicYearResponse])
async def list_academic_years(db: AsyncSession = Depends(get_db)):
    cached = await cache_service.get(CacheKeys.academic_years())
    if cached is not None:
        return cached

    result = await db.execute(select(AcademicYear).order_by(AcademicYear.start_date.desc()))
    items = result.scalars().all()
    serialized = [AcademicYearResponse.model_validate(y).model_dump() for y in items]
    await cache_service.set(CacheKeys.academic_years(), serialized, ttl=3600)
    return items


@router.post("/years", response_model=AcademicYearResponse, status_code=status.HTTP_201_CREATED)
async def create_academic_year(
    data: AcademicYearCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(AcademicYear).where(AcademicYear.code == data.code))
    if existing.scalar_one_or_none():
        raise ConflictException(f"Academic Year with code {data.code} already exists")

    if data.is_current:
        # Unmark existing current
        all_years = await db.execute(select(AcademicYear).where(AcademicYear.is_current.is_(True)))
        for y in all_years.scalars().all():
            y.is_current = False

    ay = AcademicYear(
        institute_id=current_user.institute_id,
        name=data.name,
        code=data.code,
        start_date=data.start_date,
        end_date=data.end_date,
        is_current=data.is_current,
        is_active=True
    )
    db.add(ay)
    await db.commit()
    await db.refresh(ay)
    await cache_service.delete(CacheKeys.academic_years())
    return ay


@router.post("/years/{year_id}/set-current", response_model=AcademicYearResponse)
async def set_current_academic_year(
    year_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    target = await db.get(AcademicYear, year_id)
    if not target:
        raise NotFoundException("Academic Year not found")

    # Unmark all other years
    all_years = await db.execute(select(AcademicYear))
    for y in all_years.scalars().all():
        y.is_current = (y.id == target.id)

    await db.commit()
    await db.refresh(target)
    await cache_service.delete(CacheKeys.academic_years())
    return target


# --- Classes ---
@router.get("/classes", response_model=List[ClassResponse])
async def list_classes(db: AsyncSession = Depends(get_db)):
    cached = await cache_service.get(CacheKeys.academic_classes())
    if cached is not None:
        return cached

    result = await db.execute(select(Class).order_by(Class.order_index.asc()))
    items = result.scalars().all()
    serialized = [ClassResponse.model_validate(c).model_dump() for c in items]
    await cache_service.set(CacheKeys.academic_classes(), serialized, ttl=3600)
    return items


@router.post("/classes", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
async def create_class(
    data: ClassCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    c = Class(
        institute_id=current_user.institute_id,
        name=data.name,
        code=data.code,
        level_id=data.level_id,
        order_index=data.order_index,
        is_active=True
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    await cache_service.delete(CacheKeys.academic_classes())
    return c


# --- Streams ---
@router.get("/streams", response_model=List[StreamResponse])
async def list_streams(db: AsyncSession = Depends(get_db)):
    cached = await cache_service.get(CacheKeys.academic_streams())
    if cached is not None:
        return cached

    result = await db.execute(select(Stream).order_by(Stream.name.asc()))
    items = result.scalars().all()
    serialized = [StreamResponse.model_validate(s).model_dump() for s in items]
    await cache_service.set(CacheKeys.academic_streams(), serialized, ttl=3600)
    return items


@router.post("/streams", response_model=StreamResponse, status_code=status.HTTP_201_CREATED)
async def create_stream(
    data: StreamCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    s = Stream(
        institute_id=current_user.institute_id,
        name=data.name,
        code=data.code,
        description=data.description,
        is_active=True
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    await cache_service.delete(CacheKeys.academic_streams())
    return s


# --- Subjects ---
@router.get("/subjects", response_model=List[SubjectResponse])
async def list_subjects(db: AsyncSession = Depends(get_db)):
    cached = await cache_service.get(CacheKeys.academic_subjects())
    if cached is not None:
        return cached

    result = await db.execute(select(Subject).order_by(Subject.name.asc()))
    items = result.scalars().all()
    serialized = [SubjectResponse.model_validate(s).model_dump() for s in items]
    await cache_service.set(CacheKeys.academic_subjects(), serialized, ttl=1800)
    return items


@router.post("/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(
    data: SubjectCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    subj = Subject(
        institute_id=current_user.institute_id,
        name=data.name,
        code=data.code,
        default_theory_marks=data.default_theory_marks,
        default_practical_marks=data.default_practical_marks,
        default_individual_fee=data.default_individual_fee,
        is_active=True
    )
    db.add(subj)
    await db.commit()
    await db.refresh(subj)
    await cache_service.delete(CacheKeys.academic_subjects())
    return subj


@router.put("/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: uuid.UUID,
    data: SubjectUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Subject).where(Subject.id == subject_id)
    subj = (await db.execute(stmt)).scalar_one_or_none()
    if not subj:
        raise NotFoundException(f"Subject {subject_id} not found")

    if data.code is not None and data.code != subj.code:
        code_check = await db.execute(select(Subject).where(Subject.code == data.code, Subject.id != subject_id))
        if code_check.scalar_one_or_none():
            raise ConflictException(f"Subject with code '{data.code}' already exists")
        subj.code = data.code

    if data.name is not None:
        subj.name = data.name
    if data.default_theory_marks is not None:
        subj.default_theory_marks = data.default_theory_marks
    if data.default_practical_marks is not None:
        subj.default_practical_marks = data.default_practical_marks
    if data.default_individual_fee is not None:
        subj.default_individual_fee = data.default_individual_fee
    if data.is_active is not None:
        subj.is_active = data.is_active

    await db.commit()
    await db.refresh(subj)
    await cache_service.delete(CacheKeys.academic_subjects())
    return subj


@router.delete("/subjects/{subject_id}", response_model=SubjectDeleteResponse)
async def delete_subject(
    subject_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Subject).where(Subject.id == subject_id)
    subj = (await db.execute(stmt)).scalar_one_or_none()
    if not subj:
        raise NotFoundException(f"Subject {subject_id} not found")

    # Safety checks: Active student enrollments & Exam records
    enr_check = await db.execute(select(EnrollmentSubject).where(EnrollmentSubject.subject_id == subject_id))
    if enr_check.scalars().first():
        raise BadRequestException(f"Cannot delete subject '{subj.name}' because students are actively enrolled in it.")

    exam_check = await db.execute(select(ExamSubject).where(ExamSubject.subject_id == subject_id))
    if exam_check.scalars().first():
        raise BadRequestException(f"Cannot delete subject '{subj.name}' because examination records exist for it.")

    # Clean up associated configuration mappings if no active student/exam dependencies
    await db.execute(delete(BatchSubject).where(BatchSubject.subject_id == subject_id))
    await db.execute(delete(CourseVersionSubject).where(CourseVersionSubject.subject_id == subject_id))
    await db.execute(delete(SubjectGroupItem).where(SubjectGroupItem.subject_id == subject_id))
    await db.execute(delete(ClassSubject).where(ClassSubject.subject_id == subject_id))

    await db.delete(subj)
    await db.commit()
    await cache_service.delete(CacheKeys.academic_subjects())

    return SubjectDeleteResponse(
        message=f"Subject '{subj.name}' ({subj.code}) deleted successfully.",
        subject_id=subj.id,
        status="DELETED"
    )


# --- Subject Groups (e.g. PCM, PCB, PCMB) ---
def _serialize_subject_group(grp: SubjectGroup) -> SubjectGroupResponse:
    subjs = []
    sub_ids = []
    for item in grp.items:
        sub_ids.append(item.subject_id)
        if item.subject:
            subjs.append(
                SubjectResponse(
                    id=item.subject.id,
                    name=item.subject.name,
                    code=item.subject.code,
                    default_theory_marks=item.subject.default_theory_marks,
                    default_practical_marks=item.subject.default_practical_marks,
                    default_individual_fee=item.subject.default_individual_fee,
                    is_active=item.subject.is_active
                )
            )
    return SubjectGroupResponse(
        id=grp.id,
        class_id=grp.class_id,
        stream_id=grp.stream_id,
        name=grp.name,
        code=grp.code,
        package_fee=grp.package_fee,
        one_time_package_fee=grp.one_time_package_fee,
        installment_package_fee=grp.installment_package_fee,
        is_active=grp.is_active,
        subject_ids=sub_ids,
        subjects=subjs
    )


@router.get("/subject-groups", response_model=List[SubjectGroupResponse])
async def list_subject_groups(
    class_id: Optional[uuid.UUID] = None,
    stream_id: Optional[uuid.UUID] = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(SubjectGroup)
        .options(
            selectinload(SubjectGroup.items).selectinload(SubjectGroupItem.subject)
        )
    )
    if not include_inactive:
        stmt = stmt.where(SubjectGroup.is_active.is_(True))
    if class_id:
        stmt = stmt.where(SubjectGroup.class_id == class_id)
    if stream_id:
        stmt = stmt.where(or_(SubjectGroup.stream_id == stream_id, SubjectGroup.stream_id.is_(None)))
    result = await db.execute(stmt)
    groups = result.scalars().all()
    return [_serialize_subject_group(g) for g in groups]


@router.get("/subject-groups/{group_id}", response_model=SubjectGroupResponse)
async def get_subject_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(SubjectGroup)
        .options(
            selectinload(SubjectGroup.items).selectinload(SubjectGroupItem.subject)
        )
        .where(SubjectGroup.id == group_id)
    )
    grp = (await db.execute(stmt)).scalar_one_or_none()
    if not grp:
        raise NotFoundException(f"Subject group {group_id} not found")
    return _serialize_subject_group(grp)


@router.post("/subject-groups", response_model=SubjectGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_subject_group(
    data: SubjectGroupCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    grp = SubjectGroup(
        institute_id=current_user.institute_id,
        class_id=data.class_id,
        stream_id=data.stream_id,
        name=data.name,
        code=data.code,
        package_fee=data.package_fee,
        one_time_package_fee=data.one_time_package_fee,
        installment_package_fee=data.installment_package_fee,
        is_active=True
    )
    db.add(grp)
    await db.flush()

    for sid in data.subject_ids:
        item = SubjectGroupItem(subject_group_id=grp.id, subject_id=sid)
        db.add(item)
    await db.commit()
    await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())

    refetch = (
        select(SubjectGroup)
        .options(selectinload(SubjectGroup.items).selectinload(SubjectGroupItem.subject))
        .where(SubjectGroup.id == grp.id)
    )
    grp_loaded = (await db.execute(refetch)).scalar_one()
    return _serialize_subject_group(grp_loaded)


@router.put("/subject-groups/{group_id}", response_model=SubjectGroupResponse)
async def update_subject_group(
    group_id: uuid.UUID,
    data: SubjectGroupUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(SubjectGroup)
        .options(
            selectinload(SubjectGroup.items).selectinload(SubjectGroupItem.subject)
        )
        .where(SubjectGroup.id == group_id)
    )
    grp = (await db.execute(stmt)).scalar_one_or_none()
    if not grp:
        raise NotFoundException(f"Subject group {group_id} not found")

    if data.name is not None:
        grp.name = data.name
    if data.code is not None:
        grp.code = data.code
    if data.class_id is not None:
        grp.class_id = data.class_id
    if data.stream_id is not None:
        grp.stream_id = data.stream_id
    if data.package_fee is not None:
        grp.package_fee = data.package_fee
    if data.one_time_package_fee is not None:
        grp.one_time_package_fee = data.one_time_package_fee
    if data.installment_package_fee is not None:
        grp.installment_package_fee = data.installment_package_fee
    if data.is_active is not None:
        grp.is_active = data.is_active

    if data.subject_ids is not None:
        current_map = {item.subject_id: item for item in grp.items}
        target_sids = set(data.subject_ids)
        # Remove unselected items
        for sid, item in list(current_map.items()):
            if sid not in target_sids:
                grp.items.remove(item)
        # Add newly selected items
        for sid in target_sids:
            if sid not in current_map:
                grp.items.append(SubjectGroupItem(subject_group_id=grp.id, subject_id=sid))

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())

    refetch = (
        select(SubjectGroup)
        .options(selectinload(SubjectGroup.items).selectinload(SubjectGroupItem.subject))
        .where(SubjectGroup.id == group_id)
        .execution_options(populate_existing=True)
    )
    grp_loaded = (await db.execute(refetch)).scalar_one()
    return _serialize_subject_group(grp_loaded)


@router.delete("/subject-groups/{group_id}", response_model=SubjectGroupDeleteResponse)
async def delete_subject_group(
    group_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(SubjectGroup)
        .options(selectinload(SubjectGroup.items))
        .where(SubjectGroup.id == group_id)
    )
    grp = (await db.execute(stmt)).scalar_one_or_none()
    if not grp:
        raise NotFoundException(f"Subject group {group_id} not found")

    await db.delete(grp)
    await db.commit()
    return SubjectGroupDeleteResponse(
        message=f"Subject bundle '{grp.name}' ({grp.code}) deleted successfully.",
        group_id=grp.id,
        status="DELETED"
    )


# --- Course Types ---
@router.get("/course-types", response_model=List[CourseTypeResponse])
async def list_course_types(db: AsyncSession = Depends(get_db)):
    stmt = select(CourseType).order_by(CourseType.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


# --- Courses & Versions ---
def _serialize_course(crs: Course) -> CourseResponse:
    active_ver = next((v for v in sorted(crs.versions, key=lambda x: x.version_number, reverse=True) if v.is_active), None)
    cver_resp = None
    if active_ver:
        subjs = [
            SubjectResponse(
                id=vs.subject.id,
                name=vs.subject.name,
                code=vs.subject.code,
                default_theory_marks=vs.subject.default_theory_marks,
                default_practical_marks=vs.subject.default_practical_marks,
                default_individual_fee=vs.subject.default_individual_fee,
                is_active=vs.subject.is_active
            ) for vs in active_ver.version_subjects if vs.subject
        ]
        cver_resp = CourseVersionResponse(
            id=active_ver.id,
            course_id=active_ver.course_id,
            version_number=active_ver.version_number,
            effective_from=active_ver.effective_from,
            effective_to=active_ver.effective_to,
            base_fee=active_ver.base_fee,
            one_time_fee=active_ver.one_time_fee,
            installment_fee=active_ver.installment_fee,
            is_active=active_ver.is_active,
            subjects=subjs
        )

    return CourseResponse(
        id=crs.id,
        course_type_id=crs.course_type_id,
        class_id=crs.class_id,
        stream_id=crs.stream_id,
        is_universal=crs.is_universal,
        name=crs.name,
        code=crs.code,
        description=crs.description,
        duration_months=crs.duration_months,
        is_active=crs.is_active,
        current_version=cver_resp
    )


@router.get("/courses", response_model=List[CourseResponse])
async def list_courses(
    class_id: Optional[uuid.UUID] = None,
    stream_id: Optional[uuid.UUID] = None,
    include_inactive: bool = False,
    include_universal: bool = True,
    is_universal: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    cache_key = f"{CacheKeys.PREFIX}:academics:courses:c_{class_id}:s_{stream_id}:u_{is_universal}:iu_{include_universal}:ia_{include_inactive}"
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached

    stmt = (
        select(Course)
        .options(
            selectinload(Course.versions)
            .selectinload(CourseVersion.version_subjects)
            .selectinload(CourseVersionSubject.subject)
        )
    )
    if not include_inactive:
        stmt = stmt.where(Course.is_active.is_(True))
    if is_universal is not None:
        stmt = stmt.where(Course.is_universal == is_universal)
    elif class_id:
        if include_universal:
            stmt = stmt.where(or_(Course.class_id == class_id, Course.is_universal.is_(True)))
        else:
            stmt = stmt.where(Course.class_id == class_id)
    if stream_id and not is_universal:
        stmt = stmt.where(or_(Course.stream_id == stream_id, Course.stream_id.is_(None)))
    
    result = await db.execute(stmt)
    courses = result.scalars().all()
    serialized = [_serialize_course(c) for c in courses]
    serialized_dicts = [CourseResponse.model_validate(c).model_dump() for c in serialized]
    await cache_service.set(cache_key, serialized_dicts, ttl=900)
    return serialized


@router.get("/courses/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Course)
        .options(
            selectinload(Course.versions)
            .selectinload(CourseVersion.version_subjects)
            .selectinload(CourseVersionSubject.subject)
        )
        .where(Course.id == course_id)
    )
    crs = (await db.execute(stmt)).scalar_one_or_none()
    if not crs:
        raise NotFoundException(f"Course {course_id} not found")
    return _serialize_course(crs)


@router.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    data: CourseCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    course_type_id = data.course_type_id
    if not course_type_id:
        first_ct = (await db.execute(select(CourseType).order_by(CourseType.name.asc()))).scalars().first()
        if first_ct:
            course_type_id = first_ct.id
        else:
            raise BadRequestException("No CourseType configured in the system")

    if not data.is_universal and not data.class_id:
        raise BadRequestException("Class/Grade is required for non-universal courses.")

    crs = Course(
        institute_id=current_user.institute_id,
        course_type_id=course_type_id,
        class_id=None if data.is_universal else data.class_id,
        stream_id=None if data.is_universal else data.stream_id,
        is_universal=data.is_universal,
        name=data.name,
        code=data.code,
        description=data.description,
        duration_months=data.duration_months,
        is_active=True
    )
    db.add(crs)
    await db.flush()

    # Initial Version 1
    cver = CourseVersion(
        course_id=crs.id,
        version_number=1,
        effective_from=date.today(),
        base_fee=data.initial_base_fee,
        one_time_fee=data.one_time_fee,
        installment_fee=data.installment_fee,
        is_active=True
    )
    db.add(cver)
    await db.flush()

    for sid in data.subject_ids:
        cvs = CourseVersionSubject(course_version_id=cver.id, subject_id=sid, is_optional=False)
        db.add(cvs)

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.academic_courses_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())

    # Reload with full version subjects for complete response
    stmt = (
        select(Course)
        .options(
            selectinload(Course.versions)
            .selectinload(CourseVersion.version_subjects)
            .selectinload(CourseVersionSubject.subject)
        )
        .where(Course.id == crs.id)
    )
    crs_loaded = (await db.execute(stmt)).scalar_one()
    return _serialize_course(crs_loaded)


@router.put("/courses/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: uuid.UUID,
    data: CourseUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Course)
        .options(
            selectinload(Course.versions)
            .selectinload(CourseVersion.version_subjects)
            .selectinload(CourseVersionSubject.subject)
        )
        .where(Course.id == course_id)
    )
    crs = (await db.execute(stmt)).scalar_one_or_none()
    if not crs:
        raise NotFoundException(f"Course {course_id} not found")

    # Update basic metadata if provided
    if data.name is not None:
        crs.name = data.name
    if data.code is not None:
        crs.code = data.code
    if data.course_type_id is not None:
        crs.course_type_id = data.course_type_id
    if data.is_universal is not None:
        crs.is_universal = data.is_universal
        if data.is_universal:
            crs.class_id = None
            crs.stream_id = None
    if data.class_id is not None:
        crs.class_id = data.class_id
    if data.stream_id is not None:
        crs.stream_id = data.stream_id
    if data.description is not None:
        crs.description = data.description
    if data.duration_months is not None:
        crs.duration_months = data.duration_months
    if data.is_active is not None:
        crs.is_active = data.is_active

    # Check fee or subject changes
    fee_or_subj_changed = (
        (data.base_fee is not None)
        or (data.one_time_fee is not None)
        or (data.installment_fee is not None)
        or (data.subject_ids is not None)
    )
    if fee_or_subj_changed:
        active_ver = next((v for v in sorted(crs.versions, key=lambda x: x.version_number, reverse=True) if v.is_active), None)
        
        # Check if active_ver is referenced in any student enrollment
        has_enrollments = False
        if active_ver:
            enr_check = await db.execute(select(Enrollment.id).where(Enrollment.course_version_id == active_ver.id).limit(1))
            has_enrollments = enr_check.first() is not None

        target_base_fee = data.base_fee if data.base_fee is not None else (active_ver.base_fee if active_ver else Decimal("0.00"))
        target_one_time_fee = data.one_time_fee if data.one_time_fee is not None else (active_ver.one_time_fee if active_ver else None)
        target_installment_fee = data.installment_fee if data.installment_fee is not None else (active_ver.installment_fee if active_ver else None)
        target_subject_ids = data.subject_ids if data.subject_ids is not None else ([vs.subject_id for vs in active_ver.version_subjects] if active_ver else [])

        if active_ver and has_enrollments:
            # Preserve historical version: bump version to keep existing students unaffected
            active_ver.is_active = False
            active_ver.effective_to = date.today()

            new_ver = CourseVersion(
                course_id=crs.id,
                version_number=active_ver.version_number + 1,
                effective_from=date.today(),
                base_fee=target_base_fee,
                one_time_fee=target_one_time_fee,
                installment_fee=target_installment_fee,
                is_active=True
            )
            db.add(new_ver)
            await db.flush()

            for sid in target_subject_ids:
                cvs = CourseVersionSubject(course_version_id=new_ver.id, subject_id=sid, is_optional=False)
                db.add(cvs)
        elif active_ver:
            # No enrollments yet: safe to update current version in-place
            if data.base_fee is not None:
                active_ver.base_fee = data.base_fee
            if data.one_time_fee is not None:
                active_ver.one_time_fee = data.one_time_fee
            if data.installment_fee is not None:
                active_ver.installment_fee = data.installment_fee
            if data.subject_ids is not None:
                current_subjs_map = {vs.subject_id: vs for vs in active_ver.version_subjects}
                target_sids = set(data.subject_ids)
                # Remove subjects that are no longer selected
                for sid, vs in list(current_subjs_map.items()):
                    if sid not in target_sids:
                        active_ver.version_subjects.remove(vs)
                # Add newly selected subjects
                for sid in target_sids:
                    if sid not in current_subjs_map:
                        active_ver.version_subjects.append(
                            CourseVersionSubject(course_version_id=active_ver.id, subject_id=sid, is_optional=False)
                        )
        else:
            # No active version exists, create version 1
            new_ver = CourseVersion(
                course_id=crs.id,
                version_number=1,
                effective_from=date.today(),
                base_fee=target_base_fee,
                one_time_fee=target_one_time_fee,
                installment_fee=target_installment_fee,
                is_active=True
            )
            db.add(new_ver)
            await db.flush()
            for sid in target_subject_ids:
                cvs = CourseVersionSubject(course_version_id=new_ver.id, subject_id=sid, is_optional=False)
                db.add(cvs)

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.academic_courses_pattern())
    await cache_service.delete(CacheKeys.dashboard_metrics())

    # Re-fetch course with full version subjects
    refetch_stmt = (
        select(Course)
        .options(
            selectinload(Course.versions)
            .selectinload(CourseVersion.version_subjects)
            .selectinload(CourseVersionSubject.subject)
        )
        .where(Course.id == course_id)
        .execution_options(populate_existing=True)
    )
    crs_reloaded = (await db.execute(refetch_stmt)).scalar_one()
    return _serialize_course(crs_reloaded)


@router.delete("/courses/{course_id}", response_model=CourseDeleteResponse)
async def delete_course(
    course_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Course)
        .options(
            selectinload(Course.versions)
            .selectinload(CourseVersion.version_subjects)
        )
        .where(Course.id == course_id)
    )
    crs = (await db.execute(stmt)).scalar_one_or_none()
    if not crs:
        # If the course is already not in the database, clear any stale course cache
        # and return an idempotent DELETED response so the frontend cleanly refreshes
        await cache_service.delete_pattern(CacheKeys.academic_courses_pattern())
        await cache_service.delete(CacheKeys.dashboard_metrics())
        return CourseDeleteResponse(
            message="Course has already been removed or does not exist.",
            course_id=course_id,
            status="DELETED"
        )

    # Check dependencies: student enrollments and teaching batches
    enr_check = await db.execute(select(Enrollment.id).where(Enrollment.course_id == course_id).limit(1))
    has_enrollments = enr_check.first() is not None

    batch_check = await db.execute(select(Batch.id).where(Batch.course_id == course_id).limit(1))
    has_batches = batch_check.first() is not None

    if has_enrollments or has_batches:
        # Soft delete / archive to maintain referential and historical integrity
        crs.is_active = False
        for v in crs.versions:
            v.is_active = False
        await db.commit()
        await cache_service.delete_pattern(CacheKeys.academic_courses_pattern())
        await cache_service.delete(CacheKeys.dashboard_metrics())
        return CourseDeleteResponse(
            message=f"Course '{crs.name}' has existing student enrollments or batches; it has been safely archived to preserve historical academic records.",
            course_id=crs.id,
            status="ARCHIVED"
        )
    else:
        # Hard delete is safe
        await db.delete(crs)
        await db.commit()
        await cache_service.delete_pattern(CacheKeys.academic_courses_pattern())
        await cache_service.delete(CacheKeys.dashboard_metrics())
        return CourseDeleteResponse(
            message=f"Course '{crs.name}' deleted successfully.",
            course_id=crs.id,
            status="DELETED"
        )


# --- Batches ---
def _serialize_batch(b: Batch) -> BatchResponse:
    subjs = []
    if b.batch_subjects:
        for bs in b.batch_subjects:
            t_name = f"{bs.teacher.user.first_name} {bs.teacher.user.last_name}" if bs.teacher and bs.teacher.user else None
            c_name = bs.classroom.name if bs.classroom else None
            s_name = bs.subject.name if bs.subject else None
            s_code = bs.subject.code if bs.subject else None
            subjs.append(
                BatchSubjectItem(
                    id=bs.id,
                    subject_id=bs.subject_id,
                    subject_name=s_name,
                    subject_code=s_code,
                    teacher_name=t_name,
                    classroom_name=c_name
                )
            )
    e_count = len([s for s in (b.students or []) if getattr(s, 'status', 'ACTIVE') == 'ACTIVE']) if getattr(b, 'students', None) is not None else 0
    return BatchResponse(
        id=b.id,
        course_id=b.course_id,
        course_name=b.course.name if b.course else None,
        course_code=b.course.code if b.course else None,
        academic_year_id=b.academic_year_id,
        name=b.name,
        code=b.code,
        division=b.division or "A",
        max_capacity=b.max_capacity,
        enrolled_count=e_count,
        start_date=b.start_date,
        end_date=b.end_date,
        is_active=b.is_active,
        batch_subjects=subjs
    )


@router.get("/batches", response_model=List[BatchResponse])
async def list_batches(
    course_id: Optional[uuid.UUID] = None,
    class_id: Optional[uuid.UUID] = None,
    academic_year_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    cache_key = f"{CacheKeys.PREFIX}:academics:batches:c_{course_id}:cl_{class_id}:y_{academic_year_id}"
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached

    stmt = (
        select(Batch)
        .options(
            selectinload(Batch.course),
            selectinload(Batch.students),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.subject),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.teacher).selectinload(Teacher.user),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.classroom)
        )
        .order_by(Batch.division.asc(), Batch.created_at.asc())
    )

    if course_id:
        # Check if requested course is a Multi-Year Combined Course (e.g. 9th & 10th or 11th & 12th)
        target_course = await db.get(Course, course_id)
        if target_course and (target_course.duration_months > 12 or "combined" in target_course.name.lower()):
            # Resolve to active regular teaching batches of the entry standard / stream
            reg_c_stmt = select(Course).where(
                Course.class_id == target_course.class_id,
                Course.duration_months <= 12,
                Course.is_active == True
            )
            if target_course.stream_id:
                reg_c_stmt = reg_c_stmt.where(Course.stream_id == target_course.stream_id)
            reg_courses = (await db.execute(reg_c_stmt)).scalars().all()
            reg_c_ids = [rc.id for rc in reg_courses]
            if reg_c_ids:
                stmt = stmt.where(Batch.course_id.in_(reg_c_ids))
            else:
                stmt = stmt.where(Batch.course_id == course_id)
        else:
            stmt = stmt.where(Batch.course_id == course_id)
    elif class_id:
        reg_c_stmt = select(Course.id).where(Course.class_id == class_id, Course.is_active == True)
        reg_c_ids = (await db.execute(reg_c_stmt)).scalars().all()
        if reg_c_ids:
            stmt = stmt.where(Batch.course_id.in_(reg_c_ids))

    if academic_year_id:
        stmt = stmt.where(Batch.academic_year_id == academic_year_id)

    result = await db.execute(stmt)
    batches = result.scalars().all()
    serialized = [_serialize_batch(b) for b in batches]
    serialized_dicts = [BatchResponse.model_validate(b).model_dump() for b in serialized]
    await cache_service.set(cache_key, serialized_dicts, ttl=300)
    return serialized


@router.post("/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    data: BatchCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    target_course = await db.get(Course, data.course_id)
    if not target_course:
        raise NotFoundException(f"Course {data.course_id} not found")

    if target_course.duration_months > 12 or "combined" in target_course.name.lower():
        raise BadRequestException(
            f"'{target_course.name}' is a Multi-Year Combined Program. "
            f"Students in this program are assigned to the regular batches and divisions of their entry standard. "
            f"Please create divisions under the standard's Regular Course instead."
        )

    div = (data.division or "A").strip().upper()
    existing_div_stmt = select(Batch).where(
        Batch.course_id == data.course_id,
        Batch.academic_year_id == data.academic_year_id,
        Batch.division.ilike(div),
        Batch.is_active == True
    )
    if (await db.execute(existing_div_stmt)).scalars().first():
        raise ConflictException(f"Division '{div}' already exists for this course in this academic year.")

    existing_name_stmt = select(Batch).where(
        Batch.course_id == data.course_id,
        Batch.academic_year_id == data.academic_year_id,
        Batch.name.ilike(data.name.strip()),
        Batch.is_active == True
    )
    if (await db.execute(existing_name_stmt)).scalars().first():
        raise ConflictException(f"A batch named '{data.name.strip()}' already exists for this course in this academic year.")

    existing_code_stmt = select(Batch).where(
        Batch.academic_year_id == data.academic_year_id,
        Batch.code.ilike(data.code.strip())
    )
    if (await db.execute(existing_code_stmt)).scalars().first():
        raise ConflictException(f"A batch with code '{data.code.strip()}' already exists for this academic year.")

    batch = Batch(
        course_id=data.course_id,
        academic_year_id=data.academic_year_id,
        name=data.name,
        code=data.code,
        division=div,
        max_capacity=data.max_capacity,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=True
    )
    db.add(batch)
    await db.flush()

    if data.subject_assignments:
        for sa in data.subject_assignments:
            bs = BatchSubject(
                batch_id=batch.id,
                subject_id=sa.subject_id,
                teacher_id=sa.teacher_id,
                classroom_id=sa.classroom_id
            )
            db.add(bs)
    else:
        # Auto-provision BatchSubject for all core subjects in active CourseVersion
        cver_stmt = (
            select(CourseVersion)
            .options(selectinload(CourseVersion.version_subjects))
            .where(CourseVersion.course_id == data.course_id, CourseVersion.is_active == True)
            .order_by(CourseVersion.version_number.desc())
        )
        cver = (await db.execute(cver_stmt)).scalars().first()
        if cver and cver.version_subjects:
            for vs in cver.version_subjects:
                bs = BatchSubject(
                    batch_id=batch.id,
                    subject_id=vs.subject_id
                )
                db.add(bs)

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())

    refetch = (
        select(Batch)
        .options(
            selectinload(Batch.course),
            selectinload(Batch.students),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.subject),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.teacher).selectinload(Teacher.user),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.classroom)
        )
        .where(Batch.id == batch.id)
    )
    b_loaded = (await db.execute(refetch)).scalar_one()
    return _serialize_batch(b_loaded)


@router.put("/batches/{batch_id}", response_model=BatchResponse)
async def update_batch(
    batch_id: uuid.UUID,
    data: BatchUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Batch)
        .options(
            selectinload(Batch.course),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.subject),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.teacher).selectinload(Teacher.user),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.classroom)
        )
        .where(Batch.id == batch_id)
    )
    batch = (await db.execute(stmt)).scalar_one_or_none()
    if not batch:
        raise NotFoundException(f"Batch {batch_id} not found")

    if data.name is not None:
        batch.name = data.name
    if data.code is not None:
        batch.code = data.code
    if data.division is not None:
        batch.division = data.division
    if data.max_capacity is not None:
        batch.max_capacity = data.max_capacity
    if data.start_date is not None:
        batch.start_date = data.start_date
    if data.end_date is not None:
        batch.end_date = data.end_date
    if data.is_active is not None:
        batch.is_active = data.is_active

    if data.subject_assignments is not None:
        curr_bs_map = {bs.subject_id: bs for bs in batch.batch_subjects}
        new_sids = {sa.subject_id for sa in data.subject_assignments}
        sa_map = {sa.subject_id: sa for sa in data.subject_assignments}

        for sid, bs in list(curr_bs_map.items()):
            if sid not in new_sids:
                await db.delete(bs)
            else:
                sa = sa_map[sid]
                bs.teacher_id = sa.teacher_id
                bs.classroom_id = sa.classroom_id

        for sid in new_sids:
            if sid not in curr_bs_map:
                sa = sa_map[sid]
                db.add(BatchSubject(
                    batch_id=batch.id,
                    subject_id=sid,
                    teacher_id=sa.teacher_id,
                    classroom_id=sa.classroom_id
                ))

    await db.commit()
    await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())

    refetch = (
        select(Batch)
        .options(
            selectinload(Batch.course),
            selectinload(Batch.students),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.subject),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.teacher).selectinload(Teacher.user),
            selectinload(Batch.batch_subjects).selectinload(BatchSubject.classroom)
        )
        .where(Batch.id == batch_id)
    )
    b_loaded = (await db.execute(refetch)).scalar_one()
    return _serialize_batch(b_loaded)


@router.delete("/batches/{batch_id}", response_model=BatchDeleteResponse)
async def delete_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Batch).where(Batch.id == batch_id)
    batch = (await db.execute(stmt)).scalar_one_or_none()
    if not batch:
        await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())
        return BatchDeleteResponse(
            message="Batch has already been removed or does not exist.",
            batch_id=batch_id,
            status="DELETED"
        )

    # Check if students are actively assigned to this batch
    bs_check = await db.execute(select(BatchStudent).where(BatchStudent.batch_id == batch_id))
    if bs_check.scalars().first():
        raise BadRequestException("Cannot delete batch with active student enrollments. Transfer or archive them first.")

    await db.delete(batch)
    await db.commit()
    await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())
    return BatchDeleteResponse(
        message=f"Batch '{batch.name}' ({batch.code}) deleted successfully.",
        batch_id=batch.id,
        status="DELETED"
    )


# --- Batch Roster & Division Roll Number Management ---

def _extract_standard_number(class_name: Optional[str], class_code: Optional[str]) -> int:
    for text_val in [class_code, class_name]:
        if text_val:
            m = re.search(r'\d+', text_val)
            if m:
                return int(m.group())
    return 10


def _get_division_offset(division: str) -> int:
    div = (division or "A").strip().upper()
    if div in ("A", "1"):
        return 0
    elif div in ("B", "2"):
        return 50
    elif div in ("C", "3"):
        return 100
    elif div in ("D", "4"):
        return 150
    return 0


async def get_next_roll_number_for_batch(db: AsyncSession, batch_id: uuid.UUID) -> int:
    """
    Computes the next available sequential roll number for a batch.
    Roll numbers are ALWAYS appended at the end so existing students' roll numbers are NEVER changed or disturbed.
    Formula:
      - standard_number = class number (e.g. 5 for 5th, 10 for 10th)
      - base_prefix = standard_number * 100
      - division_offset = 0 for Div A, 50 for Div B, 100 for Div C, 150 for Div D
      - min_roll = base_prefix + division_offset + 1
      - next_roll = max(existing_max_roll + 1, min_roll)
    """
    batch = await db.get(Batch, batch_id)
    if not batch:
        return 1

    cls_name = None
    cls_code = None
    if batch.course_id:
        course = await db.get(Course, batch.course_id)
        if course and course.class_id:
            cls = await db.get(Class, course.class_id)
            if cls:
                cls_name = cls.name
                cls_code = cls.code

    std_num = _extract_standard_number(cls_name, cls_code)
    base_prefix = std_num * 100
    div_offset = _get_division_offset(batch.division)
    min_roll = base_prefix + div_offset + 1

    max_roll_stmt = select(BatchStudent.roll_number).where(
        BatchStudent.batch_id == batch_id,
        BatchStudent.roll_number != None
    ).order_by(BatchStudent.roll_number.desc()).limit(1)
    max_roll = (await db.execute(max_roll_stmt)).scalar_one_or_none()

    if max_roll is not None and max_roll >= (base_prefix + div_offset):
        return max_roll + 1
    return min_roll


@router.get("/batches/{batch_id}/roster", response_model=List[BatchStudentRosterItem])
async def get_batch_roster(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Returns all enrolled students in this batch/division ordered by roll number."""
    batch = await db.get(Batch, batch_id)
    if not batch:
        raise NotFoundException(f"Batch {batch_id} not found")

    stmt = (
        select(BatchStudent)
        .options(
            selectinload(BatchStudent.student).selectinload(Student.enrollments)
        )
        .where(BatchStudent.batch_id == batch_id)
        .order_by(
            BatchStudent.roll_number.asc().nulls_last(),
            BatchStudent.created_at.asc()
        )
    )
    records = (await db.execute(stmt)).scalars().all()
    out = []
    for r in records:
        if r.student:
            m_enr = next((e for e in (r.student.enrollments or []) if e.academic_year_id == batch.academic_year_id), None)
            out.append(
                BatchStudentRosterItem(
                    student_id=r.student.id,
                    student_code=r.student.student_code,
                    prn=r.student.prn or r.student.student_code.replace("STU-", "PRN-"),
                    first_name=r.student.first_name,
                    last_name=r.student.last_name,
                    gender=r.student.gender,
                    roll_number=r.roll_number,
                    status=r.status,
                    enrolled_at=r.enrolled_at,
                    promotion_status=m_enr.promotion_status if m_enr else None,
                    enrollment_status=m_enr.status if m_enr else r.status
                )
            )
    return out


@router.post("/batches/{batch_id}/students", response_model=BatchStudentRosterItem, status_code=status.HTTP_201_CREATED)
async def add_student_to_batch(
    batch_id: uuid.UUID,
    data: AddStudentToBatchRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Enrolls an existing student into a batch/division with an optional roll number."""
    batch = await db.get(Batch, batch_id)
    if not batch:
        raise NotFoundException(f"Batch {batch_id} not found")

    student = await db.get(Student, data.student_id)
    if not student:
        raise NotFoundException(f"Student {data.student_id} not found")

    # Check if already enrolled
    existing_stmt = select(BatchStudent).where(
        BatchStudent.batch_id == batch_id,
        BatchStudent.student_id == data.student_id
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise ConflictException("Student is already enrolled in this batch")

    # Validate roll number if provided, or auto-assign next sequential roll number at the end
    assigned_roll = data.roll_number
    if assigned_roll is not None:
        if assigned_roll <= 0:
            raise BadRequestException("Roll number must be a positive integer")
        dup_stmt = select(BatchStudent).where(
            BatchStudent.batch_id == batch_id,
            BatchStudent.roll_number == assigned_roll
        )
        if (await db.execute(dup_stmt)).scalar_one_or_none():
            raise ConflictException(f"Roll number {assigned_roll} is already assigned in this division.")
    else:
        assigned_roll = await get_next_roll_number_for_batch(db, batch_id)

    bs = BatchStudent(
        batch_id=batch_id,
        student_id=data.student_id,
        roll_number=assigned_roll,
        status="ACTIVE"
    )
    db.add(bs)
    await db.commit()
    await CacheInvalidator.invalidate_batch_roster(batch_id=batch_id, student_ids=[data.student_id])

    return BatchStudentRosterItem(
        student_id=student.id,
        student_code=student.student_code,
        prn=student.prn or student.student_code.replace("STU-", "PRN-"),
        first_name=student.first_name,
        last_name=student.last_name,
        gender=student.gender,
        roll_number=bs.roll_number,
        status=bs.status,
        enrolled_at=bs.enrolled_at
    )


@router.get("/batches/{batch_id}/sync-preview", response_model=BatchSyncPreviewResponse)
async def get_batch_sync_preview(
    batch_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns preview of all students enrolled in the batch's course,
    categorized by their division mapping and active batch status.
    """
    stmt = (
        select(Batch)
        .options(
            selectinload(Batch.course).selectinload(Course.academic_class)
        )
        .where(Batch.id == batch_id)
    )
    batch = (await db.execute(stmt)).scalar_one_or_none()
    if not batch:
        raise NotFoundException(f"Batch {batch_id} not found")

    course_batches_stmt = select(Batch).where(
        Batch.course_id == batch.course_id,
        Batch.academic_year_id == batch.academic_year_id,
        Batch.is_active == True
    )
    course_batches = (await db.execute(course_batches_stmt)).scalars().all()
    batch_map = {b.id: b for b in course_batches}
    has_multiple_batches = len(course_batches) > 1

    enr_stmt = (
        select(Enrollment)
        .options(
            selectinload(Enrollment.student),
            selectinload(Enrollment.batch),
            selectinload(Enrollment.enrolled_subjects)
        )
        .where(
            Enrollment.academic_year_id == batch.academic_year_id,
            or_(
                Enrollment.course_id == batch.course_id,
                Enrollment.batch_id == batch.id,
                and_(
                    Enrollment.class_id == batch.course.class_id,
                    Enrollment.enrollment_group_id.isnot(None)
                )
            ),
            Enrollment.status == "ACTIVE"
        )
    )
    enrs = (await db.execute(enr_stmt)).scalars().all()

    bs_stmt = (
        select(BatchStudent)
        .options(selectinload(BatchStudent.batch))
        .where(
            BatchStudent.batch_id.in_([b.id for b in course_batches]),
            BatchStudent.status == "ACTIVE"
        )
    )
    bs_records = (await db.execute(bs_stmt)).scalars().all()
    bs_map = {bs.student_id: bs for bs in bs_records}

    items: List[BatchSyncPreviewItem] = []
    seen_student_ids = set()

    matched_count = 0
    unassigned_count = 0
    other_division_count = 0
    already_in_this_batch_count = 0

    for e in enrs:
        if not e.student or e.student.id in seen_student_ids:
            continue
        seen_student_ids.add(e.student.id)

        enrolled_bid = e.batch_id
        if not enrolled_bid and e.enrolled_subjects:
            for es in e.enrolled_subjects:
                if es.batch_id:
                    enrolled_bid = es.batch_id
                    break
        enrolled_b = batch_map.get(enrolled_bid) if enrolled_bid else None

        active_bs = bs_map.get(e.student.id)
        is_assigned_to_this_batch = bool(active_bs and active_bs.batch_id == batch.id)
        is_assigned_to_other_batch = bool(active_bs and active_bs.batch_id != batch.id)

        if enrolled_bid == batch.id:
            is_matched = True
        elif enrolled_bid is None and not has_multiple_batches:
            is_matched = True
        else:
            is_matched = False

        if is_assigned_to_this_batch:
            already_in_this_batch_count += 1
        elif is_assigned_to_other_batch:
            other_division_count += 1
        elif is_matched:
            matched_count += 1
        else:
            if enrolled_bid and enrolled_bid != batch.id:
                other_division_count += 1
            else:
                unassigned_count += 1

        items.append(
            BatchSyncPreviewItem(
                student_id=e.student.id,
                student_code=e.student.student_code,
                prn=e.student.prn or e.student.student_code.replace("STU-", "PRN-"),
                first_name=e.student.first_name,
                last_name=e.student.last_name,
                gender=e.student.gender,
                enrolled_batch_id=enrolled_bid,
                enrolled_batch_name=enrolled_b.name if enrolled_b else None,
                enrolled_division=enrolled_b.division if enrolled_b else None,
                current_batch_id=active_bs.batch_id if active_bs else None,
                current_batch_name=active_bs.batch.name if active_bs and active_bs.batch else None,
                current_division=active_bs.batch.division if active_bs and active_bs.batch else None,
                current_roll_number=active_bs.roll_number if active_bs else None,
                is_assigned_to_this_batch=is_assigned_to_this_batch,
                is_assigned_to_other_batch=is_assigned_to_other_batch,
                is_matched_for_this_batch=is_matched
            )
        )

    items.sort(key=lambda x: (
        not x.is_matched_for_this_batch,
        x.is_assigned_to_this_batch,
        x.is_assigned_to_other_batch,
        x.last_name.lower(),
        x.first_name.lower()
    ))

    return BatchSyncPreviewResponse(
        batch_id=batch.id,
        batch_name=batch.name,
        division=batch.division,
        course_id=batch.course_id,
        course_name=batch.course.name if batch.course else "",
        total_course_enrollments=len(seen_student_ids),
        matched_count=matched_count,
        unassigned_count=unassigned_count,
        other_division_count=other_division_count,
        already_in_this_batch_count=already_in_this_batch_count,
        students=items
    )


@router.post("/batches/{batch_id}/sync-enrolled-students", response_model=List[BatchStudentRosterItem])
async def sync_enrolled_course_students(
    batch_id: uuid.UUID,
    data: Optional[BatchSyncRequest] = None,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Syncs students actively enrolled in this batch's course into the batch roster.
    Guarantees strict division isolation:
    - If data.selected_student_ids provided: only imports those students.
    - If AUTO: imports students enrolled specifically for this batch (Enrollment.batch_id == batch.id).
      If the course has only 1 active batch, also absorbs unassigned course students.
      Never absorbs students belonging to other divisions.
    """
    stmt = (
        select(Batch)
        .options(
            selectinload(Batch.course).selectinload(Course.academic_class)
        )
        .where(Batch.id == batch_id)
    )
    batch = (await db.execute(stmt)).scalar_one_or_none()
    if not batch:
        raise NotFoundException(f"Batch {batch_id} not found")

    course_batches_stmt = select(Batch).where(
        Batch.course_id == batch.course_id,
        Batch.academic_year_id == batch.academic_year_id,
        Batch.is_active == True
    )
    course_batches = (await db.execute(course_batches_stmt)).scalars().all()
    has_multiple_batches = len(course_batches) > 1

    enr_stmt = (
        select(Enrollment)
        .options(
            selectinload(Enrollment.student),
            selectinload(Enrollment.enrolled_subjects)
        )
        .where(
            Enrollment.academic_year_id == batch.academic_year_id,
            or_(
                Enrollment.course_id == batch.course_id,
                Enrollment.batch_id == batch.id,
                and_(
                    Enrollment.class_id == batch.course.class_id,
                    Enrollment.enrollment_group_id.isnot(None)
                )
            ),
            Enrollment.status == "ACTIVE"
        )
    )
    enrs = (await db.execute(enr_stmt)).scalars().all()

    # Check all students already assigned to ANY active batch for this course
    course_batch_ids = [b.id for b in course_batches]
    existing_stmt = select(BatchStudent.student_id).where(
        BatchStudent.batch_id.in_(course_batch_ids),
        BatchStudent.status == "ACTIVE"
    )
    already_assigned_ids = set((await db.execute(existing_stmt)).scalars().all())

    # Filter eligible students
    new_additions = []
    seen = set()

    manual_selected_ids = set(data.selected_student_ids) if (data and data.selected_student_ids) else None

    for e in enrs:
        if not e.student or e.student.id in already_assigned_ids or e.student.id in seen:
            continue

        enrolled_bid = e.batch_id
        if not enrolled_bid and e.enrolled_subjects:
            for es in e.enrolled_subjects:
                if es.batch_id:
                    enrolled_bid = es.batch_id
                    break

        is_eligible = False
        if manual_selected_ids is not None:
            is_eligible = e.student.id in manual_selected_ids
        else:
            # AUTO mode:
            if enrolled_bid == batch.id:
                is_eligible = True
            elif enrolled_bid is None and not has_multiple_batches:
                is_eligible = True
            else:
                is_eligible = False

        if is_eligible:
            seen.add(e.student.id)
            new_additions.append(e)

    cls_name = batch.course.academic_class.name if batch.course and batch.course.academic_class else None
    cls_code = batch.course.academic_class.code if batch.course and batch.course.academic_class else None
    std_num = _extract_standard_number(cls_name, cls_code)
    base_prefix = std_num * 100
    div_offset = _get_division_offset(batch.division)

    max_roll_stmt = select(BatchStudent.roll_number).where(
        BatchStudent.batch_id == batch_id,
        BatchStudent.roll_number != None
    ).order_by(BatchStudent.roll_number.desc()).limit(1)
    max_roll = (await db.execute(max_roll_stmt)).scalar_one_or_none()
    next_roll = (max_roll + 1) if max_roll and max_roll >= (base_prefix + div_offset) else (base_prefix + div_offset + 1)

    # Append new enrollments in chronological order of enrollment (not alphabetically) so existing roll numbers are undisturbed
    new_additions.sort(key=lambda e: (e.created_at or datetime.min))
    for e in new_additions:
        bs = BatchStudent(
            batch_id=batch.id,
            student_id=e.student.id,
            roll_number=next_roll,
            status="ACTIVE"
        )
        next_roll += 1
        db.add(bs)
        e.batch_id = batch.id
        if e.enrolled_subjects:
            for es in e.enrolled_subjects:
                es.batch_id = batch.id

    await db.commit()
    added_student_ids = [e.student.id for e in new_additions if e.student]
    await CacheInvalidator.invalidate_batch_roster(batch_id=batch_id, student_ids=added_student_ids)

    roster_stmt = (
        select(BatchStudent)
        .options(selectinload(BatchStudent.student))
        .where(BatchStudent.batch_id == batch_id)
        .order_by(BatchStudent.roll_number.asc().nulls_last(), BatchStudent.created_at.asc())
    )
    records = (await db.execute(roster_stmt)).scalars().all()
    out = []
    for r in records:
        if r.student:
            out.append(
                BatchStudentRosterItem(
                    student_id=r.student.id,
                    student_code=r.student.student_code,
                    prn=r.student.prn or r.student.student_code.replace("STU-", "PRN-"),
                    first_name=r.student.first_name,
                    last_name=r.student.last_name,
                    gender=r.student.gender,
                    roll_number=r.roll_number,
                    status=r.status,
                    enrolled_at=r.enrolled_at
                )
            )
    return out


@router.post("/batches/{batch_id}/generate-roll-numbers", response_model=AutoRollNumberResponse)
async def auto_generate_roll_numbers(
    batch_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Auto-assigns class-prefixed roll numbers sorted alphabetically by student name.
    Formula (Option 1):
      standard_number = class number (e.g. 5 for 5th, 10 for 10th)
      base_prefix = standard_number * 100
      division_offset = 0 for Div A, 50 for Div B, 100 for Div C
      student roll = base_prefix + division_offset + index + 1
    """
    stmt = (
        select(Batch)
        .options(
            selectinload(Batch.course).selectinload(Course.academic_class)
        )
        .where(Batch.id == batch_id)
    )
    batch = (await db.execute(stmt)).scalar_one_or_none()
    if not batch:
        raise NotFoundException(f"Batch {batch_id} not found")

    # Determine standard number
    cls_name = batch.course.academic_class.name if batch.course and batch.course.academic_class else None
    cls_code = batch.course.academic_class.code if batch.course and batch.course.academic_class else None
    std_num = _extract_standard_number(cls_name, cls_code)
    base_prefix = std_num * 100
    div_offset = _get_division_offset(batch.division)

    # Fetch all active batch students
    roster_stmt = (
        select(BatchStudent)
        .options(selectinload(BatchStudent.student))
        .where(BatchStudent.batch_id == batch_id, BatchStudent.status == "ACTIVE")
    )
    records = (await db.execute(roster_stmt)).scalars().all()
    if not records:
        return AutoRollNumberResponse(
            message="No active students found in this division to assign roll numbers.",
            batch_id=batch.id,
            division=batch.division,
            standard_number=std_num,
            base_prefix=base_prefix,
            division_offset=div_offset,
            assigned_count=0,
            roster=[]
        )

    # Preserve existing roll numbers completely so nobody's roll number is disturbed!
    assigned_records = [r for r in records if r.roll_number is not None]
    unassigned_records = [r for r in records if r.roll_number is None]

    if not unassigned_records:
        # All students already have roll numbers - strictly preserve them
        records_sorted = sorted(records, key=lambda r: (r.roll_number or 0))
        roster_out = [
            BatchStudentRosterItem(
                student_id=r.student.id,
                student_code=r.student.student_code,
                prn=r.student.prn or r.student.student_code.replace("STU-", "PRN-"),
                first_name=r.student.first_name,
                last_name=r.student.last_name,
                gender=r.student.gender,
                roll_number=r.roll_number,
                status=r.status,
                enrolled_at=r.enrolled_at
            )
            for r in records_sorted
        ]
        return AutoRollNumberResponse(
            message=f"All {len(records)} students in Division {batch.division} already have roll numbers. Existing roll numbers are safely preserved.",
            batch_id=batch.id,
            division=batch.division,
            standard_number=std_num,
            base_prefix=base_prefix,
            division_offset=div_offset,
            assigned_count=len(records),
            roster=roster_out
        )

    # Determine starting roll number for unassigned students (append at the last)
    existing_rolls = [r.roll_number for r in assigned_records if r.roll_number is not None]
    if existing_rolls:
        next_roll = max(existing_rolls) + 1
    else:
        next_roll = base_prefix + div_offset + 1

    # Sort unassigned students chronologically by enrollment date (NOT alphabetically) to append at the end
    unassigned_sorted = sorted(
        unassigned_records,
        key=lambda r: (r.created_at or r.enrolled_at or datetime.min)
    )

    newly_assigned_count = 0
    for r in unassigned_sorted:
        r.roll_number = next_roll
        next_roll += 1
        newly_assigned_count += 1

    await db.commit()
    affected_student_ids = [r.student.id for r in unassigned_sorted if r.student]
    await CacheInvalidator.invalidate_batch_roster(batch_id=batch.id, student_ids=affected_student_ids)

    # Build response roster ordered by roll number
    records_sorted = sorted(records, key=lambda r: (r.roll_number or 0))
    roster_out = [
        BatchStudentRosterItem(
            student_id=r.student.id,
            student_code=r.student.student_code,
            prn=r.student.prn or r.student.student_code.replace("STU-", "PRN-"),
            first_name=r.student.first_name,
            last_name=r.student.last_name,
            gender=r.student.gender,
            roll_number=r.roll_number,
            status=r.status,
            enrolled_at=r.enrolled_at
        )
        for r in records_sorted
    ]

    div_label = f"Division {batch.division}"
    return AutoRollNumberResponse(
        message=f"Successfully appended {newly_assigned_count} roll numbers at the end (ending at Roll #{next_roll - 1}) for {div_label}. Existing roll numbers were strictly preserved.",
        batch_id=batch.id,
        division=batch.division,
        standard_number=std_num,
        base_prefix=base_prefix,
        division_offset=div_offset,
        assigned_count=newly_assigned_count,
        roster=roster_out
    )


@router.put("/batches/{batch_id}/students/{student_id}/roll-number", response_model=BatchStudentRosterItem)
async def update_student_roll_number(
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    data: RollNumberUpdateRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Manually updates a student's roll number in a specific batch/division."""
    if data.roll_number <= 0:
        raise BadRequestException("Roll number must be a positive integer")

    stmt = (
        select(BatchStudent)
        .options(selectinload(BatchStudent.student))
        .where(BatchStudent.batch_id == batch_id, BatchStudent.student_id == student_id)
    )
    bs = (await db.execute(stmt)).scalar_one_or_none()
    if not bs:
        raise NotFoundException("Student is not enrolled in this batch")

    # Check for duplicate roll number in this batch
    dup_stmt = select(BatchStudent).where(
        BatchStudent.batch_id == batch_id,
        BatchStudent.roll_number == data.roll_number,
        BatchStudent.student_id != student_id
    )
    dup = (await db.execute(dup_stmt)).scalar_one_or_none()
    if dup:
        raise ConflictException(f"Roll number {data.roll_number} is already assigned to another student in this batch.")

    bs.roll_number = data.roll_number
    await db.commit()
    await CacheInvalidator.invalidate_batch_roster(batch_id=batch_id, student_ids=[student_id])

    return BatchStudentRosterItem(
        student_id=bs.student.id,
        student_code=bs.student.student_code,
        prn=bs.student.prn or bs.student.student_code.replace("STU-", "PRN-"),
        first_name=bs.student.first_name,
        last_name=bs.student.last_name,
        gender=bs.student.gender,
        roll_number=bs.roll_number,
        status=bs.status,
        enrolled_at=bs.enrolled_at
    )


@router.delete("/batches/{batch_id}/students/{student_id}", response_model=BatchDeleteResponse)
async def remove_student_from_batch(
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Removes a student from a batch/division."""
    stmt = select(BatchStudent).where(
        BatchStudent.batch_id == batch_id,
        BatchStudent.student_id == student_id
    )
    bs = (await db.execute(stmt)).scalar_one_or_none()
    if not bs:
        raise NotFoundException("Student is not enrolled in this batch")

    await db.delete(bs)
    await db.commit()
    await CacheInvalidator.invalidate_batch_roster(batch_id=batch_id, student_ids=[student_id])
    return BatchDeleteResponse(
        message="Student successfully removed from batch.",
        batch_id=batch_id,
        status="REMOVED"
    )


@router.post("/batches/{batch_id}/students/{student_id}/transfer", response_model=BatchTransferResponse)
async def transfer_student_batch(
    batch_id: uuid.UUID,
    student_id: uuid.UUID,
    data: BatchTransferRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Transfers a student from current batch to target batch (e.g., Division A to Division B).
    Automatically recalculates the new division's roll number with the standard offset (e.g. +50 for Div B)
    and updates Enrollment.batch_id.
    """
    if batch_id == data.target_batch_id:
        raise BadRequestException("Target batch must be different from source batch")

    src_batch = await db.get(Batch, batch_id)
    if not src_batch:
        raise NotFoundException(f"Source batch {batch_id} not found")

    tgt_stmt = (
        select(Batch)
        .options(selectinload(Batch.course).selectinload(Course.academic_class))
        .where(Batch.id == data.target_batch_id)
    )
    tgt_batch = (await db.execute(tgt_stmt)).scalar_one_or_none()
    if not tgt_batch:
        raise NotFoundException(f"Target batch {data.target_batch_id} not found")

    if src_batch.academic_year_id != tgt_batch.academic_year_id:
        raise BadRequestException(
            "Cannot transfer student between batches of different academic years. "
            "Use Cohort Rollover to transition students between academic years."
        )

    if src_batch.course_id != tgt_batch.course_id:
        raise BadRequestException("Cannot transfer student between batches of different courses")

    bs_stmt = select(BatchStudent).where(
        BatchStudent.batch_id == batch_id,
        BatchStudent.student_id == student_id,
        BatchStudent.status == "ACTIVE"
    )
    bs = (await db.execute(bs_stmt)).scalar_one_or_none()
    if not bs:
        raise NotFoundException("Student is not an active member of the source batch")

    cls_name = tgt_batch.course.academic_class.name if tgt_batch.course and tgt_batch.course.academic_class else None
    cls_code = tgt_batch.course.academic_class.code if tgt_batch.course and tgt_batch.course.academic_class else None
    std_num = _extract_standard_number(cls_name, cls_code)
    base_prefix = std_num * 100
    div_offset = _get_division_offset(tgt_batch.division)

    max_roll_stmt = select(BatchStudent.roll_number).where(
        BatchStudent.batch_id == tgt_batch.id,
        BatchStudent.roll_number != None
    ).order_by(BatchStudent.roll_number.desc()).limit(1)
    max_roll = (await db.execute(max_roll_stmt)).scalar_one_or_none()
    next_roll = (max_roll + 1) if max_roll and max_roll >= (base_prefix + div_offset) else (base_prefix + div_offset + 1)

    bs.batch_id = tgt_batch.id
    bs.roll_number = next_roll

    enr_stmt = select(Enrollment).options(selectinload(Enrollment.enrolled_subjects)).where(
        Enrollment.student_id == student_id,
        Enrollment.course_id == tgt_batch.course_id,
        Enrollment.status == "ACTIVE"
    )
    enrs = (await db.execute(enr_stmt)).scalars().all()
    for e in enrs:
        e.batch_id = tgt_batch.id
        if e.enrolled_subjects:
            for es in e.enrolled_subjects:
                es.batch_id = tgt_batch.id

    await db.commit()
    await CacheInvalidator.invalidate_batch_roster(batch_id=batch_id, student_ids=[student_id])

    return BatchTransferResponse(
        message=f"Student successfully transferred to {tgt_batch.name} (Division {tgt_batch.division}) with Roll #{next_roll}.",
        student_id=student_id,
        source_batch_id=batch_id,
        target_batch_id=tgt_batch.id,
        new_roll_number=next_roll,
        target_division=tgt_batch.division
    )
