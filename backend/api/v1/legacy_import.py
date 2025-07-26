import json
import asyncio
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from neo4j import AsyncSession

from db.database import get_session
from api.dependencies import get_current_user
from schemas.user import User
from schemas.legacy_import import ImportResult, ImportProgress
from services.legacy_import_service import LegacyImportService
from services.ws_notifications import notification_manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/legacy",
    tags=["legacy-import"]
)


@router.post("/import")
async def import_legacy_project(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Import a legacy project with progress streaming
    
    This endpoint accepts legacy project JSON and returns a streaming response
    with real-time progress updates via Server-Sent Events (SSE).
    """
    try:
        # Get the raw body data first to handle encoding issues
        body_bytes = await request.body()
        
        # Try to decode as UTF-8, with error handling
        try:
            body_str = body_bytes.decode('utf-8')
        except UnicodeDecodeError:
            # Try with latin-1 encoding as fallback
            try:
                body_str = body_bytes.decode('latin-1')
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid character encoding in request body. Please ensure the file is UTF-8 encoded."
                )
        
        # Parse JSON
        try:
            legacy_data = json.loads(body_str)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON format: {str(e)}"
            )
        
        # Validate basic structure
        if not legacy_data.get("id") or not legacy_data.get("name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid legacy data: missing required fields (id, name)"
            )
        
        # Create progress queue for SSE
        progress_queue = asyncio.Queue()
        
        async def progress_callback(progress: ImportProgress):
            await progress_queue.put(progress)
        
        async def event_generator():
            # Start import in background
            import_task = asyncio.create_task(
                import_legacy_project_task(
                    legacy_data,
                    str(current_user.id),
                    progress_callback
                )
            )
            
            try:
                # Stream progress updates
                while True:
                    try:
                        # Wait for progress update with timeout
                        progress = await asyncio.wait_for(
                            progress_queue.get(),
                            timeout=1.0
                        )
                        
                        event = {
                            "type": "progress",
                            "data": {
                                "current_step": progress.current_step,
                                "percentage": progress.percentage,
                                "total_nodes": progress.total_nodes,
                                "processed_nodes": progress.processed_nodes,
                                "total_edges": progress.total_edges,
                                "processed_edges": progress.processed_edges,
                                "errors": progress.errors
                            }
                        }
                        yield f"data: {json.dumps(event)}\n\n"
                        
                        # Check if import is complete
                        if progress.percentage >= 100:
                            # Get final result
                            result = await import_task
                            
                            # Send WebSocket notification for import completion
                            await notification_manager.notify_project(
                                result.project_id, 
                                "import_completed"
                            )
                            
                            # Send completion event
                            completion_event = {
                                "type": "complete",
                                "data": {
                                    "project_id": result.project_id,
                                    "imported_nodes": result.imported_nodes,
                                    "imported_edges": result.imported_edges,
                                    "errors": result.errors,
                                    "warnings": result.warnings
                                }
                            }
                            yield f"data: {json.dumps(completion_event)}\n\n"
                            break
                            
                    except asyncio.TimeoutError:
                        # Send heartbeat to keep connection alive
                        heartbeat = {"type": "heartbeat"}
                        yield f"data: {json.dumps(heartbeat)}\n\n"
                        
                        # Check if task is done
                        if import_task.done():
                            # Task completed without sending 100% progress
                            try:
                                result = await import_task
                                
                                # Send WebSocket notification for import completion
                                await notification_manager.notify_project(
                                    result.project_id, 
                                    "import_completed"
                                )
                                
                                completion_event = {
                                    "type": "complete",
                                    "data": {
                                        "project_id": result.project_id,
                                        "imported_nodes": result.imported_nodes,
                                        "imported_edges": result.imported_edges,
                                        "errors": result.errors,
                                        "warnings": result.warnings
                                    }
                                }
                                yield f"data: {json.dumps(completion_event)}\n\n"
                            except Exception as e:
                                error_event = {
                                    "type": "error",
                                    "message": str(e)
                                }
                                yield f"data: {json.dumps(error_event)}\n\n"
                            break
                            
            except Exception as e:
                logger.error(f"Error in import event generator: {e}")
                error_event = {
                    "type": "error",
                    "message": str(e)
                }
                yield f"data: {json.dumps(error_event)}\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Disable Nginx buffering
            }
        )
        
    except Exception as e:
        logger.error(f"Legacy import error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )


async def import_legacy_project_task(
    legacy_data: dict,
    user_id: str,
    progress_callback
) -> ImportResult:
    """Background task to import legacy project"""
    # Create a new session for the background task
    from db.database import get_session
    
    async for session in get_session():
        import_service = LegacyImportService(session)
        
        try:
            result = await import_service.import_legacy_project(
                legacy_data,
                user_id,
                progress_callback
            )
            return result
        except Exception as e:
            logger.error(f"Import task failed: {e}")
            raise


@router.post("/import/validate")
async def validate_legacy_data(
    request: Request,
    current_user: User = Depends(get_current_user)
) -> Dict:
    """
    Validate legacy project data without importing
    
    Returns validation results including what will be imported.
    """
    try:
        # Get the raw body data first to handle encoding issues
        body_bytes = await request.body()
        
        # Try to decode as UTF-8, with error handling
        try:
            body_str = body_bytes.decode('utf-8')
        except UnicodeDecodeError:
            # Try with latin-1 encoding as fallback
            try:
                body_str = body_bytes.decode('latin-1')
            except Exception:
                return {
                    "valid": False,
                    "errors": ["Invalid character encoding. Please ensure the file is UTF-8 encoded."],
                    "warnings": [],
                    "summary": {}
                }
        
        # Parse JSON
        try:
            legacy_data = json.loads(body_str)
        except json.JSONDecodeError as e:
            return {
                "valid": False,
                "errors": [f"Invalid JSON format: {str(e)}"],
                "warnings": [],
                "summary": {}
            }
        
        # Basic validation
        errors = []
        warnings = []
        
        if not legacy_data.get("id"):
            errors.append("Missing project ID")
        if not legacy_data.get("name"):
            errors.append("Missing project name")
            
        # Check for nodes and edges
        nodes = []
        edges = []
        
        if legacy_data.get("nodes") and legacy_data.get("edges"):
            nodes = legacy_data["nodes"]
            edges = legacy_data["edges"]
        elif legacy_data.get("flowData"):
            nodes = legacy_data["flowData"].get("nodes", [])
            edges = legacy_data["flowData"].get("edges", [])
        elif legacy_data.get("template", {}).get("flowData"):
            nodes = legacy_data["template"]["flowData"].get("nodes", [])
            edges = legacy_data["template"]["flowData"].get("edges", [])
            
        if not nodes:
            warnings.append("No nodes found in the legacy data")
            
        # Validate node structure
        for i, node in enumerate(nodes):
            if not node.get("id"):
                errors.append(f"Node at index {i} missing ID")
            if not node.get("data", {}).get("name"):
                warnings.append(f"Node {node.get('id', i)} missing name")
                
        # Validate edge structure
        node_ids = {node["id"] for node in nodes if node.get("id")}
        for i, edge in enumerate(edges):
            if not edge.get("source") or not edge.get("target"):
                errors.append(f"Edge at index {i} missing source or target")
            elif edge["source"] not in node_ids or edge["target"] not in node_ids:
                warnings.append(
                    f"Edge {edge.get('id', i)} references non-existent nodes"
                )
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "summary": {
                "nodes_count": len(nodes),
                "edges_count": len(edges),
                "has_template": bool(legacy_data.get("template")),
                "project_name": legacy_data.get("name", "Unknown"),
                "tags_count": len(legacy_data.get("tags", []))
            }
        }
        
    except Exception as e:
        logger.error(f"Validation error: {e}")
        return {
            "valid": False,
            "errors": [f"Failed to parse legacy data: {str(e)}"],
            "warnings": [],
            "summary": {}
        }


@router.get("/import/sample")
async def get_sample_legacy_format(
    current_user: User = Depends(get_current_user)
) -> Dict:
    """
    Get a sample of the expected legacy format
    
    This helps users understand what format is expected for import.
    """
    return {
        "format_description": "Legacy Penflow project format",
        "required_fields": ["id", "name"],
        "optional_fields": ["description", "tags", "template", "flowData", "nodes", "edges"],
        "sample": {
            "id": "uuid-here",
            "identifier": "optional-identifier",
            "name": "Project Name",
            "description": "Project description",
            "tags": ["tag1", "tag2"],
            "nodes": [
                {
                    "id": "node-uuid",
                    "type": "custom",
                    "position": {"x": 0, "y": 0},
                    "data": {
                        "name": "Node Name",
                        "description": "Node description",
                        "commands": [],
                        "findings": [],
                        "status": "NOT_STARTED",
                        "tags": []
                    }
                }
            ],
            "edges": [
                {
                    "id": "edge-uuid",
                    "source": "source-node-id",
                    "target": "target-node-id",
                    "type": "bezier"
                }
            ]
        }
    }