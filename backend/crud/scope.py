from uuid import UUID, uuid4
from neo4j import AsyncSession, AsyncTransaction
from neo4j.time import DateTime as Neo4jDateTime
from datetime import datetime
from typing import List, Optional
from schemas.scope import ScopeAsset, ScopeAssetCreate, ScopeAssetUpdate, ScopeTag, HostGroup, ScopeStats

# --- Helper Functions ---

def convert_neo4j_datetime(dt):
    """Convert Neo4j DateTime to Python datetime"""
    if isinstance(dt, Neo4jDateTime):
        return dt.to_native()
    return dt

def calculate_host_status(service_statuses: List[str]) -> str:
    """Calculate host status based on service statuses (most critical wins)"""
    priority = {"exploitable": 4, "vulnerable": 3, "testing": 2, "clean": 1, "not_tested": 0}
    if not service_statuses:
        return "not_tested"
    
    max_priority = max(priority.get(status, 0) for status in service_statuses)
    for status, value in priority.items():
        if value == max_priority:
            return status
    return "not_tested"

# --- Scope Asset CRUD ---

async def get_all_assets_for_project(
    session: AsyncSession, project_id: UUID, owner_id: UUID
) -> List[ScopeAsset]:
    """Get all scope assets for a project with complete isolation"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_SCOPE_ASSET]->(asset:ScopeAsset)
    RETURN asset
    ORDER BY asset.ip, asset.port
    """
    
    result = await session.run(query, owner_id=str(owner_id), project_id=str(project_id))
    assets = []
    
    async for record in result:
        asset_data = record["asset"]
        
        # Parse tags from JSON property (if exists)
        tags_data = asset_data.get("tags", [])
        if isinstance(tags_data, str):
            import json
            tags_data = json.loads(tags_data) if tags_data else []
        
        scope_tags = [
            ScopeTag(
                id=tag.get("id", f"tag_{tag['name']}"),
                name=tag["name"],
                color=tag.get("color", "#blue"),
                is_predefined=tag.get("is_predefined", False)
            ) for tag in tags_data if isinstance(tag, dict) and "name" in tag
        ]
        
        asset = ScopeAsset(
            id=UUID(asset_data["id"]),
            ip=asset_data["ip"],
            port=asset_data["port"],
            protocol=asset_data["protocol"],
            hostnames=asset_data.get("hostnames", []) or [],
            vhosts=asset_data.get("vhosts", []) or [],
            status=asset_data["status"],
            discovered_via=asset_data["discovered_via"],
            notes=asset_data.get("notes"),
            tags=scope_tags,
            created_at=convert_neo4j_datetime(asset_data["created_at"]),
            updated_at=convert_neo4j_datetime(asset_data["updated_at"])
        )
        assets.append(asset)
        
    return assets

async def get_asset_by_id(
    session: AsyncSession, asset_id: UUID, project_id: UUID, owner_id: UUID
) -> Optional[ScopeAsset]:
    """Get a specific asset by ID with project isolation"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_SCOPE_ASSET]->(asset:ScopeAsset {id: $asset_id})
    RETURN asset
    """
    
    result = await session.run(query, 
                        owner_id=str(owner_id), 
                        project_id=str(project_id), 
                        asset_id=str(asset_id))
    record = await result.single()
    
    if not record:
        return None
        
    asset_data = record["asset"]
    
    # Parse tags from JSON property (if exists)
    tags_data = asset_data.get("tags", [])
    if isinstance(tags_data, str):
        import json
        tags_data = json.loads(tags_data) if tags_data else []
    
    scope_tags = [
        ScopeTag(
            id=tag.get("id", f"tag_{tag['name']}"),
            name=tag["name"],
            color=tag.get("color", "#blue"),
            is_predefined=tag.get("is_predefined", False)
        ) for tag in tags_data if isinstance(tag, dict) and "name" in tag
    ]
    
    return ScopeAsset(
        id=UUID(asset_data["id"]),
        ip=asset_data["ip"],
        port=asset_data["port"],
        protocol=asset_data["protocol"],
        hostnames=asset_data.get("hostnames", []) or [],
        vhosts=asset_data.get("vhosts", []) or [],
        status=asset_data["status"],
        discovered_via=asset_data["discovered_via"],
        notes=asset_data.get("notes"),
        tags=scope_tags,
        created_at=convert_neo4j_datetime(asset_data["created_at"]),
        updated_at=convert_neo4j_datetime(asset_data["updated_at"])
    )

