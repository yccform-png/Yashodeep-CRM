import uuid
from typing import List, Optional
from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException, BadRequestException, ConflictException, ForbiddenException
from app.core.cache import cache_service, CacheKeys, CacheInvalidator
from app.models.user import User
from app.models.institute import Institute
from app.models.student import Student, Guardian, StudentGuardian
from app.models.academic import (
    AcademicYear, Class, Stream, Subject, SubjectGroup, Course, CourseVersion, Batch, BatchStudent
)
from app.models.enrollment import EnrollmentGroup, Enrollment, EnrollmentSubject
from app.models.service import StudentService, ServicePlan, ServiceType
from app.models.fee import Invoice, InvoiceItem, InstallmentPlan, Installment, Payment
from app.models.hostel import HostelBed, BedAllocation
from app.models.study_room import StudySeat, SeatAllocation
from app.modules.fees.pricing_engine import PricingEngine
from app.modules.enrollments.schemas import (
    AdmissionWizardRequest, AdmissionConfirmationResponse, PromotionRequest,
    MidSessionSkillEnrollmentRequest, SkillEnrollmentResponse, TrialConversionRequest
)
from app.modules.students.service import generate_student_code_and_prn
from app.modules.notifications.service import notification_dispatcher

router = APIRouter(prefix="/enrollments", tags=["Admissions & Enrollments"])


