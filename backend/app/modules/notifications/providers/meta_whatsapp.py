import re
import uuid
import logging
from typing import Dict, Any, List, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def normalize_phone_number(raw_phone: str, default_country_code: str = "91") -> str:
    """
    Cleans and converts raw phone numbers to E.164 standard without plus symbol for Meta API.
    e.g., '+91 98220 12345' -> '919822012345'
          '9822012345'      -> '919822012345'
    """
    if not raw_phone:
        return ""
    # Strip non-digits
    digits = re.sub(r"\D", "", raw_phone)
    if not digits:
        return ""
    
    # Standard 10-digit Indian mobile
    if len(digits) == 10:
        return f"{default_country_code}{digits}"
    # 11-digit starting with 0
    if len(digits) == 11 and digits.startswith("0"):
        return f"{default_country_code}{digits[1:]}"
    return digits


class MetaWhatsAppClient:
    """
    Client for the official Meta Cloud API (WhatsApp Business Platform).
    Seamlessly falls back to Mock Sandbox Mode when credentials are not configured in .env.
    """

    @property
    def api_version(self) -> str:
        return settings.META_WHATSAPP_API_VERSION or "v21.0"

    @property
    def phone_number_id(self) -> Optional[str]:
        return settings.META_WHATSAPP_PHONE_NUMBER_ID

    @property
    def access_token(self) -> Optional[str]:
        return settings.META_WHATSAPP_ACCESS_TOKEN

    @property
    def enabled(self) -> bool:
        return bool(settings.META_WHATSAPP_ENABLED and self.access_token and self.phone_number_id)

    def __init__(self):
        pass

    @property
    def base_url(self) -> str:
        return f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"

    async def send_template_message(
        self,
        to_phone: str,
        template_name: str,
        components: List[Dict[str, Any]],
        language_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends an approved Meta WhatsApp Template Message.
        Defaults to Marathi ('mr'), falling back to 'en_US' if not yet approved.
        If credentials are absent or disabled, logs message cleanly in Mock Sandbox mode.
        """
        normalized_to = normalize_phone_number(to_phone)
        if not normalized_to:
            raise ValueError(f"Invalid phone number provided: '{to_phone}'")

        target_lang = language_code or getattr(settings, "META_WHATSAPP_DEFAULT_LANGUAGE", "mr") or "mr"

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": normalized_to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": target_lang},
                "components": components
            }
        }

        # Sandbox / Mock Mode
        if not self.enabled:
            mock_wamid = f"wamid_mock_{uuid.uuid4().hex[:16]}"
            logger.info(
                f"\n[META WHATSAPP MOCK SANDBOX DISPATCH]\n"
                f"  To: +{normalized_to} (Raw: {to_phone})\n"
                f"  Template: {template_name} ({target_lang})\n"
                f"  Components: {components}\n"
                f"  Generated Mock ID: {mock_wamid}\n"
            )
            return {
                "status": "MOCK_SENT",
                "message_id": mock_wamid,
                "recipient": normalized_to,
                "template": template_name,
                "language": target_lang,
                "is_mock": True
            }

        # Live Meta Cloud API Dispatch
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(self.base_url, headers=headers, json=payload)
                resp_json = response.json()
                if response.status_code >= 400:
                    error_detail = resp_json.get("error", {}).get("message", response.text)
                    # If failed because language translation is still pending/not found, retry with 'en_US'
                    if target_lang != "en_US" and ("template" in error_detail.lower() or "language" in error_detail.lower() or "does not exist" in error_detail.lower()):
                        logger.warning(
                            f"Meta template '{template_name}' in '{target_lang}' returned ({error_detail}). Falling back to 'en_US'."
                        )
                        payload["template"]["language"]["code"] = "en_US"
                        fallback_resp = await client.post(self.base_url, headers=headers, json=payload)
                        if fallback_resp.status_code < 400:
                            fb_json = fallback_resp.json()
                            return {
                                "status": "SENT",
                                "message_id": fb_json.get("messages", [{}])[0].get("id", "wamid_unknown"),
                                "recipient": normalized_to,
                                "template": template_name,
                                "language": "en_US",
                                "is_mock": False
                            }
                    logger.error(f"Meta WhatsApp API error ({response.status_code}): {error_detail}")
                    raise RuntimeError(f"Meta WhatsApp API returned HTTP {response.status_code}: {error_detail}")

                message_id = resp_json.get("messages", [{}])[0].get("id", "wamid_unknown")
                return {
                    "status": "SENT",
                    "message_id": message_id,
                    "recipient": normalized_to,
                    "template": template_name,
                    "language": target_lang,
                    "is_mock": False
                }
            except httpx.RequestError as exc:
                logger.error(f"Network error connecting to Meta WhatsApp API: {exc}")
                raise RuntimeError(f"Network connection error to Meta Cloud API: {exc}")

    async def send_text_message(
        self,
        to_phone: str,
        text_body: str
    ) -> Dict[str, Any]:
        """
        Sends a standard text message via Meta WhatsApp Cloud API.
        Falls back to Mock Sandbox mode when credentials are not configured.
        """
        normalized_to = normalize_phone_number(to_phone)
        if not normalized_to:
            raise ValueError(f"Invalid phone number provided: '{to_phone}'")

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": normalized_to,
            "type": "text",
            "text": {"body": text_body}
        }

        # Sandbox / Mock Mode
        if not self.enabled:
            mock_wamid = f"wamid_mock_{uuid.uuid4().hex[:16]}"
            logger.info(
                f"\n[META WHATSAPP MOCK SANDBOX TEXT DISPATCH]\n"
                f"  To: +{normalized_to} (Raw: {to_phone})\n"
                f"  Body: {text_body}\n"
                f"  Generated Mock ID: {mock_wamid}\n"
            )
            return {
                "status": "MOCK_SENT",
                "message_id": mock_wamid,
                "recipient": normalized_to,
                "body": text_body,
                "is_mock": True
            }

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(self.base_url, headers=headers, json=payload)
                resp_json = response.json()
                if response.status_code >= 400:
                    error_detail = resp_json.get("error", {}).get("message", response.text)
                    logger.error(f"Meta WhatsApp API error ({response.status_code}): {error_detail}")
                    raise RuntimeError(f"Meta WhatsApp API returned HTTP {response.status_code}: {error_detail}")

                message_id = resp_json.get("messages", [{}])[0].get("id", "wamid_unknown")
                return {
                    "status": "SENT",
                    "message_id": message_id,
                    "recipient": normalized_to,
                    "is_mock": False
                }
            except httpx.RequestError as exc:
                logger.error(f"Network error connecting to Meta WhatsApp API: {exc}")
                raise RuntimeError(f"Network connection error to Meta Cloud API: {exc}")


meta_whatsapp_client = MetaWhatsAppClient()
