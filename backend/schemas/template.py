from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None

class TemplateCreate(TemplateBase):
    source_project_id: UUID
    category_tags: Optional[List[str]] = None

class TemplateUpdate(TemplateBase):
    category_tags: Optional[List[str]] = None

class TemplateInDBBase(TemplateBase):
    id: UUID
    owner_id: UUID
    category_tags: List[str] = []

    class Config:
        from_attributes = True

class Template(TemplateInDBBase):
    node_count: Optional[int] = 0
    context_count: Optional[int] = 0

class TemplateInDB(TemplateInDBBase):
    node_count: Optional[int] = 0
    context_count: Optional[int] = 0 