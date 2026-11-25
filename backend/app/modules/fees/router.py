import uuid
from typing import List, Optional
from datetime import date, datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status, BackgroundTasks, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException, BadRequestException, ConflictException, ForbiddenException
from app.core.cache import cache_service, CacheKeys, CacheInvalidator
from app.models.user import User
from app.models.institute import Institute
from app.models.academic import CourseVersion, Subject, SubjectGroup, SubjectGroupItem, Class, Course, Batch, BatchStudent
from app.models.service import ServicePlan
from app.models.student import Student, Guardian, StudentGuardian
from app.models.enrollment import Enrollment
from app.models.study_room import SeatAllocation, StudySeat
from app.models.hostel import BedAllocation, HostelBed
from app.models.fee import (
    Invoice, InvoiceItem, InstallmentPlan, Installment, Payment,
    PaymentAllocation, Receipt, Refund
)
from app.modules.notifications.service import notification_dispatcher
from app.modules.notifications.providers.meta_whatsapp import meta_whatsapp_client
from app.modules.notifications.templates import format_fee_reminder_whatsapp_text, build_whatsapp_click_url
from app.modules.fees.pricing_engine import PricingEngine, FeePreviewResult
from app.modules.fees.schemas import (
    FeePreviewRequest, InvoiceResponse, PaymentCreate, PaymentResponse,
    PaymentAllocationResponse, RefundCreate, RefundResponse,
    InstallmentRescheduleRequest, InstallmentResponse, PlanRestructureRequest,
    DetailedInvoiceResponse, DetailedInvoiceStudentInfo, InvoicePaymentHistoryItem,
    DetailedReceiptResponse, ReceiptAllocationItem
)
from app.modules.fees.utils import number_to_words_inr

router = APIRouter(prefix="/fees", tags=["Fees & Payments"])


