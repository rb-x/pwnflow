import uuid
from datetime import datetime
from typing import Iterable, List, Optional

from sqlalchemy import select

from database import get_session
from models import WebhookSubscription, DeliveryLog


async def list_webhooks(
    scope: Optional[str] = None,
    project_id: Optional[str] = None,
    project_ids: Optional[Iterable[str]] = None,
) -> List[WebhookSubscription]:
    async with get_session() as session:
        stmt = select(WebhookSubscription)

        if scope == "global":
            stmt = stmt.where(WebhookSubscription.scope == "global")
        elif scope == "project":
            stmt = stmt.where(WebhookSubscription.scope == "project")
            if project_id:
                stmt = stmt.where(WebhookSubscription.project_id == project_id)
            elif project_ids:
                stmt = stmt.where(WebhookSubscription.project_id.in_(list(project_ids)))
        else:
            if project_id:
                stmt = stmt.where(
                    WebhookSubscription.scope == "project",
                    WebhookSubscription.project_id == project_id,
                )
            elif project_ids:
                stmt = stmt.where(
                    WebhookSubscription.scope == "project",
                    WebhookSubscription.project_id.in_(list(project_ids)),
                )

        result = await session.execute(
            stmt.order_by(WebhookSubscription.created_at.desc())
        )
        return list(result.scalars().all())


async def get_webhook(webhook_id: uuid.UUID) -> Optional[WebhookSubscription]:
    async with get_session() as session:
        return await session.get(WebhookSubscription, webhook_id)


async def create_webhook(
    scope: str,
    url: str,
    events: List[str],
    secret: Optional[str],
    project_id: Optional[str],
) -> WebhookSubscription:
    async with get_session() as session:
        webhook = WebhookSubscription(
            scope=scope,
            url=url,
            events=events,
            secret=secret,
            project_id=project_id,
        )
        session.add(webhook)
        await session.commit()
        await session.refresh(webhook)
        return webhook


async def update_webhook(
    webhook_id: uuid.UUID,
    *,
    url: Optional[str] = None,
    events: Optional[List[str]] = None,
    secret: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Optional[WebhookSubscription]:
    async with get_session() as session:
        webhook = await session.get(WebhookSubscription, webhook_id)
        if not webhook:
            return None

        if url is not None:
            webhook.url = url
        if events is not None:
            webhook.events = events
        if secret is not None:
            webhook.secret = secret
        if is_active is not None:
            webhook.is_active = is_active

        webhook.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(webhook)
        return webhook


async def delete_webhook(webhook_id: uuid.UUID) -> bool:
    async with get_session() as session:
        webhook = await session.get(WebhookSubscription, webhook_id)
        if not webhook:
            return False
        await session.delete(webhook)
        await session.commit()
        return True


async def log_delivery(
    webhook_id: uuid.UUID,
    event: str,
    success: bool,
    status_code: Optional[int] = None,
    error: Optional[str] = None,
) -> None:
    async with get_session() as session:
        log = DeliveryLog(
            webhook_id=webhook_id,
            event=event,
            success=success,
            status_code=status_code,
            error=error,
        )
        session.add(log)
        await session.commit()
