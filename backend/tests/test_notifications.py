import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.modules.notifications.providers.meta_whatsapp import normalize_phone_number, meta_whatsapp_client
from app.modules.notifications.providers.brevo_email import brevo_email_client
from app.modules.notifications.templates import (
    format_attendance_absent_whatsapp,
    format_attendance_absent_email,
    format_payment_receipt_whatsapp,
    format_payment_receipt_email,
    format_fee_reminder_whatsapp,
    format_exam_result_whatsapp,
    format_admission_welcome_whatsapp
)


@pytest.mark.asyncio
async def test_phone_number_normalization():
    """Verify phone normalization strips non-digits and prepends standard 91 country code for Indian numbers."""
    assert normalize_phone_number("9822012345") == "919822012345"
    assert normalize_phone_number("+91 98220 12345") == "919822012345"
    assert normalize_phone_number("09822012345") == "919822012345"
    assert normalize_phone_number("+91-98220-12345") == "919822012345"
    assert normalize_phone_number("919822012345") == "919822012345"
    assert normalize_phone_number("") == ""


@pytest.mark.asyncio
async def test_meta_whatsapp_mock_sandbox_mode(monkeypatch):
    """Verify Meta WhatsApp client falls back to Mock Sandbox Mode when credentials are not configured."""
    monkeypatch.setattr(settings, "META_WHATSAPP_ACCESS_TOKEN", None)
    monkeypatch.setattr(settings, "META_WHATSAPP_ENABLED", False)
    res = await meta_whatsapp_client.send_template_message(
        to_phone="9822012345",
        template_name="ycc_attendance_absent",
        components=[
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": "Mr. Patil"},
                    {"type": "text", "text": "Harshvardhan Patil"},
                    {"type": "text", "text": "Physics"},
                    {"type": "text", "text": "12th Standard"},
                    {"type": "text", "text": "2026-11-22"}
                ]
            }
        ]
    )
    assert res["status"] == "MOCK_SENT"
    assert res["is_mock"] is True
    assert res["recipient"] == "919822012345"
    assert res["message_id"].startswith("wamid_mock_")


@pytest.mark.asyncio
async def test_brevo_email_mock_sandbox_mode(monkeypatch):
    """Verify Brevo email client falls back to Mock Sandbox Mode when API key is not configured."""
    monkeypatch.setattr(settings, "BREVO_API_KEY", None)
    monkeypatch.setattr(settings, "BREVO_EMAIL_ENABLED", False)
    res = await brevo_email_client.send_transactional_email(
        to_email="parent@example.com",
        to_name="Parent Name",
        subject="Official Fee Receipt #RCP-2026-00001",
        html_content="<p>Payment received successfully.</p>"
    )
    assert res["status"] == "MOCK_SENT"
    assert res["is_mock"] is True
    assert res["recipient"] == "parent@example.com"
    assert res["message_id"].startswith("mock_brevo_")


@pytest.mark.asyncio
async def test_templates_formatting():
    """Verify all 5 coaching institute templates format correctly."""
    # 1. Absence WhatsApp
    wa_abs = format_attendance_absent_whatsapp("Father", "Rahul", "Chemistry", "11th Science", "2026-11-22")
    assert wa_abs["template_name"] == "ycc_attendance_absent"
    assert len(wa_abs["components"][0]["parameters"]) == 5

    # 2. Absence Email
    em_abs = format_attendance_absent_email("Father", "Rahul", "Chemistry", "11th Science", "2026-11-22")
    assert "Rahul marked ABSENT" in em_abs["subject"]
    assert "Yashodeep Coaching Classes" in em_abs["html_content"]

    # 3. Payment WhatsApp
    wa_pay = format_payment_receipt_whatsapp("Mother", 15000.0, "Sneha", "INV-2026-00001", "RCP-2026-00001", 30000.0)
    assert wa_pay["template_name"] == "ycc_payment_receipt"
    assert "₹15,000.00" in wa_pay["components"][0]["parameters"][1]["text"]

    # 4. Fee Reminder WhatsApp
    wa_rem = format_fee_reminder_whatsapp("Mother", 2, 12500.0, "Sneha", "2026-12-05")
    assert wa_rem["template_name"] == "ycc_fee_reminder"
    assert wa_rem["components"][0]["parameters"][1]["text"] == "2"

    # 5. Exam Result WhatsApp
    wa_ex = format_exam_result_whatsapp("Parent", "Math Unit Test 1", "Mathematics", "Aarav", 48.0, 50.0, 96.0)
    assert wa_ex["template_name"] == "ycc_exam_result"
    assert wa_ex["components"][0]["parameters"][4]["text"] == "48"
    assert wa_ex["components"][0]["parameters"][6]["text"] == "96.0"

    # 6. Admission Welcome WhatsApp
    wa_adm = format_admission_welcome_whatsapp("Aarav", "Foundation 5th Standard", "PRN-2026-00001")
    assert wa_adm["template_name"] == "ycc_admission_welcome"
    assert wa_adm["components"][0]["parameters"][2]["text"] == "PRN-2026-00001"


