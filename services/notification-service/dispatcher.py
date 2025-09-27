import hashlib
import hmac
import json
import logging
from typing import Dict, List, Optional

import httpx
from sqlalchemy import select

from database import get_session
from models import WebhookSubscription
from repository import log_delivery

logger = logging.getLogger(__name__)


async def _load_subscriptions(event_name: str, project_id: Optional[str]) -> List[WebhookSubscription]:
    async with get_session() as session:
        base_stmt = select(WebhookSubscription).where(
            WebhookSubscription.is_active.is_(True),
            WebhookSubscription.events.contains([event_name]),
        )
        global_result = await session.execute(
            base_stmt.where(WebhookSubscription.scope == "global")
        )
        subscriptions: List[WebhookSubscription] = list(global_result.scalars().all())

        if project_id:
            project_stmt = base_stmt.where(
                WebhookSubscription.scope == "project",
                WebhookSubscription.project_id == project_id,
            )
            project_result = await session.execute(project_stmt)
            subscriptions.extend(project_result.scalars().all())

        return subscriptions


async def dispatch_event(event_payload: Dict[str, any]) -> None:
    event_name = event_payload.get("event")
    metadata = event_payload.get("metadata", {})
    project_id = metadata.get("project_id") if isinstance(metadata, dict) else None

    subscribers = await _load_subscriptions(event_name, project_id)
    if not subscribers:
        logger.debug("No webhook subscribers for event %s project %s", event_name, project_id)
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        for sub in subscribers:
            try:
                headers = {"Content-Type": "application/json", "X-Pwnflow-Event": event_name}
                body = json.dumps(event_payload)
                if sub.secret:
                    signature = hmac.new(
                        sub.secret.encode("utf-8"),
                        body.encode("utf-8"),
                        hashlib.sha256,
                    ).hexdigest()
                    headers["X-Pwnflow-Signature"] = signature

                response = await client.post(sub.url, data=body, headers=headers)
                await log_delivery(
                    webhook_id=sub.id,
                    event=event_name,
                    success=response.is_success,
                    status_code=response.status_code,
                    error=None if response.is_success else response.text[:512],
                )
                logger.info(
                    "Sent webhook %s for event %s -> %s",
                    sub.id,
                    event_name,
                    response.status_code,
                )
            except httpx.HTTPError as exc:
                await log_delivery(
                    webhook_id=sub.id,
                    event=event_name,
                    success=False,
                    status_code=None,
                    error=str(exc),
                )
                logger.error(
                    "Failed to deliver webhook %s for event %s: %s",
                    sub.id,
                    event_name,
                    exc,
                )
