from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from typing import Any, List, Optional
from uuid import UUID
from neo4j import AsyncSession
from pydantic import BaseModel
import os
import tempfile

from schemas.template import Template, TemplateCreate, TemplateUpdate
from schemas.export import (
    TemplateExportRequest, ExportJobResponse, ImportPreviewResponse
)
from schemas.node import Node
from schemas.context import Context
from crud import template as template_crud
from api.dependencies import get_current_user, get_session
from schemas.user import User
from services.export_service import ExportService
from services.import_service import ImportService

router = APIRouter()
template_crud_router = APIRouter(tags=["Templates"])
template_category_tags_router = APIRouter(tags=["Template Category Tags"])

# Export/Import services
export_service = ExportService()
import_service = ImportService()

# Temporary storage for export files
EXPORT_DIR = tempfile.gettempdir()

@template_crud_router.post("/", response_model=Template, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_in: TemplateCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create a new template.
    If a source_project_id is provided, the template will be a clone of that project.
    Otherwise, a new blank template will be created.
    """
    if template_in.source_project_id:
        # Create a template from a project
        template = await template_crud.create_template_from_project(
            session, template_in=template_in, owner_id=current_user.id
        )
        if not template:
            raise HTTPException(
                status_code=404,
                detail="Source project not found or you do not have permission to access it.",
            )
    else:
        # Create a blank template
        template = await template_crud.create_template(
            session, template_in=template_in, owner_id=current_user.id
        )
    return template

@template_crud_router.get("/", response_model=List[Template])
async def get_all_templates(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> List[Template]:
    """
    Retrieve all templates for the current user.
    """
    templates = await template_crud.get_all_templates_for_user(
        session, owner_id=current_user.id, skip=skip, limit=limit
    )
    return templates

@template_crud_router.get("/{template_id}", response_model=Template)
async def get_template(
    template_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get a specific template by ID.
    """
    template = await template_crud.get_template(session, template_id=template_id, owner_id=current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@template_crud_router.put("/{template_id}", response_model=Template)
async def update_template(
    template_id: UUID,
    template_in: TemplateUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Update a template.
    """
    template = await template_crud.get_template(session, template_id=template_id, owner_id=current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    updated_template = await template_crud.update_template(
        session, template_id=template_id, template_in=template_in, owner_id=current_user.id
    )
    return updated_template

@template_crud_router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> None:
    """
    Delete a template.
    """
    template = await template_crud.get_template(session, template_id=template_id, owner_id=current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await template_crud.delete_template(session, template_id=template_id, owner_id=current_user.id)
    
    return


class BulkDeleteTemplatesRequest(BaseModel):
    template_ids: List[UUID]
    

class BulkDeleteTemplatesResponse(BaseModel):
    deleted: List[UUID]
    failed: List[dict]  # {id: UUID, reason: str}
    total_deleted: int


@template_crud_router.post("/bulk-delete", response_model=BulkDeleteTemplatesResponse)
async def bulk_delete_templates(
    request: BulkDeleteTemplatesRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> BulkDeleteTemplatesResponse:
    """
    Delete multiple templates at once. This operation is atomic - all templates are deleted
    together in a single transaction, including all their related data (nodes, contexts, commands, etc.).
    """
    if not request.template_ids:
        return BulkDeleteTemplatesResponse(deleted=[], failed=[], total_deleted=0)
    
    try:
        # Use the optimized bulk delete function
        result = await template_crud.bulk_delete_templates(
            session=session,
            template_ids=request.template_ids,
            owner_id=current_user.id
        )
        
        # Format failed items
        failed = []
        for template_id in result["not_found"]:
            failed.append({
                "id": str(template_id),
                "reason": "Template not found or you don't have permission"
            })
        
        return BulkDeleteTemplatesResponse(
            deleted=result["deleted"],
            failed=failed,
            total_deleted=result["total_deleted"]
        )
        
    except Exception as e:
        # If transaction fails, nothing gets deleted
        raise HTTPException(
            status_code=500,
            detail=f"Bulk delete failed: {str(e)}. No templates were deleted."
        ) 

@template_category_tags_router.post("/{template_id}/category-tags/{tag_name}", response_model=Template)
async def add_category_tag_to_template_route(
    template_id: UUID,
    tag_name: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Add a category tag to a template.
    """
    template = await template_crud.add_category_tag_to_template(session, template_id, tag_name, current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@template_category_tags_router.delete("/{template_id}/category-tags/{tag_name}", response_model=Template)
async def remove_category_tag_from_template_route(
    template_id: UUID,
    tag_name: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a category tag from a template.
    """
    template = await template_crud.remove_category_tag_from_template(session, template_id, tag_name, current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template or tag not found on template")
    return template 

class NodeLink(BaseModel):
    source: str
    target: str

class NodesWithLinks(BaseModel):
    nodes: List[Node]
    links: List[NodeLink]

@template_crud_router.get("/{template_id}/nodes", response_model=NodesWithLinks)
async def get_template_nodes(
    template_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get all nodes for a specific template.
    """
    nodes_data = await template_crud.get_all_nodes_for_template(
        session, template_id=template_id, owner_id=current_user.id
    )
    
    # If nodes_data is empty list, it means template exists but has no nodes
    # Only raise 404 if the template itself doesn't exist
    if nodes_data is None:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Convert to Node objects
    nodes = []
    for node_data in nodes_data:
        nodes.append(Node(**node_data))
    
    # Extract unique links from parent-child relationships
    links = []
    seen_links = set()
    
    for node in nodes:
        # Add links from parents to this node
        for parent_id in node.parents:
            link_tuple = (str(parent_id), str(node.id))
            if link_tuple not in seen_links:
                seen_links.add(link_tuple)
                links.append(NodeLink(source=str(parent_id), target=str(node.id)))
    
    return NodesWithLinks(nodes=nodes, links=links)


@template_crud_router.get("/{template_id}/contexts", response_model=List[Context])
async def get_template_contexts(
    template_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get all contexts for a specific template.
    """
    # First verify the template exists and user has access
    template = await template_crud.get_template(session, template_id=template_id, owner_id=current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get contexts from the template
    contexts_data = await template_crud.get_all_contexts_for_template(
        session, template_id=template_id, owner_id=current_user.id
    )
    
    # Convert to Context objects
    contexts = []
    for context_data in contexts_data:
        contexts.append(Context(**context_data))
    
    return contexts


# Export/Import endpoints
@template_crud_router.post("/{template_id}/export", response_model=ExportJobResponse)
async def export_template(
    template_id: str,
    request: TemplateExportRequest,
    current_user: User = Depends(get_current_user)
):
    """Export a template to an encrypted file."""
    try:
        file_path, generated_password = await export_service.export_template(
            template_id=template_id,
            user=current_user,
            encryption_method=request.encryption.method,
            password=request.encryption.password
        )
        
        # Generate a temporary job ID
        job_id = f"export_{template_id}_{os.path.basename(file_path)}"
        
        return ExportJobResponse(
            job_id=job_id,
            status="completed",
            download_url=f"/api/v1/exports/download/{job_id}",
            generated_password=generated_password
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@template_crud_router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_template_import(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Preview a template import file."""
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.penflow-template') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        preview = import_service.preview_import(tmp_path, password)
        
        if "error" in preview:
            raise HTTPException(status_code=400, detail=preview["error"])
        
        return ImportPreviewResponse(**preview)
    
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


@template_crud_router.post("/import")
async def import_template(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Import a template from file."""
    # Validate file extension
    if not file.filename.endswith('.penflow-template'):
        raise HTTPException(status_code=400, detail="Invalid file type. Expected .penflow-template")
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.penflow-template') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        template_id = await import_service.import_template(
            file_path=tmp_path,
            user=current_user,
            password=password
        )
        
        return {
            "success": True,
            "template_id": template_id,
            "message": "Template imported successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


# Include all the specific routers into the main router for this file
router.include_router(template_crud_router, prefix="")
router.include_router(template_category_tags_router, prefix="") 