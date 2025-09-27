from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from neo4j import AsyncSession

from api.dependencies import get_current_user, get_session
from crud import project as project_crud
from schemas.user import User
from schemas.webhook import (
    ProjectWebhookCreate,
    Webhook,
    WebhookCreate,
    WebhookUpdate,
)
from services import notification_client
from services.notification_client import NotificationServiceError

router = APIRouter(tags=["webhooks"])


async def _ensure_project_access(session: AsyncSession, project_id: UUID, user: User) -> None:
    project = await project_crud.get_project(session=session, project_id=project_id, owner_id=user.id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


async def _get_accessible_project_ids(session: AsyncSession, user: User) -> List[str]:
    projects = await project_crud.get_all_projects_for_user(
        session=session,
        owner_id=user.id,
        skip=0,
        limit=1000,
    )
    return [str(project.id) for project in projects]


@router.get("/webhooks", response_model=List[Webhook])
async def list_webhooks(
    scope: Optional[str] = Query(default=None),
    project_id: Optional[UUID] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> List[Webhook]:
    if scope and scope not in {"global", "project"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid scope")
    if project_id and scope == "global":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id is only valid for project scope")

    resolved_scope = scope
    if project_id and not scope:
        resolved_scope = "project"

    try:
        if resolved_scope == "project" and project_id:
            await _ensure_project_access(session, project_id, current_user)
            return await notification_client.list_webhooks(scope="project", project_id=str(project_id))

        if resolved_scope == "global":
            return await notification_client.list_webhooks(scope="global")

        accessible_project_ids = await _get_accessible_project_ids(session, current_user)

        if resolved_scope == "project":
            if not accessible_project_ids:
                return []
            hooks = await notification_client.list_webhooks(
                scope="project",
                project_ids=accessible_project_ids,
            )
            allowed = set(accessible_project_ids)
            return [hook for hook in hooks if hook.get("project_id") in allowed]

        # No scope provided: return global plus project hooks the user can access
        results: List[Webhook] = []
        global_hooks = await notification_client.list_webhooks(scope="global")
        results.extend(global_hooks)

        if accessible_project_ids:
            project_hooks = await notification_client.list_webhooks(
                scope="project",
                project_ids=accessible_project_ids,
            )
            allowed = set(accessible_project_ids)
            results.extend([hook for hook in project_hooks if hook.get("project_id") in allowed])

        return results
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/webhooks", response_model=Webhook, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    payload: WebhookCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Webhook:
    try:
        if payload.scope == "project":
            if not payload.project_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id is required for project webhooks")
            await _ensure_project_access(session, payload.project_id, current_user)
            data = payload.model_dump(
                mode="json",
                exclude_none=True,
                exclude={"scope", "project_id"},
            )
            return await notification_client.create_project_webhook(str(payload.project_id), data)

        data = payload.model_dump(
            mode="json",
            exclude_none=True,
            exclude={"scope", "project_id"},
        )
        return await notification_client.create_global_webhook(data)
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.put("/webhooks/{webhook_id}", response_model=Webhook)
async def update_webhook(
    webhook_id: UUID,
    payload: WebhookUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Webhook:
    try:
        existing = await notification_client.get_webhook(str(webhook_id))
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    if existing.get("scope") == "project":
        project_id = existing.get("project_id")
        if not project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook missing project association")
        await _ensure_project_access(session, UUID(project_id), current_user)

    try:
        data = payload.model_dump(mode="json", exclude_unset=True, exclude_none=True)
        return await notification_client.update_webhook(str(webhook_id), data)
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        existing = await notification_client.get_webhook(str(webhook_id))
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    if existing.get("scope") == "project":
        project_id = existing.get("project_id")
        if not project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook missing project association")
        await _ensure_project_access(session, UUID(project_id), current_user)

    try:
        await notification_client.delete_webhook(str(webhook_id))
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    return None


# Legacy project-scoped endpoints -------------------------------------------------


@router.get("/projects/{project_id}/webhooks", response_model=List[Webhook])
async def list_project_webhooks(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> List[Webhook]:
    await _ensure_project_access(session, project_id, current_user)
    return await notification_client.list_project_webhooks(str(project_id))


@router.post("/projects/{project_id}/webhooks", response_model=Webhook, status_code=status.HTTP_201_CREATED)
async def create_project_webhook(
    project_id: UUID,
    payload: ProjectWebhookCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Webhook:
    await _ensure_project_access(session, project_id, current_user)
    try:
        data = payload.model_dump(mode="json", exclude_none=True)
        return await notification_client.create_project_webhook(str(project_id), data)
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.put("/projects/{project_id}/webhooks/{webhook_id}", response_model=Webhook)
async def update_project_webhook(
    project_id: UUID,
    webhook_id: UUID,
    payload: WebhookUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Webhook:
    await _ensure_project_access(session, project_id, current_user)
    try:
        data = payload.model_dump(mode="json", exclude_unset=True, exclude_none=True)
        return await notification_client.update_project_webhook(str(project_id), str(webhook_id), data)
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.delete("/projects/{project_id}/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_webhook(
    project_id: UUID,
    webhook_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    await _ensure_project_access(session, project_id, current_user)
    try:
        await notification_client.delete_project_webhook(str(project_id), str(webhook_id))
    except NotificationServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    return None
