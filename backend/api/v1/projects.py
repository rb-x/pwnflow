from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from typing import Any, List, Optional
from uuid import UUID
from neo4j import AsyncSession
from pydantic import BaseModel
import os
import tempfile
import asyncio

from schemas.project import Project, ProjectCreate, ProjectUpdate
from schemas.export import (
    ProjectExportRequest, ExportJobResponse, ImportPreviewResponse
)
from crud import project as project_crud
from api.dependencies import get_current_user, get_session
from schemas.user import User
from services.export_service import ExportService
from services.import_service import ImportService
from services.ws_notifications import notification_manager
from . import nodes as nodes_router
from . import contexts as contexts_router

router = APIRouter()
project_crud_router = APIRouter(tags=["Projects"])
project_category_tags_router = APIRouter(tags=["Project Category Tags"])

# Export/Import services
export_service = ExportService()
import_service = ImportService()

# Temporary storage for export files
EXPORT_DIR = tempfile.gettempdir()


@project_crud_router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create a new project.
    """
    project = await project_crud.create_project(session=session, project_in=project_in, owner_id=current_user.id)
    if not project:
        raise HTTPException(
            status_code=400,
            detail="Project could not be created. If using a template, ensure it exists and you have permission to access it.",
        )
    return project


@project_crud_router.get("/", response_model=List[Project])
async def read_projects(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> List[Project]:
    """
    Retrieve all projects for the current user.
    """
    projects = await project_crud.get_all_projects_for_user(
        session=session, owner_id=current_user.id, skip=skip, limit=limit
    )
    return projects


@project_crud_router.get("/{project_id}", response_model=Project)
async def read_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get a specific project by ID.
    """
    project = await project_crud.get_project(session=session, project_id=project_id, owner_id=current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@project_crud_router.put("/{project_id}", response_model=Project)
async def update_project(
    project_id: UUID,
    project_in: ProjectUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Update a project.
    """
    project = await project_crud.get_project(session=session, project_id=project_id, owner_id=current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    updated_project = await project_crud.update_project(
        session=session, project_id=project_id, project_in=project_in, owner_id=current_user.id
    )
    return updated_project


@project_crud_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> None:
    """
    Delete a project.
    """
    project = await project_crud.get_project(session=session, project_id=project_id, owner_id=current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await project_crud.delete_project(session=session, project_id=project_id, owner_id=current_user.id)
    
    return


class BulkDeleteRequest(BaseModel):
    project_ids: List[UUID]
    

class BulkDeleteResponse(BaseModel):
    deleted: List[UUID]
    failed: List[dict]  # {id: UUID, reason: str}
    total_deleted: int


@project_crud_router.post("/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_projects(
    request: BulkDeleteRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> BulkDeleteResponse:
    """
    Delete multiple projects at once. This operation is atomic - all projects are deleted
    together in a single transaction, including all their related data (nodes, contexts, commands, etc.).
    """
    if not request.project_ids:
        return BulkDeleteResponse(deleted=[], failed=[], total_deleted=0)
    
    try:
        # Use the optimized bulk delete function
        result = await project_crud.bulk_delete_projects(
            session=session,
            project_ids=request.project_ids,
            owner_id=current_user.id
        )
        
        # Format failed items
        failed = []
        for project_id in result["not_found"]:
            failed.append({
                "id": str(project_id),
                "reason": "Project not found or you don't have permission"
            })
        
        return BulkDeleteResponse(
            deleted=result["deleted"],
            failed=failed,
            total_deleted=result["total_deleted"]
        )
        
    except Exception as e:
        # If transaction fails, nothing gets deleted
        raise HTTPException(
            status_code=500,
            detail=f"Bulk delete failed: {str(e)}. No projects were deleted."
        )


@project_category_tags_router.post("/{project_id}/category-tags/{tag_name}", response_model=Project)
async def add_category_tag_to_project_route(
    project_id: UUID,
    tag_name: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Add a category tag to a project.
    """
    project = await project_crud.add_category_tag_to_project(session, project_id, tag_name, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@project_category_tags_router.delete("/{project_id}/category-tags/{tag_name}", response_model=Project)
async def remove_category_tag_from_project_route(
    project_id: UUID,
    tag_name: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a category tag from a project.
    """
    project = await project_crud.remove_category_tag_from_project(session, project_id, tag_name, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project or tag not found on project")
    return project


class ImportTemplateRequest(BaseModel):
    template_id: UUID
    offset_x: Optional[int] = None
    offset_y: Optional[int] = None


@project_crud_router.post("/{project_id}/import-template", status_code=status.HTTP_200_OK)
async def import_template_to_project(
    project_id: UUID,
    request: ImportTemplateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Import all nodes and relationships from a template into the current project.
    The nodes will be offset to avoid overlapping with existing nodes.
    """
    success = await project_crud.import_template_to_project(
        session,
        project_id=project_id,
        template_id=request.template_id,
        owner_id=current_user.id,
        offset_x=request.offset_x,
        offset_y=request.offset_y
    )
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Project or template not found, or you don't have access"
        )
    
    # Send WebSocket notification for template import
    await notification_manager.notify_project(str(project_id), "nodes_changed")
    
    return {"success": True, "message": "Template imported successfully"}


# Export/Import endpoints
@project_crud_router.post("/{project_id}/export", response_model=ExportJobResponse)
async def export_project(
    project_id: str,
    request: ProjectExportRequest,
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Export a project to an encrypted file."""
    try:
        # For now, we'll do synchronous export (can be made async with job queue later)
        file_path, generated_password = await export_service.export_project(
            project_id=project_id,
            user=current_user,
            encryption_method=request.encryption.method,
            password=request.encryption.password,
            include_variables=request.options.include_variables
        )
        
        # Generate a temporary job ID
        job_id = f"export_{project_id}_{os.path.basename(file_path)}"
        
        # Schedule cleanup after 24 hours
        # background_tasks.add_task(cleanup_export_file, file_path, delay=86400)
        
        return ExportJobResponse(
            job_id=job_id,
            status="completed",
            download_url=f"/api/v1/exports/download/{job_id}",
            generated_password=generated_password
        )
    
    except ValueError as e:
        print(f"ValueError in export_project: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Exception in export_project: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@project_crud_router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_project_import(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Preview a project import file."""
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.penflow-project') as tmp:
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


@project_crud_router.post("/import")
async def import_project(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    import_mode: str = Form("new"),
    target_project_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Import a project from file."""
    # Validate file extension
    if not file.filename.endswith('.penflow-project'):
        raise HTTPException(status_code=400, detail="Invalid file type. Expected .penflow-project")
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.penflow-project') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        project_id = await import_service.import_project(
            file_path=tmp_path,
            user=current_user,
            password=password,
            import_mode=import_mode,
            target_project_id=target_project_id
        )
        
        # Send WebSocket notification that import is complete
        await notification_manager.notify_project(project_id, "import_completed")
        
        return {
            "success": True,
            "project_id": project_id,
            "message": "Project imported successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


# Include all the specific routers into the main router for this file
router.include_router(project_crud_router, prefix="")
router.include_router(project_category_tags_router, prefix="")
router.include_router(nodes_router.router, prefix="/{project_id}/nodes")
router.include_router(contexts_router.router, prefix="/{project_id}/contexts") 