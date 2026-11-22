import uuid
import logging
from typing import Dict, Any, List, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class BrevoEmailClient:
    """
    Client for Brevo (formerly Sendinblue) Transactional Email REST API v3.
    Falls back to Mock Sandbox Mode when credentials are not configured in .env.
    """

    def __init__(self):
        self.api_key = settings.BREVO_API_KEY
        self.sender_name = settings.BREVO_SENDER_NAME or "Yashodeep Coaching Classes"
        self.sender_email = settings.BREVO_SENDER_EMAIL or "admissions@yashodeepcoachingclasses.in"
        self.enabled = bool(settings.BREVO_EMAIL_ENABLED and self.api_key)
        self.endpoint = "https://api.brevo.com/v3/smtp/email"

    async def send_transactional_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Sends a transactional email via Brevo REST API v3.
        Attachment format: [{"content": "<base64_encoded_str>", "name": "receipt_123.pdf"}]
        """
        clean_email = (to_email or "").strip().lower()
        if not clean_email or "@" not in clean_email:
            raise ValueError(f"Invalid email address provided: '{to_email}'")

        payload: Dict[str, Any] = {
            "sender": {
                "name": self.sender_name,
                "email": self.sender_email
            },
            "to": [
                {
                    "email": clean_email,
                    "name": to_name or clean_email
                }
            ],
            "subject": subject,
            "htmlContent": html_content,
            "textContent": text_content or subject
        }

        if attachments:
            payload["attachment"] = attachments

        # Sandbox / Mock Mode
        if not self.enabled:
            mock_message_id = f"mock_brevo_{uuid.uuid4().hex[:16]}"
            logger.info(
                f"\n[BREVO EMAIL MOCK SANDBOX DISPATCH]\n"
                f"  From: {self.sender_name} <{self.sender_email}>\n"
                f"  To: {to_name} <{clean_email}>\n"
                f"  Subject: {subject}\n"
                f"  Attachments: {len(attachments) if attachments else 0} file(s)\n"
                f"  Generated Mock ID: {mock_message_id}\n"
            )
            return {
                "status": "MOCK_SENT",
                "message_id": mock_message_id,
                "recipient": clean_email,
                "subject": subject,
                "is_mock": True
            }

        # Live Brevo REST API Dispatch
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(self.endpoint, headers=headers, json=payload)
                resp_json = response.json()
                if response.status_code >= 400:
                    err_msg = resp_json.get("message", response.text)
                    logger.error(f"Brevo Email API error ({response.status_code}): {err_msg}")
                    raise RuntimeError(f"Brevo API error HTTP {response.status_code}: {err_msg}")

                msg_id = resp_json.get("messageId", "brevo_unknown")
                return {
                    "status": "SENT",
                    "message_id": msg_id,
                    "recipient": clean_email,
                    "subject": subject,
                    "is_mock": False
                }
            except httpx.RequestError as exc:
                logger.error(f"Network error connecting to Brevo API: {exc}")
                raise RuntimeError(f"Network connection error to Brevo API: {exc}")


brevo_email_client = BrevoEmailClient()
