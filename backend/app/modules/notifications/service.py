"""
Notification Dispatcher Service for Yashodeep Coaching Classes ERP.
Handles asynchronous preparation, persistence into NotificationOutbox, and dispatch
across Meta WhatsApp and Brevo Transactional Email channels.
"""
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
from sqlalchemy import select, cast, String
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.notification import NotificationOutbox, Notification
from app.models.student import Student, StudentGuardian, Guardian
from app.models.academic import BatchSubject, Batch, Subject, Class, Course
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.fee import Payment, PaymentAllocation, Invoice, InstallmentPlan, Installment, Receipt
from app.models.examination import Examination, ExamResult, ExamSubject
from app.models.enrollment import Enrollment
from app.models.hostel import BedAllocation, HostelBed, HostelRoom, HostelFloor, HostelBuilding
from app.models.study_room import SeatAllocation, StudySeat, StudyRoom
from app.models.service import StudentService, ServicePlan

from app.modules.notifications.providers.meta_whatsapp import meta_whatsapp_client
from app.modules.notifications.providers.brevo_email import brevo_email_client
from app.modules.notifications.templates import (
    format_attendance_absent_whatsapp,
    format_attendance_absent_email,
    format_payment_receipt_whatsapp,
    format_payment_receipt_email,
    format_fee_reminder_whatsapp,
    format_fee_reminder_email,
    format_exam_result_whatsapp,
    format_exam_result_email,
    format_admission_welcome_whatsapp,
    format_promotion_confirmation_whatsapp,
    format_promotion_confirmation_email,
    format_facility_allocation_email,
    format_facility_expiring_whatsapp,
    format_facility_expiring_whatsapp_text,
    format_facility_expiring_email,
    format_facility_expired_whatsapp,
    format_facility_expired_whatsapp_text,
    format_facility_expired_email,
    wrap_html_email
)

logger = logging.getLogger(__name__)


