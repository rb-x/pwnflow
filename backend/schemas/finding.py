from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID


class FindingBase(BaseModel):
    content: str = Field(..., description="Finding content (supports Markdown)")
    date: datetime = Field(..., description="Auditor's specified date for timeline tracking")


class FindingCreate(FindingBase):
    date: Optional[datetime] = Field(None, description="Auditor's specified date (defaults to current time)")


class FindingUpdate(BaseModel):
    content: Optional[str] = Field(None, description="Finding content (supports Markdown)")
    date: Optional[datetime] = Field(None, description="Auditor's specified date for timeline tracking")


class Finding(FindingBase):
    id: UUID
    node_id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True