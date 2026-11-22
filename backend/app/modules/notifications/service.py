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
from app.models.student import Student, StudentGuardian
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
                        selectinload(AttendanceSession.records).selectinload(AttendanceRecord.student).selectinload(Student.guardians),
                        selectinload(AttendanceSession.batch_subject).selectinload(BatchSubject.batch),
                        selectinload(AttendanceSession.batch_subject).selectinload(BatchSubject.subject),
                        selectinload(AttendanceSession.batch_subject).selectinload(BatchSubject.batch).selectinload(Batch.academic_class)
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
                class_name = bs.batch.academic_class.name if bs and bs.batch and bs.batch.academic_class else "Regular Batch"
                date_str = str(sess.session_date)

                absent_records = [r for r in sess.records if r.status == "ABSENT"]
                logger.info(f"Dispatching absence alerts for {len(absent_records)} absent students in session {session_id}")

                for rec in absent_records:
                    stu = rec.student
                    if not stu:
                        continue

                    student_name = f"{stu.first_name} {stu.last_name}"
                    
                    # Determine primary parent / guardian contact
                    guardians = stu.guardians or []
                    primary_guardian = next((g for g in guardians if g.receives_notifications), None) or (guardians[0] if guardians else None)
                    parent_name = f"{primary_guardian.first_name} {primary_guardian.last_name}" if primary_guardian else "Parent / Guardian"
                    parent_phone = primary_guardian.mobile if primary_guardian and primary_guardian.mobile else stu.mobile
                    parent_email = primary_guardian.email if primary_guardian and primary_guardian.email else stu.email

                    # 1. WhatsApp Alert
                    if parent_phone:
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
                            recipient_target=parent_phone,
                            channel="WHATSAPP",
                            payload=wa_template
                        )
                        try:
                            await meta_whatsapp_client.send_template_message(
                                to_phone=parent_phone,
                                template_name=wa_template["template_name"],
                                components=wa_template["components"]
                            )
                            await self._update_outbox_result(db, outbox.id, "SENT")
                        except Exception as exc:
                            logger.error(f"Failed to dispatch absence WhatsApp to {parent_phone}: {exc}")
                            await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                    # 2. Email Alert (if email on record)
                    if parent_email:
                        email_data = format_attendance_absent_email(
                            parent_name=parent_name,
                            student_name=student_name,
                            subject_name=subject_name,
                            class_name=class_name,
                            date_str=date_str
                        )
                        outbox = await self._log_outbox(
                            db,
                            event_type="ATTENDANCE_ABSENT",
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
                            logger.error(f"Failed to dispatch absence Email to {parent_email}: {exc}")
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
                        selectinload(Payment.student).selectinload(Student.guardians),
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
                student_name = f"{stu.first_name} {stu.last_name}"
                guardians = stu.guardians or []
                primary_guardian = next((g for g in guardians if g.receives_notifications), None) or (guardians[0] if guardians else None)
                parent_name = f"{primary_guardian.first_name} {primary_guardian.last_name}" if primary_guardian else "Parent / Guardian"
                parent_phone = primary_guardian.mobile if primary_guardian and primary_guardian.mobile else stu.mobile
                parent_email = primary_guardian.email if primary_guardian and primary_guardian.email else stu.email

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
                        selectinload(Invoice.student).selectinload(Student.guardians),
                        selectinload(Invoice.installments)
                    )
                    .where(Invoice.id == invoice_id)
                )
                res = await db.execute(query)
                inv = res.scalar_one_or_none()
                if not inv or not inv.student:
                    return

                stu = inv.student
                student_name = f"{stu.first_name} {stu.last_name}"
                guardians = stu.guardians or []
                primary_guardian = next((g for g in guardians if g.receives_notifications), None) or (guardians[0] if guardians else None)
                parent_name = f"{primary_guardian.first_name} {primary_guardian.last_name}" if primary_guardian else "Parent / Guardian"
                parent_phone = primary_guardian.mobile if primary_guardian and primary_guardian.mobile else stu.mobile

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
                        selectinload(Examination.results).selectinload(ExamResult.student).selectinload(Student.guardians)
                    )
                    .where(Examination.id == exam_id)
                )
                res = await db.execute(query)
                exam = res.scalar_one_or_none()
                if not exam or not exam.results:
                    return

                exam_name = exam.name
                subject_name = exam.subject_name or "Curriculum Subject"
                max_marks = float(exam.max_marks or 100.0)

                for r in exam.results:
                    stu = r.student
                    if not stu:
                        continue

                    student_name = f"{stu.first_name} {stu.last_name}"
                    guardians = stu.guardians or []
                    primary_guardian = next((g for g in guardians if g.receives_notifications), None) or (guardians[0] if guardians else None)
                    parent_name = f"{primary_guardian.first_name} {primary_guardian.last_name}" if primary_guardian else "Parent / Guardian"
                    parent_phone = primary_guardian.mobile if primary_guardian and primary_guardian.mobile else stu.mobile

                    if parent_phone:
                        wa_payload = format_exam_result_whatsapp(
                            parent_name=parent_name,
                            exam_name=exam_name,
                            subject_name=subject_name,
                            student_name=student_name,
                            marks_obtained=float(r.total_obtained),
                            max_marks=max_marks,
                            percentage=float(r.percentage)
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
                query = select(Student).options(selectinload(Student.guardians)).where(Student.id == student_id)
                res = await db.execute(query)
                stu = res.scalar_one_or_none()
                if not stu:
                    return

                student_name = f"{stu.first_name} {stu.last_name}"
                prn = stu.prn or stu.student_code or "PRN-PENDING"
                
                # Fetch course name
                course_name = "Academic Coaching Program"
                if enrollment_id:
                    enr_res = await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id))
                    enr = enr_res.scalar_one_or_none()
                    if enr and enr.course_name:
                        course_name = enr.course_name

                guardians = stu.guardians or []
                primary_guardian = next((g for g in guardians if g.receives_notifications), None) or (guardians[0] if guardians else None)
                parent_phone = primary_guardian.mobile if primary_guardian and primary_guardian.mobile else stu.mobile
                parent_email = primary_guardian.email if primary_guardian and primary_guardian.email else stu.email

                # 1. WhatsApp Welcome
                if parent_phone:
                    wa_payload = format_admission_welcome_whatsapp(
                        student_name=student_name,
                        course_name=course_name,
                        prn=prn
                    )
                    outbox = await self._log_outbox(
                        db,
                        event_type="ADMISSION_CONFIRMED",
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
                        logger.error(f"Failed to dispatch welcome WhatsApp to {parent_phone}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

                # 2. Email Welcome
                if parent_email:
                    subject = f"Welcome to Yashodeep Coaching Classes - Enrollment Confirmed ({prn})"
                    html_content = wrap_html_email(
                        title=subject,
                        content_body=f"""
                        <p>Dear Student & Parents,</p>
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
                        recipient_target=parent_email,
                        channel="EMAIL",
                        payload={"subject": subject}
                    )
                    try:
                        await brevo_email_client.send_transactional_email(
                            to_email=parent_email,
                            to_name=student_name,
                            subject=subject,
                            html_content=html_content
                        )
                        await self._update_outbox_result(db, outbox.id, "SENT")
                    except Exception as exc:
                        logger.error(f"Failed to dispatch welcome Email to {parent_email}: {exc}")
                        await self._update_outbox_result(db, outbox.id, "FAILED", str(exc))

            except Exception as e:
                logger.error(f"Error in dispatch_admission_welcome: {e}", exc_info=True)


notification_dispatcher = NotificationDispatcher()
