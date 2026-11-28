import uuid
import logging
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status, Request, Response, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.notification import NotificationOutbox
from app.modules.notifications.schemas import (
    NotificationOutboxResponse,
    NotificationOutboxListResponse,
    ManualTestDispatchSchema,
    TestDispatchResult
)
from app.modules.notifications.providers.meta_whatsapp import meta_whatsapp_client
from app.modules.notifications.providers.brevo_email import brevo_email_client
from app.modules.notifications.templates import wrap_html_email
from app.modules.notifications.service import notification_dispatcher
from app.core.exceptions import BadRequestException, ForbiddenException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications Engine"])


# -----------------------------------------------------------------------------
# 1. OUTBOX AUDIT LOG (Admin / Staff)
# -----------------------------------------------------------------------------
@router.get("/outbox", response_model=NotificationOutboxListResponse)
async def list_notification_outbox(
    channel: Optional[str] = Query(None, description="WHATSAPP, EMAIL, or IN_APP"),
    status_filter: Optional[str] = Query(None, alias="status", description="PENDING, SENT, FAILED"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    search: Optional[str] = Query(None, description="Search recipient target"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns paginated audit log of all system notifications dispatched via WhatsApp & Email.
    """
    base_query = select(NotificationOutbox)
    count_query = select(func.count(NotificationOutbox.id))

    filters = []
    if channel:
        filters.append(NotificationOutbox.channel == channel.upper())
    if status_filter:
        filters.append(NotificationOutbox.status == status_filter.upper())
    if event_type:
        filters.append(NotificationOutbox.event_type == event_type.upper())
    if search:
        filters.append(NotificationOutbox.recipient_target.ilike(f"%{search.strip()}%"))

    if filters:
        for f in filters:
            base_query = base_query.where(f)
            count_query = count_query.where(f)

    total_count = (await db.execute(count_query)).scalar() or 0
    items = (
        await db.execute(
            base_query.order_by(desc(NotificationOutbox.created_at)).limit(limit).offset(offset)
        )
    ).scalars().all()

    return NotificationOutboxListResponse(total=total_count, items=items)


# -----------------------------------------------------------------------------
# 2. MANUAL TEST DISPATCH (Staff Testing Tool)
# -----------------------------------------------------------------------------
@router.post("/test-dispatch", response_model=TestDispatchResult)
async def manual_test_dispatch(
    data: ManualTestDispatchSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Staff tool to dispatch a test WhatsApp or Email notification.
    If Meta or Brevo are not configured with live credentials, operates in Mock Sandbox mode.
    """
    channel = data.channel.upper()
    recipient = data.recipient.strip()

    if channel not in ["WHATSAPP", "EMAIL"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Channel must be either 'WHATSAPP' or 'EMAIL'."
        )

    outbox_entry = NotificationOutbox(
        id=uuid.uuid4(),
        event_type=data.event_type.upper(),
        recipient_target=recipient,
        channel=channel,
        payload={
            "sample_name": data.sample_name,
            "sample_text": data.sample_text,
            "initiated_by": current_user.email
        },
        status="PENDING",
        retry_count=0,
        last_attempted_at=datetime.now(timezone.utc)
    )
    db.add(outbox_entry)
    await db.commit()
    await db.refresh(outbox_entry)

    try:
        if channel == "WHATSAPP":
            # If live Meta API is enabled, use the official pre-approved test template 'hello_world'
            if meta_whatsapp_client.enabled:
                tpl_name = "hello_world"
                tpl_components = []
            else:
                tpl_name = "ycc_test_notification"
                tpl_components = [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": data.sample_name or "Parent / Student"},
                            {"type": "text", "text": "Test Notification"},
                            {"type": "text", "text": "Yashodeep Coaching Classes"}
                        ]
                    }
                ]
            result = await meta_whatsapp_client.send_template_message(
                to_phone=recipient,
                template_name=tpl_name,
                components=tpl_components
            )
            outbox_entry.status = "SENT"
            outbox_entry.last_attempted_at = datetime.now(timezone.utc)
            await db.commit()

            return TestDispatchResult(
                status=result.get("status", "SENT"),
                channel="WHATSAPP",
                recipient=recipient,
                message_id=result.get("message_id"),
                is_mock=result.get("is_mock", True),
                details=result
            )

        else:
            # Brevo Email
            subject = f"Test Notification from Yashodeep Coaching Classes"
            html_content = wrap_html_email(
                title=subject,
                content_body=f"""
                <p>Hello <strong>{data.sample_name or 'Valued Member'}</strong>,</p>
                <p>{data.sample_text}</p>
                <div class="card" style="border-left: 4px solid #4f46e5;">
                  <p style="margin: 0; font-weight: bold; color: #4338ca;">Channel Verification Successful</p>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">
                    Initiated by {current_user.first_name} {current_user.last_name} ({current_user.email})
                  </p>
                </div>
                """
            )
            result = await brevo_email_client.send_transactional_email(
                to_email=recipient,
                to_name=data.sample_name or recipient,
                subject=subject,
                html_content=html_content
            )
            outbox_entry.status = "SENT"
            outbox_entry.last_attempted_at = datetime.now(timezone.utc)
            await db.commit()

            return TestDispatchResult(
                status=result.get("status", "SENT"),
                channel="EMAIL",
                recipient=recipient,
                message_id=result.get("message_id"),
                is_mock=result.get("is_mock", True),
                details=result
            )

    except Exception as exc:
        logger.error(f"Manual test dispatch error: {exc}", exc_info=True)
        outbox_entry.status = "FAILED"
        outbox_entry.error_message = str(exc)[:1000]
        outbox_entry.last_attempted_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dispatch failed: {str(exc)}"
        )


