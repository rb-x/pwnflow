from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from neo4j import AsyncSession

from schemas.context import VariableInDB, VariableCreate, VariableUpdate
from crud import context as context_crud
from api.dependencies import get_current_user, get_session
from schemas.user import User

router = APIRouter(tags=["Variables"])

@router.post("/", response_model=VariableInDB, status_code=status.HTTP_201_CREATED)
async def create_variable(
    project_id: UUID,
    context_id: UUID,
    variable_in: VariableCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    variable = await context_crud.add_variable_to_context(
        session, variable_in=variable_in, context_id=context_id, project_id=project_id, owner_id=current_user.id
    )
    if not variable:
        raise HTTPException(status_code=404, detail="Context not found.")
    return variable

@router.get("/{variable_id}", response_model=VariableInDB)
async def get_variable(
    project_id: UUID,
    context_id: UUID,
    variable_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    variable = await context_crud.get_variable_in_context(
        session, variable_id=variable_id, context_id=context_id, project_id=project_id, owner_id=current_user.id
    )
    if not variable:
        raise HTTPException(status_code=404, detail="Variable not found.")
    return variable

@router.put("/{variable_id}", response_model=VariableInDB)
async def update_variable(
    project_id: UUID,
    context_id: UUID,
    variable_id: UUID,
    variable_in: VariableUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    variable = await context_crud.update_variable_in_context(
        session, variable_id=variable_id, variable_in=variable_in, context_id=context_id, project_id=project_id, owner_id=current_user.id
    )
    if not variable:
        raise HTTPException(status_code=404, detail="Variable not found.")
    return variable

@router.delete("/{variable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variable(
    project_id: UUID,
    context_id: UUID,
    variable_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = await context_crud.delete_variable_from_context(
        session, variable_id=variable_id, context_id=context_id, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Variable not found.")
    return 