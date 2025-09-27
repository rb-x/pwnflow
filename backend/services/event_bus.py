import base64
import json
import logging
from typing import Any, Dict, Iterable, Optional

from pwnflow_event_schemas import (
    BaseEvent,
    EventMetadata,
    ProjectRef,
    ProjectCreatedEvent,
    ProjectDeletedEvent,
    NodeCreatedEvent,
    NodeUpdatedEvent,
    NodeDeletedEvent,
    FindingCreatedEvent,
    NodeRef,
    UserRef,
)

from db.redis import get_redis_client

logger = logging.getLogger(__name__)

DEFAULT_CHANNEL = "pwnflow.events"


async def publish_event(event: BaseEvent | Dict[str, Any], channel: str = DEFAULT_CHANNEL) -> None:
    """Publish an event payload to Redis."""

    payload = event.model_dump(mode="json") if isinstance(event, BaseEvent) else event
    client = await get_redis_client()
    await client.publish(channel, json.dumps(payload))
    logger.info("Published event %s to channel %s", payload.get("event"), channel)


def _build_metadata(project_id: Optional[str], initiator_id: Optional[str], source: Optional[str]) -> EventMetadata:
    return EventMetadata(project_id=project_id, initiator_id=initiator_id, source=source)


async def emit_project_created(
    project_id: str,
    name: str,
    owner_id: str,
    initiator_id: str,
    source: Optional[str] = None,
) -> None:
    event = ProjectCreatedEvent(
        metadata=_build_metadata(project_id, initiator_id, source),
        project=ProjectRef(id=project_id, name=name, owner_id=owner_id),
        owner=UserRef(id=owner_id),
    )
    await publish_event(event)


async def emit_project_deleted(
    project_id: str,
    name: Optional[str],
    owner_id: Optional[str],
    initiator_id: str,
    source: Optional[str] = None,
) -> None:
    event = ProjectDeletedEvent(
        metadata=_build_metadata(project_id, initiator_id, source),
        project=ProjectRef(id=project_id, name=name, owner_id=owner_id),
    )
    await publish_event(event)


async def emit_node_created(
    project_id: str,
    project_name: Optional[str],
    node_id: str,
    title: str,
    node_type: Optional[str],
    initiator_id: str,
    source: Optional[str] = None,
) -> None:
    event = NodeCreatedEvent(
        metadata=_build_metadata(project_id, initiator_id, source),
        project=ProjectRef(id=project_id, name=project_name),
        node=NodeRef(id=node_id, title=title, type=node_type),
    )
    await publish_event(event)


async def emit_node_updated(
    project_id: str,
    project_name: Optional[str],
    node_id: str,
    title: Optional[str],
    node_type: Optional[str],
    changes: Dict[str, Any],
    initiator_id: str,
    source: Optional[str] = None,
) -> None:
    event = NodeUpdatedEvent(
        metadata=_build_metadata(project_id, initiator_id, source),
        project=ProjectRef(id=project_id, name=project_name),
        node=NodeRef(id=node_id, title=title, type=node_type),
        changes=changes,
    )
    await publish_event(event)


async def emit_node_deleted(
    project_id: str,
    project_name: Optional[str],
    node_id: str,
    title: Optional[str],
    node_type: Optional[str],
    initiator_id: str,
    source: Optional[str] = None,
) -> None:
    event = NodeDeletedEvent(
        metadata=_build_metadata(project_id, initiator_id, source),
        project=ProjectRef(id=project_id, name=project_name),
        node=NodeRef(id=node_id, title=title, type=node_type),
    )
    await publish_event(event)


async def emit_finding_created(
    project_id: str,
    project_name: Optional[str],
    finding_id: str,
    node_id: Optional[str],
    node_title: Optional[str],
    initiator_id: str,
    source: Optional[str] = None,
) -> None:
    event = FindingCreatedEvent(
        metadata=_build_metadata(project_id, initiator_id, source),
        project=ProjectRef(id=project_id, name=project_name),
        node=NodeRef(id=node_id, title=node_title) if node_id else None,
        finding_id=finding_id,
    )
    await publish_event(event)


async def emit_command_triggered(
    project_id: str,
    project_name: Optional[str],
    node_id: str,
    node_title: Optional[str],
    node_type: Optional[str],
    command_id: str,
    command_title: Optional[str],
    command_body: Optional[str],
    command_description: Optional[str],
    initiator_id: str,
    source: Optional[str] = None,
) -> Dict[str, Any]:
    # Encode command body in base64 if it exists
    command_base64 = None
    if command_body:
        command_base64 = base64.b64encode(command_body.encode('utf-8')).decode('utf-8')

    # Build event as dict since CommandTriggeredEvent is not available
    event = {
        "event": "command.triggered",
        "metadata": {
            "project_id": project_id,
            "initiator_id": initiator_id,
            "source": source
        },
        "project": {
            "id": project_id,
            "name": project_name
        },
        "node": {
            "id": node_id,
            "title": node_title,
            "type": node_type
        },
        "command": {
            "id": command_id,
            "title": command_title,
            "command": command_base64,  # Base64 encoded command
            "command_raw": command_body,  # Keep raw for backwards compatibility if needed
            "description": command_description
        }
    }
    await publish_event(event)
    return event


__all__ = [
    "publish_event",
    "emit_project_created",
    "emit_project_deleted",
    "emit_node_created",
    "emit_node_updated",
    "emit_node_deleted",
    "emit_finding_created",
    "emit_command_triggered",
    "DEFAULT_CHANNEL",
]
