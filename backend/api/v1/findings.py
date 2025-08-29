from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from neo4j import AsyncSession

from schemas.finding import Finding, FindingCreate, FindingUpdate
from crud import finding as finding_crud
from api.dependencies import get_current_user, get_session
from schemas.user import User
from services.ws_notifications import notification_manager

router = APIRouter(tags=["Findings"])

@router.post("/projects/{project_id}/nodes/{node_id}/finding", response_model=Finding, status_code=status.HTTP_201_CREATED)
async def create_finding(
    project_id: UUID,
    node_id: UUID,
    finding_in: FindingCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a finding for a specific node"""
    finding = await finding_crud.create_finding_for_node(
        session, 
        finding_in=finding_in, 
        node_id=node_id, 
        project_id=project_id, 
        owner_id=current_user.id
    )
    
    if not finding:
        raise HTTPException(status_code=404, detail="Node not found or you don't have access")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "finding_created", {
        "finding": finding.model_dump(),
        "node_id": str(node_id)
    })
    
    return finding

@router.get("/projects/{project_id}/nodes/{node_id}/finding", response_model=Finding)
async def get_node_finding(
    project_id: UUID,
    node_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get the finding for a specific node"""
    finding = await finding_crud.get_finding_for_node(
        session, 
        node_id=node_id, 
        project_id=project_id, 
        owner_id=current_user.id
    )
    
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    return finding

@router.get("/projects/{project_id}/findings/{finding_id}", response_model=Finding)
async def get_finding(
    project_id: UUID,
    finding_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a specific finding by ID"""
    finding = await finding_crud.get_finding_by_id(
        session, 
        finding_id=finding_id, 
        project_id=project_id, 
        owner_id=current_user.id
    )
    
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    return finding

@router.put("/projects/{project_id}/findings/{finding_id}", response_model=Finding)
async def update_finding(
    project_id: UUID,
    finding_id: UUID,
    finding_in: FindingUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a specific finding"""
    updated_finding = await finding_crud.update_finding(
        session, 
        finding_id=finding_id, 
        finding_in=finding_in, 
        project_id=project_id, 
        owner_id=current_user.id
    )
    
    if not updated_finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "finding_updated", {
        "finding": updated_finding.model_dump()
    })
    
    return updated_finding

@router.delete("/projects/{project_id}/findings/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_finding(
    project_id: UUID,
    finding_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a specific finding"""
    success = await finding_crud.delete_finding(
        session, 
        finding_id=finding_id, 
        project_id=project_id, 
        owner_id=current_user.id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "finding_deleted", {
        "finding_id": str(finding_id)
    })
    
    return

@router.get("/projects/{project_id}/timeline", response_model=List[dict])
async def get_project_timeline(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get chronological timeline of all findings in a project"""
    timeline = await finding_crud.get_project_timeline(
        session, 
        project_id=project_id, 
        owner_id=current_user.id
    )
    
    return timeline