# -----------------------------------------------------------------------------
# 3. META CLOUD API WEBHOOKS (Handshake & Delivery Receipts)
# -----------------------------------------------------------------------------
@router.get("/webhook/whatsapp")
async def meta_whatsapp_verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    """
    Meta Cloud API Webhook Handshake Verification.
    Meta makes a GET request to verify the webhook URL with hub.verify_token and hub.challenge.
    """
    configured_token = settings.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN
    if hub_mode == "subscribe" and hub_verify_token == configured_token:
        logger.info("Meta Cloud WhatsApp Webhook verified successfully!")
        return Response(content=hub_challenge or "", media_type="text/plain")
    
    logger.warning(f"Meta Cloud WhatsApp Webhook verification failed. Token received: {hub_verify_token}")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")


@router.post("/webhook/whatsapp")
async def meta_whatsapp_receive_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Meta Cloud API Webhook Receiver.
    Listens for message status updates (sent, delivered, read, failed).
    """
    try:
        body = await request.json()
        entries = body.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                statuses = value.get("statuses", [])
                for st in statuses:
                    wamid = st.get("id")
                    status_name = st.get("status")  # sent, delivered, read, failed
                    logger.info(f"Meta WhatsApp Webhook Status: {wamid} -> {status_name}")
                    
                    # Update status in notification_outbox if found
                    # (Meta statuses are lowercase: sent, delivered, read, failed)
        return {"status": "ok"}
    except Exception as exc:
        logger.error(f"Error handling Meta WhatsApp webhook: {exc}")
        return {"status": "error", "detail": str(exc)}


# -----------------------------------------------------------------------------
# 5. AUTOMATED FACILITY TENANCY EXPIRY PROCESSOR (CRON-JOB.ORG COMPATIBLE)
# -----------------------------------------------------------------------------
@router.api_route("/reminders/process-facility-expiries", methods=["GET", "POST"])
async def process_facility_expiries(
    days_ahead: int = Query(3, description="Days before expiry to trigger reminder (default 3)"),
    include_expired: bool = Query(True, description="Whether to include expired allocations for renewal grace notice"),
    force: bool = Query(False, description="Force send even if already reminded today"),
    cron_key: Optional[str] = Query(None, description="Secret cron key for automated schedulers"),
    x_cron_key: Optional[str] = Header(None, alias="X-Cron-Key", description="Secret cron header for automated schedulers"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Automated background processor for Hostel & Study Room tenancy expiry reminders.
    Sends 1 notification per day during the final 3 days (T-3, T-2, T-1) and
    one renewal grace notice upon expiry.
    
    Accessible by:
    1. cron-job.org or external scheduler with ?cron_key=... or X-Cron-Key header
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

    result = await notification_dispatcher.scan_and_dispatch_facility_expiry_reminders(
        days_ahead=days_ahead,
        include_expired=include_expired,
        force=force
    )
    return result

