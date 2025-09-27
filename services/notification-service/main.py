import uuid
from contextlib import asynccontextmanager
import logging
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status

from pydantic import BaseModel, model_validator

from database import init_db
from events import start_background_task
from models import WebhookSubscription
from repository import create_webhook, delete_webhook, get_webhook, list_webhooks, update_webhook
from settings import get_settings

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

settings = get_settings()

task_handle = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global task_handle
    await init_db()
    task_handle = await start_background_task()
    try:
        yield
    finally:
        if task_handle:
            task_handle.cancel()
            try:
                await task_handle
            except Exception:
                pass


def verify_internal_token(x_internal_token: str = Header(...)):
    if x_internal_token != settings.internal_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


app = FastAPI(
    title="Pwnflow Notification Service",
    version="0.1.0",
    lifespan=lifespan,
)


class WebhookPayloadBase(BaseModel):
    url: str
    events: List[str]
    secret: Optional[str] = None


class WebhookCreateRequest(WebhookPayloadBase):
    scope: Literal["global", "project"]
    project_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_scope(self) -> "WebhookCreateRequest":
        if self.scope == "project" and not self.project_id:
            raise ValueError("project_id is required when scope is 'project'")
        return self


class ProjectWebhookCreateRequest(WebhookPayloadBase):
    pass


class WebhookUpdateRequest(BaseModel):
    url: Optional[str] = None
    events: Optional[List[str]] = None
    secret: Optional[str] = None
    is_active: Optional[bool] = None


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# General webhook endpoints


@app.get("/internal/webhooks", response_model=List[WebhookSubscription])
async def list_webhooks_internal(
    scope: Optional[str] = Query(default=None),
    project_id: Optional[str] = Query(default=None),
    project_ids: Optional[List[str]] = Query(default=None),
    _: None = Depends(verify_internal_token),
):
    if scope is not None and scope not in {"global", "project"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid scope")
    return await list_webhooks(scope=scope, project_id=project_id, project_ids=project_ids)


@app.post("/internal/webhooks", response_model=WebhookSubscription, status_code=201)
async def create_webhook_internal(
    payload: WebhookCreateRequest,
    _: None = Depends(verify_internal_token),
):
    project_id = payload.project_id if payload.scope == "project" else None
    return await create_webhook(
        scope=payload.scope,
        url=payload.url,
        events=payload.events,
        secret=payload.secret,
        project_id=project_id,
    )


@app.put("/internal/webhooks/{webhook_id}", response_model=WebhookSubscription)
async def update_webhook_internal(
    webhook_id: str,
    payload: WebhookUpdateRequest,
    _: None = Depends(verify_internal_token),
):
    updated = await update_webhook(
        uuid.UUID(webhook_id),
        url=payload.url,
        events=payload.events,
        secret=payload.secret,
        is_active=payload.is_active,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return updated


@app.delete("/internal/webhooks/{webhook_id}", status_code=204)
async def delete_webhook_internal(
    webhook_id: str,
    _: None = Depends(verify_internal_token),
):
    success = await delete_webhook(uuid.UUID(webhook_id))
    if not success:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return None


@app.get("/internal/webhooks/{webhook_id}", response_model=WebhookSubscription)
async def get_webhook_internal(
    webhook_id: str,
    _: None = Depends(verify_internal_token),
):
    webhook = await get_webhook(uuid.UUID(webhook_id))
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return webhook


# Project-scoped endpoints (legacy compatibility)


@app.get("/internal/projects/{project_id}/webhooks", response_model=List[WebhookSubscription])
async def list_project_webhooks_internal(
    project_id: str,
    _: None = Depends(verify_internal_token),
):
    return await list_webhooks(scope="project", project_id=project_id)


@app.post("/internal/projects/{project_id}/webhooks", response_model=WebhookSubscription, status_code=201)
async def create_project_webhook_internal(
    project_id: str,
    payload: ProjectWebhookCreateRequest,
    _: None = Depends(verify_internal_token),
):
    return await create_webhook(
        scope="project",
        url=payload.url,
        events=payload.events,
        secret=payload.secret,
        project_id=project_id,
    )


@app.put("/internal/projects/{project_id}/webhooks/{webhook_id}", response_model=WebhookSubscription)
async def update_project_webhook_internal(
    project_id: str,
    webhook_id: str,
    payload: WebhookUpdateRequest,
    _: None = Depends(verify_internal_token),
):
    updated = await update_webhook(
        uuid.UUID(webhook_id),
        url=payload.url,
        events=payload.events,
        secret=payload.secret,
        is_active=payload.is_active,
    )
    if not updated or updated.project_id != project_id:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return updated


@app.delete("/internal/projects/{project_id}/webhooks/{webhook_id}", status_code=204)
async def delete_project_webhook_internal(
    project_id: str,
    webhook_id: str,
    _: None = Depends(verify_internal_token),
):
    success = await delete_webhook(uuid.UUID(webhook_id))
    if not success:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return None
