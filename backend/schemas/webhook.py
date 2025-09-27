from datetime import datetime
from typing import List, Optional
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, HttpUrl, model_validator


class WebhookBase(BaseModel):
    url: HttpUrl
    events: List[str]
    secret: Optional[str] = None


class ProjectWebhookCreate(WebhookBase):
    pass


class WebhookCreate(WebhookBase):
    scope: Literal["global", "project"]
    project_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validate_scope(self) -> "WebhookCreate":
        if self.scope == "project" and not self.project_id:
            raise ValueError("project_id is required when scope is 'project'")
        if self.scope == "global":
            self.project_id = None
        return self


class WebhookUpdate(BaseModel):
    url: Optional[HttpUrl] = None
    events: Optional[List[str]] = None
    secret: Optional[str] = None
    is_active: Optional[bool] = None


class Webhook(WebhookBase):
    id: UUID
    scope: str
    project_id: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
