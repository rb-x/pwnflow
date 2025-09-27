import uuid
from datetime import datetime
from typing import List, Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text
from sqlalchemy.dialects.postgresql import ARRAY


class WebhookSubscription(SQLModel, table=True):
    __tablename__ = "webhook_subscriptions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    scope: str = Field(default="project")  # "project" or "global"
    project_id: Optional[str] = Field(default=None, index=True)
    url: str
    secret: Optional[str] = None
    events: List[str] = Field(default_factory=list, sa_column=Column(ARRAY(Text)))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DeliveryLog(SQLModel, table=True):
    __tablename__ = "delivery_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    webhook_id: uuid.UUID = Field(foreign_key="webhook_subscriptions.id")
    event: str
    status_code: Optional[int] = None
    success: bool = Field(default=False)
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