@pytest.mark.asyncio
async def test_meta_webhook_verification(client: AsyncClient):
    """Verify Meta Cloud API webhook verification handshake endpoint."""
    verify_token = settings.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN
    challenge = "1158201444"

    # Successful verification handshake
    resp = await client.get(
        "/api/v1/notifications/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": verify_token,
            "hub.challenge": challenge
        }
    )
    assert resp.status_code == 200
    assert resp.text == challenge

    # Failed verification (wrong token)
    bad_resp = await client.get(
        "/api/v1/notifications/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": challenge
        }
    )
    assert bad_resp.status_code == 403


@pytest.mark.asyncio
async def test_meta_webhook_receiver(client: AsyncClient):
    """Verify Meta Cloud API incoming status webhook receiver."""
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "1002938475",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"display_phone_number": "919822012345", "phone_number_id": "104928374"},
                            "statuses": [
                                {
                                    "id": "wamid.HBgLM...",
                                    "status": "delivered",
                                    "timestamp": "1732252800",
                                    "recipient_id": "919822012345"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    resp = await client.post("/api/v1/notifications/webhook/whatsapp", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_manual_test_dispatch_and_outbox(client: AsyncClient, auth_headers: dict, monkeypatch):
    """Verify manual staff test dispatch records to NotificationOutbox and can be queried."""
    monkeypatch.setattr(settings, "META_WHATSAPP_ACCESS_TOKEN", None)
    monkeypatch.setattr(settings, "META_WHATSAPP_ENABLED", False)
    monkeypatch.setattr(settings, "BREVO_API_KEY", None)
    monkeypatch.setattr(settings, "BREVO_EMAIL_ENABLED", False)

    # 1. Dispatch WhatsApp Test
    wa_resp = await client.post(
        "/api/v1/notifications/test-dispatch",
        headers=auth_headers,
        json={
            "channel": "WHATSAPP",
            "recipient": "9822099999",
            "event_type": "TEST_DISPATCH",
            "sample_name": "Test Student",
            "sample_text": "Sample WhatsApp notification message."
        }
    )
    assert wa_resp.status_code == 200
    wa_data = wa_resp.json()
    assert wa_data["channel"] == "WHATSAPP"
    assert wa_data["is_mock"] is True

    # 2. Dispatch Email Test
    em_resp = await client.post(
        "/api/v1/notifications/test-dispatch",
        headers=auth_headers,
        json={
            "channel": "EMAIL",
            "recipient": "test_parent@example.com",
            "event_type": "TEST_DISPATCH",
            "sample_name": "Test Parent",
            "sample_text": "Sample Email notification message."
        }
    )
    assert em_resp.status_code == 200
    em_data = em_resp.json()
    assert em_data["channel"] == "EMAIL"
    assert em_data["is_mock"] is True

    # 3. Query Outbox List
    outbox_resp = await client.get(
        "/api/v1/notifications/outbox",
        headers=auth_headers,
        params={"limit": 10}
    )
    assert outbox_resp.status_code == 200
    outbox_data = outbox_resp.json()
    assert outbox_data["total"] >= 2
    items = outbox_data["items"]
    assert any(i["channel"] == "WHATSAPP" for i in items)
    assert any(i["channel"] == "EMAIL" for i in items)


def test_resolve_contact_with_student_guardian():
    """Verify _resolve_contact handles StudentGuardian junction records and extracts mobile/email safely."""
    from unittest.mock import MagicMock
    from app.modules.notifications.service import notification_dispatcher

    # Case 1: Student with StudentGuardian linking to Guardian
    student = MagicMock()
    student.first_name = "Aarav"
    student.last_name = "Patil"
    student.mobile = "9822011111"
    student.email = "student@example.com"

    guardian_obj = MagicMock()
    guardian_obj.first_name = "Ramesh"
    guardian_obj.last_name = "Patil"
    guardian_obj.mobile = "9822022222"
    guardian_obj.email = "parent@example.com"

    sg = MagicMock(spec=["receives_notifications", "is_primary", "guardian"])
    sg.receives_notifications = True
    sg.is_primary = True
    sg.guardian = guardian_obj

    student.guardians = [sg]

    p_name, p_phone, p_email = notification_dispatcher._resolve_contact(student)
    assert p_name == "Ramesh Patil"
    assert p_phone == "9822022222"
    assert p_email == "parent@example.com"

    # Case 2: Student without guardians (falls back safely)
    student_no_guardians = MagicMock()
    student_no_guardians.first_name = "Pooja"
    student_no_guardians.last_name = "Sharma"
    student_no_guardians.mobile = "9822033333"
    student_no_guardians.email = "pooja@example.com"
    student_no_guardians.guardians = []

    p_name2, p_phone2, p_email2 = notification_dispatcher._resolve_contact(student_no_guardians)
    assert p_name2 == "Parent of Pooja Sharma"
    assert p_phone2 == "9822033333"
    assert p_email2 == "pooja@example.com"
