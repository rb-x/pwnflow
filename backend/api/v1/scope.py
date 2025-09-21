from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from neo4j import AsyncSession

from schemas.scope import (
    ScopeAsset, ScopeAssetCreate, ScopeAssetUpdate, 
    NmapImportRequest, ImportStats, ScopeStats,
    BulkStatusUpdate, BulkTagOperation, ScopeTag
)
from crud import scope as scope_crud
from api.dependencies import get_current_user, get_session
from schemas.user import User
from services.ws_notifications import notification_manager
from services.nmap_parser import parse_nmap_xml

# Main router for all scope-related endpoints
router = APIRouter()

# Specific routers for organizing the API
scope_crud_router = APIRouter(tags=["Scope Assets"])
scope_import_router = APIRouter(tags=["Scope Import"])
scope_stats_router = APIRouter(tags=["Scope Analytics"])

# --- Core CRUD Operations ---

@scope_crud_router.get("/assets", response_model=List[ScopeAsset])
async def get_project_assets(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all scope assets for a project"""
    assets = await scope_crud.get_all_assets_for_project(
        session, project_id=project_id, owner_id=current_user.id
    )
    return assets

@scope_crud_router.get("/assets/{asset_id}", response_model=ScopeAsset)
async def get_asset(
    project_id: UUID,
    asset_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a specific asset by ID"""
    asset = await scope_crud.get_asset_by_id(
        session, asset_id=asset_id, project_id=project_id, owner_id=current_user.id
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return asset

@scope_crud_router.post("/assets", response_model=ScopeAsset, status_code=status.HTTP_201_CREATED)
async def create_asset(
    project_id: UUID,
    asset_in: ScopeAssetCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new scope asset"""
    asset = await scope_crud.create_asset_for_project(
        session, asset_in=asset_in, project_id=project_id, owner_id=current_user.id
    )
    if not asset:
        raise HTTPException(
            status_code=400, 
            detail="Asset could not be created. It may already exist or project not found."
        )
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "scope_updated")
    
    return asset

@scope_crud_router.put("/assets/{asset_id}", response_model=ScopeAsset)
async def update_asset(
    project_id: UUID,
    asset_id: UUID,
    asset_in: ScopeAssetUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an existing scope asset"""
    print(f"Backend: Updating asset {asset_id} with data: {asset_in}")
    updated_asset = await scope_crud.update_asset_in_project(
        session, asset_id=asset_id, asset_in=asset_in, project_id=project_id, owner_id=current_user.id
    )
    print(f"Backend: Updated asset result: {updated_asset}")
    if not updated_asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    
    # Send WebSocket notification with updated asset data
    await notification_manager.notify_project(
        str(project_id), 
        "asset_updated",
        {"asset": updated_asset.model_dump()}
    )
    
    return updated_asset

@scope_crud_router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    project_id: UUID,
    asset_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a scope asset from a project"""
    success = await scope_crud.delete_asset_from_project(
        session, asset_id=asset_id, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Asset not found.")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "scope_updated")
    
    return

# --- Tag Management ---

@scope_crud_router.post("/assets/{asset_id}/tags", response_model=ScopeAsset, status_code=status.HTTP_201_CREATED)
async def add_tag_to_asset(
    project_id: UUID,
    asset_id: UUID,
    tag: ScopeTag,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a tag to an asset"""
    success = await scope_crud.add_tag_to_asset(
        session, asset_id=asset_id, tag=tag, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Asset not found.")
    
    # Return updated asset
    return await scope_crud.get_asset_by_id(session, asset_id, project_id, current_user.id)

@scope_crud_router.delete("/assets/{asset_id}/tags/{tag_id}", response_model=ScopeAsset)
async def remove_tag_from_asset(
    project_id: UUID,
    asset_id: UUID,
    tag_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Remove a tag from an asset"""
    success = await scope_crud.remove_tag_from_asset(
        session, asset_id=asset_id, tag_id=tag_id, project_id=project_id, owner_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found on this asset.")
    
    # Return updated asset
    return await scope_crud.get_asset_by_id(session, asset_id, project_id, current_user.id)

# --- Bulk Operations ---

@scope_crud_router.post("/assets/bulk-status-update", status_code=status.HTTP_200_OK)
async def bulk_update_asset_status(
    project_id: UUID,
    bulk_update: BulkStatusUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Bulk update status for multiple assets"""
    success_count = 0
    
    for asset_id in bulk_update.asset_ids:
        asset_update = ScopeAssetUpdate(status=bulk_update.new_status)
        updated_asset = await scope_crud.update_asset_in_project(
            session, asset_id=asset_id, asset_in=asset_update, 
            project_id=project_id, owner_id=current_user.id
        )
        if updated_asset:
            success_count += 1
    
    if success_count == 0:
        raise HTTPException(status_code=404, detail="No assets found to update.")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "scope_updated")
    
    return {
        "status": "success", 
        "detail": f"Updated status for {success_count} of {len(bulk_update.asset_ids)} assets."
    }

@scope_crud_router.post("/assets/bulk-tag-operation", status_code=status.HTTP_200_OK)
async def bulk_tag_operation(
    project_id: UUID,
    bulk_operation: BulkTagOperation,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add or remove tags for multiple assets"""
    success_count = 0
    
    for asset_id in bulk_operation.asset_ids:
        if bulk_operation.operation == "add":
            success = await scope_crud.add_tag_to_asset(
                session, asset_id=asset_id, tag=bulk_operation.tag,
                project_id=project_id, owner_id=current_user.id
            )
        else:  # remove
            success = await scope_crud.remove_tag_from_asset(
                session, asset_id=asset_id, tag_id=bulk_operation.tag.id,
                project_id=project_id, owner_id=current_user.id
            )
        
        if success:
            success_count += 1
    
    if success_count == 0:
        raise HTTPException(status_code=404, detail="No assets found to update.")
    
    # Send WebSocket notification
    await notification_manager.notify_project(str(project_id), "scope_updated")
    
    operation_verb = "Added tags to" if bulk_operation.operation == "add" else "Removed tags from"
    return {
        "status": "success",
        "detail": f"{operation_verb} {success_count} of {len(bulk_operation.asset_ids)} assets."
    }

# --- Import Operations ---

@scope_import_router.post("/import-nmap", response_model=ImportStats, status_code=status.HTTP_201_CREATED)
async def import_nmap_scan(
    project_id: UUID,
    request: NmapImportRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Import Nmap XML scan results"""
    
    # Verify project ownership first
    verify_query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})
    RETURN project
    """
    
    result = await session.run(verify_query, 
                              owner_id=str(current_user.id), 
                              project_id=str(project_id))
    if not await result.single():
        raise HTTPException(status_code=404, detail="Project not found.")
    
    # Parse Nmap XML
    try:
        parsing_settings = {
            'open_ports_only': request.open_ports_only,
            'default_status': request.default_status
        }
        
        parsed_assets, import_stats = parse_nmap_xml(request.xml_content, parsing_settings)
        
        # Create assets in database
        created_assets = []
        updated_count = 0
        
        for asset_data in parsed_assets:
            try:
                # Try to create the asset
                created_asset = await scope_crud.create_asset_for_project(
                    session, asset_in=asset_data, project_id=project_id, owner_id=current_user.id
                )
                
                if created_asset:
                    created_assets.append(created_asset)
                    import_stats.services_created += 1
                else:
                    # Asset already exists, try to update it instead
                    # For now, we'll skip duplicate assets
                    # TODO: Implement merge logic
                    updated_count += 1
                    
            except Exception as e:
                import_stats.errors.append(f"Failed to create asset {asset_data.ip}:{asset_data.port} - {str(e)}")
        
        import_stats.services_updated = updated_count
        
        # Send WebSocket notification
        await notification_manager.notify_project(str(project_id), "scope_updated", {
            "import_stats": import_stats.model_dump(),
            "assets_created": len(created_assets)
        })
        
        return import_stats
        
    except Exception as e:
        # Return error stats if parsing fails
        error_stats = ImportStats(
            hosts_processed=0,
            services_created=0,
            services_updated=0,
            hostnames_linked=0,
            vhosts_detected=0,
            errors=[f"Failed to parse Nmap XML: {str(e)}"]
        )
        return error_stats

# --- Analytics and Statistics ---

@scope_stats_router.get("/stats", response_model=ScopeStats)
async def get_scope_statistics(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get scope statistics for a project"""
    stats = await scope_crud.get_scope_stats_for_project(
        session, project_id=project_id, owner_id=current_user.id
    )
    return stats

# Include all the specific routers into the main router
router.include_router(scope_crud_router, prefix="")
router.include_router(scope_import_router, prefix="")
router.include_router(scope_stats_router, prefix="")