@router.post("/admit", response_model=AdmissionConfirmationResponse, status_code=status.HTTP_201_CREATED)
async def process_full_admission(
    data: AdmissionWizardRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes the end-to-end multi-step admission wizard atomically.
    Handles Single Year, Combined 11th+12th, Individual Subject, and Facility-Only (Hostel/Study Room) scenarios.
    Supports Provisional Trial Admissions (with upfront Form Fee receipt) and Confirmed Admissions.
    """
    # 0. Load Institute Configuration
    inst_stmt = select(Institute).where(Institute.is_active == True)
    institute = (await db.execute(inst_stmt)).scalars().first()

    joining_date = data.admission_date or date.today()
    is_trial_admission = (
        data.admission_type == "PROVISIONAL_TRIAL"
        and institute is not None
        and institute.enable_trial_admission
        and data.is_academic_enrolled
    )
    trial_days = institute.trial_period_days if institute else 14
    trial_end_date = joining_date + timedelta(days=trial_days) if is_trial_admission else None

    # 1. Create Student
    student_code, prn_number = await generate_student_code_and_prn(db, year=2026)

    student = Student(
        institute_id=current_user.institute_id,
        student_code=student_code,
        prn=prn_number,
        first_name=data.first_name,
        middle_name=data.middle_name,
        last_name=data.last_name,
        date_of_birth=data.date_of_birth,
        gender=data.gender.upper(),
        blood_group=data.blood_group,
        mobile=data.mobile,
        email=data.email,
        village=data.village or data.address_line2 or data.city,
        taluka=data.taluka,
        district=data.district or data.city or "Kolhapur",
        address_line1=data.address_line1,
        address_line2=data.address_line2,
        city=data.city or data.village,
        state=data.state or "Maharashtra",
        pincode=data.pincode,
        institution_type=data.institution_type or "SCHOOL",
        school_college_name=data.school_college_name,
        education_board=data.education_board,
        previous_percentage=data.previous_percentage,
        aadhar_number=data.aadhar_number,
        category=data.category,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone,
        emergency_contact_relation=data.emergency_contact_relation,
        admission_date=joining_date,
        status="PROVISIONAL_TRIAL" if is_trial_admission else "ACTIVE",
        trial_end_date=trial_end_date,
        trial_form_fee_paid=is_trial_admission and (institute.enable_admission_form_fee if institute else True),
        trial_receipt_number=None
    )
    db.add(student)
    await db.flush()

    # Issue upfront Form Fee receipt for Provisional Trial
    if is_trial_admission and institute and institute.enable_admission_form_fee and institute.admission_form_fee > Decimal("0.00"):
        pay_count = len((await db.execute(select(Payment))).scalars().all()) + 1
        rec_number = f"REC-FORM-2026-{pay_count:05d}"
        while (await db.execute(select(Payment.id).where(Payment.payment_number == rec_number))).scalar_one_or_none():
            pay_count += 1
            rec_number = f"REC-FORM-2026-{pay_count:05d}"
        form_payment = Payment(
            institute_id=current_user.institute_id,
            student_id=student.id,
            payment_number=rec_number,
            payment_date=joining_date,
            amount=institute.admission_form_fee,
            payment_method=data.form_fee_payment_mode or "CASH",
            transaction_reference=f"FORM-FEE-{student.student_code}"
        )
        db.add(form_payment)
        student.trial_receipt_number = rec_number
        await db.flush()

    # Link Guardians
    if data.guardians:
        for g_data in data.guardians:
            guardian = Guardian(
                institute_id=current_user.institute_id,
                first_name=g_data.first_name,
                last_name=g_data.last_name,
                relation=g_data.relation,
                mobile=g_data.mobile,
                email=g_data.email,
                occupation=g_data.occupation,
                address=g_data.address
            )
            db.add(guardian)
            await db.flush()

            sg = StudentGuardian(
                student_id=student.id,
                guardian_id=guardian.id,
                is_primary=g_data.is_primary,
                can_pickup=True,
                receives_notifications=True
            )
            db.add(sg)

    # 2. Academic Enrollment Handling
    enrollment = None
    enrollment_group = None

    is_universal_course = False
    if data.course_id:
        c_obj = await db.get(Course, data.course_id)
        if c_obj and c_obj.is_universal:
            is_universal_course = True

    if data.is_academic_enrolled and data.academic_year_id and (data.class_id or is_universal_course):
        if data.enrollment_type == "COMBINED_MULTI_YEAR":
            grp_count = len((await db.execute(select(EnrollmentGroup))).scalars().all()) + 1
            entry_class = await db.get(Class, data.class_id) if data.class_id else None
            class_name = entry_class.name if entry_class else ""
            if "9" in class_name:
                remarks_text = "9th + 10th Combined Admission"
            elif "11" in class_name:
                remarks_text = "11th + 12th Combined Admission"
            else:
                remarks_text = f"{class_name} Multi-Year Combined Admission"

            enrollment_group = EnrollmentGroup(
                institute_id=current_user.institute_id,
                group_code=f"GRP-2026-{grp_count:04d}",
                enrollment_type="COMBINED_MULTI_YEAR",
                total_years=2,
                remarks=remarks_text
            )
            db.add(enrollment_group)
            await db.flush()

        actual_course_version_id = data.course_version_id
        if not actual_course_version_id and data.course_id:
            cv_cand = (
                await db.execute(
                    select(CourseVersion).where(
                        CourseVersion.course_id == data.course_id,
                        CourseVersion.is_active == True
                    )
                )
            ).scalars().first()
            if cv_cand:
                actual_course_version_id = cv_cand.id

        enrollment = Enrollment(
            enrollment_group_id=enrollment_group.id if enrollment_group else None,
            student_id=student.id,
            academic_year_id=data.academic_year_id,
            class_id=data.class_id or None,
            stream_id=data.stream_id,
            course_id=data.course_id,
            course_version_id=actual_course_version_id,
            enrollment_date=joining_date,
            status="PROVISIONAL_TRIAL" if is_trial_admission else "ACTIVE",
            promotion_status="NOT_PROMOTED"
        )
        db.add(enrollment)
        await db.flush()

        # Resolve teaching batch: if batch_id provided, or resolve candidate batch
        assigned_batch_id = data.batch_id
        if not assigned_batch_id and data.course_id:
            target_course = await db.get(Course, data.course_id)
            if target_course and (target_course.duration_months > 12 or "combined" in target_course.name.lower()):
                # Multi-year combined program -> resolve to regular batch of entry standard/stream
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
                    batch_candidate = (
                        await db.execute(
                            select(Batch)
                            .where(Batch.course_id.in_(reg_c_ids), Batch.is_active == True)
                            .order_by(Batch.division.asc(), Batch.created_at.asc())
                        )
                    ).scalars().first()
                    if batch_candidate:
                        assigned_batch_id = batch_candidate.id
            else:
                batch_candidate = (
                    await db.execute(
                        select(Batch)
                        .where(Batch.course_id == data.course_id, Batch.is_active == True)
                        .order_by(Batch.division.asc(), Batch.created_at.asc())
                    )
                ).scalars().first()
                if batch_candidate:
                    assigned_batch_id = batch_candidate.id

        if assigned_batch_id:
            enrollment.batch_id = assigned_batch_id

        # Link Subjects
        all_subject_ids = set(data.selected_subject_ids or [])
        package_subject_ids = set()
        if actual_course_version_id:
            cver_s_stmt = select(CourseVersion).options(selectinload(CourseVersion.version_subjects)).where(CourseVersion.id == actual_course_version_id)
            cver_obj = (await db.execute(cver_s_stmt)).scalar_one_or_none()
            if cver_obj:
                for vs in cver_obj.version_subjects:
                    package_subject_ids.add(vs.subject_id)
                    all_subject_ids.add(vs.subject_id)

        if data.subject_group_id:
            sgrp_stmt = select(SubjectGroup).options(selectinload(SubjectGroup.items)).where(SubjectGroup.id == data.subject_group_id)
            sgrp = (await db.execute(sgrp_stmt)).scalar_one_or_none()
            if sgrp:
                for item in sgrp.items:
                    package_subject_ids.add(item.subject_id)
                    all_subject_ids.add(item.subject_id)

        for sid in all_subject_ids:
            is_pkg = sid in package_subject_ids
            subj = await db.get(Subject, sid)
            fee = Decimal("0.00") if is_pkg else (subj.default_individual_fee if subj else Decimal("0.00"))
            es = EnrollmentSubject(
                enrollment_id=enrollment.id,
                subject_id=sid,
                is_package_subject=is_pkg,
                individual_fee=fee,
                batch_id=assigned_batch_id
            )
            db.add(es)

        # Enroll student into teaching batch roster
        if assigned_batch_id:
            bs_check = await db.execute(
                select(BatchStudent).where(
                    BatchStudent.batch_id == assigned_batch_id,
                    BatchStudent.student_id == student.id
                )
            )
            if not bs_check.scalar_one_or_none():
                bs_record = BatchStudent(
                    batch_id=assigned_batch_id,
                    student_id=student.id,
                    status="ACTIVE"
                )
                db.add(bs_record)

    # 3. Facility Services: Hostel & Study Room
    seat_label = None
    if data.study_room_plan_id:
        srp = await db.get(ServicePlan, data.study_room_plan_id)
        if srp:
            sr_sub = StudentService(
                student_id=student.id,
                service_plan_id=srp.id,
                academic_year_id=data.academic_year_id,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=365),
                billing_frequency=srp.billing_frequency,
                unit_price=srp.base_amount,
                deposit_amount=srp.deposit_amount,
                status="ACTIVE"
            )
            db.add(sr_sub)
            await db.flush()

            # Allocate Study Seat if provided
            if data.study_seat_id:
                # Lock row with SELECT FOR UPDATE to prevent concurrency conflict
                seat_stmt = select(StudySeat).where(StudySeat.id == data.study_seat_id).with_for_update()
                seat = (await db.execute(seat_stmt)).scalar_one_or_none()
                if not seat or seat.status != "AVAILABLE":
                    raise ConflictException("Selected study room seat is no longer available")

                # Validate Gender constraint
                is_boy = student.gender in ("MALE", "BOY", "BOYS")
                is_girl = student.gender in ("FEMALE", "GIRL", "GIRLS")
                if seat.gender_allowed == "BOYS" and not is_boy:
                    raise BadRequestException(f"Seat {seat.seat_number} is reserved for BOYS")
                if seat.gender_allowed == "GIRLS" and not is_girl:
                    raise BadRequestException(f"Seat {seat.seat_number} is reserved for GIRLS")

                seat.status = "OCCUPIED"
                alloc = SeatAllocation(
                    study_seat_id=seat.id,
                    student_id=student.id,
                    student_service_id=sr_sub.id,
                    start_date=date.today(),
                    end_date=date.today() + timedelta(days=365),
                    status="ACTIVE",
                    allocated_by_user_id=current_user.id
                )
                db.add(alloc)
                seat_label = seat.seat_number

    bed_label = None
    if data.hostel_plan_id:
        hp = await db.get(ServicePlan, data.hostel_plan_id)
        if hp:
            h_sub = StudentService(
                student_id=student.id,
                service_plan_id=hp.id,
                academic_year_id=data.academic_year_id,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=365),
                billing_frequency=hp.billing_frequency,
                unit_price=hp.base_amount,
                deposit_amount=hp.deposit_amount,
                status="ACTIVE"
            )
            db.add(h_sub)
            await db.flush()

            if data.hostel_bed_id:
                bed_stmt = select(HostelBed).where(HostelBed.id == data.hostel_bed_id).with_for_update()
                bed = (await db.execute(bed_stmt)).scalar_one_or_none()
                if not bed or bed.status != "AVAILABLE":
                    raise ConflictException("Selected hostel bed is no longer available")

                bed.status = "OCCUPIED"
                h_alloc = BedAllocation(
                    hostel_bed_id=bed.id,
                    student_id=student.id,
                    student_service_id=h_sub.id,
                    start_date=date.today(),
                    end_date=date.today() + timedelta(days=365),
                    check_in_date=date.today(),
                    status="ACTIVE",
                    allocated_by_user_id=current_user.id,
                    deposit_amount=hp.deposit_amount
                )
                db.add(h_alloc)
                bed_label = bed.bed_number

    # 4. Pricing Calculation & Invoice Generation
    # Prepare inputs for PricingEngine
    base_fee = Decimal("0.00")
    one_time_fee = None
    installment_fee = None
    pkg_subjs = []
    actual_course_version_id = data.course_version_id
    if not actual_course_version_id and data.course_id:
        cv_cand = (
            await db.execute(
                select(CourseVersion).where(
                    CourseVersion.course_id == data.course_id,
                    CourseVersion.is_active == True
                )
            )
        ).scalars().first()
        if cv_cand:
            actual_course_version_id = cv_cand.id

    if actual_course_version_id:
        cver_stmt = (
            select(CourseVersion)
            .options(selectinload(CourseVersion.version_subjects))
            .where(CourseVersion.id == actual_course_version_id)
        )
        cver = (await db.execute(cver_stmt)).scalar_one_or_none()
        if cver:
            base_fee = cver.base_fee
            one_time_fee = cver.one_time_fee
            installment_fee = cver.installment_fee
            pkg_subjs.extend([str(vs.subject_id) for vs in cver.version_subjects])

    pkg_fee = None
    one_time_pkg_fee = None
    installment_pkg_fee = None
    if data.subject_group_id:
        sgrp_stmt = select(SubjectGroup).options(selectinload(SubjectGroup.items)).where(SubjectGroup.id == data.subject_group_id)
        sgrp = (await db.execute(sgrp_stmt)).scalar_one_or_none()
        if sgrp:
            pkg_fee = sgrp.package_fee
            one_time_pkg_fee = sgrp.one_time_package_fee
            installment_pkg_fee = sgrp.installment_package_fee
            pkg_subjs.extend([str(item.subject_id) for item in sgrp.items])

    subj_list = []
    if data.selected_subject_ids:
        for sid in data.selected_subject_ids:
            s = await db.get(Subject, sid)
            if s:
                subj_list.append({"id": str(s.id), "name": s.name, "fee": s.default_individual_fee})

    h_plan_dict = None
    if data.hostel_plan_id:
        hp = await db.get(ServicePlan, data.hostel_plan_id)
        if hp:
            h_plan_dict = {"name": hp.name, "base_amount": hp.base_amount, "deposit_amount": hp.deposit_amount}

    sr_plan_dict = None
    if data.study_room_plan_id:
        srp = await db.get(ServicePlan, data.study_room_plan_id)
        if srp:
            sr_plan_dict = {"name": srp.name, "base_amount": srp.base_amount, "deposit_amount": srp.deposit_amount}

    # If this is a Provisional Trial Admission, complete registration without tuition invoice
    if is_trial_admission:
        await db.commit()
        await cache_service.delete(CacheKeys.dashboard_metrics())
        await cache_service.delete(CacheKeys.student_profile(student.id))
        await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())

        return AdmissionConfirmationResponse(
            student_id=student.id,
            student_code=student.student_code,
            prn=student.prn,
            enrollment_id=enrollment.id if enrollment else None,
            enrollment_group_id=enrollment_group.id if enrollment_group else None,
            invoice_id=None,
            invoice_number=None,
            total_fee=institute.admission_form_fee if (institute and institute.enable_admission_form_fee) else Decimal("0.00"),
            seat_allocated=seat_label,
            bed_allocated=bed_label,
            is_trial=True,
            trial_end_date=student.trial_end_date,
            trial_receipt_number=student.trial_receipt_number,
            message=f"Student {student.first_name} {student.last_name} enrolled on PROVISIONAL TRIAL ({trial_days} days, valid until {student.trial_end_date}). Form fee receipt: {student.trial_receipt_number or 'N/A'}."
        )

    # Check permission if custom installment amounts are requested
    if data.custom_installments and any(ci.amount is not None for ci in data.custom_installments):
        if current_user.user_type not in ["SUPER_ADMIN", "ADMIN"]:
            raise ForbiddenException("Only administrators can customize installment split amounts. Staff can only adjust installment due dates.")

    form_fee_charge = institute.admission_form_fee if (institute and institute.enable_admission_form_fee and data.is_academic_enrolled) else Decimal("0.00")

    calc_result = PricingEngine.calculate_fees(
        base_course_fee=base_fee,
        one_time_course_fee=one_time_fee,
        installment_course_fee=installment_fee,
        package_group_fee=pkg_fee,
        one_time_package_fee=one_time_pkg_fee,
        installment_package_fee=installment_pkg_fee,
        package_subject_ids=pkg_subjs,
        selected_subjects=subj_list,
        hostel_plan=h_plan_dict,
        study_room_plan=sr_plan_dict,
        admission_fee=form_fee_charge,
        discount_amount=data.discount_amount,
        number_of_installments=data.number_of_installments,
        start_date=joining_date,
        custom_installments=data.custom_installments
    )

    # Generate Official Invoice
    inv_count = len((await db.execute(select(Invoice))).scalars().all()) + 1
    invoice_number = f"INV-2026-{inv_count:05d}"
    while (await db.execute(select(Invoice.id).where(Invoice.invoice_number == invoice_number))).scalar_one_or_none():
        inv_count += 1
        invoice_number = f"INV-2026-{inv_count:05d}"
    while (await db.execute(select(Invoice.id).where(Invoice.invoice_number == invoice_number))).scalar_one_or_none():
        inv_count += 1
        invoice_number = f"INV-2026-{inv_count:05d}"

    inv_status = "ISSUED"
    bal_amt = calc_result.total_amount
    paid_amt = Decimal("0.00")
    if calc_result.total_amount <= Decimal("0.00"):
        inv_status = "PAID"
        bal_amt = Decimal("0.00")

    invoice = Invoice(
        institute_id=current_user.institute_id,
        student_id=student.id,
        enrollment_id=enrollment.id if enrollment else None,
        invoice_number=invoice_number,
        issue_date=joining_date,
        due_date=joining_date + timedelta(days=15),
        subtotal=calc_result.subtotal,
        discount_amount=calc_result.total_discount,
        tax_amount=calc_result.tax_amount,
        total_amount=calc_result.total_amount,
        paid_amount=paid_amt,
        balance_amount=bal_amt,
        status=inv_status
    )
    db.add(invoice)
    await db.flush()

    for item in calc_result.items:
        ii = InvoiceItem(
            invoice_id=invoice.id,
            description=item.description,
            service_type_code=item.service_type,
            unit_price=item.unit_price,
            quantity=item.quantity,
            discount_amount=item.discount_amount,
            total_amount=item.total_amount
        )
        db.add(ii)

    # Installment Plan - only if balance payable > 0
    valid_installments = [inst for inst in calc_result.installments if inst.amount > Decimal("0.00")]
    if calc_result.total_amount > Decimal("0.00") and valid_installments:
        inst_plan = InstallmentPlan(
            invoice_id=invoice.id,
            number_of_installments=len(valid_installments),
            total_amount=calc_result.total_amount
        )
        db.add(inst_plan)
        await db.flush()

        for inst in valid_installments:
            installment = Installment(
                installment_plan_id=inst_plan.id,
                installment_number=inst.installment_number,
                due_date=inst.due_date,
                amount=inst.amount,
                paid_amount=Decimal("0.00"),
                status="PENDING"
            )
            db.add(installment)

    await db.commit()
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete(CacheKeys.student_profile(student.id))
    await cache_service.delete_pattern(CacheKeys.study_room_pattern())
    await cache_service.delete_pattern(CacheKeys.hostel_pattern())
    await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())

    # Trigger async welcome WhatsApp & Email notifications
    background_tasks.add_task(
        notification_dispatcher.dispatch_admission_welcome,
        student_id=student.id,
        enrollment_id=enrollment.id if enrollment else None
    )

    return AdmissionConfirmationResponse(
        student_id=student.id,
        student_code=student.student_code,
        prn=student.prn,
        enrollment_id=enrollment.id if enrollment else None,
        enrollment_group_id=enrollment_group.id if enrollment_group else None,
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        total_fee=calc_result.total_amount,
        seat_allocated=seat_label,
        bed_allocated=bed_label,
        message="Student admission completed successfully with all configured services"
    )


@router.post("/{enrollment_id}/convert-trial", response_model=AdmissionConfirmationResponse)
async def convert_trial_to_confirmed_admission(
    enrollment_id: uuid.UUID,
    data: TrialConversionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Enrollment)
        .options(
            selectinload(Enrollment.student),
            selectinload(Enrollment.enrolled_subjects),
            selectinload(Enrollment.course_version).selectinload(CourseVersion.course),
            selectinload(Enrollment.course_version).selectinload(CourseVersion.version_subjects)
        )
        .where(Enrollment.id == enrollment_id)
    )
    enrollment = (await db.execute(stmt)).scalar_one_or_none()
    if not enrollment:
        raise NotFoundException("Enrollment record not found")

    student = enrollment.student
    if not student:
        raise NotFoundException("Student not found")

    joining_date = data.joining_date or date.today()

    # Transition student and enrollment to ACTIVE
    student.status = "ACTIVE"
    student.trial_end_date = None
    enrollment.status = "ACTIVE"

    # Resolve course fees
    base_fee = Decimal("0.00")
    one_time_fee = None
    installment_fee = None
    pkg_fee = None
    one_time_pkg_fee = None
    installment_pkg_fee = None
    pkg_subjs = []
    if enrollment.course_version:
        base_fee = enrollment.course_version.base_fee
        one_time_fee = enrollment.course_version.one_time_fee
        installment_fee = enrollment.course_version.installment_fee
        if enrollment.course_version.version_subjects:
            pkg_subjs = [str(vs.subject_id) for vs in enrollment.course_version.version_subjects]

    subj_list = []
    if enrollment.enrolled_subjects:
        for es in enrollment.enrolled_subjects:
            s = await db.get(Subject, es.subject_id)
            if s:
                subj_list.append({"id": str(s.id), "name": s.name, "fee": es.individual_fee or s.default_individual_fee})

    # Note: admission_fee is 0.00 because form fee was ALREADY paid upfront during trial
    calc_result = PricingEngine.calculate_fees(
        base_course_fee=base_fee,
        one_time_course_fee=one_time_fee,
        installment_course_fee=installment_fee,
        package_group_fee=pkg_fee,
        one_time_package_fee=one_time_pkg_fee,
        installment_package_fee=installment_pkg_fee,
        package_subject_ids=pkg_subjs,
        selected_subjects=subj_list,
        hostel_plan=None,
        study_room_plan=None,
        admission_fee=Decimal("0.00"),
        discount_amount=data.discount_amount,
        number_of_installments=data.number_of_installments,
        start_date=joining_date,
        custom_installments=data.custom_installments
    )

    # Generate Official Invoice
    inv_count = len((await db.execute(select(Invoice))).scalars().all()) + 1
    invoice_number = f"INV-2026-{inv_count:05d}"
    while (await db.execute(select(Invoice.id).where(Invoice.invoice_number == invoice_number))).scalar_one_or_none():
        inv_count += 1
        invoice_number = f"INV-2026-{inv_count:05d}"

    inv_status = "ISSUED"
    bal_amt = calc_result.total_amount
    paid_amt = Decimal("0.00")
    if calc_result.total_amount <= Decimal("0.00"):
        inv_status = "PAID"
        bal_amt = Decimal("0.00")

    invoice = Invoice(
        institute_id=current_user.institute_id,
        student_id=student.id,
        enrollment_id=enrollment.id,
        invoice_number=invoice_number,
        issue_date=joining_date,
        due_date=joining_date + timedelta(days=15),
        subtotal=calc_result.subtotal,
        discount_amount=calc_result.total_discount,
        tax_amount=calc_result.tax_amount,
        total_amount=calc_result.total_amount,
        paid_amount=paid_amt,
        balance_amount=bal_amt,
        status=inv_status
    )
    db.add(invoice)
    await db.flush()

    for item in calc_result.items:
        ii = InvoiceItem(
            invoice_id=invoice.id,
            description=item.description,
            service_type_code=item.service_type,
            unit_price=item.unit_price,
            quantity=item.quantity,
            discount_amount=item.discount_amount,
            total_amount=item.total_amount
        )
        db.add(ii)

    valid_installments = [inst for inst in calc_result.installments if inst.amount > Decimal("0.00")]
    if calc_result.total_amount > Decimal("0.00") and valid_installments:
        inst_plan = InstallmentPlan(
            invoice_id=invoice.id,
            number_of_installments=len(valid_installments),
            total_amount=calc_result.total_amount
        )
        db.add(inst_plan)
        await db.flush()

        for inst in valid_installments:
            installment = Installment(
                installment_plan_id=inst_plan.id,
                installment_number=inst.installment_number,
                due_date=inst.due_date,
                amount=inst.amount,
                paid_amount=Decimal("0.00"),
                status="PENDING"
            )
            db.add(installment)

    await db.commit()
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete(CacheKeys.student_profile(student.id))

    # Trigger async welcome WhatsApp & Email notifications
    background_tasks.add_task(
        notification_dispatcher.dispatch_admission_welcome,
        student_id=student.id,
        enrollment_id=enrollment.id
    )

    return AdmissionConfirmationResponse(
        student_id=student.id,
        student_code=student.student_code,
        prn=student.prn,
        enrollment_id=enrollment.id,
        enrollment_group_id=enrollment.enrollment_group_id,
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        total_fee=calc_result.total_amount,
        seat_allocated=None,
        bed_allocated=None,
        message=f"Trial converted to permanent admission for {student.first_name} {student.last_name}. Invoice {invoice.invoice_number} issued."
    )


@router.post("/{enrollment_id}/close-trial")
async def close_trial_enrollment(
    enrollment_id: uuid.UUID,
    reason: Optional[str] = "Student discontinued after trial period",
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Enrollment).options(selectinload(Enrollment.student)).where(Enrollment.id == enrollment_id)
    enrollment = (await db.execute(stmt)).scalar_one_or_none()
    if not enrollment:
        raise NotFoundException("Enrollment not found")

    enrollment.status = "TRIAL_DROPOUT"
    enrollment.remarks = f"Trial closed: {reason}"
    if enrollment.student:
        enrollment.student.status = "TRIAL_DROPOUT"

    if enrollment.batch_id:
        bs_stmt = select(BatchStudent).where(
            and_(
                BatchStudent.student_id == enrollment.student_id,
                BatchStudent.batch_id == enrollment.batch_id
            )
        )
        bs = (await db.execute(bs_stmt)).scalar_one_or_none()
        if bs:
            bs.is_active = False

    await db.commit()
    if enrollment.student_id:
        await CacheInvalidator.invalidate_student(enrollment.student_id)
    await cache_service.delete(CacheKeys.dashboard_metrics())

    return {
        "status": "TRIAL_DROPOUT",
        "message": f"Trial enrollment closed for {enrollment.student.first_name} {enrollment.student.last_name}. Retained form fee, 0 financial debt."
    }


@router.post("/{enrollment_id}/promote")
async def promote_student(
    enrollment_id: uuid.UUID,
    data: PromotionRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    current_enr = await db.get(Enrollment, enrollment_id)
    if not current_enr:
        raise NotFoundException("Enrollment record not found")

    # Mark current enrollment completed
    current_enr.status = "COMPLETED"
    current_enr.promotion_status = "PROMOTED_TO_NEXT"

    # Create next year enrollment linked to same enrollment_group if any
    next_enr = Enrollment(
        enrollment_group_id=current_enr.enrollment_group_id,
        student_id=current_enr.student_id,
        academic_year_id=data.next_academic_year_id,
        class_id=data.next_class_id,
        stream_id=data.next_stream_id,
        course_id=data.next_course_id,
        course_version_id=data.next_course_version_id,
        enrollment_date=date.today(),
        status="ACTIVE",
        promotion_status="NOT_PROMOTED",
        remarks=f"Promoted from enrollment {current_enr.id}"
    )
    db.add(next_enr)
    await db.flush()

    # Link new subjects & resolve division continuity
    assigned_next_batch_id = data.next_batch_id
    if not assigned_next_batch_id:
        current_bs_stmt = (
            select(BatchStudent)
            .options(selectinload(BatchStudent.batch))
            .where(
                BatchStudent.student_id == current_enr.student_id,
                BatchStudent.status == "ACTIVE"
            )
            .order_by(BatchStudent.created_at.desc())
        )
        current_bs = (await db.execute(current_bs_stmt)).scalars().first()
        current_div = current_bs.batch.division if current_bs and current_bs.batch else "A"

        if data.next_course_id:
            next_batch_cand = (await db.execute(
                select(Batch).where(
                    Batch.course_id == data.next_course_id,
                    Batch.division == current_div,
                    Batch.is_active == True
                )
            )).scalars().first()
            if not next_batch_cand:
                next_batch_cand = (await db.execute(
                    select(Batch).where(
                        Batch.course_id == data.next_course_id,
                        Batch.is_active == True
                    ).order_by(Batch.created_at.asc())
                )).scalars().first()
            if next_batch_cand:
                assigned_next_batch_id = next_batch_cand.id

    for sid in data.subject_ids:
        s = await db.get(Subject, sid)
        es = EnrollmentSubject(
            enrollment_id=next_enr.id,
            subject_id=sid,
            is_package_subject=True,
            individual_fee=Decimal("0.00"),
            batch_id=assigned_next_batch_id
        )
        db.add(es)

    # Register student into BatchStudent for the new class
    if assigned_next_batch_id:
        next_enr.batch_id = assigned_next_batch_id
        bs_check = await db.execute(
            select(BatchStudent).where(
                BatchStudent.batch_id == assigned_next_batch_id,
                BatchStudent.student_id == current_enr.student_id
            )
        )
        if not bs_check.scalar_one_or_none():
            bs_record = BatchStudent(
                batch_id=assigned_next_batch_id,
                student_id=current_enr.student_id,
                status="ACTIVE"
            )
            db.add(bs_record)

    await db.commit()
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete(CacheKeys.student_profile(current_enr.student_id))
    await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())
    return {"message": "Student successfully promoted to next academic year", "next_enrollment_id": str(next_enr.id)}


@router.post("/add-skill-course", response_model=SkillEnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def enroll_existing_student_skill_course(
    data: MidSessionSkillEnrollmentRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Enrolls an existing registered student into a Skill / Universal Course mid-session.
    Issues a dedicated add-on invoice with independent receipting and optional installment schedules.
    """
    # 1. Validate student
    student = await db.get(Student, data.student_id)
    if not student:
        raise NotFoundException("Student not found")

    # 2. Validate course
    course_stmt = select(Course).where(Course.id == data.course_id)
    course = (await db.execute(course_stmt)).scalar_one_or_none()
    if not course:
        raise NotFoundException("Course not found")

    # 3. Detect active academic year
    ay_stmt = select(AcademicYear).where(AcademicYear.is_active == True)
    active_ay = (await db.execute(ay_stmt)).scalars().first()
    if not active_ay:
        ay_stmt = select(AcademicYear).order_by(AcademicYear.start_date.desc())
        active_ay = (await db.execute(ay_stmt)).scalars().first()
    if not active_ay:
        raise BadRequestException("No academic year configured in system")

    # 4. Resolve CourseVersion
    cver = None
    if data.course_version_id:
        cver = await db.get(CourseVersion, data.course_version_id)
    if not cver:
        cver_stmt = (
            select(CourseVersion)
            .options(selectinload(CourseVersion.version_subjects))
            .where(CourseVersion.course_id == course.id, CourseVersion.is_active == True)
        )
        cver = (await db.execute(cver_stmt)).scalars().first()
    if not cver:
        cver_stmt = (
            select(CourseVersion)
            .options(selectinload(CourseVersion.version_subjects))
            .where(CourseVersion.course_id == course.id)
        )
        cver = (await db.execute(cver_stmt)).scalars().first()

    # 5. Check if already actively enrolled in this course
    existing_enr_stmt = select(Enrollment).where(
        Enrollment.student_id == student.id,
        Enrollment.course_id == course.id,
        Enrollment.academic_year_id == active_ay.id,
        Enrollment.status == "ACTIVE"
    )
    existing_enr = (await db.execute(existing_enr_stmt)).scalars().first()
    if existing_enr:
        raise BadRequestException(f"Student is already enrolled in '{course.name}' for this academic year")

    # If merging into open invoice, validate the target invoice upfront
    target_inv = None
    if data.billing_mode == "MERGE_INTO_OPEN_INVOICE":
        if data.target_invoice_id:
            inv_stmt = (
                select(Invoice)
                .options(selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments))
                .where(Invoice.id == data.target_invoice_id, Invoice.student_id == student.id)
            )
            target_inv = (await db.execute(inv_stmt)).scalars().first()
        else:
            inv_stmt = (
                select(Invoice)
                .options(selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments))
                .where(
                    Invoice.student_id == student.id,
                    Invoice.status.in_(["ISSUED", "PARTIALLY_PAID"]),
                    Invoice.balance_amount > Decimal("0.00")
                )
                .order_by(Invoice.created_at.desc())
            )
            target_inv = (await db.execute(inv_stmt)).scalars().first()

        if not target_inv:
            raise BadRequestException("No active open invoice with pending balance found to merge into.")
        if target_inv.status == "PAID" or target_inv.balance_amount <= Decimal("0.00"):
            raise BadRequestException(f"Invoice {target_inv.invoice_number} is already fully paid and cannot be merged into.")

    # 6. Create new Enrollment
    remarks_str = f"Skill Course Add-on (Merged into {target_inv.invoice_number}): {course.name}" if target_inv else f"Skill Course Add-on: {course.name}"
    enrollment = Enrollment(
        student_id=student.id,
        academic_year_id=active_ay.id,
        class_id=course.class_id,  # None for Universal courses
        stream_id=course.stream_id,
        course_id=course.id,
        course_version_id=cver.id if cver else None,
        enrollment_date=date.today(),
        status="ACTIVE",
        promotion_status="NOT_PROMOTED",
        remarks=remarks_str
    )
    db.add(enrollment)
    await db.flush()

    # 7. Link subjects from course version
    if cver and cver.version_subjects:
        for vs in cver.version_subjects:
            es = EnrollmentSubject(
                enrollment_id=enrollment.id,
                subject_id=vs.subject_id,
                is_package_subject=True,
                individual_fee=Decimal("0.00"),
                batch_id=data.batch_id
            )
            db.add(es)

    # 8. Enroll into batch
    assigned_batch_id = data.batch_id
    if not assigned_batch_id:
        batch_cand = (
            await db.execute(
                select(Batch).where(Batch.course_id == course.id, Batch.is_active == True).order_by(Batch.created_at.asc())
            )
        ).scalars().first()
        if batch_cand:
            assigned_batch_id = batch_cand.id

    if assigned_batch_id:
        enrollment.batch_id = assigned_batch_id
        bs_check = await db.execute(
            select(BatchStudent).where(
                BatchStudent.batch_id == assigned_batch_id,
                BatchStudent.student_id == student.id
            )
        )
        if not bs_check.scalar_one_or_none():
            bs_record = BatchStudent(
                batch_id=assigned_batch_id,
                student_id=student.id,
                status="ACTIVE"
            )
            db.add(bs_record)

    # 9. Invoicing: Either MERGE into existing open invoice or issue a SEPARATE add-on invoice
    base_fee = cver.base_fee if cver else Decimal("0.00")
    one_time_fee = cver.one_time_fee if cver else None
    installment_fee = cver.installment_fee if cver else None
    discount_val = data.discount_amount or Decimal("0.00")

    if data.billing_mode == "MERGE_INTO_OPEN_INVOICE" and target_inv:
        net_skill_fee = max(Decimal("0.00"), base_fee - discount_val)

        # Append new line item to existing invoice
        ii = InvoiceItem(
            invoice_id=target_inv.id,
            description=f"Skill Course Add-on: {course.name}",
            service_type_code="TUITION",
            unit_price=base_fee,
            quantity=1,
            discount_amount=discount_val,
            total_amount=net_skill_fee
        )
        db.add(ii)

        # Update target invoice financial balances
        target_inv.subtotal += base_fee
        target_inv.discount_amount += discount_val
        target_inv.total_amount += net_skill_fee
        target_inv.balance_amount += net_skill_fee
        if target_inv.paid_amount > Decimal("0.00"):
            target_inv.status = "PARTIALLY_PAID"
        else:
            target_inv.status = "ISSUED"

        # Update installments across remaining pending installments
        updated_count = 0
        if target_inv.installment_plan:
            target_inv.installment_plan.total_amount += net_skill_fee
            pending_insts = [inst for inst in target_inv.installment_plan.installments if inst.status == "PENDING"]
            if not pending_insts:
                pending_insts = [inst for inst in target_inv.installment_plan.installments if inst.status == "PARTIALLY_PAID"]

            if pending_insts:
                pending_insts.sort(key=lambda x: x.installment_number)
                count = len(pending_insts)
                updated_count = count
                split_each = (net_skill_fee / Decimal(count)).quantize(Decimal("0.01"))
                allocated_so_far = Decimal("0.00")
                for idx, inst in enumerate(pending_insts):
                    if idx == count - 1:
                        addition = net_skill_fee - allocated_so_far
                    else:
                        addition = split_each
                        allocated_so_far += split_each
                    inst.amount += addition
            else:
                next_inst_num = max([inst.installment_number for inst in target_inv.installment_plan.installments], default=0) + 1
                new_inst = Installment(
                    installment_plan_id=target_inv.installment_plan.id,
                    installment_number=next_inst_num,
                    due_date=date.today() + timedelta(days=15),
                    amount=net_skill_fee,
                    paid_amount=Decimal("0.00"),
                    status="PENDING"
                )
                db.add(new_inst)
                target_inv.installment_plan.number_of_installments += 1
                updated_count = 1
        else:
            new_plan = InstallmentPlan(
                invoice_id=target_inv.id,
                number_of_installments=1,
                total_amount=target_inv.total_amount
            )
            db.add(new_plan)
            await db.flush()
            new_inst = Installment(
                installment_plan_id=new_plan.id,
                installment_number=1,
                due_date=date.today() + timedelta(days=15),
                amount=target_inv.balance_amount,
                paid_amount=Decimal("0.00"),
                status="PENDING"
            )
            db.add(new_inst)
            updated_count = 1

        await db.commit()
        await cache_service.delete(CacheKeys.dashboard_metrics())
        await cache_service.delete(CacheKeys.student_profile(student.id))
        await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())

        return SkillEnrollmentResponse(
            student_id=student.id,
            enrollment_id=enrollment.id,
            invoice_id=target_inv.id,
            invoice_number=target_inv.invoice_number,
            course_name=course.name,
            total_fee=net_skill_fee,
            billing_mode="MERGED",
            updated_installments_count=updated_count,
            message=f"Successfully enrolled {student.first_name} {student.last_name} in '{course.name}'. Fee of ₹{net_skill_fee:,.2f} was merged into invoice {target_inv.invoice_number} across {updated_count} installment(s)."
        )

    # Issue SEPARATE Add-on Invoice
    calc_result = PricingEngine.calculate_fees(
        base_course_fee=base_fee,
        one_time_course_fee=one_time_fee,
        installment_course_fee=installment_fee,
        package_group_fee=None,
        package_subject_ids=[],
        selected_subjects=[],
        hostel_plan=None,
        study_room_plan=None,
        discount_amount=data.discount_amount,
        number_of_installments=data.number_of_installments,
        start_date=date.today(),
        custom_installments=data.custom_installments
    )

    inv_count = len((await db.execute(select(Invoice))).scalars().all()) + 1
    invoice_number = f"INV-2026-{inv_count:05d}"
    while (await db.execute(select(Invoice.id).where(Invoice.invoice_number == invoice_number))).scalar_one_or_none():
        inv_count += 1
        invoice_number = f"INV-2026-{inv_count:05d}"
    inv_status = "ISSUED"
    bal_amt = calc_result.total_amount
    paid_amt = Decimal("0.00")
    if calc_result.total_amount <= Decimal("0.00"):
        inv_status = "PAID"
        bal_amt = Decimal("0.00")

    invoice = Invoice(
        institute_id=current_user.institute_id,
        student_id=student.id,
        enrollment_id=enrollment.id,
        invoice_number=invoice_number,
        issue_date=date.today(),
        due_date=date.today() + timedelta(days=15),
        subtotal=calc_result.subtotal,
        discount_amount=calc_result.total_discount,
        tax_amount=calc_result.tax_amount,
        total_amount=calc_result.total_amount,
        paid_amount=paid_amt,
        balance_amount=bal_amt,
        status=inv_status
    )
    db.add(invoice)
    await db.flush()

    for item in calc_result.items:
        ii = InvoiceItem(
            invoice_id=invoice.id,
            description=f"Skill Course: {course.name}",
            service_type_code=item.service_type,
            unit_price=item.unit_price,
            quantity=item.quantity,
            discount_amount=item.discount_amount,
            total_amount=item.total_amount
        )
        db.add(ii)

    valid_installments = [inst for inst in calc_result.installments if inst.amount > Decimal("0.00")]
    if calc_result.total_amount > Decimal("0.00") and valid_installments:
        inst_plan = InstallmentPlan(
            invoice_id=invoice.id,
            number_of_installments=len(valid_installments),
            total_amount=calc_result.total_amount
        )
        db.add(inst_plan)
        await db.flush()

        for inst in valid_installments:
            installment = Installment(
                installment_plan_id=inst_plan.id,
                installment_number=inst.installment_number,
                due_date=inst.due_date,
                amount=inst.amount,
                paid_amount=Decimal("0.00"),
                status="PENDING"
            )
            db.add(installment)

    await db.commit()
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete(CacheKeys.student_profile(student.id))

    # Trigger async welcome WhatsApp & Email notifications
    background_tasks.add_task(
        notification_dispatcher.dispatch_admission_welcome,
        student_id=student.id,
        enrollment_id=enrollment.id
    )
    await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())

    return SkillEnrollmentResponse(
        student_id=student.id,
        enrollment_id=enrollment.id,
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        course_name=course.name,
        total_fee=calc_result.total_amount,
        billing_mode="SEPARATE_INVOICE",
        updated_installments_count=len(valid_installments),
        message=f"Successfully enrolled {student.first_name} {student.last_name} in '{course.name}' with invoice {invoice.invoice_number}"
    )