class NotificationDispatcher:
    """
    Unified Orchestrator for sending multi-channel notifications (WhatsApp & Email).
    Designed to run seamlessly inside FastAPI BackgroundTasks with independent DB sessions.
    """

    async def _log_outbox(
        self,
        db,
        event_type: str,
        recipient_target: str,
        channel: str,
        payload: Dict[str, Any]
    ) -> NotificationOutbox:
        """Creates an initial PENDING record in the notification_outbox table."""
        outbox_entry = NotificationOutbox(
            id=uuid.uuid4(),
            event_type=event_type,
            recipient_target=recipient_target,
            channel=channel,
            payload=payload,
            status="PENDING",
            retry_count=0,
            last_attempted_at=datetime.now(timezone.utc)
        )
        db.add(outbox_entry)
        await db.commit()
        await db.refresh(outbox_entry)
        return outbox_entry

    async def _update_outbox_result(
        self,
        db,
        outbox_id: uuid.UUID,
        status: str,
        error_message: Optional[str] = None
    ):
        """Updates outbox status upon successful dispatch or failure."""
        res = await db.execute(select(NotificationOutbox).where(NotificationOutbox.id == outbox_id))
        entry = res.scalar_one_or_none()
        if entry:
            entry.status = status
            entry.last_attempted_at = datetime.now(timezone.utc)
            if error_message:
                entry.error_message = str(error_message)[:1000]
            await db.commit()

    def _resolve_contact(self, stu: Student):
        """
        Safely extracts parent/guardian contact info from Student and associated Guardian(s).
        Handles StudentGuardian junction model safely without throwing AttributeError.
        """
        guardians = getattr(stu, "guardians", []) or []
        sg = next((g for g in guardians if getattr(g, "receives_notifications", False)), None)
        if not sg:
            sg = next((g for g in guardians if getattr(g, "is_primary", False)), None)
        if not sg and guardians:
            sg = guardians[0]

        guardian_obj = getattr(sg, "guardian", None) if sg else None

        parent_name = "Parent / Guardian"
        parent_phone = None
        parent_email = None

        if guardian_obj:
            fname = getattr(guardian_obj, "first_name", "") or ""
            lname = getattr(guardian_obj, "last_name", "") or ""
            full = f"{fname} {lname}".strip()
            if full:
                parent_name = full
            parent_phone = getattr(guardian_obj, "mobile", None)
            parent_email = getattr(guardian_obj, "email", None)
        elif sg and hasattr(sg, "mobile"):
            fname = getattr(sg, "first_name", "") or ""
            lname = getattr(sg, "last_name", "") or ""
            full = f"{fname} {lname}".strip()
            if full:
                parent_name = full
            parent_phone = getattr(sg, "mobile", None)
            parent_email = getattr(sg, "email", None)

        # Fallbacks to student details if guardian values are absent
        if not parent_phone:
            parent_phone = getattr(stu, "mobile", None)
        if not parent_email:
            parent_email = getattr(stu, "email", None)
        if parent_name == "Parent / Guardian" and stu:
            stu_name = f"{getattr(stu, 'first_name', '')} {getattr(stu, 'last_name', '')}".strip()
            if stu_name:
                parent_name = f"Parent of {stu_name}"

        return parent_name, parent_phone, parent_email

    def _resolve_whatsapp_recipients(self, stu: Student) -> List[Dict[str, str]]:
        """
        Extracts WhatsApp recipients, routing language by audience role:
        - Parent / Guardian -> Marathi ('mr')
        - Student -> English ('en_US')
        Avoids duplicate messages if student and parent share the same phone number.
        """
        recipients = []
        guardians = getattr(stu, "guardians", []) or []
        sg = (
            next((g for g in guardians if getattr(g, "receives_notifications", False)), None)
            or next((g for g in guardians if getattr(g, "is_primary", False)), None)
            or (guardians[0] if guardians else None)
        )
        guardian_obj = getattr(sg, "guardian", None) if sg else None

        parent_name = "Parent / Guardian"
        guardian_phone = None
        if guardian_obj and getattr(guardian_obj, "mobile", None):
            guardian_phone = guardian_obj.mobile.strip()
            fname = getattr(guardian_obj, "first_name", "") or ""
            lname = getattr(guardian_obj, "last_name", "") or ""
            full = f"{fname} {lname}".strip()
            if full:
                parent_name = full
        elif sg and hasattr(sg, "mobile") and getattr(sg, "mobile", None):
            guardian_phone = sg.mobile.strip()
            fname = getattr(sg, "first_name", "") or ""
            lname = getattr(sg, "last_name", "") or ""
            full = f"{fname} {lname}".strip()
            if full:
                parent_name = full

        student_name = f"{getattr(stu, 'first_name', '')} {getattr(stu, 'last_name', '')}".strip()
        student_phone = getattr(stu, "mobile", None)
        student_phone = student_phone.strip() if student_phone else None

        if guardian_phone:
            recipients.append({
                "phone": guardian_phone,
                "language": "mr",
                "name": parent_name,
                "role": "PARENT"
            })

        if student_phone and student_phone != guardian_phone:
            recipients.append({
                "phone": student_phone,
                "language": "en_US",
                "name": student_name,
                "role": "STUDENT"
            })
        elif not guardian_phone and student_phone:
            recipients.append({
                "phone": student_phone,
                "language": "mr" if guardians else "en_US",
                "name": parent_name if guardians else student_name,
                "role": "PARENT" if guardians else "STUDENT"
            })

        return recipients

    # -------------------------------------------------------------------------
    # 1. ATTENDANCE ABSENT ALERTS
    # -------------------------------------------------------------------------
    async def dispatch_attendance_absent_alerts(self, session_id: uuid.UUID):
        """Dispatches WhatsApp and Email alerts to parents of students marked absent in a session."""
        async with AsyncSessionLocal() as db:
            try:
                # Load session with relations
                query = (
                    select(AttendanceSession)
                    .options(
                        selectinload(AttendanceSession.records)
                        .selectinload(AttendanceRecord.student)
                        .selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian),
                        selectinload(AttendanceSession.batch_subject)
                        .selectinload(BatchSubject.batch)
                        .selectinload(Batch.course)
                        .selectinload(Course.academic_class),
                        selectinload(AttendanceSession.batch_subject).selectinload(BatchSubject.subject)
                    )
                    .where(AttendanceSession.id == session_id)
                )
                res = await db.execute(query)
                sess = res.scalar_one_or_none()
                if not sess:
                    logger.warning(f"Attendance session {session_id} not found for notification dispatch.")
                    return

                bs = sess.batch_subject
                subject_name = bs.subject.name if bs and bs.subject else "Lecture"
                class_name = "Regular Batch"
                if bs and bs.batch:
                    if getattr(bs.batch, "name", None):
                        class_name = bs.batch.name
                    elif getattr(bs.batch, "course", None):
                        c = bs.batch.course
                        class_name = getattr(getattr(c, "academic_class", None), "name", None) or c.name
                date_str = str(sess.session_date)

                absent_records = [r for r in sess.records if r.status == "ABSENT"]
                logger.info(f"Dispatching absence alerts for {len(absent_records)} absent students in session {session_id}")

                for rec in absent_records:
                    stu = rec.student
                    if not stu:
                        continue

                    student_name = f"{stu.first_name} {stu.last_name}".strip()
                    parent_name, parent_phone, parent_email = self._resolve_contact(stu)

                    # 1. WhatsApp Alert (Parent in Marathi, Student in English if distinct)
                    recipients = self._resolve_whatsapp_recipients(stu)
                    for rc in recipients:
                        wa_template = format_attendance_absent_whatsapp(
                            parent_name=rc["name"],
                            student_name=student_name,
                            subject_name=subject_name,
                            class_name=class_name,
                            date_str=date_str
                        )
                        outbox = await self._log_outbox(
                            db,
                            event_type="ATTENDANCE_ABSENT",
                            recipient_target=rc["phone"],
                            channel="WHATSAPP",
                            payload={**wa_template, "language": rc["language"], "role": rc["role"]}
                        )
                        try:
                            res = await meta_whatsapp_client.send_template_message(
                                to_phone=rc["phone"],
                                template_name=wa_template["template_name"],
                                components=wa_template["components"],
                                language_code=rc["language"]
                            )
                            if res.get("is_mock"):
                                await self._update_outbox_result(db, outbox.id, "NOT_CONFIGURED", "Meta WhatsApp API is not configured in .env. Use 1-Click WhatsApp links to send directly.")
                            else:
                                await self._update_outbox_result(db, outbox.id, "SENT")
                        except Exception as exc:
                            logger.error(f"Failed to dispatch absence WhatsApp to {rc['phone']}: {exc}")
                            await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                    # 2. Email Alert (if email on record for guardian or student)
                    emails_to_send = []
                    if parent_email:
                        emails_to_send.append((parent_email, parent_name))
                    if stu.email and (not parent_email or stu.email.lower() != parent_email.lower()):
                        emails_to_send.append((stu.email, student_name))

                    for target_email, target_name in emails_to_send:
                        email_data = format_attendance_absent_email(
                            parent_name=target_name,
                            student_name=student_name,
                            subject_name=subject_name,
                            class_name=class_name,
                            date_str=date_str
                        )
                        outbox = await self._log_outbox(
                            db,
                            event_type="ATTENDANCE_ABSENT",
                            recipient_target=target_email,
                            channel="EMAIL",
                            payload={"subject": email_data["subject"]}
                        )
                        try:
                            await brevo_email_client.send_transactional_email(
                                to_email=target_email,
                                to_name=target_name,
                                subject=email_data["subject"],
                                html_content=email_data["html_content"]
                            )
                            await self._update_outbox_result(db, outbox.id, "SENT")
                        except Exception as exc:
                            logger.error(f"Failed to dispatch absence Email to {target_email}: {exc}")
                            await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_attendance_absent_alerts: {e}", exc_info=True)

    # -------------------------------------------------------------------------
    # 2. FEE PAYMENT RECEIPT CONFIRMATION
    # -------------------------------------------------------------------------
    async def dispatch_payment_receipt(self, payment_id: uuid.UUID):
        """Dispatches WhatsApp and Email receipts to parents upon successful fee payment."""
        async with AsyncSessionLocal() as db:
            try:
                query = (
                    select(Payment)
                    .options(
                        selectinload(Payment.student)
                        .selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian),
                        selectinload(Payment.receipt),
                        selectinload(Payment.allocations)
                        .selectinload(PaymentAllocation.invoice)
                        .selectinload(Invoice.enrollment)
                        .selectinload(Enrollment.course)
                    )
                    .where(Payment.id == payment_id)
                )
                res = await db.execute(query)
                pay = res.scalar_one_or_none()
                if not pay or not pay.student:
                    logger.warning(f"Payment {payment_id} not found for receipt notification.")
                    return

                stu = pay.student
                student_name = f"{stu.first_name} {stu.last_name}".strip()
                parent_name, parent_phone, parent_email = self._resolve_contact(stu)

                # Calculate remaining balance across invoices
                first_alloc = pay.allocations[0] if pay.allocations else None
                first_inv = first_alloc.invoice if first_alloc and getattr(first_alloc, "invoice", None) else None
                inv_number = first_inv.invoice_number if first_inv else "INV-ACADEMIC"
                balance_amount = float(first_inv.balance_amount) if first_inv else 0.0

                course_name = "Academic Tuition"
                if first_inv and getattr(first_inv, "enrollment", None):
                    enr = first_inv.enrollment
                    if getattr(enr, "course", None):
                        course_name = enr.course.name

                receipt_num = None
                if getattr(pay, "receipt", None) and getattr(pay.receipt, "receipt_number", None):
                    receipt_num = pay.receipt.receipt_number
                elif getattr(pay, "payment_number", None):
                    receipt_num = pay.payment_number
                else:
                    receipt_num = f"RCP-{pay.id.hex[:8].upper()}"

                payment_method = getattr(pay, "payment_method", "ONLINE")

                # 1. WhatsApp Receipt (Parent in Marathi, Student in English if distinct)
                recipients = self._resolve_whatsapp_recipients(stu)
                for rc in recipients:
                    wa_payload = format_payment_receipt_whatsapp(
                        parent_name=rc["name"],
                        amount=float(pay.amount),
                        student_name=student_name,
                        invoice_number=inv_number,
                        receipt_number=receipt_num,
                        balance=balance_amount
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="PAYMENT_RECEIPT",
                        recipient_target=rc["phone"],
                        channel="WHATSAPP",
                        payload={**wa_payload, "language": rc["language"], "role": rc["role"]}
                    )
                    try:
                        res = await meta_whatsapp_client.send_template_message(
                            to_phone=rc["phone"],
                            template_name=wa_payload["template_name"],
                            components=wa_payload["components"],
                            language_code=rc["language"]
                        )
                        if res.get("is_mock"):
                            await self._update_outbox_result(db, outbox.id, "NOT_CONFIGURED", "Meta WhatsApp API is not configured in .env. Use 1-Click WhatsApp links to send directly.")
                        else:
                            await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch payment WhatsApp to {rc['phone']}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                # 2. Email Receipt (both parent and student if emails on record)
                emails_to_send = []
                if parent_email:
                    emails_to_send.append((parent_email, parent_name))
                if stu.email and (not parent_email or stu.email.lower() != parent_email.lower()):
                    emails_to_send.append((stu.email, student_name))

                for target_email, target_name in emails_to_send:
                    email_data = format_payment_receipt_email(
                        parent_name=target_name,
                        amount=float(pay.amount),
                        student_name=student_name,
                        invoice_number=inv_number,
                        receipt_number=receipt_num,
                        payment_mode=payment_method,
                        balance=balance_amount,
                        course_name=course_name
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="PAYMENT_RECEIPT",
                        recipient_target=target_email,
                        channel="EMAIL",
                        payload={"subject": email_data["subject"]}
                    )
                    try:
                        await brevo_email_client.send_transactional_email(
                            to_email=target_email,
                            to_name=target_name,
                            subject=email_data["subject"],
                            html_content=email_data["html_content"]
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch payment Email to {target_email}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_payment_receipt: {e}", exc_info=True)

    # -------------------------------------------------------------------------
    # 3. FEE DUE / OVERDUE REMINDER
    # -------------------------------------------------------------------------
    async def dispatch_fee_reminder(self, invoice_id: uuid.UUID, installment_id: Optional[uuid.UUID] = None):
        """Dispatches an upcoming fee installment due reminder via WhatsApp and Email."""
        async with AsyncSessionLocal() as db:
            try:
                query = (
                    select(Invoice)
                    .options(
                        selectinload(Invoice.student)
                        .selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian),
                        selectinload(Invoice.enrollment).selectinload(Enrollment.course),
                        selectinload(Invoice.installment_plan)
                        .selectinload(InstallmentPlan.installments)
                    )
                    .where(Invoice.id == invoice_id)
                )
                res = await db.execute(query)
                inv = res.scalar_one_or_none()
                if not inv or not inv.student:
                    return

                stu = inv.student
                student_name = f"{stu.first_name} {stu.last_name}".strip()
                parent_name, parent_phone, parent_email = self._resolve_contact(stu)
                course_name = inv.enrollment.course.name if (inv.enrollment and inv.enrollment.course) else "Academic Course"

                # Target installment
                target_inst = None
                installments = inv.installment_plan.installments if getattr(inv, "installment_plan", None) else []
                if installment_id:
                    target_inst = next((i for i in installments if i.id == installment_id), None)
                if not target_inst:
                    # Pick first unpaid installment
                    unpaid = [i for i in installments if i.status != "PAID"]
                    target_inst = unpaid[0] if unpaid else None

                if not target_inst:
                    return

                is_overdue = target_inst.due_date < date.today()
                due_date_str = str(target_inst.due_date)
                unpaid_amount = float(target_inst.amount - (target_inst.paid_amount or 0))

                # 1. Dispatch WhatsApp (Parent in Marathi, Student in English if distinct)
                recipients = self._resolve_whatsapp_recipients(stu)
                for rc in recipients:
                    wa_payload = format_fee_reminder_whatsapp(
                        parent_name=rc["name"],
                        installment_number=target_inst.installment_number,
                        amount=unpaid_amount,
                        student_name=student_name,
                        due_date=due_date_str
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="FEE_DUE_REMINDER",
                        recipient_target=rc["phone"],
                        channel="WHATSAPP",
                        payload={**wa_payload, "installment_id": str(target_inst.id), "invoice_id": str(inv.id), "language": rc["language"], "role": rc["role"]}
                    )
                    try:
                        res = await meta_whatsapp_client.send_template_message(
                            to_phone=rc["phone"],
                            template_name=wa_payload["template_name"],
                            components=wa_payload["components"],
                            language_code=rc["language"]
                        )
                        if res.get("is_mock"):
                            await self._update_outbox_result(db, outbox.id, "NOT_CONFIGURED", "Meta WhatsApp API is not configured in .env. Use 1-Click WhatsApp links to send directly.")
                        else:
                            await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch fee reminder WhatsApp to {rc['phone']}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                # 2. Dispatch Email (to parent and student)
                emails_to_send = []
                if parent_email and "@" in parent_email:
                    emails_to_send.append((parent_email, parent_name))
                if stu.email and "@" in stu.email and (not parent_email or stu.email.lower() != parent_email.lower()):
                    emails_to_send.append((stu.email, student_name))

                for target_email, target_name in emails_to_send:
                    email_data = format_fee_reminder_email(
                        parent_name=target_name,
                        student_name=student_name,
                        installment_number=target_inst.installment_number,
                        amount=unpaid_amount,
                        due_date=due_date_str,
                        invoice_number=inv.invoice_number,
                        course_name=course_name,
                        is_overdue=is_overdue
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="FEE_DUE_REMINDER",
                        recipient_target=target_email,
                        channel="EMAIL",
                        payload={"subject": email_data["subject"], "installment_id": str(target_inst.id), "invoice_id": str(inv.id)}
                    )
                    try:
                        await brevo_email_client.send_transactional_email(
                            to_email=target_email,
                            to_name=target_name,
                            subject=email_data["subject"],
                            html_content=email_data["html_content"]
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch fee reminder Email to {target_email}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_fee_reminder: {e}", exc_info=True)

    async def scan_and_dispatch_due_fee_reminders(
        self,
        days_ahead: int = 3,
        include_overdue: bool = True,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Scans for unpaid installments approaching due date (due in <= days_ahead days)
        or overdue, and dispatches WhatsApp & Email reminders.
        Uses NotificationOutbox to ensure idempotency and prevent duplicate spamming.
        """
        async with AsyncSessionLocal() as db:
            today = date.today()
            upcoming_cutoff = today + timedelta(days=days_ahead)
            start_of_today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

            query = (
                select(Installment)
                .join(Installment.installment_plan)
                .join(InstallmentPlan.invoice)
                .options(
                    selectinload(Installment.installment_plan).selectinload(InstallmentPlan.invoice)
                )
                .where(
                    Installment.status.in_(["PENDING", "PARTIALLY_PAID", "OVERDUE"]),
                    Installment.amount > Installment.paid_amount
                )
            )
            res = await db.execute(query)
            installments = res.scalars().all()

            eligible = []
            for inst in installments:
                is_upcoming = today <= inst.due_date <= upcoming_cutoff
                is_overdue = inst.due_date < today

                if is_upcoming or (include_overdue and is_overdue):
                    eligible.append((inst, "OVERDUE" if is_overdue else "UPCOMING"))

            dispatched = []
            skipped = []

            for inst, reason in eligible:
                inst_plan = inst.installment_plan
                if not inst_plan or not inst_plan.invoice_id:
                    continue

                invoice_id = inst_plan.invoice_id
                inst_id_str = str(inst.id)

                if not force:
                    # Check if already reminded today for this installment
                    outbox_check = await db.execute(
                        select(NotificationOutbox.id)
                        .where(
                            NotificationOutbox.event_type == "FEE_DUE_REMINDER",
                            NotificationOutbox.created_at >= start_of_today,
                            cast(NotificationOutbox.payload, String).like(f"%{inst_id_str}%")
                        )
                        .limit(1)
                    )
                    if outbox_check.scalars().first():
                        skipped.append({
                            "installment_id": inst_id_str,
                            "installment_number": inst.installment_number,
                            "reason": "already_reminded_today"
                        })
                        continue

                try:
                    await self.dispatch_fee_reminder(invoice_id=invoice_id, installment_id=inst.id)
                    dispatched.append({
                        "installment_id": inst_id_str,
                        "installment_number": inst.installment_number,
                        "due_date": str(inst.due_date),
                        "amount": float(inst.amount - inst.paid_amount),
                        "reason": reason
                    })
                except Exception as exc:
                    logger.error(f"Error dispatching reminder for installment {inst.id}: {exc}")

            return {
                "status": "success",
                "total_candidates": len(eligible),
                "reminders_dispatched": len(dispatched),
                "skipped_count": len(skipped),
                "dispatched": dispatched,
                "skipped": skipped
            }

    # -------------------------------------------------------------------------
    # 4. EXAM RESULT PUBLISHED
    # -------------------------------------------------------------------------
    async def dispatch_exam_results(self, exam_id: uuid.UUID):
        """Dispatches WhatsApp test scorecards and Brevo Email performance reports to parents and students when an examination is published."""
        async with AsyncSessionLocal() as db:
            try:
                query = (
                    select(Examination)
                    .options(
                        selectinload(Examination.results)
                        .selectinload(ExamResult.student)
                        .selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian),
                        selectinload(Examination.exam_subjects).selectinload(ExamSubject.subject),
                        selectinload(Examination.exam_subjects).selectinload(ExamSubject.academic_class)
                    )
                    .where(Examination.id == exam_id)
                )
                res = await db.execute(query)
                exam = res.scalar_one_or_none()
                if not exam or not exam.results:
                    return

                exam_name = exam.name
                exam_code = exam.code or "EXAM"
                # Derive subject name safely from exam_subjects relation
                subject_names = [es.subject.name for es in (exam.exam_subjects or []) if es.subject]
                subject_name = ", ".join(subject_names) if subject_names else (exam_name or "Curriculum Evaluation")

                class_names = [es.academic_class.name for es in (exam.exam_subjects or []) if es.academic_class]
                academic_class = ", ".join(sorted(set(class_names))) if class_names else None

                for r in exam.results:
                    stu = r.student
                    if not stu:
                        continue

                    student_name = f"{stu.first_name} {stu.last_name}".strip()
                    parent_name, parent_phone, parent_email = self._resolve_contact(stu)

                    marks_obtained = float(r.total_obtained) if r.total_obtained is not None else 0.0
                    max_marks = float(r.total_possible) if r.total_possible is not None else 100.0
                    percentage = float(r.percentage) if r.percentage is not None else round((marks_obtained / max_marks) * 100, 2)
                    grade = r.grade or ("A+" if percentage >= 90 else ("A" if percentage >= 80 else ("B+" if percentage >= 70 else ("B" if percentage >= 60 else "C"))))
                    is_pass = bool(r.is_pass) if r.is_pass is not None else (percentage >= 35.0)

                    # 1. WhatsApp Dispatch (Parent in Marathi, Student in English if distinct)
                    recipients = self._resolve_whatsapp_recipients(stu)
                    for rc in recipients:
                        wa_payload = format_exam_result_whatsapp(
                            parent_name=rc["name"],
                            exam_name=exam_name,
                            subject_name=subject_name,
                            student_name=student_name,
                            marks_obtained=marks_obtained,
                            max_marks=max_marks,
                            percentage=percentage
                        )
                        outbox = await self._log_outbox(
                            db,
                            event_type="EXAM_RESULT_PUBLISHED",
                            recipient_target=rc["phone"],
                            channel="WHATSAPP",
                            payload={**wa_payload, "exam_id": str(exam.id), "student_id": str(stu.id), "language": rc["language"], "role": rc["role"]}
                        )
                        try:
                            res = await meta_whatsapp_client.send_template_message(
                                to_phone=rc["phone"],
                                template_name=wa_payload["template_name"],
                                components=wa_payload["components"],
                                language_code=rc["language"]
                            )
                            if res.get("is_mock"):
                                await self._update_outbox_result(db, outbox.id, "NOT_CONFIGURED", "Meta WhatsApp API is not configured in .env. Use 1-Click WhatsApp links to send directly.")
                            else:
                                await self._update_outbox_result(db, outbox.id, "SENT")
                        except Exception as exc:
                            logger.error(f"Failed to dispatch exam result WhatsApp to {rc['phone']}: {exc}")
                            await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                    # 2. Email Dispatch (to parent and student)
                    emails_to_send = []
                    if parent_email and "@" in parent_email:
                        emails_to_send.append((parent_email, parent_name))
                    if stu.email and "@" in stu.email and (not parent_email or stu.email.lower() != parent_email.lower()):
                        emails_to_send.append((stu.email, student_name))

                    for target_email, target_name in emails_to_send:
                        email_data = format_exam_result_email(
                            parent_name=target_name,
                            student_name=student_name,
                            exam_name=exam_name,
                            exam_code=exam_code,
                            subject_name=subject_name,
                            marks_obtained=marks_obtained,
                            max_marks=max_marks,
                            percentage=percentage,
                            grade=grade,
                            is_pass=is_pass,
                            academic_class=academic_class
                        )
                        outbox = await self._log_outbox(
                            db,
                            event_type="EXAM_RESULT_PUBLISHED",
                            recipient_target=target_email,
                            channel="EMAIL",
                            payload={"subject": email_data["subject"], "exam_id": str(exam.id), "student_id": str(stu.id)}
                        )
                        try:
                            await brevo_email_client.send_transactional_email(
                                to_email=target_email,
                                to_name=target_name,
                                subject=email_data["subject"],
                                html_content=email_data["html_content"]
                            )
                            await self._update_outbox_result(db, outbox.id, "SENT")
                        except Exception as exc:
                            logger.error(f"Failed to dispatch exam result Email to {target_email}: {exc}")
                            await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_exam_results: {e}", exc_info=True)

    # -------------------------------------------------------------------------
    # 5. ADMISSION CONFIRMED / WELCOME
    # -------------------------------------------------------------------------
    async def dispatch_admission_welcome(self, student_id: uuid.UUID, enrollment_id: Optional[uuid.UUID] = None):
        """Dispatches welcome onboarding notifications via WhatsApp & Email upon student enrollment."""
        async with AsyncSessionLocal() as db:
            try:
                query = (
                    select(Student)
                    .options(
                        selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian)
                    )
                    .where(Student.id == student_id)
                )
                res = await db.execute(query)
                stu = res.scalar_one_or_none()
                if not stu:
                    return

                student_name = f"{stu.first_name} {stu.last_name}".strip()
                prn = stu.prn or stu.student_code or "PRN-PENDING"
                
                # Fetch course name
                course_name = "Academic Coaching Program"
                if enrollment_id:
                    enr_res = await db.execute(
                        select(Enrollment)
                        .options(selectinload(Enrollment.course), selectinload(Enrollment.academic_class))
                        .where(Enrollment.id == enrollment_id)
                    )
                    enr = enr_res.scalar_one_or_none()
                    if enr:
                        if enr.course:
                            course_name = enr.course.name
                        elif enr.academic_class:
                            course_name = enr.academic_class.name

                parent_name, parent_phone, parent_email = self._resolve_contact(stu)

                # 1. WhatsApp Welcome (Parent in Marathi, Student in English if distinct)
                recipients = self._resolve_whatsapp_recipients(stu)
                for rc in recipients:
                    wa_payload = format_admission_welcome_whatsapp(
                        student_name=student_name,
                        course_name=course_name,
                        prn=prn
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="ADMISSION_CONFIRMED",
                        recipient_target=rc["phone"],
                        channel="WHATSAPP",
                        payload={**wa_payload, "language": rc["language"], "role": rc["role"]}
                    )
                    try:
                        res = await meta_whatsapp_client.send_template_message(
                            to_phone=rc["phone"],
                            template_name=wa_payload["template_name"],
                            components=wa_payload["components"],
                            language_code=rc["language"]
                        )
                        if res.get("is_mock"):
                            await self._update_outbox_result(db, outbox.id, "NOT_CONFIGURED", "Meta WhatsApp API is not configured in .env. Use 1-Click WhatsApp links to send directly.")
                        else:
                            await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch welcome WhatsApp to {rc['phone']}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                # 2. Email Welcome
                emails_to_send = []
                if parent_email:
                    emails_to_send.append((parent_email, parent_name))
                if stu.email and (not parent_email or stu.email.lower() != parent_email.lower()):
                    emails_to_send.append((stu.email, student_name))

                for target_email, target_name in emails_to_send:
                    subject = f"Welcome to Yashodeep Coaching Classes - Enrollment Confirmed ({prn})"
                    html_content = wrap_html_email(
                        title=subject,
                        content_body=f"""
                        <p>Dear {target_name},</p>
                        <p>We are delighted to welcome <strong>{student_name}</strong> to the Yashodeep Coaching Classes academic family!</p>
                        <div class="card">
                          <p style="margin: 4px 0;"><strong>Permanent Registration Number (PRN):</strong> <span style="font-family: monospace; font-weight: bold; color: #4338ca;">{prn}</span></p>
                          <p style="margin: 4px 0;"><strong>Enrolled Program:</strong> {course_name}</p>
                          <p style="margin: 4px 0;"><strong>Status:</strong> <span class="badge badge-emerald">CONFIRMED</span></p>
                        </div>
                        <p>Please use your PRN for all future examinations, portal logins, and fee receipts.</p>
                        """
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="ADMISSION_CONFIRMED",
                        recipient_target=target_email,
                        channel="EMAIL",
                        payload={"subject": subject}
                    )
                    try:
                        await brevo_email_client.send_transactional_email(
                            to_email=target_email,
                            to_name=target_name,
                            subject=subject,
                            html_content=html_content
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch welcome Email to {target_email}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_admission_welcome: {e}", exc_info=True)

    # -------------------------------------------------------------------------
    # 6. PROMOTION & ACADEMIC ROLLOVER CONFIRMATION
    # -------------------------------------------------------------------------
    async def dispatch_promotion_confirmation(
        self,
        student_id: uuid.UUID,
        new_enrollment_id: uuid.UUID,
        old_enrollment_id: Optional[uuid.UUID] = None,
        invoice_id: Optional[uuid.UUID] = None
    ):
        """Dispatches promotion confirmation notifications via WhatsApp & Email to parents & student."""
        async with AsyncSessionLocal() as db:
            try:
                # 1. Fetch Student & Guardians
                query = (
                    select(Student)
                    .options(
                        selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian)
                    )
                    .where(Student.id == student_id)
                )
                student = (await db.execute(query)).scalar_one_or_none()
                if not student:
                    return

                # 2. Fetch New Enrollment details
                new_enr_query = (
                    select(Enrollment)
                    .options(
                        selectinload(Enrollment.academic_class),
                        selectinload(Enrollment.course),
                        selectinload(Enrollment.batch),
                        selectinload(Enrollment.academic_year)
                    )
                    .where(Enrollment.id == new_enrollment_id)
                )
                new_enr = (await db.execute(new_enr_query)).scalar_one_or_none()
                if not new_enr:
                    return

                old_class_name = "Previous Standard"
                if old_enrollment_id:
                    old_enr = await db.get(Enrollment, old_enrollment_id)
                    if old_enr and old_enr.class_id:
                        old_cls = await db.get(Class, old_enr.class_id)
                        if old_cls:
                            old_class_name = old_cls.name

                new_class_name = new_enr.academic_class.name if new_enr.academic_class else "Next Standard"
                new_batch_name = new_enr.batch.name if new_enr.batch else (new_enr.course.name if new_enr.course else "All Batches")
                ay_name = new_enr.academic_year.name if new_enr.academic_year else "2027-2028"

                # 3. Fetch Invoice if linked
                inv_number = "INV-PENDING"
                inv_total = "0.00"
                installments_data = []
                if invoice_id:
                    inv_query = (
                        select(Invoice)
                        .options(
                            selectinload(Invoice.installment_plan)
                            .selectinload(InstallmentPlan.installments)
                        )
                        .where(Invoice.id == invoice_id)
                    )
                    inv = (await db.execute(inv_query)).scalar_one_or_none()
                    if inv:
                        inv_number = inv.invoice_number
                        inv_total = f"{float(inv.total_amount):,.2f}"
                        if inv.installment_plan and inv.installment_plan.installments:
                            installments_data = [
                                {
                                    "number": inst.installment_number,
                                    "due_date": inst.due_date.isoformat(),
                                    "amount": float(inst.amount)
                                }
                                for inst in inv.installment_plan.installments
                            ]

                # Resolve recipient details
                parent_name = f"Mr./Mrs. {student.last_name}"
                target_phone = student.mobile
                target_email = student.email
                if student.guardians:
                    primary_g = student.guardians[0].guardian
                    if primary_g:
                        parent_name = f"{primary_g.first_name} {primary_g.last_name}"
                        if primary_g.mobile:
                            target_phone = primary_g.mobile
                        if primary_g.email:
                            target_email = primary_g.email

                student_full_name = f"{student.first_name} {student.last_name}".strip()
                prn = student.prn or student.student_code

                # A. Meta WhatsApp Dispatch (Parent in Marathi, Student in English if distinct)
                if meta_whatsapp_client.is_configured:
                    recipients = self._resolve_whatsapp_recipients(student)
                    for rc in recipients:
                        wa_payload = format_promotion_confirmation_whatsapp(
                            parent_name=rc["name"],
                            student_name=student_full_name,
                            promoted_class_name=new_class_name,
                            academic_year_name=ay_name,
                            invoice_number=inv_number,
                            total_amount=f"₹{inv_total}"
                        )
                        outbox = await self._log_outbox(
                            db,
                            event_type="PROMOTION_CONFIRMED",
                            recipient_target=rc["phone"],
                            channel="WHATSAPP",
                            payload={**wa_payload, "language": rc["language"], "role": rc["role"]}
                        )
                        try:
                            res = await meta_whatsapp_client.send_template_message(
                                to_phone=rc["phone"],
                                template_name=wa_payload["template_name"],
                                components=wa_payload["components"],
                                language_code=rc["language"]
                            )
                            if res.get("is_mock"):
                                await self._update_outbox_result(db, outbox.id, "NOT_CONFIGURED", "Meta WhatsApp API is not configured in .env. Use 1-Click WhatsApp links to send directly.")
                            else:
                                await self._update_outbox_result(db, outbox.id, "SENT")
                        except Exception as exc:
                            logger.error(f"Failed to dispatch promotion WhatsApp to {rc['phone']}: {exc}")
                            await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                # B. Brevo Email Dispatch
                if target_email and brevo_email_client.is_configured:
                    email_payload = format_promotion_confirmation_email(
                        student_name=student_full_name,
                        prn=prn,
                        old_class_name=old_class_name,
                        new_class_name=new_class_name,
                        new_batch_name=new_batch_name,
                        academic_year_name=ay_name,
                        invoice_number=inv_number,
                        total_amount=inv_total,
                        installments=installments_data
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="PROMOTION_CONFIRMED",
                        recipient_target=target_email,
                        channel="EMAIL",
                        payload={"subject": email_payload["subject"]}
                    )
                    try:
                        await brevo_email_client.send_transactional_email(
                            to_email=target_email,
                            to_name=parent_name,
                            subject=email_payload["subject"],
                            html_content=email_payload["html_content"]
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch promotion Email to {target_email}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_promotion_confirmation: {e}", exc_info=True)

    # -------------------------------------------------------------------------
    # 7. FACILITY TENANCY ALLOCATION WELCOME (STUDY ROOM & HOSTEL)
    # -------------------------------------------------------------------------
    async def dispatch_facility_allocation_welcome(
        self,
        student_id: uuid.UUID,
        facility_type: str,  # "STUDY_ROOM" or "HOSTEL"
        unit_label: str,     # "Study Desk B-012" or "Hostel Bed B2"
        location_label: str, # "Main Reading Hall - Floor 1" or "Main Boys Hostel - Room 204"
        duration_months: int,
        start_date: date,
        end_date: date,
        monthly_charge: Decimal,
        total_rent: Decimal,
        deposit_amount: Decimal,
        invoice_number: str,
        payment_status: str
    ):
        """Dispatches facility booking confirmation emails to both student and parents."""
        async with AsyncSessionLocal() as db:
            try:
                query = (
                    select(Student)
                    .options(
                        selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian)
                    )
                    .where(Student.id == student_id)
                )
                student = (await db.execute(query)).scalar_one_or_none()
                if not student:
                    return

                student_name = f"{student.first_name} {student.last_name}".strip()
                prn = student.prn or student.student_code or "PRN-PENDING"

                parent_name, parent_phone, parent_email = self._resolve_contact(student)

                emails_to_send = []
                if parent_email:
                    emails_to_send.append((parent_email, parent_name or "Parent / Guardian"))
                if student.email and (not parent_email or student.email.lower() != parent_email.lower()):
                    emails_to_send.append((student.email, student_name))

                email_payload = format_facility_allocation_email(
                    student_name=student_name,
                    prn=prn,
                    facility_type=facility_type,
                    unit_label=unit_label,
                    location_label=location_label,
                    duration_months=duration_months,
                    start_date_str=start_date.strftime("%d-%b-%Y"),
                    end_date_str=end_date.strftime("%d-%b-%Y"),
                    monthly_charge=float(monthly_charge),
                    total_rent=float(total_rent),
                    deposit_amount=float(deposit_amount),
                    total_invoiced=float(total_rent + deposit_amount),
                    invoice_number=invoice_number,
                    payment_status=payment_status
                )

                for target_email, target_name in emails_to_send:
                    outbox = await self._log_outbox(
                        db,
                        event_type="FACILITY_ALLOCATED",
                        recipient_target=target_email,
                        channel="EMAIL",
                        payload={"subject": email_payload["subject"]}
                    )
                    try:
                        await brevo_email_client.send_transactional_email(
                            to_email=target_email,
                            to_name=target_name,
                            subject=email_payload["subject"],
                            html_content=email_payload["html_content"]
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                        logger.info(f"Facility confirmation email sent to {target_email} for {student_name}")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch facility email to {target_email}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_facility_allocation_welcome: {e}", exc_info=True)

    async def dispatch_facility_expiry_notice(
        self,
        student_id: uuid.UUID,
        facility_type: str,     # "STUDY_ROOM" or "HOSTEL"
        allocation_id: uuid.UUID,
        unit_label: str,
        location_label: str,
        end_date: date,
        days_remaining: int,    # 3, 2, 1 (expiring) or <= 0 (expired)
        monthly_renewal_charge: Decimal
    ):
        """
        Dispatches 1 expiry reminder per day (T-3, T-2, T-1) or renewal notice (Expired)
        to student and parents via Meta WhatsApp & Brevo Email.
        """
        async with AsyncSessionLocal() as db:
            try:
                query = (
                    select(Student)
                    .options(
                        selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian)
                    )
                    .where(Student.id == student_id)
                )
                student = (await db.execute(query)).scalar_one_or_none()
                if not student:
                    return

                student_name = f"{student.first_name} {student.last_name}".strip()
                prn = student.prn or student.student_code or "PRN-PENDING"
                parent_name, parent_phone, parent_email = self._resolve_contact(student)
                contact_name = parent_name or student_name
                is_expired = days_remaining <= 0
                event_type = "FACILITY_EXPIRED_NOTICE" if is_expired else "FACILITY_EXPIRING_REMINDER"

                end_date_str = end_date.strftime("%d-%b-%Y")
                renewal_float = float(monthly_renewal_charge)

                # 1. Format WhatsApp
                pref_lang = getattr(settings, "META_WHATSAPP_DEFAULT_LANGUAGE", "en_US") or "en_US"
                if pref_lang not in ("en_US", "mr"):
                    pref_lang = "en_US"

                if is_expired:
                    wa_template = format_facility_expired_whatsapp(
                        recipient_name=contact_name,
                        student_name=student_name,
                        facility_type=facility_type,
                        unit_label=unit_label,
                        end_date_str=end_date_str,
                        monthly_renewal_charge=renewal_float,
                        language_code=pref_lang
                    )
                    wa_text = format_facility_expired_whatsapp_text(
                        recipient_name=contact_name,
                        student_name=student_name,
                        facility_type=facility_type,
                        unit_label=unit_label,
                        end_date_str=end_date_str,
                        monthly_renewal_charge=renewal_float
                    )
                else:
                    wa_template = format_facility_expiring_whatsapp(
                        recipient_name=contact_name,
                        student_name=student_name,
                        facility_type=facility_type,
                        unit_label=unit_label,
                        days_remaining=days_remaining,
                        end_date_str=end_date_str,
                        monthly_renewal_charge=renewal_float,
                        language_code=pref_lang
                    )
                    wa_text = format_facility_expiring_whatsapp_text(
                        recipient_name=contact_name,
                        student_name=student_name,
                        facility_type=facility_type,
                        unit_label=unit_label,
                        days_remaining=days_remaining,
                        end_date_str=end_date_str,
                        monthly_renewal_charge=renewal_float
                    )

                # Send WhatsApp to parent and/or student
                phones_to_send = []
                if parent_phone:
                    phones_to_send.append(parent_phone)
                if student.mobile and student.mobile != parent_phone:
                    phones_to_send.append(student.mobile)

                for phone in phones_to_send:
                    outbox = await self._log_outbox(
                        db,
                        event_type=event_type,
                        recipient_target=phone,
                        channel="WHATSAPP",
                        payload={
                            "allocation_id": str(allocation_id),
                            "facility_type": facility_type,
                            "days_remaining": days_remaining,
                            "end_date": end_date_str,
                            "message_text": wa_text
                        }
                    )
                    try:
                        if meta_whatsapp_client.enabled:
                            await meta_whatsapp_client.send_template_message(
                                to_phone=phone,
                                template_name=wa_template["name"],
                                language_code=wa_template["language"]["code"],
                                components=wa_template["components"]
                            )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch facility expiry WhatsApp to {phone}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                # 2. Format Email
                if is_expired:
                    email_payload = format_facility_expired_email(
                        student_name=student_name,
                        prn=prn,
                        facility_type=facility_type,
                        unit_label=unit_label,
                        location_label=location_label,
                        end_date_str=end_date_str,
                        monthly_renewal_charge=renewal_float
                    )
                else:
                    email_payload = format_facility_expiring_email(
                        student_name=student_name,
                        prn=prn,
                        facility_type=facility_type,
                        unit_label=unit_label,
                        location_label=location_label,
                        days_remaining=days_remaining,
                        end_date_str=end_date_str,
                        monthly_renewal_charge=renewal_float
                    )

                emails_to_send = []
                if parent_email:
                    emails_to_send.append((parent_email, parent_name or "Parent / Guardian"))
                if student.email and (not parent_email or student.email.lower() != parent_email.lower()):
                    emails_to_send.append((student.email, student_name))

                for target_email, target_name in emails_to_send:
                    outbox = await self._log_outbox(
                        db,
                        event_type=event_type,
                        recipient_target=target_email,
                        channel="EMAIL",
                        payload={
                            "allocation_id": str(allocation_id),
                            "facility_type": facility_type,
                            "days_remaining": days_remaining,
                            "subject": email_payload["subject"]
                        }
                    )
                    try:
                        await brevo_email_client.send_transactional_email(
                            to_email=target_email,
                            to_name=target_name,
                            subject=email_payload["subject"],
                            html_content=email_payload["html_content"]
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch facility expiry Email to {target_email}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_facility_expiry_notice: {e}", exc_info=True)

    async def scan_and_dispatch_facility_expiry_reminders(
        self,
        days_ahead: int = 3,
        include_expired: bool = True,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Scans for active Hostel Bed and Study Room Seat allocations expiring in
        the next 3 days (1 reminder per day) or expired today/yesterday (renewal notice).
        Uses NotificationOutbox to guarantee strict idempotency (max 1 message per day).
        """
        async with AsyncSessionLocal() as db:
            today = date.today()
            start_of_today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

            dispatched = []
            skipped = []

            # -------------------------------------------------------------
            # A. Scan Hostel Bed Allocations
            # -------------------------------------------------------------
            bed_query = (
                select(BedAllocation)
                .options(
                    selectinload(BedAllocation.student)
                    .selectinload(Student.guardians)
                    .selectinload(StudentGuardian.guardian),
                    selectinload(BedAllocation.hostel_bed)
                    .selectinload(HostelBed.room)
                    .selectinload(HostelRoom.floor)
                    .selectinload(HostelFloor.building),
                    selectinload(BedAllocation.student_service)
                    .selectinload(StudentService.service_plan)
                )
                .where(BedAllocation.status == "ACTIVE")
            )
            bed_allocations = (await db.execute(bed_query)).scalars().all()

            for b_alloc in bed_allocations:
                days_diff = (b_alloc.end_date - today).days

                # Eligible if:
                # 1. Expiring in 1, 2, or 3 days (days_ahead)
                # 2. Expired today or recently (days_diff in [0, -1])
                is_expiring = 1 <= days_diff <= days_ahead
                is_expired = days_diff in [0, -1]

                if not (is_expiring or (include_expired and is_expired)):
                    continue

                alloc_id_str = str(b_alloc.id)

                if not force:
                    # Check if already reminded today for this allocation
                    outbox_check = await db.execute(
                        select(NotificationOutbox.id)
                        .where(
                            NotificationOutbox.event_type.in_(["FACILITY_EXPIRING_REMINDER", "FACILITY_EXPIRED_NOTICE"]),
                            NotificationOutbox.created_at >= start_of_today,
                            cast(NotificationOutbox.payload, String).like(f"%{alloc_id_str}%")
                        )
                        .limit(1)
                    )
                    if outbox_check.scalars().first():
                        skipped.append({
                            "allocation_id": alloc_id_str,
                            "facility_type": "HOSTEL",
                            "unit": f"Bed {b_alloc.hostel_bed.bed_number if b_alloc.hostel_bed else ''}",
                            "end_date": str(b_alloc.end_date),
                            "days_remaining": days_diff,
                            "reason": "already_reminded_today"
                        })
                        continue

                # Prepare details
                bed_num = b_alloc.hostel_bed.bed_number if b_alloc.hostel_bed else "Bed"
                room_num = b_alloc.hostel_bed.room.room_number if b_alloc.hostel_bed and b_alloc.hostel_bed.room else "Room"
                bld_name = (
                    b_alloc.hostel_bed.room.floor.building.name
                    if b_alloc.hostel_bed and b_alloc.hostel_bed.room and b_alloc.hostel_bed.room.floor and b_alloc.hostel_bed.room.floor.building
                    else "Hostel Building"
                )

                unit_label = f"Bed {bed_num} (Room {room_num})"
                location_label = f"{bld_name} - Room {room_num}"

                # Calculate single-month renewal charge
                monthly_charge = Decimal("0.00")
                if b_alloc.student_service and b_alloc.student_service.service_plan:
                    monthly_charge = Decimal(str(b_alloc.student_service.service_plan.base_amount or 0.00))

                try:
                    await self.dispatch_facility_expiry_notice(
                        student_id=b_alloc.student_id,
                        facility_type="HOSTEL",
                        allocation_id=b_alloc.id,
                        unit_label=unit_label,
                        location_label=location_label,
                        end_date=b_alloc.end_date,
                        days_remaining=days_diff,
                        monthly_renewal_charge=monthly_charge
                    )
                    dispatched.append({
                        "allocation_id": alloc_id_str,
                        "facility_type": "HOSTEL",
                        "unit": unit_label,
                        "student_id": str(b_alloc.student_id),
                        "end_date": str(b_alloc.end_date),
                        "days_remaining": days_diff,
                        "status": "EXPIRED" if days_diff <= 0 else f"EXPIRING_IN_{days_diff}_DAYS"
                    })
                except Exception as exc:
                    logger.error(f"Failed to dispatch hostel expiry notice for {alloc_id_str}: {exc}")

            # -------------------------------------------------------------
            # B. Scan Study Room Seat Allocations
            # -------------------------------------------------------------
            seat_query = (
                select(SeatAllocation)
                .options(
                    selectinload(SeatAllocation.student)
                    .selectinload(Student.guardians)
                    .selectinload(StudentGuardian.guardian),
                    selectinload(SeatAllocation.study_seat)
                    .selectinload(StudySeat.study_room),
                    selectinload(SeatAllocation.student_service)
                    .selectinload(StudentService.service_plan)
                )
                .where(SeatAllocation.status == "ACTIVE")
            )
            seat_allocations = (await db.execute(seat_query)).scalars().all()

            for s_alloc in seat_allocations:
                days_diff = (s_alloc.end_date - today).days

                is_expiring = 1 <= days_diff <= days_ahead
                is_expired = days_diff in [0, -1]

                if not (is_expiring or (include_expired and is_expired)):
                    continue

                alloc_id_str = str(s_alloc.id)

                if not force:
                    outbox_check = await db.execute(
                        select(NotificationOutbox.id)
                        .where(
                            NotificationOutbox.event_type.in_(["FACILITY_EXPIRING_REMINDER", "FACILITY_EXPIRED_NOTICE"]),
                            NotificationOutbox.created_at >= start_of_today,
                            cast(NotificationOutbox.payload, String).like(f"%{alloc_id_str}%")
                        )
                        .limit(1)
                    )
                    if outbox_check.scalars().first():
                        skipped.append({
                            "allocation_id": alloc_id_str,
                            "facility_type": "STUDY_ROOM",
                            "unit": f"Desk {s_alloc.study_seat.seat_number if s_alloc.study_seat else ''}",
                            "end_date": str(s_alloc.end_date),
                            "days_remaining": days_diff,
                            "reason": "already_reminded_today"
                        })
                        continue

                seat_num = s_alloc.study_seat.seat_number if s_alloc.study_seat else "Desk"
                room_name = s_alloc.study_seat.study_room.name if s_alloc.study_seat and s_alloc.study_seat.study_room else "Reading Hall"

                unit_label = f"Desk {seat_num}"
                location_label = f"{room_name} - Seat {seat_num}"

                monthly_charge = Decimal("0.00")
                if s_alloc.student_service and s_alloc.student_service.service_plan:
                    monthly_charge = Decimal(str(s_alloc.student_service.service_plan.base_amount or 0.00))

                try:
                    await self.dispatch_facility_expiry_notice(
                        student_id=s_alloc.student_id,
                        facility_type="STUDY_ROOM",
                        allocation_id=s_alloc.id,
                        unit_label=unit_label,
                        location_label=location_label,
                        end_date=s_alloc.end_date,
                        days_remaining=days_diff,
                        monthly_renewal_charge=monthly_charge
                    )
                    dispatched.append({
                        "allocation_id": alloc_id_str,
                        "facility_type": "STUDY_ROOM",
                        "unit": unit_label,
                        "student_id": str(s_alloc.student_id),
                        "end_date": str(s_alloc.end_date),
                        "days_remaining": days_diff,
                        "status": "EXPIRED" if days_diff <= 0 else f"EXPIRING_IN_{days_diff}_DAYS"
                    })
                except Exception as exc:
                    logger.error(f"Failed to dispatch study room expiry notice for {alloc_id_str}: {exc}")

            return {
                "success": True,
                "scan_date": str(today),
                "total_dispatched": len(dispatched),
                "total_skipped": len(skipped),
                "dispatched": dispatched,
                "skipped": skipped
            }



notification_dispatcher = NotificationDispatcher()