@router.post("/preview", response_model=FeePreviewResult)
async def preview_fee(
    data: FeePreviewRequest,
    db: AsyncSession = Depends(get_db)
):
    base_fee = Decimal("0.00")
    one_time_fee = None
    installment_fee = None
    pkg_subjs = []
    if data.course_version_id:
        cver_stmt = (
            select(CourseVersion)
            .options(selectinload(CourseVersion.version_subjects))
            .where(CourseVersion.id == data.course_version_id)
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
        stmt = (
            select(SubjectGroup)
            .options(selectinload(SubjectGroup.items))
            .where(SubjectGroup.id == data.subject_group_id)
        )
        res = await db.execute(stmt)
        sgrp = res.scalar_one_or_none()
        if sgrp:
            pkg_fee = sgrp.package_fee
            one_time_pkg_fee = sgrp.one_time_package_fee
            installment_pkg_fee = sgrp.installment_package_fee
            pkg_subjs.extend([str(item.subject_id) for item in sgrp.items])

    # Resolve selected subjects
    subj_list = []
    if data.selected_subject_ids:
        for sid in data.selected_subject_ids:
            s = await db.get(Subject, sid)
            if s:
                subj_list.append({"id": str(s.id), "name": s.name, "fee": s.default_individual_fee})

    # Resolve hostel plan
    hostel_plan = None
    if data.hostel_plan_id:
        hp = await db.get(ServicePlan, data.hostel_plan_id)
        if hp:
            hostel_plan = {"name": hp.name, "base_amount": hp.base_amount, "deposit_amount": hp.deposit_amount}

    # Resolve study room plan
    sr_plan = None
    if data.study_room_plan_id:
        srp = await db.get(ServicePlan, data.study_room_plan_id)
        if srp:
            sr_plan = {"name": srp.name, "base_amount": srp.base_amount, "deposit_amount": srp.deposit_amount}

    # Check if one-time admission form fee applies for new learning course enrollments
    admission_fee = Decimal("0.00")
    if data.include_admission_fee:
        inst_stmt = select(Institute).where(Institute.is_active == True)
        institute = (await db.execute(inst_stmt)).scalars().first()
        if institute and institute.enable_admission_form_fee:
            admission_fee = institute.admission_form_fee

    return PricingEngine.calculate_fees(
        base_course_fee=base_fee,
        one_time_course_fee=one_time_fee,
        installment_course_fee=installment_fee,
        package_group_fee=pkg_fee,
        one_time_package_fee=one_time_pkg_fee,
        installment_package_fee=installment_pkg_fee,
        package_subject_ids=pkg_subjs,
        selected_subjects=subj_list,
        hostel_plan=hostel_plan,
        study_room_plan=sr_plan,
        admission_fee=admission_fee,
        discount_amount=data.discount_amount,
        number_of_installments=data.number_of_installments,
        start_date=data.admission_date or date.today(),
        custom_installments=data.custom_installments
    )


@router.get("/invoices", response_model=List[InvoiceResponse])
async def list_invoices(
    student_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    class_id: Optional[uuid.UUID] = None,
    batch_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.student),
            selectinload(Invoice.items),
            selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments),
            selectinload(Invoice.enrollment).selectinload(Enrollment.academic_class),
            selectinload(Invoice.enrollment).selectinload(Enrollment.batch),
            selectinload(Invoice.enrollment).selectinload(Enrollment.course)
        )
    )
    if student_id:
        stmt = stmt.where(Invoice.student_id == student_id)
    if status_filter and status_filter != "ALL":
        stmt = stmt.where(Invoice.status == status_filter)
    if class_id:
        stmt = stmt.where(
            or_(
                Invoice.enrollment.has(Enrollment.class_id == class_id),
                Invoice.student_id.in_(
                    select(Enrollment.student_id).where(Enrollment.class_id == class_id, Enrollment.status == "ACTIVE")
                )
            )
        )
    if batch_id:
        stmt = stmt.where(
            or_(
                Invoice.enrollment.has(Enrollment.batch_id == batch_id),
                Invoice.student_id.in_(
                    select(BatchStudent.student_id).where(BatchStudent.batch_id == batch_id, BatchStudent.status == "ACTIVE")
                )
            )
        )

    stmt = stmt.order_by(Invoice.created_at.desc())
    result = await db.execute(stmt)
    invoices = result.scalars().all()

    # Preload active batch student mappings to resolve batch_name if not directly on enrollment
    student_ids = [inv.student_id for inv in invoices if inv.student_id]
    batch_student_map = {}
    if student_ids:
        bs_stmt = (
            select(BatchStudent)
            .options(
                selectinload(BatchStudent.batch)
                .selectinload(Batch.course)
                .selectinload(Course.academic_class)
            )
            .where(BatchStudent.student_id.in_(student_ids), BatchStudent.status == "ACTIVE")
        )
        bs_res = await db.execute(bs_stmt)
        for bs in bs_res.scalars().all():
            if bs.student_id not in batch_student_map and bs.batch:
                batch_student_map[bs.student_id] = bs.batch

    output = []
    for inv in invoices:
        inst_list = []
        if inv.installment_plan and inv.installment_plan.installments:
            inst_list = sorted(inv.installment_plan.installments, key=lambda x: x.installment_number)
        stu_name = f"{inv.student.first_name} {inv.student.last_name}" if inv.student else None
        stu_prn = inv.student.prn if inv.student else None
        stu_code = inv.student.student_code if inv.student else None
        stu_mob = inv.student.mobile if inv.student else None

        c_id = None
        c_name = None
        b_id = None
        b_name = None
        crs_name = None

        if inv.enrollment:
            c_id = inv.enrollment.class_id
            c_name = inv.enrollment.academic_class.name if inv.enrollment.academic_class else None
            b_id = inv.enrollment.batch_id
            b_name = inv.enrollment.batch.name if inv.enrollment.batch else None
            crs_name = inv.enrollment.course.name if inv.enrollment.course else None

        if not b_id and inv.student_id in batch_student_map:
            assigned_batch = batch_student_map[inv.student_id]
            b_id = assigned_batch.id
            b_name = assigned_batch.name
            if not c_name and assigned_batch.course and assigned_batch.course.academic_class:
                c_id = assigned_batch.course.class_id
                c_name = assigned_batch.course.academic_class.name
            if not crs_name and assigned_batch.course:
                crs_name = assigned_batch.course.name

        output.append(
            InvoiceResponse(
                id=inv.id,
                student_id=inv.student_id,
                student_name=stu_name,
                student_prn=stu_prn,
                student_code=stu_code,
                student_mobile=stu_mob,
                class_id=c_id,
                class_name=c_name,
                batch_id=b_id,
                batch_name=b_name,
                course_name=crs_name,
                invoice_number=inv.invoice_number,
                issue_date=inv.issue_date,
                due_date=inv.due_date,
                subtotal=inv.subtotal,
                discount_amount=inv.discount_amount,
                tax_amount=inv.tax_amount,
                total_amount=inv.total_amount,
                paid_amount=inv.paid_amount,
                balance_amount=inv.balance_amount,
                status=inv.status,
                items=inv.items,
                installments=inst_list
            )
        )
    return output


