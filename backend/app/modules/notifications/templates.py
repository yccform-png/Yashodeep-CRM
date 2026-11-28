"""
Notification Templates Engine for Meta WhatsApp Business & Brevo Transactional Email.
Provides standard components formatting for Meta Cloud API and responsive HTML templates for Brevo.
"""
import re
import urllib.parse
from typing import Dict, Any, List, Optional


def normalize_phone_for_whatsapp(raw_phone: str, default_country_code: str = "91") -> str:
    """Cleans phone numbers into international digits without leading zeroes or plus symbol."""
    if not raw_phone:
        return ""
    digits = re.sub(r"\D", "", raw_phone)
    if not digits:
        return ""
    if len(digits) == 10:
        return f"{default_country_code}{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"{default_country_code}{digits[1:]}"
    return digits


def build_whatsapp_click_url(phone: str, text: str) -> str:
    """Builds a https://wa.me/ deep link with pre-filled encoded text."""
    norm = normalize_phone_for_whatsapp(phone)
    if not norm:
        return ""
    return f"https://wa.me/{norm}?text={urllib.parse.quote(text)}"


# -----------------------------------------------------------------------------
# Base HTML Layout Wrapper for Brevo Emails
# -----------------------------------------------------------------------------
def wrap_html_email(title: str, content_body: str, institute_name: str = "Yashodeep Coaching Classes") -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .header {{ background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 24px 32px; text-align: left; }}
    .header h1 {{ color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }}
    .header p {{ color: #c7d2fe; margin: 4px 0 0 0; font-size: 12px; }}
    .content {{ padding: 32px; line-height: 1.6; font-size: 14px; }}
    .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }}
    .badge-rose {{ background: #ffe4e6; color: #be123c; }}
    .badge-emerald {{ background: #d1fae5; color: #047857; }}
    .badge-indigo {{ background: #e0e7ff; color: #4338ca; }}
    .footer {{ background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{institute_name}</h1>
      <p>Official Academic Notification System</p>
    </div>
    <div class="content">
      {content_body}
    </div>
    <div class="footer">
      <p>© {institute_name} • Kuditre, Karveer, Kolhapur, Maharashtra</p>
      <p>This is an automated institutional notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>"""


# -----------------------------------------------------------------------------
# 1. ATTENDANCE ABSENT
# -----------------------------------------------------------------------------
def format_attendance_absent_whatsapp(
    parent_name: str,
    student_name: str,
    subject_name: str,
    class_name: str,
    date_str: str
) -> Dict[str, Any]:
    """Meta WhatsApp Template: ycc_attendance_absent"""
    return {
        "template_name": "ycc_attendance_absent",
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": parent_name or "Parent / Guardian"},
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": subject_name},
                    {"type": "text", "text": class_name or "Regular Batch"},
                    {"type": "text", "text": date_str}
                ]
            }
        ]
    }


def format_attendance_absent_email(
    parent_name: str,
    student_name: str,
    subject_name: str,
    class_name: str,
    date_str: str
) -> Dict[str, str]:
    subject = f"Attendance Notice: {student_name} marked ABSENT on {date_str}"
    body = f"""
    <p>Dear <strong>{parent_name or 'Parent/Guardian'}</strong>,</p>
    <p>This is an official communication regarding your child's lecture attendance at our institute today.</p>
    
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 13px; font-weight: bold; color: #0f172a;">Student: {student_name}</span>
        <span class="badge badge-rose">ABSENT</span>
      </div>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Curriculum Subject:</strong> {subject_name}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Academic Class:</strong> {class_name}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Session Date:</strong> {date_str}</p>
    </div>

    <p style="color: #475569; font-size: 13px;">
      Regular attendance is crucial for continuous academic excellence. If this absence was planned or due to illness, 
      please notify the academic coordinator. If unexpected, please contact the institute front desk immediately.
    </p>
    """
    return {
        "subject": subject,
        "html_content": wrap_html_email(subject, body)
    }


# -----------------------------------------------------------------------------
# 2. FEE PAYMENT RECEIPT
# -----------------------------------------------------------------------------
def format_payment_receipt_whatsapp(
    parent_name: str,
    amount: float,
    student_name: str,
    invoice_number: str,
    receipt_number: str,
    balance: float
) -> Dict[str, Any]:
    """Meta WhatsApp Template: ycc_payment_receipt"""
    return {
        "template_name": "ycc_payment_receipt",
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": parent_name or "Parent / Guardian"},
                    {"type": "text", "text": f"₹{amount:,.2f}"},
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": invoice_number},
                    {"type": "text", "text": receipt_number},
                    {"type": "text", "text": f"₹{balance:,.2f}"}
                ]
            }
        ]
    }


def format_payment_receipt_email(
    parent_name: str,
    amount: float,
    student_name: str,
    invoice_number: str,
    receipt_number: str,
    payment_mode: str,
    balance: float,
    course_name: str
) -> Dict[str, str]:
    subject = f"Official Fee Receipt #{receipt_number} - ₹{amount:,.2f} Received ({student_name})"
    body = f"""
    <p>Dear <strong>{parent_name or 'Parent/Guardian'}</strong>,</p>
    <p>We gratefully acknowledge receipt of payment towards academic tuition and services.</p>
    
    <div class="card" style="border-left: 4px solid #059669;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 14px; font-weight: 800; color: #047857;">Payment Receipt Confirmed</span>
        <span class="badge badge-emerald">PAID</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b;">Receipt Number:</td><td style="font-weight: bold; font-family: monospace;">{receipt_number}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Invoice Reference:</td><td style="font-weight: bold; font-family: monospace;">{invoice_number}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Student:</td><td style="font-weight: bold;">{student_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Program / Course:</td><td>{course_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Payment Mode:</td><td>{payment_mode}</td></tr>
        <tr style="border-top: 1px dashed #cbd5e1;"><td style="padding: 8px 0; font-weight: bold; color: #0f172a;">Amount Paid:</td><td style="font-weight: 800; font-size: 16px; color: #047857;">₹{amount:,.2f}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Outstanding Balance:</td><td style="font-weight: bold; color: #b45309;">₹{balance:,.2f}</td></tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #64748b;">
      Please retain this electronic receipt confirmation for your financial and tax records.
    </p>
    """
    return {
        "subject": subject,
        "html_content": wrap_html_email(subject, body)
    }


# -----------------------------------------------------------------------------
# 3. FEE DUE REMINDER
# -----------------------------------------------------------------------------
def format_fee_reminder_whatsapp(
    parent_name: str,
    installment_number: int,
    amount: float,
    student_name: str,
    due_date: str
) -> Dict[str, Any]:
    """Meta WhatsApp Template: ycc_fee_reminder"""
    return {
        "template_name": "ycc_fee_reminder",
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": parent_name or "Parent / Guardian"},
                    {"type": "text", "text": str(installment_number)},
                    {"type": "text", "text": f"₹{amount:,.2f}"},
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": due_date}
                ]
            }
        ]
    }


def format_fee_reminder_whatsapp_text(
    parent_name: str,
    installment_number: int,
    amount: float,
    student_name: str,
    due_date: str,
    invoice_number: Optional[str] = None,
    course_name: Optional[str] = None,
    is_overdue: bool = False
) -> str:
    """Formatted plain-text message suitable for direct WhatsApp click-to-chat links."""
    header = "⚠️ *FEE INSTALLMENT OVERDUE NOTICE*" if is_overdue else "🔔 *FEE INSTALLMENT DUE REMINDER*"
    lines = [
        header,
        "🏛️ *Yashodeep Coaching Classes*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"Dear *{parent_name or 'Parent / Guardian'}*,",
        "",
        f"This is a {'formal notice regarding an overdue installment' if is_overdue else 'courtesy reminder regarding an upcoming installment payment'} for *{student_name}*.",
        "",
        f"👤 *Student:* {student_name}",
    ]
    if course_name:
        lines.append(f"📚 *Course:* {course_name}")
    if invoice_number:
        lines.append(f"📋 *Invoice Ref:* {invoice_number}")
    lines.extend([
        f"🔢 *Installment:* #{installment_number}",
        f"📅 *Scheduled Due Date:* {due_date}",
        f"💰 *Payable Amount:* ₹{amount:,.2f}",
        "",
        f"Kindly arrange to clear the dues on or before *{due_date}* to ensure continuous classes and access to academic services.",
        "",
        "If you have already completed this payment, please disregard this notification.",
        "",
        "Regards,",
        "*Yashodeep Coaching Classes*",
        "📞 Contact: +91 9876543210"
    ])
    return "\n".join(lines)



def format_fee_reminder_email(
    parent_name: str,
    student_name: str,
    installment_number: int,
    amount: float,
    due_date: str,
    invoice_number: str,
    course_name: str = "Enrolled Academic Course",
    is_overdue: bool = False
) -> Dict[str, str]:
    badge_label = "OVERDUE" if is_overdue else "UPCOMING DUE"
    badge_class = "badge-rose" if is_overdue else "badge-amber"
    border_color = "#e11d48" if is_overdue else "#f59e0b"
    title_text = "Important: Fee Installment Overdue" if is_overdue else "Fee Installment Due Reminder"
    subject = f"{'⚠️ Fee Overdue Notice' if is_overdue else '📅 Fee Installment Due Reminder'} - Inst #{installment_number} of ₹{amount:,.2f} ({student_name})"

    body = f"""
    <p>Dear <strong>{parent_name or 'Parent / Guardian'}</strong>,</p>
    <p>This is a {'formal notice regarding an overdue installment' if is_overdue else 'courtesy reminder regarding an upcoming installment payment'} for <strong>{student_name}</strong>.</p>
    
    <div class="card" style="border-left: 4px solid {border_color};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 14px; font-weight: 800; color: {'#be123c' if is_overdue else '#b45309'};">{title_text}</span>
        <span class="badge {badge_class}">{badge_label}</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b;">Student:</td><td style="font-weight: bold;">{student_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Course / Program:</td><td>{course_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Invoice Reference:</td><td style="font-weight: bold; font-family: monospace;">{invoice_number}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Installment:</td><td style="font-weight: bold;">Installment #{installment_number}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Scheduled Due Date:</td><td style="font-weight: bold; color: {'#e11d48' if is_overdue else '#0f172a'};">{due_date}</td></tr>
        <tr style="border-top: 1px dashed #cbd5e1;"><td style="padding: 8px 0; font-weight: bold; color: #0f172a;">Amount Payable:</td><td style="font-weight: 800; font-size: 16px; color: {'#e11d48' if is_overdue else '#047857'};">₹{amount:,.2f}</td></tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #475569; margin-top: 16px;">
      Please clear the scheduled dues on or before <strong>{due_date}</strong> to ensure uninterrupted classes and access to academic services.
    </p>
    <p style="font-size: 12px; color: #64748b;">
      For online payment options or account queries, please visit the institute administration desk or reply to this email.
    </p>
    """
    return {
        "subject": subject,
        "html_content": wrap_html_email(subject, body)
    }


# -----------------------------------------------------------------------------
# 4. EXAM RESULT PUBLISHED
# -----------------------------------------------------------------------------
def format_exam_result_whatsapp(
    parent_name: str,
    exam_name: str,
    subject_name: str,
    student_name: str,
    marks_obtained: float,
    max_marks: float,
    percentage: float
) -> Dict[str, Any]:
    """Meta WhatsApp Template: ycc_exam_result"""
    return {
        "template_name": "ycc_exam_result",
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": parent_name or "Parent / Guardian"},
                    {"type": "text", "text": exam_name},
                    {"type": "text", "text": subject_name},
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": f"{marks_obtained:g}"},
                    {"type": "text", "text": f"{max_marks:g}"},
                    {"type": "text", "text": f"{percentage:.1f}"}
                ]
            }
        ]
    }


def format_exam_result_whatsapp_text(
    parent_name: str,
    exam_name: str,
    subject_name: str,
    student_name: str,
    marks_obtained: float,
    max_marks: float,
    percentage: float,
    grade: Optional[str] = None,
    is_pass: Optional[bool] = None,
    rank: Optional[int] = None
) -> str:
    """Formatted plain-text scorecard suitable for direct WhatsApp click-to-chat links."""
    status_str = "PASSED ✅" if (is_pass if is_pass is not None else percentage >= 35.0) else "NEEDS ATTENTION ⚠️"
    grade_str = grade or ("A+" if percentage >= 90 else ("A" if percentage >= 80 else ("B+" if percentage >= 70 else ("B" if percentage >= 60 else "C"))))

    lines = [
        "📊 *ACADEMIC EVALUATION SCORECARD*",
        "🏛️ *Yashodeep Coaching Classes*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"Dear *{parent_name or 'Parent / Guardian'}*,",
        "",
        f"Official test scorecard for *{student_name}* has been declared:",
        "",
        f"👤 *Student Name:* {student_name}",
        f"📝 *Examination:* {exam_name}",
        f"📚 *Subject / Paper:* {subject_name}",
        f"📈 *Marks Obtained:* {marks_obtained:g} / {max_marks:g}",
        f"🎯 *Percentage:* {percentage:.1f}%",
        f"🏆 *Grade Awarded:* {grade_str}",
        f"✨ *Evaluation Status:* {status_str}",
    ]
    if rank:
        lines.append(f"🏅 *Merit Rank in Class:* #{rank}")
    lines.extend([
        "",
        "Keep encouraging the student to excel further! For any academic discussion or performance review, please feel free to visit the institute.",
        "",
        "Warm regards,",
        "*Yashodeep Coaching Classes*",
        "📞 Contact: +91 9876543210"
    ])
    return "\n".join(lines)



def format_exam_result_email(
    parent_name: str,
    student_name: str,
    exam_name: str,
    exam_code: str,
    subject_name: str,
    marks_obtained: float,
    max_marks: float,
    percentage: float,
    grade: str,
    is_pass: bool = True,
    academic_class: Optional[str] = None
) -> Dict[str, str]:
    badge_label = "PASSED" if is_pass else "NEEDS IMPROVEMENT"
    badge_class = "badge-emerald" if is_pass else "badge-rose"
    border_color = "#059669" if is_pass else "#e11d48"
    result_color = "#047857" if is_pass else "#be123c"
    subject = f"Academic Performance Scorecard: {exam_name} - {student_name} ({marks_obtained:g}/{max_marks:g} • {percentage:.1f}%)"

    class_row = f'<tr><td style="padding: 4px 0; color: #64748b;">Class / Standard:</td><td>{academic_class}</td></tr>' if academic_class else ''

    body = f"""
    <p>Dear <strong>{parent_name or 'Parent / Guardian'}</strong>,</p>
    <p>The academic evaluation results for <strong>{student_name}</strong> have been officially published by Yashodeep Coaching Classes faculty.</p>
    
    <div class="card" style="border-left: 4px solid {border_color};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 14px; font-weight: 800; color: {result_color};">Official Examination Scorecard</span>
        <span class="badge {badge_class}">{badge_label}</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 0; color: #64748b;">Student:</td><td style="font-weight: bold;">{student_name}</td></tr>
        {class_row}
        <tr><td style="padding: 4px 0; color: #64748b;">Examination:</td><td style="font-weight: bold;">{exam_name}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Assessment Code:</td><td style="font-family: monospace; font-weight: 600;">{exam_code}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Subject / Paper:</td><td style="font-weight: bold; color: #4338ca;">{subject_name}</td></tr>
        <tr style="border-top: 1px dashed #cbd5e1;"><td style="padding: 8px 0; font-weight: bold; color: #0f172a;">Marks Obtained:</td><td style="font-weight: 800; font-size: 16px; color: {result_color};">{marks_obtained:g} / {max_marks:g}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Percentage:</td><td style="font-weight: 800; font-size: 15px; color: #0f172a;">{percentage:.1f}%</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Performance Grade:</td><td style="font-weight: 800; font-size: 14px; color: #4338ca;">{grade}</td></tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #475569; margin-top: 16px;">
      Our faculty conducts regular evaluations to assess concept mastery, retention, and exam preparedness. For personalized academic feedback, please visit the institute during teacher interaction hours.
    </p>
    <p style="font-size: 12px; color: #64748b;">
      Yashodeep Coaching Classes • Committed to Academic Excellence
    </p>
    """
    return {
        "subject": subject,
        "html_content": wrap_html_email(subject, body)
    }


# -----------------------------------------------------------------------------
# 5. ADMISSION CONFIRMED / WELCOME
# -----------------------------------------------------------------------------
def format_admission_welcome_whatsapp(
    student_name: str,
    course_name: str,
    prn: str
) -> Dict[str, Any]:
    """Meta WhatsApp Template: ycc_admission_welcome"""
    return {
        "template_name": "ycc_admission_welcome",
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": course_name},
                    {"type": "text", "text": prn}
                ]
            }
        ]
    }


# -----------------------------------------------------------------------------
# 6. PROMOTION & NEXT-YEAR ENROLLMENT CONFIRMATION
# -----------------------------------------------------------------------------
def format_promotion_confirmation_whatsapp(
    parent_name: str,
    student_name: str,
    promoted_class_name: str,
    academic_year_name: str,
    invoice_number: str,
    total_amount: str
) -> Dict[str, Any]:
    """Meta WhatsApp Template: ycc_promotion_confirmation"""
    return {
        "template_name": "ycc_promotion_confirmation",
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": parent_name},
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": promoted_class_name},
                    {"type": "text", "text": academic_year_name},
                    {"type": "text", "text": invoice_number},
                    {"type": "text", "text": total_amount}
                ]
            }
        ]
    }


def format_promotion_confirmation_email(
    student_name: str,
    prn: str,
    old_class_name: str,
    new_class_name: str,
    new_batch_name: str,
    academic_year_name: str,
    invoice_number: str,
    total_amount: str,
    installments: List[Dict[str, Any]],
    portal_url: Optional[str] = None
) -> Dict[str, Any]:
    subject = f"Promotion Confirmed: {student_name} Promoted to {new_class_name} ({academic_year_name}) - Yashodeep Career Coaching"

    installments_html = "".join([
        f"""
        <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">#{inst.get('number', i + 1)}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #475569;">{inst.get('due_date', '—')}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a;">₹{float(inst.get('amount', 0)):,.2f}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #fef3c7; color: #92400e;">SCHEDULED</span>
            </td>
        </tr>
        """
        for i, inst in enumerate(installments)
    ])

    body = f"""
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; color: #166534; font-size: 16px; font-weight: 700;">🎉 Academic Promotion Confirmed!</h3>
        <p style="margin: 0; color: #15803d; font-size: 14px; line-height: 1.5;">
            We are proud to confirm that <strong>{student_name}</strong> (PRN: <code>{prn}</code>) has successfully completed <strong>{old_class_name}</strong> and is officially promoted to <strong>{new_class_name}</strong> for the upcoming <strong>Academic Session {academic_year_name}</strong>.
        </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 16px; color: #64748b; font-size: 13px; width: 40%;">Student Name</td>
            <td style="padding: 12px 16px; font-weight: 700; color: #0f172a; font-size: 13px;">{student_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fafafa;">
            <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Permanent Reg. # (PRN)</td>
            <td style="padding: 12px 16px; font-weight: 700; color: #0284c7; font-family: monospace; font-size: 13px;">{prn}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Promoted Standard & Cohort</td>
            <td style="padding: 12px 16px; font-weight: 700; color: #4338ca; font-size: 13px;">{new_class_name} — {new_batch_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fafafa;">
            <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Academic Session</td>
            <td style="padding: 12px 16px; font-weight: 600; color: #0f172a; font-size: 13px;">{academic_year_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Tuition Invoice Number</td>
            <td style="padding: 12px 16px; font-weight: 700; color: #0f172a; font-size: 13px;">{invoice_number}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
            <td style="padding: 14px 16px; font-weight: 700; color: #0f172a; font-size: 14px;">Total Billed Amount</td>
            <td style="padding: 14px 16px; font-weight: 800; color: #16a34a; font-size: 16px;">₹{float(total_amount):,.2f}</td>
        </tr>
    </table>

    <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px; font-weight: 700;">Scheduled Installment Plan ({academic_year_name})</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
            <tr style="background-color: #f1f5f9; text-align: left; color: #475569; font-size: 12px; text-transform: uppercase;">
                <th style="padding: 10px 14px;">Installment</th>
                <th style="padding: 10px 14px;">Scheduled Due Date</th>
                <th style="padding: 10px 14px; text-align: right;">Amount</th>
                <th style="padding: 10px 14px; text-align: center;">Status</th>
            </tr>
        </thead>
        <tbody>
            {installments_html if installments_html else '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #64748b;">Full payment upfront scheduled.</td></tr>'}
        </tbody>
    </table>

    <p style="margin: 0 0 16px 0; color: #475569; font-size: 13px; line-height: 1.6;">
        Classes for the new session will commence according to the academic calendar. Please ensure fees are remitted on or before their due dates for uninterrupted class access, study materials, and tests.
    </p>

    <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="{portal_url or 'https://yashodeep-crm.vercel.app'}" 
           style="background-color: #4338ca; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 14px;">
            Access Student Portal &amp; Pay Dues
        </a>
    </div>
    """

    return {
        "subject": subject,
        "html_content": wrap_html_email(subject, body)
    }


# -----------------------------------------------------------------------------
# 7. Facility Allocation Email (Study Room & Hostel)
# -----------------------------------------------------------------------------
def format_facility_allocation_email(
    student_name: str,
    prn: str,
    facility_type: str,  # "STUDY_ROOM" or "HOSTEL"
    unit_label: str,     # "Study Desk B-012" or "Hostel Bed B2"
    location_label: str, # "Main Reading Hall - Floor 1" or "Main Boys Hostel - Room 204"
    duration_months: int,
    start_date_str: str,
    end_date_str: str,
    monthly_charge: float,
    total_rent: float,
    deposit_amount: float,
    total_invoiced: float,
    invoice_number: str,
    payment_status: str,
    portal_url: Optional[str] = None
) -> Dict[str, str]:
    is_study_room = facility_type == "STUDY_ROOM"
    facility_title = "Study Room Desk" if is_study_room else "Hostel Bed"
    badge_color = "#0284c7" if is_study_room else "#4f46e5"

    subject = f"Yashodeep Coaching Classes - {facility_title} Allocation Confirmed ({unit_label})"

    pay_badge = (
        '<span style="background-color: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 11px;">PAID / CONFIRMED</span>'
        if payment_status == "PAID"
        else '<span style="background-color: #fef9c3; color: #854d0e; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 11px;">PAYMENT PENDING</span>'
    )

    guidelines = """
        <li style="margin-bottom: 6px;"><strong>Operational Timings:</strong> 6:00 AM – 10:30 PM (Mon to Sun).</li>
        <li style="margin-bottom: 6px;"><strong>Silence Protocol:</strong> Strictly maintain pin-drop silence in the reading hall. Phone calls strictly prohibited inside.</li>
        <li style="margin-bottom: 6px;"><strong>Desk Usage:</strong> Occupy only your assigned desk number. Do not exchange or swap without written approval.</li>
        <li style="margin-bottom: 6px;"><strong>Locker Key:</strong> Keep your locker key secure. Refundable deposit returned upon vacating desk.</li>
    """ if is_study_room else """
        <li style="margin-bottom: 6px;"><strong>Curfew & Gate Timings:</strong> Hostel gates close at 9:00 PM sharp. Late entry requires prior warden permission.</li>
        <li style="margin-bottom: 6px;"><strong>Mess Schedule:</strong> Breakfast (7:30 - 9:00 AM), Lunch (12:30 - 2:00 PM), Dinner (7:30 - 9:00 PM).</li>
        <li style="margin-bottom: 6px;"><strong>Cleanliness:</strong> Maintain room hygiene. Electrical heating coils or induction cooktops prohibited.</li>
        <li style="margin-bottom: 6px;"><strong>Caution Deposit:</strong> Caution deposit refunded on checkout after room inventory inspection.</li>
    """

    body = f"""
    <div style="margin-bottom: 24px;">
        <span style="background-color: #e0f2fe; color: {badge_color}; padding: 6px 14px; border-radius: 9999px; font-weight: 800; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
            {facility_title} Allocated
        </span>
    </div>

    <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
        {facility_title} Allocation Confirmation
    </h2>

    <p style="color: #475569; font-size: 14px; margin: 0 0 20px 0; line-height: 1.6;">
        Dear <strong>{student_name}</strong> (and Parent / Guardian),<br>
        We are pleased to confirm your tenancy reservation for <strong>{unit_label}</strong> at Yashodeep Coaching Classes.
    </p>

    <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        Allocation &amp; Tenancy Details
    </h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b; width: 40%;">Student Name</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">{student_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
            <td style="padding: 10px 14px; color: #64748b;">PRN / Roll Number</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #4338ca; font-family: monospace;">{prn}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b;">Allocated Unit</td>
            <td style="padding: 10px 14px; font-weight: 800; color: #0f172a;">{unit_label}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
            <td style="padding: 10px 14px; color: #64748b;">Facility Location</td>
            <td style="padding: 10px 14px; color: #334155;">{location_label}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b;">Tenancy Period</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">
                {duration_months} Month{'s' if duration_months > 1 else ''} ({start_date_str} to {end_date_str})
            </td>
        </tr>
        <tr>
            <td style="padding: 10px 14px; color: #64748b;">Invoice Reference</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a; font-family: monospace;">{invoice_number}</td>
        </tr>
    </table>

    <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        Financial Breakdown
    </h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b;">Single Month Charge</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a; text-align: right;">₹{monthly_charge:,.2f} / month</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
            <td style="padding: 10px 14px; color: #64748b;">Duration Rate ({duration_months} Months)</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a; text-align: right;">₹{total_rent:,.2f}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b;">Security / Caution Deposit (Refundable)</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0369a1; text-align: right;">₹{deposit_amount:,.2f}</td>
        </tr>
        <tr style="background-color: #f1f5f9;">
            <td style="padding: 12px 14px; font-weight: 800; color: #0f172a; font-size: 14px;">Total Billed Amount</td>
            <td style="padding: 12px 14px; font-weight: 800; color: #15803d; font-size: 15px; text-align: right;">₹{total_invoiced:,.2f}</td>
        </tr>
        <tr>
            <td style="padding: 10px 14px; color: #64748b;">Payment Status</td>
            <td style="padding: 10px 14px; text-align: right;">{pay_badge}</td>
        </tr>
    </table>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <h5 style="margin: 0 0 8px 0; color: #1e293b; font-size: 12px; font-weight: 800; text-transform: uppercase;">
            Facility Rules &amp; Protocols
        </h5>
        <ul style="margin: 0; padding-left: 18px; color: #475569; font-size: 12px; line-height: 1.6;">
            {guidelines}
        </ul>
    </div>

    <div style="text-align: center; margin: 24px 0 12px 0;">
        <a href="{portal_url or 'https://yashodeepcoachingclasses.in'}" 
           style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 13px;">
            View Tenancy &amp; Download Invoice
        </a>
    </div>
    """

    return {
        "subject": subject,
        "html_content": wrap_html_email(subject, body)
    }


# -----------------------------------------------------------------------------
# 8. Facility Tenancy Expiring Reminders (T-3, T-2, T-1 Days)
# -----------------------------------------------------------------------------
def format_facility_expiring_whatsapp(
    recipient_name: str,
    student_name: str,
    facility_type: str,
    unit_label: str,
    days_remaining: int,
    end_date_str: str,
    monthly_renewal_charge: float,
    language_code: str = "en_US"
) -> Dict[str, Any]:
    """Meta WhatsApp Template: ycc_facility_expiring"""
    facility_title = "Study Room Desk" if facility_type == "STUDY_ROOM" else "Hostel Bed"
    day_text = "TOMORROW" if days_remaining == 1 else f"in {days_remaining} days"

    return {
        "template_name": "ycc_facility_expiring",
        "name": "ycc_facility_expiring",
        "language": {"code": language_code},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": recipient_name},
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": f"{facility_title} ({unit_label})"},
                    {"type": "text", "text": day_text},
                    {"type": "text", "text": end_date_str},
                    {"type": "text", "text": f"₹{monthly_renewal_charge:,.2f}"}
                ]
            }
        ]
    }


def format_facility_expiring_whatsapp_text(
    recipient_name: str,
    student_name: str,
    facility_type: str,
    unit_label: str,
    days_remaining: int,
    end_date_str: str,
    monthly_renewal_charge: float,
    institute_phone: str = "+91 9428818019"
) -> str:
    """Formatted text message for direct WhatsApp sending / click-to-chat deep link."""
    facility_title = "Study Room Desk" if facility_type == "STUDY_ROOM" else "Hostel Bed"
    urgency_tag = "⚠️ URGENT: EXPIRES TOMORROW" if days_remaining == 1 else f"⏰ EXPIRES IN {days_remaining} DAYS"

    lines = [
        f"*{urgency_tag}*",
        f"*Yashodeep Coaching Classes - Facility Tenancy Renewal*",
        "",
        f"Dear *{recipient_name}*,",
        f"This is an automated reminder that the *{facility_title}* tenancy for *{student_name}* is expiring soon.",
        "",
        f"📋 *Tenancy Details:*",
        f"• Facility: *{facility_title}*",
        f"• Assigned Unit: *{unit_label}*",
        f"• Expiry Date: *{end_date_str}*",
        f"• Days Remaining: *{days_remaining} Day{'s' if days_remaining > 1 else ''}*",
        f"• Monthly Renewal Fee: *₹{monthly_renewal_charge:,.2f}*",
        "",
        "💡 *Important Renewal Notice:*",
        f"To retain your assigned {unit_label.lower()} without interruption or de-allocation, please renew your tenancy at the earliest.",
        "",
        f"📞 *Renewal Assistance / Office:* {institute_phone}",
        "Thank you for choosing Yashodeep Coaching Classes!"
    ]
    return "\n".join(lines)


def format_facility_expiring_email(
    student_name: str,
    prn: str,
    facility_type: str,
    unit_label: str,
    location_label: str,
    days_remaining: int,
    end_date_str: str,
    monthly_renewal_charge: float,
    portal_url: Optional[str] = None
) -> Dict[str, str]:
    is_study_room = facility_type == "STUDY_ROOM"
    facility_title = "Study Room Desk" if is_study_room else "Hostel Bed"
    urgency_subject = "Expires Tomorrow!" if days_remaining == 1 else f"Expires in {days_remaining} Days"

    subject = f"Action Required: {facility_title} Tenancy for {student_name} ({unit_label}) {urgency_subject}"

    urgency_badge_color = "#b45309" if days_remaining > 1 else "#b91c1c"
    urgency_badge_bg = "#fef3c7" if days_remaining > 1 else "#fee2e2"
    banner_text = f"Expiring in {days_remaining} Day{'s' if days_remaining > 1 else ''}" if days_remaining > 1 else "Expiring Tomorrow"

    body = f"""
    <div style="margin-bottom: 24px;">
        <span style="background-color: {urgency_badge_bg}; color: {urgency_badge_color}; padding: 6px 14px; border-radius: 9999px; font-weight: 800; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
            ⚠️ Tenancy Renewal • {banner_text}
        </span>
    </div>

    <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
        {facility_title} Tenancy Expiring Soon
    </h2>

    <p style="color: #475569; font-size: 14px; margin: 0 0 20px 0; line-height: 1.6;">
        Dear <strong>{student_name}</strong> (and Parent / Guardian),<br>
        Your tenancy reservation for <strong>{unit_label}</strong> at Yashodeep Coaching Classes is scheduled to expire on <strong>{end_date_str}</strong> ({banner_text.lower()}).
    </p>

    <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        Current Allocation Summary
    </h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b; width: 40%;">Student Name</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">{student_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
            <td style="padding: 10px 14px; color: #64748b;">PRN / Roll Number</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #4338ca; font-family: monospace;">{prn}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b;">Allocated Unit</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">{unit_label}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
            <td style="padding: 10px 14px; color: #64748b;">Campus Location</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #334155;">{location_label}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b;">Plan Valid Until</td>
            <td style="padding: 10px 14px; font-weight: 800; color: {urgency_badge_color};">{end_date_str} ({banner_text.lower()})</td>
        </tr>
        <tr style="background-color: #f1f5f9;">
            <td style="padding: 12px 14px; font-weight: 800; color: #0f172a; font-size: 14px;">Monthly Renewal Charge</td>
            <td style="padding: 12px 14px; font-weight: 800; color: #0369a1; font-size: 15px; text-align: right;">₹{monthly_renewal_charge:,.2f}</td>
        </tr>
    </table>

    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <h5 style="margin: 0 0 8px 0; color: #92400e; font-size: 12px; font-weight: 800; text-transform: uppercase;">
            How to Renew Your Tenancy
        </h5>
        <p style="margin: 0; color: #78350f; font-size: 12px; line-height: 1.6;">
            1. Visit the Institute Administrative Office during office hours.<br>
            2. Choose your desired renewal extension (1, 3, 6, or 12 months).<br>
            3. Complete fee settlement via UPI, Cash, or Bank Transfer to ensure uninterrupted occupancy.
        </p>
    </div>

    <div style="text-align: center; margin: 24px 0 12px 0;">
        <a href="{portal_url or 'https://yashodeepcoachingclasses.in'}" 
           style="background-color: #d97706; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 13px;">
            Log in to Student Portal
        </a>
    </div>
    """

    return {
        "subject": subject,
        "html_content": wrap_html_email(subject, body)
    }


# -----------------------------------------------------------------------------
# 9. Facility Tenancy Expired Notice (Day 0 / +1 Renewal Grace)
# -----------------------------------------------------------------------------
def format_facility_expired_whatsapp(
    recipient_name: str,
    student_name: str,
    facility_type: str,
    unit_label: str,
    end_date_str: str,
    monthly_renewal_charge: float,
    language_code: str = "en_US"
) -> Dict[str, Any]:
    """Meta WhatsApp Template: ycc_facility_expired"""
    facility_title = "Study Room Desk" if facility_type == "STUDY_ROOM" else "Hostel Bed"

    return {
        "template_name": "ycc_facility_expired",
        "name": "ycc_facility_expired",
        "language": {"code": language_code},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": recipient_name},
                    {"type": "text", "text": student_name},
                    {"type": "text", "text": f"{facility_title} ({unit_label})"},
                    {"type": "text", "text": end_date_str},
                    {"type": "text", "text": f"₹{monthly_renewal_charge:,.2f}"}
                ]
            }
        ]
    }


def format_facility_expired_whatsapp_text(
    recipient_name: str,
    student_name: str,
    facility_type: str,
    unit_label: str,
    end_date_str: str,
    monthly_renewal_charge: float,
    institute_phone: str = "+91 9428818019"
) -> str:
    """Formatted text message for direct WhatsApp sending / click-to-chat deep link."""
    facility_title = "Study Room Desk" if facility_type == "STUDY_ROOM" else "Hostel Bed"

    lines = [
        "🚨 *IMPORTANT: TENANCY EXPIRED - RENEWAL PENDING*",
        "*Yashodeep Coaching Classes*",
        "",
        f"Dear *{recipient_name}*,",
        f"The *{facility_title}* tenancy for *{student_name}* ({unit_label}) expired on *{end_date_str}*.",
        "",
        "⏳ *Grace Period Notice:*",
        f"Your assigned {unit_label.lower()} is currently held in a temporary grace period. To avoid immediate de-allocation and assignment to waitlisted students, please renew your tenancy today.",
        "",
        f"• Monthly Renewal Fee: *₹{monthly_renewal_charge:,.2f}*",
        f"• Helpdesk / Warden Office: {institute_phone}",
        "",
        "Please visit the administration office or contact us immediately to retain your desk/bed."
    ]
    return "\n".join(lines)


def format_facility_expired_email(
    student_name: str,
    prn: str,
    facility_type: str,
    unit_label: str,
    location_label: str,
    end_date_str: str,
    monthly_renewal_charge: float,
    portal_url: Optional[str] = None
) -> Dict[str, str]:
    is_study_room = facility_type == "STUDY_ROOM"
    facility_title = "Study Room Desk" if is_study_room else "Hostel Bed"

    subject = f"Notice: {facility_title} Tenancy Expired for {student_name} ({unit_label}) - Immediate Renewal Required"

    body = f"""
    <div style="margin-bottom: 24px;">
        <span style="background-color: #fee2e2; color: #dc2626; padding: 6px 14px; border-radius: 9999px; font-weight: 800; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
            🚨 Tenancy Expired • Renewal Grace Period
        </span>
    </div>

    <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
        {facility_title} Tenancy Expired
    </h2>

    <p style="color: #475569; font-size: 14px; margin: 0 0 20px 0; line-height: 1.6;">
        Dear <strong>{student_name}</strong> (and Parent / Guardian),<br>
        Your tenancy reservation for <strong>{unit_label}</strong> at Yashodeep Coaching Classes expired on <strong>{end_date_str}</strong>.
    </p>

    <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        Expired Tenancy Record
    </h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b; width: 40%;">Student Name</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">{student_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
            <td style="padding: 10px 14px; color: #64748b;">PRN / Roll Number</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #4338ca; font-family: monospace;">{prn}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b;">Assigned Unit</td>
            <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">{unit_label}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
            <td style="padding: 10px 14px; color: #64748b;">Campus Location</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #334155;">{location_label}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 14px; color: #64748b;">Expired On</td>
            <td style="padding: 10px 14px; font-weight: 800; color: #dc2626;">{end_date_str}</td>
        </tr>
        <tr style="background-color: #f1f5f9;">
            <td style="padding: 12px 14px; font-weight: 800; color: #0f172a; font-size: 14px;">Renewal Rate</td>
            <td style="padding: 12px 14px; font-weight: 800; color: #0369a1; font-size: 15px; text-align: right;">₹{monthly_renewal_charge:,.2f} / month</td>
        </tr>
    </table>

    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <h5 style="margin: 0 0 8px 0; color: #991b1b; font-size: 12px; font-weight: 800; text-transform: uppercase;">
            Immediate Action Required
        </h5>
        <p style="margin: 0; color: #7f1d1d; font-size: 12px; line-height: 1.6;">
            Your assigned unit is currently held under a short grace period. If renewal is not completed immediately, your desk/bed will be unassigned and released for waitlisted students.<br>
            Please visit the administration office or contact the hostel warden today.
        </p>
    </div>

    <div style="text-align: center; margin: 24px 0 12px 0;">
        <a href="{portal_url or 'https://yashodeepcoachingclasses.in'}" 
           style="background-color: #dc2626; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 13px;">
            Open Student Portal
        </a>
    </div>
    """

    return {
        "subject": subject,
        "html_content": wrap_html_email(subject, body)
    }

