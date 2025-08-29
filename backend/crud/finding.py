from uuid import UUID
from neo4j import AsyncSession
from neo4j.time import DateTime as Neo4jDateTime
from datetime import datetime
from typing import Optional, List

from schemas.finding import Finding, FindingCreate, FindingUpdate

def convert_neo4j_datetime(dt):
    """Convert Neo4j DateTime to Python datetime"""
    if isinstance(dt, Neo4jDateTime):
        return dt.to_native()
    return dt

async def create_finding_for_node(
    session: AsyncSession, 
    finding_in: FindingCreate, 
    node_id: UUID, 
    project_id: UUID, 
    owner_id: UUID
) -> Optional[Finding]:
    """Create a new finding for a specific node"""
    
    # Use provided date or current time
    finding_date = finding_in.date or datetime.now()
    
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    CREATE (finding:Finding {
        id: randomUUID(),
        content: $content,
        date: $date,
        created_at: datetime(),
        updated_at: datetime()
    })
    CREATE (node)-[:HAS_FINDING]->(finding)
    RETURN finding
    """
    
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "node_id": str(node_id),
            "content": finding_in.content,
            "date": finding_date,
        }
    )
    
    record = await result.single()
    if not record:
        return None
    
    finding_data = dict(record["finding"])
    finding_data["node_id"] = str(node_id)
    finding_data["created_by"] = str(owner_id)
    
    # Convert Neo4j DateTime objects
    finding_data["date"] = convert_neo4j_datetime(finding_data["date"])
    finding_data["created_at"] = convert_neo4j_datetime(finding_data["created_at"])
    finding_data["updated_at"] = convert_neo4j_datetime(finding_data["updated_at"])
    
    return Finding(**finding_data)

async def get_finding_for_node(
    session: AsyncSession, 
    node_id: UUID, 
    project_id: UUID, 
    owner_id: UUID
) -> Optional[Finding]:
    """Get the finding for a specific node"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    MATCH (node)-[:HAS_FINDING]->(finding:Finding)
    RETURN finding, user.id as created_by
    """
    
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "node_id": str(node_id),
        }
    )
    
    record = await result.single()
    if not record:
        return None
    
    finding_data = dict(record["finding"])
    finding_data["node_id"] = str(node_id)
    finding_data["created_by"] = record["created_by"]
    
    # Convert Neo4j DateTime objects
    finding_data["date"] = convert_neo4j_datetime(finding_data["date"])
    finding_data["created_at"] = convert_neo4j_datetime(finding_data["created_at"])
    finding_data["updated_at"] = convert_neo4j_datetime(finding_data["updated_at"])
    
    return Finding(**finding_data)

async def get_finding_by_id(
    session: AsyncSession, 
    finding_id: UUID, 
    project_id: UUID, 
    owner_id: UUID
) -> Optional[Finding]:
    """Get a specific finding by ID"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node)
    MATCH (node)-[:HAS_FINDING]->(finding:Finding {id: $finding_id})
    RETURN finding, node.id as node_id, user.id as created_by
    """
    
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "finding_id": str(finding_id),
        }
    )
    
    record = await result.single()
    if not record:
        return None
    
    finding_data = dict(record["finding"])
    finding_data["node_id"] = record["node_id"]
    finding_data["created_by"] = record["created_by"]
    
    # Convert Neo4j DateTime objects
    finding_data["date"] = convert_neo4j_datetime(finding_data["date"])
    finding_data["created_at"] = convert_neo4j_datetime(finding_data["created_at"])
    finding_data["updated_at"] = convert_neo4j_datetime(finding_data["updated_at"])
    
    return Finding(**finding_data)

async def update_finding(
    session: AsyncSession, 
    finding_id: UUID, 
    finding_in: FindingUpdate, 
    project_id: UUID, 
    owner_id: UUID
) -> Optional[Finding]:
    """Update an existing finding"""
    
    # Build update properties
    props_to_update = finding_in.model_dump(exclude_unset=True)
    if not props_to_update:
        # If no updates, just return the current finding
        return await get_finding_by_id(session, finding_id, project_id, owner_id)
    
    # Add updated timestamp
    props_to_update["updated_at"] = datetime.now()
    
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node)
    MATCH (node)-[:HAS_FINDING]->(finding:Finding {id: $finding_id})
    SET finding += $props
    RETURN finding, node.id as node_id
    """
    
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "finding_id": str(finding_id),
            "props": props_to_update,
        }
    )
    
    record = await result.single()
    if not record:
        return None
    
    # Return the updated finding
    return await get_finding_by_id(session, finding_id, project_id, owner_id)

async def delete_finding(
    session: AsyncSession, 
    finding_id: UUID, 
    project_id: UUID, 
    owner_id: UUID
) -> bool:
    """Delete a finding"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node)
    MATCH (node)-[r:HAS_FINDING]->(finding:Finding {id: $finding_id})
    DETACH DELETE finding
    RETURN count(finding) as deleted_count
    """
    
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "finding_id": str(finding_id),
        }
    )
    
    summary = await result.consume()
    return summary.counters.nodes_deleted > 0

async def get_project_timeline(
    session: AsyncSession, 
    project_id: UUID, 
    owner_id: UUID
) -> List[dict]:
    """Get chronological timeline of all findings in a project"""
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node)
    MATCH (node)-[:HAS_FINDING]->(finding:Finding)
    RETURN {
        finding_id: finding.id,
        node_id: node.id,
        node_title: node.title,
        content: finding.content,
        date: finding.date,
        created_at: finding.created_at,
        updated_at: finding.updated_at,
        created_by: user.username
    } as timeline_entry
    ORDER BY finding.date ASC
    """
    
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
        }
    )
    
    timeline = []
    async for record in result:
        entry = record["timeline_entry"]
        # Convert Neo4j DateTime objects
        entry["date"] = convert_neo4j_datetime(entry["date"])
        entry["created_at"] = convert_neo4j_datetime(entry["created_at"])
        entry["updated_at"] = convert_neo4j_datetime(entry["updated_at"])
        timeline.append(entry)
    
    return timeline