@router.get("/invoices/{invoice_id}/detailed", response_model=DetailedInvoiceResponse)
async def get_detailed_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.user_type == "ADMIN":
        raise ForbiddenException("Admins do not have access to financial invoices or ledgers")
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.student),
            selectinload(Invoice.items),
            selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments)
        )
        .where(Invoice.id == invoice_id)
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise NotFoundException(f"Invoice {invoice_id} not found")

    student = inv.student
    if not student:
        raise NotFoundException("Student for invoice not found")

    # Fetch primary guardian
    guardian_stmt = (
        select(StudentGuardian)
        .options(selectinload(StudentGuardian.guardian))
        .where(StudentGuardian.student_id == student.id)
        .order_by(StudentGuardian.is_primary.desc())
    )
    sg = (await db.execute(guardian_stmt)).scalars().first()
    g_name = f"{sg.guardian.first_name} {sg.guardian.last_name}" if sg and sg.guardian else None
    g_rel = sg.guardian.relation if sg and sg.guardian else None
    g_mob = sg.guardian.mobile if sg and sg.guardian else None

    # Resolve linked invoice
    first_inv = inv

    # Fetch invoice-linked enrollment or active enrollment
    enr = None
    if first_inv and first_inv.enrollment_id:
        enr_stmt = (
            select(Enrollment)
            .options(selectinload(Enrollment.academic_class), selectinload(Enrollment.course))
            .where(Enrollment.id == first_inv.enrollment_id)
        )
        enr = (await db.execute(enr_stmt)).scalar_one_or_none()

    if not enr:
        enr_stmt = (
            select(Enrollment)
            .options(selectinload(Enrollment.academic_class), selectinload(Enrollment.course))
            .where(Enrollment.student_id == student.id, Enrollment.status == "ACTIVE")
            .order_by(Enrollment.class_id.desc().nullslast(), Enrollment.created_at.asc())
        )
        enr = (await db.execute(enr_stmt)).scalars().first()

    class_name = enr.academic_class.name if enr and enr.academic_class else ("Universal / All Grades" if (enr and enr.course and enr.course.is_universal) else None)
    course_name = enr.course.name if enr and enr.course else None

    # If the invoice has multiple course line items (e.g. regular course + skill course add-on)
    if first_inv and first_inv.items:
        skill_items = [it for it in first_inv.items if "Skill Course" in (it.description or "")]
        if skill_items and enr and enr.academic_class:
            skill_names = [it.description.split(":")[-1].strip() for it in skill_items]
            course_name = f"{course_name or enr.academic_class.name} (+ {', '.join(skill_names)})"

    # Fetch seat allocation if any
    seat_stmt = (
        select(SeatAllocation)
        .options(selectinload(SeatAllocation.study_seat))
        .where(SeatAllocation.student_id == student.id, SeatAllocation.status == "ACTIVE")
    )
    sa = (await db.execute(seat_stmt)).scalars().first()
    seat_num = sa.study_seat.seat_number if sa and sa.study_seat else None

    # Fetch bed allocation if any
    bed_stmt = (
        select(BedAllocation)
        .options(selectinload(BedAllocation.hostel_bed))
        .where(BedAllocation.student_id == student.id, BedAllocation.status == "ACTIVE")
    )
    ba = (await db.execute(bed_stmt)).scalars().first()
    bed_num = ba.hostel_bed.bed_number if ba and ba.hostel_bed else None

    # Fetch payment allocations for this invoice
    alloc_stmt = (
        select(PaymentAllocation)
        .options(selectinload(PaymentAllocation.payment).selectinload(Payment.receipt))
        .where(PaymentAllocation.invoice_id == invoice_id)
        .order_by(PaymentAllocation.created_at.desc())
    )
    allocs = (await db.execute(alloc_stmt)).scalars().all()
    payments_history = []
    for pa in allocs:
        if pa.payment:
            payments_history.append(
                InvoicePaymentHistoryItem(
                    payment_id=pa.payment.id,
                    payment_number=pa.payment.payment_number,
                    receipt_number=pa.payment.receipt.receipt_number if pa.payment.receipt else None,
                    payment_date=pa.payment.payment_date,
                    payment_method=pa.payment.payment_method,
                    transaction_reference=pa.payment.transaction_reference,
                    allocated_amount=pa.allocated_amount
                )
            )

    stu_info = DetailedInvoiceStudentInfo(
        id=student.id,
        first_name=student.first_name,
        middle_name=student.middle_name,
        last_name=student.last_name,
        prn=student.prn or student.student_code.replace("STU-", "PRN-"),
        student_code=student.student_code,
        date_of_birth=student.date_of_birth,
        gender=student.gender,
        blood_group=student.blood_group,
        mobile=student.mobile,
        email=student.email,
        village=student.village,
        taluka=student.taluka,
        district=student.district,
        address_line1=student.address_line1,
        address_line2=student.address_line2,
        city=student.city,
        state=student.state,
        pincode=student.pincode,
        institution_type=student.institution_type,
        school_college_name=student.school_college_name,
        education_board=student.education_board,
        previous_percentage=float(student.previous_percentage) if student.previous_percentage is not None else None,
        category=student.category,
        guardian_name=g_name,
        guardian_relation=g_rel,
        guardian_mobile=g_mob
    )

    inst_list = sorted(inv.installment_plan.installments, key=lambda x: x.installment_number) if inv.installment_plan and inv.installment_plan.installments else []

    return DetailedInvoiceResponse(
        id=inv.id,
        invoice_number=inv.invoice_number,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        subtotal=inv.subtotal,
        discount_amount=inv.discount_amount,
        tax_amount=inv.tax_amount,
        total_amount=inv.total_amount,
        paid_amount=inv.paid_amount,
        balance_amount=inv.balance_amount,
        status=inv.status,
        student=stu_info,
        class_name=class_name,
        course_name=course_name,
        study_seat_number=seat_num,
        hostel_bed_number=bed_num,
        items=inv.items,
        installments=inst_list,
        payments=payments_history
    )


