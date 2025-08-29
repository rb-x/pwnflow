from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from neo4j import AsyncSession
from pydantic import BaseModel
from urllib.parse import unquote

from schemas.node import Node, NodeCreate, NodeUpdate, Command, CommandCreate, CommandUpdate, BulkNodePositionUpdate
from crud import node as node_crud
from api.dependencies import get_current_user, get_session
from schemas.user import User
from services.ws_notifications import notification_manager

# Main router for all node-related endpoints
router = APIRouter()

# Specific routers for organizing the API
nodes_crud_router = APIRouter(tags=["Nodes"])
node_tags_router = APIRouter(tags=["Node Tags"])
node_commands_router = APIRouter(tags=["Node Commands"])
node_links_router = APIRouter(tags=["Node Links"])

from typing import List, Dict

class NodeLink(BaseModel):
    source: str
    target: str

class NodesWithLinks(BaseModel):
    nodes: List[Node]
    links: List[NodeLink]

class BulkDeleteRequest(BaseModel):
    node_ids: List[UUID]

@nodes_crud_router.get("/", response_model=NodesWithLinks)
async def get_project_nodes(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    nodes = await node_crud.get_all_nodes_for_project(
        session, project_id=project_id, owner_id=current_user.id
    )
    
    # Extract unique links from parent-child relationships
    links = []
    seen_links = set()
    
    for node in nodes:
        # Add links from parents to this node
        for parent_id in node.parents:
            link_key = (str(parent_id), str(node.id))
            if link_key not in seen_links:
                links.append(NodeLink(source=str(parent_id), target=str(node.id)))
                seen_links.add(link_key)
    
    return NodesWithLinks(nodes=nodes, links=links)

@nodes_crud_router.post("/", response_model=Node, status_code=status.HTTP_201_CREATED)
async def create_node(
    project_id: UUID,
    node_in: NodeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    node = await node_crud.create_node_for_project(
        session, node_in=node_in, project_id=project_id, owner_id=current_user.id
    )
    if not node:
        raise HTTPException(status_code=404, detail="Project not found.")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "nodes_changed")
    
    return node

@nodes_crud_router.post("/{node_id}/duplicate", response_model=Node, status_code=status.HTTP_201_CREATED)
async def duplicate_node(
    project_id: UUID,
    node_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Duplicate a node with all its commands and findings"""
    node = await node_crud.duplicate_node(
        session, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not node:
        raise HTTPException(status_code=404, detail="Node not found.")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "nodes_changed")
    
    return node

@nodes_crud_router.get("/{node_id}", response_model=Node)
async def get_node(
    project_id: UUID,
    node_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    node = await node_crud.get_node_details(
        session, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not node:
        raise HTTPException(status_code=404, detail="Node not found.")
    return node

@nodes_crud_router.put("/{node_id}", response_model=Node)
async def update_node(
    project_id: UUID,
    node_id: UUID,
    node_in: NodeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    updated_node = await node_crud.update_node_in_project(
        session, node_id=node_id, node_in=node_in, project_id=project_id, owner_id=current_user.id
    )
    if not updated_node:
        raise HTTPException(status_code=404, detail="Node not found.")
    
    # Send WebSocket notification with updated node data
    await notification_manager.notify_project(
        str(project_id), 
        "node_updated",
        {"node": updated_node.dict()}
    )
    
    return updated_node

@nodes_crud_router.put("/bulk/positions", status_code=status.HTTP_200_OK)
async def bulk_update_node_positions(
    project_id: UUID,
    bulk_update: BulkNodePositionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk update positions for multiple nodes in a single request.
    This is more efficient than updating each node individually.
    """
    success = await node_crud.bulk_update_node_positions(
        session, 
        project_id=project_id, 
        node_updates=bulk_update.nodes,
        owner_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=404, 
            detail="Failed to update node positions. Some nodes may not exist or you don't have access."
        )
    
    # Send WebSocket notification for bulk position update
    await notification_manager.notify_project(str(project_id), "nodes_changed")
    
    return {"status": "success", "detail": f"Updated positions for {len(bulk_update.nodes)} nodes."}

@nodes_crud_router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    project_id: UUID,
    node_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = await node_crud.delete_node_from_project(
        session, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Node not found.")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "nodes_changed")
    
    return

@nodes_crud_router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_nodes(
    project_id: UUID,
    request: BulkDeleteRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk delete multiple nodes from a project.
    This will also clean up all related data (tags, commands, variables, contexts).
    """
    success_count = 0
    for node_id in request.node_ids:
        success = await node_crud.delete_node_from_project(
            session, node_id=node_id, project_id=project_id, owner_id=current_user.id
        )
        if success:
            success_count += 1
    
    if success_count == 0:
        raise HTTPException(status_code=404, detail="No nodes found to delete.")
    
    # Send WebSocket notification if any nodes were deleted
    if success_count > 0:
        await notification_manager.notify_project(str(project_id), "nodes_changed")
    
    if success_count < len(request.node_ids):
        # Some nodes were deleted, but not all
        return {"detail": f"Deleted {success_count} of {len(request.node_ids)} nodes."}
    
    return

# Endpoints for Tags within a Node, now on its own router
@node_tags_router.post("/{node_id}/tags/{tag_name:path}", response_model=Node, status_code=status.HTTP_201_CREATED)
async def add_tag_to_node(
    project_id: UUID,
    node_id: UUID,
    tag_name: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    decoded_tag_name = unquote(tag_name)
    success = await node_crud.add_tag_to_node(
        session, tag_name=decoded_tag_name, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Node not found.")
    return await node_crud.get_node_details(session, node_id, project_id, current_user.id)

@node_tags_router.delete("/{node_id}/tags/{tag_name:path}", response_model=Node)
async def remove_tag_from_node(
    project_id: UUID,
    node_id: UUID,
    tag_name: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    decoded_tag_name = unquote(tag_name)
    success = await node_crud.remove_tag_from_node(
        session, tag_name=decoded_tag_name, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found on this node.")
    return await node_crud.get_node_details(session, node_id, project_id, current_user.id)

# Endpoints for Commands within a Node, now on its own router
@node_commands_router.get("/{node_id}/commands", response_model=List[Command])
async def get_node_commands(
    project_id: UUID,
    node_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all commands for a specific node"""
    commands = await node_crud.get_commands_for_node(
        session, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    return commands

@node_commands_router.get("/{node_id}/commands/{command_id}", response_model=Command)
async def get_command(
    project_id: UUID,
    node_id: UUID,
    command_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a specific command by ID"""
    command = await node_crud.get_command_by_id(
        session, command_id=command_id, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not command:
        raise HTTPException(status_code=404, detail="Command not found.")
    return command

@node_commands_router.post("/{node_id}/commands", response_model=Command, status_code=status.HTTP_201_CREATED)
async def add_command_to_node(
    project_id: UUID,
    node_id: UUID,
    command_in: CommandCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    command = await node_crud.add_command_to_node(
        session, command_in=command_in, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not command:
        raise HTTPException(status_code=404, detail="Node not found.")
    return command

@node_commands_router.put("/{node_id}/commands/{command_id}", response_model=Command)
async def update_command(
    project_id: UUID,
    node_id: UUID,
    command_id: UUID,
    command_in: CommandUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a specific command"""
    updated_command = await node_crud.update_command_in_node(
        session, command_id=command_id, command_in=command_in, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not updated_command:
        raise HTTPException(status_code=404, detail="Command not found.")
    return updated_command

@node_commands_router.delete("/{node_id}/commands/{command_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_command_from_node(
    project_id: UUID,
    node_id: UUID,
    command_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = await node_crud.delete_command_from_node(
        session, command_id=command_id, node_id=node_id, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Command not found.")
    return

# Endpoints for linking nodes, now on its own router
@node_links_router.post("/{source_node_id}/link/{target_node_id}", status_code=status.HTTP_201_CREATED)
async def link_nodes(
    project_id: UUID,
    source_node_id: UUID,
    target_node_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if source_node_id == target_node_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A node cannot be linked to itself.",
        )

    success = await node_crud.link_nodes(
        session,
        source_node_id=source_node_id,
        target_node_id=target_node_id,
        project_id=project_id,
        owner_id=current_user.id,
    )
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Could not create link. Ensure both source and target nodes exist in the project.",
        )
    
    # Send WebSocket notification for link creation
    await notification_manager.notify_project(str(project_id), "nodes_changed")
    
    return {"status": "success", "detail": "Nodes linked."}


@node_links_router.delete("/{source_node_id}/link/{target_node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_nodes(
    project_id: UUID,
    source_node_id: UUID,
    target_node_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = await node_crud.unlink_nodes(
        session,
        source_node_id=source_node_id,
        target_node_id=target_node_id,
        project_id=project_id,
        owner_id=current_user.id,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Link not found or could not be deleted.")
    
    # Send WebSocket notification for link deletion
    await notification_manager.notify_project(str(project_id), "nodes_changed")
    
    return 

# Include all the specific routers into the main router
router.include_router(nodes_crud_router, prefix="")
router.include_router(node_tags_router, prefix="")
router.include_router(node_commands_router, prefix="")
router.include_router(node_links_router, prefix="") 