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
        language_code: str = "en_US"
    ) -> Dict[str, Any]:
        """
        Sends an approved Meta WhatsApp Template Message.
        If credentials are absent or disabled, logs message cleanly in Mock Sandbox mode.
        """
        normalized_to = normalize_phone_number(to_phone)
        if not normalized_to:
            raise ValueError(f"Invalid phone number provided: '{to_phone}'")

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": normalized_to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components
            }
        }

        # Sandbox / Mock Mode
        if not self.enabled:
            mock_wamid = f"wamid_mock_{uuid.uuid4().hex[:16]}"
            logger.info(
                f"\n[META WHATSAPP MOCK SANDBOX DISPATCH]\n"
                f"  To: +{normalized_to} (Raw: {to_phone})\n"
                f"  Template: {template_name} ({language_code})\n"
                f"  Components: {components}\n"
                f"  Generated Mock ID: {mock_wamid}\n"
            )
            return {
                "status": "MOCK_SENT",
                "message_id": mock_wamid,
                "recipient": normalized_to,
                "template": template_name,
                "is_mock": True
            }

        # Live Meta Cloud API Dispatch
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
                    "template": template_name,
                    "is_mock": False
                }
            except httpx.RequestError as exc:
                logger.error(f"Network error connecting to Meta WhatsApp API: {exc}")
                raise RuntimeError(f"Network connection error to Meta Cloud API: {exc}")


meta_whatsapp_client = MetaWhatsAppClient()