@router.get("/payments/{payment_id}/receipt", response_model=DetailedReceiptResponse)
async def get_detailed_receipt(
    payment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.user_type == "ADMIN":
        raise ForbiddenException("Admins do not have access to financial payment receipts")
    stmt = (
        select(Payment)
        .options(
            selectinload(Payment.student),
            selectinload(Payment.receipt),
            selectinload(Payment.allocations).selectinload(PaymentAllocation.invoice).selectinload(Invoice.items),
            selectinload(Payment.allocations).selectinload(PaymentAllocation.installment)
        )
        .where(Payment.id == payment_id)
    )
    payment = (await db.execute(stmt)).scalar_one_or_none()
    if not payment:
        raise NotFoundException(f"Payment record {payment_id} not found")

    student = payment.student
    if not student:
        raise NotFoundException("Student for payment not found")

    # Fetch primary guardian
    guardian_stmt = (
        select(StudentGuardian)
        .options(selectinload(StudentGuardian.guardian))
        .where(StudentGuardian.student_id == student.id)
        .order_by(StudentGuardian.is_primary.desc())
    )
    sg = (await db.execute(guardian_stmt)).scalars().first()
    g_name = f"{sg.guardian.first_name} {sg.guardian.last_name}" if sg and sg.guardian else None
    g_rel = sg.guardian.relation if sg and sg.guardian else None
    g_mob = sg.guardian.mobile if sg and sg.guardian else None

    # Resolve first linked invoice from payment allocations
    first_inv = payment.allocations[0].invoice if payment.allocations and payment.allocations[0].invoice else None

    # Fetch invoice-linked enrollment or active enrollment
    enr = None
    if first_inv and first_inv.enrollment_id:
        enr_stmt = (
            select(Enrollment)
            .options(selectinload(Enrollment.academic_class), selectinload(Enrollment.course))
            .where(Enrollment.id == first_inv.enrollment_id)
        )
        enr = (await db.execute(enr_stmt)).scalar_one_or_none()

    if not enr:
        enr_stmt = (
            select(Enrollment)
            .options(selectinload(Enrollment.academic_class), selectinload(Enrollment.course))
            .where(Enrollment.student_id == student.id, Enrollment.status == "ACTIVE")
            .order_by(Enrollment.class_id.desc().nullslast(), Enrollment.created_at.asc())
        )
        enr = (await db.execute(enr_stmt)).scalars().first()

    class_name = enr.academic_class.name if enr and enr.academic_class else ("Universal / All Grades" if (enr and enr.course and enr.course.is_universal) else None)
    course_name = enr.course.name if enr and enr.course else None

    # If the invoice has multiple course line items (e.g. regular course + skill course add-on)
    if first_inv and first_inv.items:
        skill_items = [it for it in first_inv.items if "Skill Course" in (it.description or "")]
        if skill_items and enr and enr.academic_class:
            skill_names = [it.description.split(":")[-1].strip() for it in skill_items]
            course_name = f"{course_name or enr.academic_class.name} (+ {', '.join(skill_names)})"

    stu_info = DetailedInvoiceStudentInfo(
        id=student.id,
        first_name=student.first_name,
        middle_name=student.middle_name,
        last_name=student.last_name,
        prn=student.prn or student.student_code.replace("STU-", "PRN-"),
        student_code=student.student_code,
        date_of_birth=student.date_of_birth,
        gender=student.gender,
        blood_group=student.blood_group,
        mobile=student.mobile,
        email=student.email,
        village=student.village,
        taluka=student.taluka,
        district=student.district,
        address_line1=student.address_line1,
        address_line2=student.address_line2,
        city=student.city,
        state=student.state,
        pincode=student.pincode,
        institution_type=student.institution_type,
        school_college_name=student.school_college_name,
        education_board=student.education_board,
        previous_percentage=float(student.previous_percentage) if student.previous_percentage is not None else None,
        category=student.category,
        guardian_name=g_name,
        guardian_relation=g_rel,
        guardian_mobile=g_mob
    )

    alloc_items = []
    for a in payment.allocations:
        inv = a.invoice
        inst = a.installment
        alloc_items.append(
            ReceiptAllocationItem(
                invoice_id=a.invoice_id,
                invoice_number=inv.invoice_number if inv else "INV-UNKNOWN",
                installment_id=a.installment_id,
                installment_number=inst.installment_number if inst else None,
                allocated_amount=a.allocated_amount,
                invoice_total=inv.total_amount if inv else Decimal("0.00"),
                invoice_balance=inv.balance_amount if inv else Decimal("0.00")
            )
        )

    # Compute overall remaining balance across student's invoices
    total_balance_stmt = (
        select(func.coalesce(func.sum(Invoice.balance_amount), Decimal("0.00")))
        .where(Invoice.student_id == student.id)
    )
    student_total_balance = (await db.execute(total_balance_stmt)).scalar() or Decimal("0.00")

    receipt_num = payment.receipt.receipt_number if payment.receipt else payment.payment_number.replace("PAY-", "RCP-")

    return DetailedReceiptResponse(
        payment_id=payment.id,
        payment_number=payment.payment_number,
        receipt_number=receipt_num,
        payment_date=payment.payment_date,
        amount=payment.amount,
        amount_in_words=number_to_words_inr(payment.amount),
        payment_method=payment.payment_method,
        transaction_reference=payment.transaction_reference,
        notes=payment.notes,
        status=payment.status,
        student=stu_info,
        class_name=class_name,
        course_name=course_name,
        allocations=alloc_items,
        total_student_balance=student_total_balance
    )


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    data: PaymentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    # Idempotency check on transaction reference
    if data.transaction_reference:
        stmt = select(Payment).where(Payment.transaction_reference == data.transaction_reference)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            raise ConflictException(f"Payment with reference {data.transaction_reference} already processed")

    # Generate sequential payment number
    count_stmt = select(Payment)
    pay_count = len((await db.execute(count_stmt)).scalars().all()) + 1
    pay_number = f"PAY-2026-{pay_count:05d}"
    receipt_num = f"RCP-2026-{pay_count:05d}"
    while (await db.execute(select(Payment.id).where(Payment.payment_number == pay_number))).scalar_one_or_none():
        pay_count += 1
        pay_number = f"PAY-2026-{pay_count:05d}"
        receipt_num = f"RCP-2026-{pay_count:05d}"

    payment = Payment(
        institute_id=current_user.institute_id,
        student_id=data.student_id,
        payment_number=pay_number,
        payment_date=date.today(),
        amount=data.amount,
        payment_method=data.payment_method,
        transaction_reference=data.transaction_reference,
        gateway_payment_id=data.gateway_payment_id,
        notes=data.notes,
        status="SUCCESS",
        collected_by_user_id=current_user.id
    )
    db.add(payment)
    await db.flush()

    # Process allocations atomically
    total_allocated = Decimal("0.00")
    allocations_out = []

    for alloc in data.allocations:
        total_allocated += alloc.allocated_amount
        pa = PaymentAllocation(
            payment_id=payment.id,
            invoice_id=alloc.invoice_id,
            installment_id=alloc.installment_id,
            allocated_amount=alloc.allocated_amount
        )
        db.add(pa)
        allocations_out.append(pa)

        # Update invoice balance
        inv = await db.get(Invoice, alloc.invoice_id)
        if inv:
            if alloc.allocated_amount > inv.balance_amount:
                raise BadRequestException(
                    f"Allocated amount ({alloc.allocated_amount}) exceeds outstanding invoice balance ({inv.balance_amount})"
                )
            inv.paid_amount += alloc.allocated_amount
            inv.balance_amount = max(Decimal("0.00"), inv.total_amount - inv.paid_amount)
            if inv.balance_amount == Decimal("0.00"):
                inv.status = "PAID"
            elif inv.paid_amount > Decimal("0.00"):
                inv.status = "PARTIALLY_PAID"

        # Update installment if applicable
        if alloc.installment_id:
            inst = await db.get(Installment, alloc.installment_id)
            if inst:
                inst.paid_amount += alloc.allocated_amount
                if inst.paid_amount >= inst.amount:
                    inst.status = "PAID"
                elif inst.paid_amount > Decimal("0.00"):
                    inst.status = "PARTIALLY_PAID"

    if total_allocated > data.amount:
        raise BadRequestException(f"Allocated total ({total_allocated}) exceeds received payment amount ({data.amount})")

    # Generate Official Receipt
    rcp = Receipt(
        payment_id=payment.id,
        receipt_number=receipt_num
    )
    db.add(rcp)

    await db.commit()
    await db.refresh(payment)
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete(CacheKeys.student_profile(payment.student_id))

    # Trigger async payment receipt via WhatsApp & Email
    background_tasks.add_task(
        notification_dispatcher.dispatch_payment_receipt,
        payment_id=payment.id
    )

    return PaymentResponse(
        id=payment.id,
        student_id=payment.student_id,
        payment_number=payment.payment_number,
        payment_date=payment.payment_date,
        amount=payment.amount,
        payment_method=payment.payment_method,
        transaction_reference=payment.transaction_reference,
        status=payment.status,
        receipt_number=receipt_num,
        allocations=allocations_out
    )


@router.post("/refunds", response_model=RefundResponse, status_code=status.HTTP_201_CREATED)
async def process_refund(
    data: RefundCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    payment = await db.get(Payment, data.payment_id)
    if not payment:
        raise NotFoundException("Payment record not found")

    count_stmt = select(Refund)
    ref_count = len((await db.execute(count_stmt)).scalars().all()) + 1
    ref_number = f"REF-2026-{ref_count:05d}"

    refund = Refund(
        payment_id=data.payment_id,
        invoice_id=data.invoice_id,
        refund_number=ref_number,
        amount=data.amount,
        reason=data.reason,
        approved_by_user_id=current_user.id,
        status="COMPLETED",
        refund_date=date.today()
    )
    db.add(refund)
    await db.commit()
    await db.refresh(refund)
    await cache_service.delete(CacheKeys.dashboard_metrics())
    await cache_service.delete(CacheKeys.student_profile(payment.student_id))

    return refund


@router.patch("/installments/{installment_id}/reschedule", response_model=InstallmentResponse)
async def reschedule_installment(
    installment_id: uuid.UUID,
    data: InstallmentRescheduleRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Installment)
        .options(selectinload(Installment.installment_plan).selectinload(InstallmentPlan.invoice))
        .where(Installment.id == installment_id)
    )
    inst = (await db.execute(stmt)).scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")

    if inst.status == "PAID":
        raise BadRequestException("Cannot reschedule a fully paid installment")

    if data.new_due_date < date.today():
        raise BadRequestException("New due date cannot be in the past")

    inst.due_date = data.new_due_date
    if inst.status == "OVERDUE" and inst.due_date >= date.today():
        inst.status = "PARTIALLY_PAID" if inst.paid_amount > Decimal("0.00") else "PENDING"

    await db.commit()
    await db.refresh(inst)

    # Invalidate student profile cache and dashboard metrics
    student_id = inst.installment_plan.invoice.student_id if (inst.installment_plan and inst.installment_plan.invoice) else None
    if student_id:
        await CacheInvalidator.invalidate_student(student_id)
    else:
        await cache_service.delete(CacheKeys.dashboard_metrics())

    return inst


@router.post("/invoices/{invoice_id}/restructure", response_model=DetailedInvoiceResponse)
async def restructure_invoice_plan(
    invoice_id: uuid.UUID,
    data: PlanRestructureRequest,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Restructures the unpaid installment schedule of an existing active invoice.
    Safeguards:
    1. Already paid installments (paid_amount > 0) are strictly locked and preserved.
    2. The sum of new installments must exactly equal the remaining unpaid balance.
    3. Due dates must be in chronological order.
    4. Audits the restructure timestamp, reason, and admin user.
    """
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments),
            selectinload(Invoice.payment_allocations),
            selectinload(Invoice.items),
            selectinload(Invoice.student)
        )
        .where(Invoice.id == invoice_id)
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise NotFoundException("Invoice not found")

    plan = inv.installment_plan
    if not plan:
        raise BadRequestException("Invoice does not have an installment plan to restructure")

    # Group existing installments into paid vs unpaid
    paid_installments = [i for i in plan.installments if i.paid_amount > Decimal("0.00") or i.status == "PAID"]
    total_paid = sum((i.paid_amount for i in paid_installments), Decimal("0.00"))
    remaining_balance = inv.total_amount - total_paid

    if remaining_balance <= Decimal("0.00"):
        raise BadRequestException("Invoice is already fully paid. Cannot restructure payment plan.")

    if not data.installments or len(data.installments) == 0:
        raise BadRequestException("At least one installment must be provided for the remaining balance")

    # Validate sum of new installments
    new_sum = sum((Decimal(str(item.amount)) for item in data.installments), Decimal("0.00"))
    if abs(new_sum - remaining_balance) > Decimal("0.01"):
        raise BadRequestException(
            f"Sum of new installments (₹{new_sum:,.2f}) must exactly equal remaining balance (₹{remaining_balance:,.2f})"
        )

    # Validate chronological dates
    for idx, item in enumerate(data.installments):
        if idx > 0 and item.due_date < data.installments[idx - 1].due_date:
            raise BadRequestException(
                f"Installment dates must be in chronological order. Installment #{item.installment_number} is earlier than previous installment."
            )

    # Remove only unpaid installments
    for inst in list(plan.installments):
        if inst.paid_amount == Decimal("0.00") and inst.status != "PAID":
            await db.delete(inst)
    await db.flush()

    # Insert new installments continuing from the next sequence number
    new_inst_list = list(paid_installments)
    start_num = len(paid_installments) + 1
    for offset, item in enumerate(data.installments):
        new_inst = Installment(
            installment_plan_id=plan.id,
            installment_number=start_num + offset,
            due_date=item.due_date,
            amount=item.amount,
            paid_amount=Decimal("0.00"),
            status="OVERDUE" if item.due_date < date.today() else "PENDING"
        )
        db.add(new_inst)
        new_inst_list.append(new_inst)

    plan.installments = new_inst_list
    plan.number_of_installments = len(new_inst_list)
    plan.is_restructured = True
    plan.restructure_reason = data.reason
    plan.restructured_at = datetime.now(timezone.utc)
    plan.restructured_by_user_id = current_user.id

    await db.commit()
    if inv.student_id:
        await CacheInvalidator.invalidate_student(inv.student_id)
    await cache_service.delete(CacheKeys.dashboard_metrics())

    return await get_detailed_invoice(inv.id, db)


# =============================================================================
# FEE REMINDERS (MANUAL & AUTOMATED CRON)
# =============================================================================

def _build_fee_reminder_whatsapp_info(inv: Invoice, installment_id: Optional[uuid.UUID] = None):
    stu = inv.student
    student_name = f"{stu.first_name} {stu.last_name}".strip() if stu else "Student"
    parent_name, parent_phone, parent_email = notification_dispatcher._resolve_contact(stu) if stu else ("Parent / Guardian", None, None)
    course_name = inv.enrollment.course.name if (inv.enrollment and inv.enrollment.course) else "Academic Course"

    target_inst = None
    installments = inv.installment_plan.installments if getattr(inv, "installment_plan", None) else []
    if installment_id:
        target_inst = next((i for i in installments if i.id == installment_id), None)
    if not target_inst:
        unpaid = [i for i in installments if i.status != "PAID"]
        target_inst = unpaid[0] if unpaid else (installments[0] if installments else None)

    inst_num = target_inst.installment_number if target_inst else 1
    unpaid_amount = float(target_inst.amount - (target_inst.paid_amount or 0)) if target_inst else float(inv.balance_amount)
    due_date_str = str(target_inst.due_date) if target_inst else str(inv.due_date)
    is_overdue = (target_inst.due_date < date.today()) if target_inst else (inv.due_date < date.today())

    wa_text = format_fee_reminder_whatsapp_text(
        parent_name=parent_name,
        installment_number=inst_num,
        amount=unpaid_amount,
        student_name=student_name,
        due_date=due_date_str,
        invoice_number=inv.invoice_number,
        course_name=course_name,
        is_overdue=is_overdue
    )
    wa_url = build_whatsapp_click_url(parent_phone, wa_text) if parent_phone else ""

    return {
        "parent_name": parent_name,
        "parent_phone": parent_phone,
        "parent_email": parent_email,
        "installment_number": inst_num,
        "amount": unpaid_amount,
        "due_date": due_date_str,
        "is_overdue": is_overdue,
        "whatsapp_message": wa_text,
        "whatsapp_url": wa_url,
        "whatsapp_configured": meta_whatsapp_client.enabled
    }


@router.post("/invoices/{invoice_id}/remind")
async def send_invoice_fee_reminder(
    invoice_id: uuid.UUID,
    installment_id: Optional[uuid.UUID] = Query(None, description="Optional specific installment ID to remind for"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually triggers fee reminder dispatch to parent and student via WhatsApp & Email.
    Returns direct WhatsApp click-to-chat URL for instant delivery.
    """
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.student)
            .selectinload(Student.guardians)
            .selectinload(StudentGuardian.guardian),
            selectinload(Invoice.enrollment).selectinload(Enrollment.course),
            selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments)
        )
        .where(Invoice.id == invoice_id)
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise NotFoundException(f"Invoice {invoice_id} not found")

    wa_info = _build_fee_reminder_whatsapp_info(inv, installment_id)

    background_tasks.add_task(
        notification_dispatcher.dispatch_fee_reminder,
        invoice_id=invoice_id,
        installment_id=installment_id
    )

    msg = f"Due reminder for Installment #{wa_info['installment_number']} scheduled via Email."
    if meta_whatsapp_client.enabled:
        msg += " Automated Meta WhatsApp message dispatched."
    else:
        msg += " Click WhatsApp to open chat directly with parent."

    return {
        "success": True,
        "message": msg,
        **wa_info
    }


