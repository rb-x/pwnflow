from datetime import datetime, timezone
from typing import Optional, Dict, Any, Literal

from pydantic import BaseModel, Field


class EventMetadata(BaseModel):
    project_id: Optional[str] = None
    initiator_id: Optional[str] = None
    source: Optional[str] = None


class BaseEvent(BaseModel):
    """Base shape for all events emitted by the backend."""

    event: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: EventMetadata = Field(default_factory=EventMetadata)


class ProjectRef(BaseModel):
    id: str
    name: Optional[str] = None
    owner_id: Optional[str] = None


class UserRef(BaseModel):
    id: str
    email: Optional[str] = None
    username: Optional[str] = None


class NodeRef(BaseModel):
    id: str
    title: Optional[str] = None
    type: Optional[str] = None


class ProjectCreatedEvent(BaseEvent):
    event: Literal["project.created"] = "project.created"
    project: ProjectRef
    owner: Optional[UserRef] = None


class ProjectDeletedEvent(BaseEvent):
    event: Literal["project.deleted"] = "project.deleted"
    project: ProjectRef


class NodeCreatedEvent(BaseEvent):
    event: Literal["node.created"] = "node.created"
    project: ProjectRef
    node: NodeRef


class NodeUpdatedEvent(BaseEvent):
    event: Literal["node.updated"] = "node.updated"
    project: ProjectRef
    node: NodeRef
    changes: Dict[str, Any] = Field(default_factory=dict)


class NodeDeletedEvent(BaseEvent):
    event: Literal["node.deleted"] = "node.deleted"
    project: ProjectRef
    node: NodeRef


class FindingCreatedEvent(BaseEvent):
    event: Literal["finding.created"] = "finding.created"
    project: ProjectRef
    node: Optional[NodeRef] = None
    finding_id: str


EventType = BaseEvent | ProjectCreatedEvent | ProjectDeletedEvent | NodeCreatedEvent | NodeUpdatedEvent | NodeDeletedEvent | FindingCreatedEvent

__all__ = [
    "BaseEvent",
    "EventMetadata",
    "ProjectRef",
    "UserRef",
    "NodeRef",
    "ProjectCreatedEvent",
    "ProjectDeletedEvent",
    "NodeCreatedEvent",
    "NodeUpdatedEvent",
    "NodeDeletedEvent",
    "FindingCreatedEvent",
    "EventType",
]
