from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
from core.config import settings


class NodeType(str, Enum):
    CONCEPT = "concept"
    TOOL = "tool"
    TECHNIQUE = "technique"
    VULNERABILITY = "vulnerability"
    FINDING = "finding"
    COMMAND = "command"


class RelationshipType(str, Enum):
    DEPENDS_ON = "depends_on"
    RELATES_TO = "relates_to"
    REQUIRES = "requires"
    LEADS_TO = "leads_to"
    USES = "uses"
    CONTAINS = "contains"


class CommandStyle(str, Enum):
    BASH = "bash"
    POWERSHELL = "powershell"
    PYTHON = "python"
    CMD = "cmd"


class AIGenerationOptions(BaseModel):
    max_depth: int = Field(default=3, ge=1, le=5)
    max_nodes: int = Field(default=20, ge=1, le=50)
    node_types: List[NodeType] = Field(
        default=[NodeType.CONCEPT, NodeType.TOOL, NodeType.TECHNIQUE, NodeType.VULNERABILITY]
    )
    auto_connect: bool = Field(default=True)
    relationship_types: List[RelationshipType] = Field(
        default=[
            RelationshipType.DEPENDS_ON,
            RelationshipType.RELATES_TO,
            RelationshipType.REQUIRES,
            RelationshipType.LEADS_TO
        ]
    )
    include_commands: bool = Field(default=True)
    command_style: CommandStyle = Field(default=CommandStyle.BASH)


class AIGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)
    parent_node_id: Optional[str] = Field(default=None)
    options: AIGenerationOptions = Field(default_factory=AIGenerationOptions)


class AINode(BaseModel):
    title: str
    description: str
    commands: List[str] = Field(default_factory=list)
    node_type: NodeType
    parent_id: Optional[str] = None
    # Explicitly exclude findings - they are user-specific


class AIRelationship(BaseModel):
    source_id: str
    target_id: str
    relationship_type: RelationshipType
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str


class AIGenerationMetadata(BaseModel):
    tokens_used: int
    generation_time: float
    ai_model: str
    parent_context_used: bool
    existing_nodes_analyzed: int
    generation_id: str


class AIGenerationResponse(BaseModel):
    nodes: List[AINode]
    relationships: List[AIRelationship]
    metadata: AIGenerationMetadata


class AIExpandNodeRequest(BaseModel):
    instruction: str = Field(..., min_length=1, max_length=500)
    depth: int = Field(default=2, ge=1, le=3)


class AISuggestConnectionsRequest(BaseModel):
    source_node_id: str
    target_scope: str = Field(default="project", pattern="^(project|specific_nodes)$")
    target_node_ids: Optional[List[str]] = None


class ChatMode(str, Enum):
    GENERAL = "general"  # General conversation
    NODE_CONTEXT = "node_context"  # When discussing a specific node
    SUGGEST_IMPROVEMENTS = "suggest_improvements"  # Suggest improvements to a node
    GENERATE_CHILDREN = "generate_children"  # Suggest child nodes


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    node_id: Optional[str] = Field(default=None)
    mode: ChatMode = Field(default=ChatMode.GENERAL)


class AIChatResponse(BaseModel):
    message: str
    suggestions: Optional[List[Dict[str, Any]]] = None  # For improvements or child nodes
    mode: ChatMode