@router.post("/installments/{installment_id}/remind")
async def send_installment_fee_reminder(
    installment_id: uuid.UUID,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually triggers fee reminder for a specific installment to parent and student via WhatsApp & Email.
    Returns direct WhatsApp click-to-chat URL for instant delivery.
    """
    inst = await db.get(Installment, installment_id)
    if not inst:
        raise NotFoundException(f"Installment {installment_id} not found")

    plan = await db.get(InstallmentPlan, inst.installment_plan_id)
    if not plan or not plan.invoice_id:
        raise NotFoundException("Associated invoice not found for this installment")

    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.student)
            .selectinload(Student.guardians)
            .selectinload(StudentGuardian.guardian),
            selectinload(Invoice.enrollment).selectinload(Enrollment.course),
            selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments)
        )
        .where(Invoice.id == plan.invoice_id)
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise NotFoundException(f"Invoice {plan.invoice_id} not found")

    wa_info = _build_fee_reminder_whatsapp_info(inv, installment_id)

    background_tasks.add_task(
        notification_dispatcher.dispatch_fee_reminder,
        invoice_id=plan.invoice_id,
        installment_id=installment_id
    )

    msg = f"Fee reminder for Installment #{inst.installment_number} scheduled via Email."
    if meta_whatsapp_client.enabled:
        msg += " Automated Meta WhatsApp message dispatched."
    else:
        msg += " Click WhatsApp to open chat directly with parent."

    return {
        "success": True,
        "message": msg,
        **wa_info
    }


@router.get("/invoices/{invoice_id}/whatsapp-url")
async def get_invoice_whatsapp_url(
    invoice_id: uuid.UUID,
    installment_id: Optional[uuid.UUID] = Query(None, description="Optional specific installment ID"),
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns pre-formatted WhatsApp deep link and text message for instant direct sending.
    """
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.student)
            .selectinload(Student.guardians)
            .selectinload(StudentGuardian.guardian),
            selectinload(Invoice.enrollment).selectinload(Enrollment.course),
            selectinload(Invoice.installment_plan).selectinload(InstallmentPlan.installments)
        )
        .where(Invoice.id == invoice_id)
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise NotFoundException(f"Invoice {invoice_id} not found")

    return _build_fee_reminder_whatsapp_info(inv, installment_id)