async def _create_asset_for_project_tx(
    tx: AsyncTransaction, asset_in: ScopeAssetCreate, project_id: UUID, owner_id: UUID
) -> Optional[dict]:
    """Transaction function for creating a scope asset"""
    # First verify project ownership
    verify_query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})
    RETURN project
    """
    
    verify_result = await tx.run(verify_query, owner_id=str(owner_id), project_id=str(project_id))
    if not await verify_result.single():
        return None
        
    # Check for existing asset with same IP:PORT
    existing_query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_SCOPE_ASSET]->(asset:ScopeAsset)
    WHERE asset.ip = $ip AND asset.port = $port AND asset.protocol = $protocol
    RETURN asset
    """
    
    existing_result = await tx.run(existing_query,
                                 owner_id=str(owner_id),
                                 project_id=str(project_id),
                                 ip=asset_in.ip,
                                 port=asset_in.port,
                                 protocol=asset_in.protocol)
    
    if await existing_result.single():
        # Asset already exists, could implement merge logic here
        return None
        
    # Create new asset
    asset_id = uuid4()
    now = datetime.utcnow()
    
    create_query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})
    CREATE (asset:ScopeAsset {
        id: $asset_id,
        ip: $ip,
        port: $port,
        protocol: $protocol,
        hostnames: $hostnames,
        vhosts: $vhosts,
        tags: $tags,
        status: $status,
        discovered_via: $discovered_via,
        notes: $notes,
        created_at: $created_at,
        updated_at: $updated_at
    })
    CREATE (project)-[:HAS_SCOPE_ASSET]->(asset)
    RETURN asset
    """
    
    create_result = await tx.run(create_query,
        owner_id=str(owner_id),
        project_id=str(project_id),
        asset_id=str(asset_id),
        ip=asset_in.ip,
        port=asset_in.port,
        protocol=asset_in.protocol,
        hostnames=asset_in.hostnames or [],
        vhosts=asset_in.vhosts or [],
        tags="[]",  # Start with empty tags JSON
        status=asset_in.status or "not_tested",
        discovered_via=asset_in.discovered_via or "manual",
        notes=asset_in.notes or "",
        created_at=now.isoformat(),
        updated_at=now.isoformat()
    )
    
    asset_record = await create_result.single()
    if not asset_record:
        return None
    
    return asset_record["asset"]

async def create_asset_for_project(
    session: AsyncSession, asset_in: ScopeAssetCreate, project_id: UUID, owner_id: UUID
) -> Optional[ScopeAsset]:
    """Create a new scope asset for a project"""
    
    asset_data = await session.execute_write(
        _create_asset_for_project_tx,
        asset_in=asset_in,
        project_id=project_id,
        owner_id=owner_id
    )
    
    if not asset_data:
        return None
        
    # Convert to ScopeAsset object - get the asset_id from the returned data
    asset_id = UUID(asset_data["id"])
    return await get_asset_by_id(session, asset_id, project_id, owner_id)

async def update_asset_in_project(
    session: AsyncSession, asset_id: UUID, asset_in: ScopeAssetUpdate, project_id: UUID, owner_id: UUID
) -> Optional[ScopeAsset]:
    """Update an existing scope asset"""
    
    # Build dynamic update query
    update_fields = []
    params = {
        "owner_id": str(owner_id),
        "project_id": str(project_id),
        "asset_id": str(asset_id),
        "updated_at": datetime.utcnow()
    }
    
    if asset_in.protocol is not None:
        update_fields.append("asset.protocol = $protocol")
        params["protocol"] = asset_in.protocol
        
    if asset_in.status is not None:
        print(f"CRUD: Setting status to {asset_in.status}")
        update_fields.append("asset.status = $status")
        params["status"] = asset_in.status
        
    if asset_in.discovered_via is not None:
        update_fields.append("asset.discovered_via = $discovered_via")
        params["discovered_via"] = asset_in.discovered_via
        
    if asset_in.notes is not None:
        update_fields.append("asset.notes = $notes")
        params["notes"] = asset_in.notes
        
    if asset_in.hostnames is not None:
        update_fields.append("asset.hostnames = $hostnames")
        params["hostnames"] = asset_in.hostnames
        
    if asset_in.vhosts is not None:
        update_fields.append("asset.vhosts = $vhosts")
        params["vhosts"] = asset_in.vhosts
        
    # Handle tags update - always update if provided
    if asset_in.tags is not None:
        import json
        # Convert tag objects to JSON string
        if asset_in.tags:
            tags_json = json.dumps([{
                "id": getattr(tag, 'id', f"tag_{tag.name}") if hasattr(tag, 'id') else str(tag.get('id', f"tag_{tag.get('name', 'unknown')}")),
                "name": getattr(tag, 'name', '') if hasattr(tag, 'name') else str(tag.get('name', '')),
                "color": getattr(tag, 'color', '#blue') if hasattr(tag, 'color') else str(tag.get('color', '#blue')),
                "is_predefined": getattr(tag, 'is_predefined', False) if hasattr(tag, 'is_predefined') else bool(tag.get('is_predefined', False))
            } for tag in asset_in.tags])
        else:
            tags_json = "[]"
        update_fields.append("asset.tags = $tags")
        params["tags"] = tags_json
        
    update_fields.append("asset.updated_at = $updated_at")
    
    if not update_fields:
        # No updates to make, just return current asset
        return await get_asset_by_id(session, asset_id, project_id, owner_id)
    
    query = f"""
    MATCH (user:User {{id: $owner_id}})-[:OWNS]->(project:Project {{id: $project_id}})-[:HAS_SCOPE_ASSET]->(asset:ScopeAsset {{id: $asset_id}})
    SET {', '.join(update_fields)}
    RETURN asset
    """
    
    print(f"CRUD: Executing query: {query}")
    print(f"CRUD: With params: {params}")
    
    result = await session.run(query, **params)
    record = await result.single()
    if not record:
        return None
    
    return await get_asset_by_id(session, asset_id, project_id, owner_id)

async def delete_asset_from_project(
    session: AsyncSession, asset_id: UUID, project_id: UUID, owner_id: UUID
) -> bool:
    """Delete a scope asset from a project"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_SCOPE_ASSET]->(asset:ScopeAsset {id: $asset_id})
    
    // Delete all relationships and the asset
    OPTIONAL MATCH (asset)-[r1:HAS_HOSTNAME]->()
    OPTIONAL MATCH (asset)-[r2:HOSTS_VHOST]->()
    OPTIONAL MATCH (asset)-[r3:TAGGED_WITH]->()
    OPTIONAL MATCH ()-[r4:HAS_SCOPE_ASSET]->(asset)
    
    DELETE r1, r2, r3, r4, asset
    RETURN count(asset) as deleted_count
    """
    
    result = await session.run(query,
                        owner_id=str(owner_id),
                        project_id=str(project_id),
                        asset_id=str(asset_id))
    record = await result.single()
    
    return record and record["deleted_count"] > 0

# --- Tag Management ---

async def add_tag_to_asset(
    session: AsyncSession, asset_id: UUID, tag: ScopeTag, project_id: UUID, owner_id: UUID
) -> bool:
    """Add a tag to an asset"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_SCOPE_ASSET]->(asset:ScopeAsset {id: $asset_id})
    
    MERGE (tag:ScopeTag {id: $tag_id, name: $tag_name, color: $tag_color, is_predefined: $is_predefined})
    MERGE (asset)-[:TAGGED_WITH]->(tag)
    
    RETURN count(asset) as affected_count
    """
    
    result = await session.run(query,
                        owner_id=str(owner_id),
                        project_id=str(project_id),
                        asset_id=str(asset_id),
                        tag_id=tag.id,
                        tag_name=tag.name,
                        tag_color=tag.color,
                        is_predefined=tag.is_predefined)
    record = await result.single()
    
    return record and record["affected_count"] > 0

async def remove_tag_from_asset(
    session: AsyncSession, asset_id: UUID, tag_id: str, project_id: UUID, owner_id: UUID
) -> bool:
    """Remove a tag from an asset"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_SCOPE_ASSET]->(asset:ScopeAsset {id: $asset_id})
    MATCH (asset)-[r:TAGGED_WITH]->(tag:ScopeTag {id: $tag_id})
    
    DELETE r
    RETURN count(r) as deleted_count
    """
    
    result = await session.run(query,
                        owner_id=str(owner_id),
                        project_id=str(project_id),
                        asset_id=str(asset_id),
                        tag_id=tag_id)
    record = await result.single()
    
    return record and record["deleted_count"] > 0

# --- Statistics and Analytics ---

async def get_scope_stats_for_project(
    session: AsyncSession, project_id: UUID, owner_id: UUID
) -> ScopeStats:
    """Get scope statistics for a project"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_SCOPE_ASSET]->(asset:ScopeAsset)
    
    WITH collect(DISTINCT asset.ip) as unique_ips, 
         collect(asset.status) as all_statuses,
         count(asset) as total_assets
    
    // Count assets by status
    UNWIND all_statuses as status
    WITH unique_ips, total_assets, status, count(status) as status_count
    
    RETURN total_assets,
           size(unique_ips) as total_hosts,
           collect({status: status, count: status_count}) as status_counts
    """
    
    result = await session.run(query, owner_id=str(owner_id), project_id=str(project_id))
    record = await result.single()
    
    if not record:
        return ScopeStats(
            total_assets=0,
            total_hosts=0,
            assets_by_status={},
            completion_percentage=0
    )
    
    # Build status counts dict
    assets_by_status = {}
    for status_info in record["status_counts"]:
        assets_by_status[status_info["status"]] = status_info["count"]
    
    # Calculate completion percentage (tested vs total)
    tested_count = sum(count for status, count in assets_by_status.items() 
                      if status in ["clean", "vulnerable", "exploitable"])
    total = record["total_assets"]
    completion_percentage = int((tested_count / total * 100)) if total > 0 else 0
    
    return ScopeStats(
        total_assets=total,
        total_hosts=record["total_hosts"],
        assets_by_status=assets_by_status,
        completion_percentage=completion_percentage
    )