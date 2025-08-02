from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from neo4j import AsyncSession

from schemas.context import Context, ContextCreate, ContextUpdate
from crud import context as context_crud
from api.dependencies import get_current_user, get_session
from schemas.user import User
from . import variables as variables_router

# Main router for all context-related endpoints
router = APIRouter()

# Specific routers for organizing the API
contexts_router = APIRouter(tags=["Contexts"])
variables_router_ref = APIRouter(tags=["Variables"])

@contexts_router.post("/", response_model=Context, status_code=status.HTTP_201_CREATED)
async def create_context(
    project_id: UUID,
    context_in: ContextCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    context = await context_crud.create_context_for_project(
        session, context_in=context_in, project_id=project_id, owner_id=current_user.id
    )
    if not context:
        raise HTTPException(status_code=404, detail="Project not found.")
    return context

@contexts_router.get("/", response_model=List[Context])
async def get_all_contexts(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    contexts = await context_crud.get_all_contexts_for_project(
        session, project_id=project_id, owner_id=current_user.id
    )
    return contexts

@contexts_router.get("/{context_id}", response_model=Context)
async def get_context(
    project_id: UUID,
    context_id: UUID,
    include_sensitive: bool = False,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    context = await context_crud.get_context_with_variables(
        session, context_id=context_id, project_id=project_id, owner_id=current_user.id, include_sensitive=include_sensitive
    )
    if not context:
        raise HTTPException(status_code=404, detail="Context not found.")
    return context

@contexts_router.put("/{context_id}", response_model=Context)
async def update_context(
    project_id: UUID,
    context_id: UUID,
    context_in: ContextUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    context = await context_crud.update_context(
        session, context_id=context_id, context_in=context_in, project_id=project_id, owner_id=current_user.id
    )
    if not context:
        raise HTTPException(status_code=404, detail="Context not found.")
    return context

@contexts_router.delete("/{context_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_context(
    project_id: UUID,
    context_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = await context_crud.delete_context(
        session, context_id=context_id, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Context not found.")
    return

# Include all the specific routers into the main router
router.include_router(contexts_router, prefix="")
router.include_router(variables_router.router, prefix="/{context_id}/variables") 