@router.api_route("/reminders/process-due", methods=["GET", "POST"])
async def process_due_fee_reminders(
    days_ahead: int = Query(3, description="Days before due date to trigger reminder (default 3)"),
    include_overdue: bool = Query(True, description="Whether to include overdue unpaid installments"),
    force: bool = Query(False, description="Force send even if already reminded today"),
    cron_key: Optional[str] = Query(None, description="Secret cron key for automated schedulers"),
    x_cron_key: Optional[str] = Header(None, alias="X-Cron-Key", description="Secret cron header for automated schedulers"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Automated background processor for fee installment due reminders.
    Scans for upcoming (e.g. 3 days before due date) and overdue installments,
    dispatching reminders via WhatsApp and Email.
    Accessible by:
    1. cron-job.org with ?cron_key=... or X-Cron-Key header
    2. Authenticated staff with Bearer JWT
    """
    authorized = False
    valid_keys = {settings.SECRET_KEY}
    if hasattr(settings, "CRON_SECRET") and settings.CRON_SECRET:
        valid_keys.add(settings.CRON_SECRET)

    if (cron_key and cron_key in valid_keys) or (x_cron_key and x_cron_key in valid_keys):
        authorized = True
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            from app.core.security import decode_token
            payload = decode_token(token)
            if payload and payload.get("sub"):
                authorized = True
        except Exception:
            pass

    if not authorized:
        raise BadRequestException("Unauthorized cron trigger: Invalid cron key or missing authorization")

    result = await notification_dispatcher.scan_and_dispatch_due_fee_reminders(
        days_ahead=days_ahead,
        include_overdue=include_overdue,
        force=force
    )
    return result
