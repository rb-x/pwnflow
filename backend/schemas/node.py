from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import List, Optional
from datetime import datetime

# --- Command Schemas ---
class CommandBase(BaseModel):
    title: str
    command: str
    description: Optional[str] = None

class CommandCreate(CommandBase):
    pass

class CommandUpdate(BaseModel):
    title: Optional[str] = None
    command: Optional[str] = None
    description: Optional[str] = None

class Command(CommandBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)
    
# --- Node Status Enum (as a class with constants) ---
class NodeStatus:
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    NOT_APPLICABLE = "NOT_APPLICABLE"

# --- Node Schemas ---
class NodeBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = Field(NodeStatus.NOT_STARTED, description="The status of the node.")
    findings: Optional[str] = None
    x_pos: float = 0.0
    y_pos: float = 0.0

class NodeCreate(NodeBase):
    pass

class NodeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    findings: Optional[str] = None
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None

class Node(NodeBase):
    id: UUID
    tags: List[str] = []
    commands: List[Command] = []
    parents: List[UUID] = []
    children: List[UUID] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class NodePositionUpdate(BaseModel):
    id: UUID
    x_pos: float
    y_pos: float

class BulkNodePositionUpdate(BaseModel):
    nodes: List[NodePositionUpdate] 