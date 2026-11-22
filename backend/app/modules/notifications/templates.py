"""
Notification Templates Engine for Meta WhatsApp Business & Brevo Transactional Email.
Provides standard components formatting for Meta Cloud API and responsive HTML templates for Brevo.
"""
from typing import Dict, Any, List


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
