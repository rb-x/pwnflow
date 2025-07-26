from typing import List, Optional, Literal, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, field_validator

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    layout_direction: Optional[Literal['TB', 'BT', 'LR', 'RL']] = 'TB'

class ProjectCreate(ProjectBase):
    source_template_id: Optional[UUID] = None
    category_tags: Optional[List[str]] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    layout_direction: Optional[Literal['TB', 'BT', 'LR', 'RL']] = None
    category_tags: Optional[List[str]] = None

class ProjectInDBBase(ProjectBase):
    id: UUID
    owner_id: UUID
    category_tags: List[str] = []

    class Config:
        from_attributes = True

class Project(ProjectInDBBase):
    node_count: Optional[int] = 0
    context_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProjectInDB(ProjectInDBBase):
    node_count: Optional[int] = 0
    context_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def parse_datetime(cls, v: Any) -> Optional[datetime]:
        if v is None:
            return None
        # Handle Neo4j DateTime objects
        if hasattr(v, 'to_native'):
            return v.to_native()
        # Handle string datetime
        if isinstance(v, str):
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        return v 