import base64
import json
import logging
import os
import time
from typing import Any, Dict, Iterable, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

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
from core.config import settings

logger = logging.getLogger(__name__)


def _encrypt_command(command_body: str) -> dict:
    """
    Encrypt command using AES-256-GCM.

    Returns dict with ciphertext, nonce, and timestamp (all base64 encoded).
    Raises ValueError if TMUX_RUNNER_SECRET is not configured.
    """
    if not settings.TMUX_RUNNER_SECRET:
        raise ValueError("TMUX_RUNNER_SECRET not configured - cannot encrypt command")

    # Decode the base64 secret key
    key = base64.b64decode(settings.TMUX_RUNNER_SECRET)
    cipher = AESGCM(key)

    # Generate nonce (12 bytes for GCM)
    nonce = os.urandom(12)

    # Current timestamp for replay protection
    timestamp = int(time.time())

    # Encrypt with timestamp as associated data
    plaintext = command_body.encode('utf-8')
    ciphertext = cipher.encrypt(
        nonce=nonce,
        data=plaintext,
        associated_data=timestamp.to_bytes(8, 'big')
    )

    return {
        "ciphertext": base64.b64encode(ciphertext).decode('utf-8'),
        "nonce": base64.b64encode(nonce).decode('utf-8'),
        "timestamp": timestamp
    }

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
    # Encrypt command body with AES-256-GCM
    encrypted = None
    if command_body:
        encrypted = _encrypt_command(command_body)

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
            "ciphertext": encrypted["ciphertext"] if encrypted else None,
            "nonce": encrypted["nonce"] if encrypted else None,
            "timestamp": encrypted["timestamp"] if encrypted else None,
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
