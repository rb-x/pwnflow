from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class LegacyNodeData(BaseModel):
    name: str
    expanded: bool = True
    description: str = ""
    findings: List[Any] = Field(default_factory=list)
    commands: List[Any] = Field(default_factory=list)
    status: str = "NOT_STARTED"
    tags: List[str] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)
    expandable: bool = True


class LegacyNode(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: LegacyNodeData
    measured: Optional[Dict[str, float]] = None
    selected: bool = False
    style: Optional[Dict[str, Any]] = None
    sourcePosition: Optional[str] = None
    targetPosition: Optional[str] = None
    dragging: Optional[bool] = None
    children: Optional[List[Any]] = None


class LegacyEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str = "bezier"
    style: Optional[Dict[str, Any]] = None
    selected: bool = False


class LegacyFlowData(BaseModel):
    nodes: List[LegacyNode]
    edges: List[LegacyEdge]
    lastSaved: Optional[str] = None


class LegacyTemplate(BaseModel):
    id: str
    name: str
    description: str = ""
    flowData: LegacyFlowData
    tags: List[str] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class LegacyProject(BaseModel):
    id: str
    identifier: str
    name: str
    description: str = ""
    tags: List[str] = Field(default_factory=list)
    template: Optional[LegacyTemplate] = None
    methodologies: List[Any] = Field(default_factory=list)
    methodologyProgress: List[Any] = Field(default_factory=list)
    flowData: Optional[LegacyFlowData] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    lastSaved: Optional[str] = None
    nodes: Optional[List[LegacyNode]] = None
    edges: Optional[List[LegacyEdge]] = None


class ImportProgress(BaseModel):
    total_nodes: int
    processed_nodes: int
    total_edges: int
    processed_edges: int
    current_step: str
    percentage: float
    errors: List[str] = Field(default_factory=list)


class ImportResult(BaseModel):
    project_id: str
    original_id: str
    node_mappings: Dict[str, str]  # old_id -> new_id
    edge_mappings: Dict[str, str]  # old_id -> new_id
    imported_nodes: int
    imported_edges: int
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)