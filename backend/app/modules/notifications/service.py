"""
Notification Dispatcher Service for Yashodeep Coaching Classes ERP.
Handles asynchronous preparation, persistence into NotificationOutbox, and dispatch
across Meta WhatsApp and Brevo Transactional Email channels.
"""
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.notification import NotificationOutbox, Notification
from app.models.student import Student, StudentGuardian, Guardian
from app.models.academic import BatchSubject, Batch, Subject, Class, Course
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.fee import Payment, Invoice, Installment
from app.models.examination import Examination, ExamResult
from app.models.enrollment import Enrollment

from app.modules.notifications.providers.meta_whatsapp import meta_whatsapp_client
from app.modules.notifications.providers.brevo_email import brevo_email_client
from app.modules.notifications.templates import (
    format_attendance_absent_whatsapp,
    format_attendance_absent_email,
    format_payment_receipt_whatsapp,
    format_payment_receipt_email,
    format_fee_reminder_whatsapp,
    format_exam_result_whatsapp,
    format_admission_welcome_whatsapp,
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

                    # 1. WhatsApp Alert
                    phones_to_send = []
                    if parent_phone:
                        phones_to_send.append(parent_phone)
                    if stu.mobile and stu.mobile != parent_phone:
                        phones_to_send.append(stu.mobile)

                    for target_phone in phones_to_send:
                        wa_template = format_attendance_absent_whatsapp(
                            parent_name=parent_name,
                            student_name=student_name,
                            subject_name=subject_name,
                            class_name=class_name,
                            date_str=date_str
                        )
                        outbox = await self._log_outbox(
                            db,
                            event_type="ATTENDANCE_ABSENT",
                            recipient_target=target_phone,
                            channel="WHATSAPP",
                            payload=wa_template
                        )
                        try:
                            await meta_whatsapp_client.send_template_message(
                                to_phone=target_phone,
                                template_name=wa_template["template_name"],
                                components=wa_template["components"]
                            )
                            await self._update_outbox_result(db, outbox.id, "SENT")
                        except Exception as exc:
                            logger.error(f"Failed to dispatch absence WhatsApp to {target_phone}: {exc}")
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
                        selectinload(Payment.allocations).selectinload(Invoice.enrollment)
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
                first_inv = pay.allocations[0].invoice if pay.allocations and pay.allocations[0].invoice else None
                inv_number = first_inv.invoice_number if first_inv else "INV-ACADEMIC"
                balance_amount = float(first_inv.balance_amount) if first_inv else 0.0
                course_name = first_inv.course_name if first_inv and hasattr(first_inv, "course_name") and first_inv.course_name else "Academic Tuition"
                receipt_num = pay.receipt_number or pay.payment_number or f"RCP-{pay.id.hex[:8].upper()}"

                # 1. WhatsApp Receipt
                if parent_phone:
                    wa_payload = format_payment_receipt_whatsapp(
                        parent_name=parent_name,
                        amount=float(pay.amount),
                        student_name=student_name,
                        invoice_number=inv_number,
                        receipt_number=receipt_num,
                        balance=balance_amount
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="PAYMENT_RECEIPT",
                        recipient_target=parent_phone,
                        channel="WHATSAPP",
                        payload=wa_payload
                    )
                    try:
                        await meta_whatsapp_client.send_template_message(
                            to_phone=parent_phone,
                            template_name=wa_payload["template_name"],
                            components=wa_payload["components"]
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch payment WhatsApp to {parent_phone}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                # 2. Email Receipt
                if parent_email:
                    email_data = format_payment_receipt_email(
                        parent_name=parent_name,
                        amount=float(pay.amount),
                        student_name=student_name,
                        invoice_number=inv_number,
                        receipt_number=receipt_num,
                        payment_mode=pay.payment_mode,
                        balance=balance_amount,
                        course_name=course_name
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="PAYMENT_RECEIPT",
                        recipient_target=parent_email,
                        channel="EMAIL",
                        payload={"subject": email_data["subject"]}
                    )
                    try:
                        await brevo_email_client.send_transactional_email(
                            to_email=parent_email,
                            to_name=parent_name,
                            subject=email_data["subject"],
                            html_content=email_data["html_content"]
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch payment Email to {parent_email}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_payment_receipt: {e}", exc_info=True)

    # -------------------------------------------------------------------------
    # 3. FEE DUE / OVERDUE REMINDER
    # -------------------------------------------------------------------------
    async def dispatch_fee_reminder(self, invoice_id: uuid.UUID, installment_id: Optional[uuid.UUID] = None):
        """Dispatches an upcoming fee installment due reminder via WhatsApp."""
        async with AsyncSessionLocal() as db:
            try:
                query = (
                    select(Invoice)
                    .options(
                        selectinload(Invoice.student)
                        .selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian),
                        selectinload(Invoice.installments)
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

                # Target installment
                target_inst = None
                if installment_id:
                    target_inst = next((i for i in inv.installments if i.id == installment_id), None)
                if not target_inst:
                    # Pick first unpaid installment
                    unpaid = [i for i in inv.installments if i.status != "PAID"]
                    target_inst = unpaid[0] if unpaid else None

                if not target_inst or not parent_phone:
                    return

                wa_payload = format_fee_reminder_whatsapp(
                    parent_name=parent_name,
                    installment_number=target_inst.installment_number,
                    amount=float(target_inst.amount),
                    student_name=student_name,
                    due_date=str(target_inst.due_date)
                )
                outbox = await self._log_outbox(
                    db,
                    event_type="FEE_DUE_REMINDER",
                    recipient_target=parent_phone,
                    channel="WHATSAPP",
                    payload=wa_payload
                )
                try:
                    await meta_whatsapp_client.send_template_message(
                        to_phone=parent_phone,
                        template_name=wa_payload["template_name"],
                        components=wa_payload["components"]
                    )
                    await self._update_outbox_result(db, outbox.id, "SENT")
                except Exception as exc:
                    logger.error(f"Failed to dispatch fee reminder to {parent_phone}: {exc}")
                    await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_fee_reminder: {e}", exc_info=True)

    # -------------------------------------------------------------------------
    # 4. EXAM RESULT PUBLISHED
    # -------------------------------------------------------------------------
    async def dispatch_exam_results(self, exam_id: uuid.UUID):
        """Dispatches WhatsApp test scorecards to parents when an examination is published."""
        async with AsyncSessionLocal() as db:
            try:
                query = (
                    select(Examination)
                    .options(
                        selectinload(Examination.results)
                        .selectinload(ExamResult.student)
                        .selectinload(Student.guardians)
                        .selectinload(StudentGuardian.guardian),
                        selectinload(Examination.exam_subjects).selectinload(ExamSubject.subject)
                    )
                    .where(Examination.id == exam_id)
                )
                res = await db.execute(query)
                exam = res.scalar_one_or_none()
                if not exam or not exam.results:
                    return

                exam_name = exam.name
                # Derive subject name safely from exam_subjects relation
                subject_names = [es.subject.name for es in (exam.exam_subjects or []) if es.subject]
                subject_name = ", ".join(subject_names) if subject_names else (exam_name or "Curriculum Evaluation")

                for r in exam.results:
                    stu = r.student
                    if not stu:
                        continue

                    student_name = f"{stu.first_name} {stu.last_name}".strip()
                    parent_name, parent_phone, parent_email = self._resolve_contact(stu)

                    marks_obtained = float(r.total_obtained) if r.total_obtained is not None else 0.0
                    max_marks = float(r.total_possible) if r.total_possible is not None else 100.0
                    percentage = float(r.percentage) if r.percentage is not None else round((marks_obtained / max_marks) * 100, 2)

                    if parent_phone:
                        wa_payload = format_exam_result_whatsapp(
                            parent_name=parent_name,
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
                            recipient_target=parent_phone,
                            channel="WHATSAPP",
                            payload=wa_payload
                        )
                        try:
                            await meta_whatsapp_client.send_template_message(
                                to_phone=parent_phone,
                                template_name=wa_payload["template_name"],
                                components=wa_payload["components"]
                            )
                            await self._update_outbox_result(db, outbox.id, "SENT")
                        except Exception as exc:
                            logger.error(f"Failed to dispatch exam result to {parent_phone}: {exc}")
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

                # 1. WhatsApp Welcome
                phones_to_send = []
                if parent_phone:
                    phones_to_send.append(parent_phone)
                if stu.mobile and stu.mobile != parent_phone:
                    phones_to_send.append(stu.mobile)

                for target_phone in phones_to_send:
                    wa_payload = format_admission_welcome_whatsapp(
                        student_name=student_name,
                        course_name=course_name,
                        prn=prn
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="ADMISSION_CONFIRMED",
                        recipient_target=target_phone,
                        channel="WHATSAPP",
                        payload=wa_payload
                    )
                    try:
                        await meta_whatsapp_client.send_template_message(
                            to_phone=target_phone,
                            template_name=wa_payload["template_name"],
                            components=wa_payload["components"]
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch welcome WhatsApp to {target_phone}: {exc}")
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


notification_dispatcher = NotificationDispatcher()
