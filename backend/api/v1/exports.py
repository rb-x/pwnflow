from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
import os
import tempfile

from api.dependencies import get_current_user
from schemas.user import User

router = APIRouter(tags=["Exports"])

# Temporary storage for export files
EXPORT_DIR = tempfile.gettempdir()


@router.get("/download/{job_id}")
async def download_export(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download an exported file."""
    # Extract filename from job_id
    filename = job_id.split("_", 2)[-1]
    file_path = os.path.join(EXPORT_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Export file not found")
    
    # Determine content type based on extension
    if filename.endswith('.penflow-project'):
        media_type = "application/x-penflow-project"
        download_name = "project-export.penflow-project"
    elif filename.endswith('.penflow-template'):
        media_type = "application/x-penflow-template"
        download_name = "template-export.penflow-template"
    else:
        media_type = "application/octet-stream"
        download_name = filename
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=download_name
    )