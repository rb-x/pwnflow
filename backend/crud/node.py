from uuid import UUID
from neo4j import AsyncSession
from neo4j.time import DateTime as Neo4jDateTime
from datetime import datetime
from schemas.node import Node, NodeCreate, NodeUpdate, Command, CommandCreate, CommandUpdate, NodePositionUpdate

# --- Helper Functions ---

def convert_neo4j_datetime(dt):
    """Convert Neo4j DateTime to Python datetime"""
    if isinstance(dt, Neo4jDateTime):
        return dt.to_native()
    return dt

# --- Node CRUD ---

async def get_all_nodes_for_project(
    session: AsyncSession, project_id: UUID, owner_id: UUID
) -> list[Node]:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node)
    // Collect tags
    OPTIONAL MATCH (node)-[:HAS_TAG]->(tag:Tag)
    WITH node, collect(tag.name) as tags
    // Collect commands
    OPTIONAL MATCH (node)-[:HAS_COMMAND]->(command:Command)
    WITH node, tags, collect(command) as commands
    // Collect parent nodes
    OPTIONAL MATCH (parent:Node)-[:IS_LINKED_TO]->(node)
    WITH node, tags, commands, collect(parent.id) as parents
    // Collect child nodes
    OPTIONAL MATCH (node)-[:IS_LINKED_TO]->(child:Node)
    WITH node, tags, commands, parents, collect(child.id) as children
    RETURN node, tags, 
           [cmd IN commands | {
               id: cmd.id,
               title: cmd.title,
               command: cmd.command,
               description: cmd.description
           }] as commands,
           parents,
           children
    ORDER BY node.y_pos, node.x_pos
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
        },
    )
    nodes = []
    async for record in result:
        node_data = dict(record["node"])
        node_data["tags"] = record["tags"]
        node_data["commands"] = record["commands"]
        node_data["parents"] = record["parents"]
        node_data["children"] = record["children"]
        node_data["project_id"] = str(project_id)
        
        # Convert Neo4j DateTime objects to Python datetime
        if "created_at" in node_data:
            node_data["created_at"] = convert_neo4j_datetime(node_data["created_at"])
        if "updated_at" in node_data:
            node_data["updated_at"] = convert_neo4j_datetime(node_data["updated_at"])
        
        # Fix findings field if it's a list (convert to empty string)
        if "findings" in node_data and isinstance(node_data["findings"], list):
            node_data["findings"] = ""
            
        nodes.append(Node(**node_data))
    return nodes

async def create_node_for_project(
    session: AsyncSession, node_in: NodeCreate, project_id: UUID, owner_id: UUID
) -> Node | None:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})
    CREATE (project)-[:HAS_NODE]->(node:Node {
        id: randomUUID(),
        title: $title,
        description: $description,
        status: $status,
        findings: $findings,
        x_pos: $x_pos,
        y_pos: $y_pos,
        created_at: datetime(),
        updated_at: datetime()
    })
    RETURN node
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            **node_in.model_dump(),
        },
    )
    record = await result.single()
    if not record:
        return None
    return await get_node_details(session, record["node"]["id"], project_id, owner_id)

async def get_node_details(
    session: AsyncSession, node_id: UUID, project_id: UUID, owner_id: UUID
) -> Node | None:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    // Collect tags
    OPTIONAL MATCH (node)-[:HAS_TAG]->(tag:Tag)
    WITH node, collect(tag.name) as tags
    // Collect commands
    OPTIONAL MATCH (node)-[:HAS_COMMAND]->(command:Command)
    WITH node, tags, collect(command) as commands
    // Collect parents
    OPTIONAL MATCH (parent)-[:IS_LINKED_TO]->(node)
    WITH node, tags, commands, collect(parent.id) as parents
    // Collect children
    OPTIONAL MATCH (node)-[:IS_LINKED_TO]->(child)
    WITH node, tags, commands, parents, collect(child.id) as children
    RETURN node, tags, commands, parents, children
    """
    result = await session.run(
        query,
        {"owner_id": str(owner_id), "project_id": str(project_id), "node_id": str(node_id)},
    )
    record = await result.single()
    if not record:
        return None
    
    node_data = dict(record["node"])
    node_data["tags"] = record["tags"]
    node_data["commands"] = [Command.model_validate(c) for c in record["commands"]]
    node_data["parents"] = record["parents"]
    node_data["children"] = record["children"]
    
    # Convert Neo4j DateTime objects to Python datetime
    if "created_at" in node_data:
        node_data["created_at"] = convert_neo4j_datetime(node_data["created_at"])
    if "updated_at" in node_data:
        node_data["updated_at"] = convert_neo4j_datetime(node_data["updated_at"])
    
    # Fix findings field if it's a list (convert to empty string)
    if "findings" in node_data and isinstance(node_data["findings"], list):
        node_data["findings"] = ""
    
    return Node.model_validate(node_data)

async def update_node_in_project(
    session: AsyncSession, node_id: UUID, node_in: NodeUpdate, project_id: UUID, owner_id: UUID
) -> Node | None:
    # Update node properties
    props_to_update = node_in.model_dump(exclude_unset=True)
    if props_to_update:
        set_query = """
        MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
        SET node += $props, node.updated_at = datetime()
        """
        await session.run(set_query, {"owner_id": str(owner_id), "project_id": str(project_id), "node_id": str(node_id), "props": props_to_update})

    return await get_node_details(session, node_id, project_id, owner_id)

async def add_tag_to_node(session: AsyncSession, tag_name: str, node_id: UUID, project_id: UUID, owner_id: UUID) -> bool:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    MERGE (tag:Tag {name: $tag_name})
    MERGE (node)-[r:HAS_TAG]->(tag)
    SET node.updated_at = datetime()
    RETURN r IS NOT NULL
    """
    result = await session.run(query, {"owner_id": str(owner_id), "project_id": str(project_id), "node_id": str(node_id), "tag_name": tag_name})
    record = await result.single()
    return record[0] if record else False

async def remove_tag_from_node(session: AsyncSession, tag_name: str, node_id: UUID, project_id: UUID, owner_id: UUID) -> bool:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    MATCH (node)-[r:HAS_TAG]->(tag:Tag {name: $tag_name})
    DELETE r
    SET node.updated_at = datetime()
    // Optional: Add logic here to delete the Tag node if it's no longer connected to any nodes
    RETURN count(r) > 0
    """
    result = await session.run(query, {"owner_id": str(owner_id), "project_id": str(project_id), "node_id": str(node_id), "tag_name": tag_name})
    summary = await result.consume()
    return summary.counters.relationships_deleted > 0

async def add_command_to_node(
    session: AsyncSession, command_in: CommandCreate, node_id: UUID, project_id: UUID, owner_id: UUID
) -> Command | None:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    CREATE (node)-[:HAS_COMMAND]->(command:Command {
        id: randomUUID(),
        title: $title,
        command: $command,
        description: $description
    })
    SET node.updated_at = datetime()
    RETURN command
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "node_id": str(node_id),
            **command_in.model_dump(),
        },
    )
    record = await result.single()
    return Command.model_validate(record["command"]) if record else None

async def get_commands_for_node(
    session: AsyncSession, node_id: UUID, project_id: UUID, owner_id: UUID
) -> list[Command]:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    MATCH (node)-[:HAS_COMMAND]->(command:Command)
    RETURN command
    ORDER BY command.title
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "node_id": str(node_id),
        },
    )
    records = await result.data()
    return [Command.model_validate(record["command"]) for record in records]

async def get_command_by_id(
    session: AsyncSession, command_id: UUID, node_id: UUID, project_id: UUID, owner_id: UUID
) -> Command | None:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    MATCH (node)-[:HAS_COMMAND]->(command:Command {id: $command_id})
    RETURN command
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "node_id": str(node_id),
            "command_id": str(command_id),
        },
    )
    record = await result.single()
    return Command.model_validate(record["command"]) if record else None

async def update_command_in_node(
    session: AsyncSession, command_id: UUID, command_in: CommandUpdate, node_id: UUID, project_id: UUID, owner_id: UUID
) -> Command | None:
    props = command_in.model_dump(exclude_unset=True)
    if not props:
        # If no properties to update, just return the command
        return await get_command_by_id(session, command_id, node_id, project_id, owner_id)
    
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    MATCH (node)-[:HAS_COMMAND]->(command:Command {id: $command_id})
    SET command += $props, node.updated_at = datetime()
    RETURN command
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "node_id": str(node_id),
            "command_id": str(command_id),
            "props": props,
        },
    )
    record = await result.single()
    return Command.model_validate(record["command"]) if record else None

async def delete_command_from_node(
    session: AsyncSession, command_id: UUID, node_id: UUID, project_id: UUID, owner_id: UUID
) -> bool:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: $node_id})
    MATCH (node)-[r:HAS_COMMAND]->(command:Command {id: $command_id})
    DELETE r, command
    SET node.updated_at = datetime()
    RETURN count(command) > 0
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "node_id": str(node_id),
            "command_id": str(command_id),
        },
    )
    summary = await result.consume()
    return summary.counters.nodes_deleted > 0

# --- The rest of the functions (delete_node_from_project, link_nodes, unlink_nodes) remain largely the same ---
async def delete_node_from_project(
    session: AsyncSession, node_id: UUID, project_id: UUID, owner_id: UUID
) -> bool:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[r:HAS_NODE]->(node:Node {id: $node_id})
    DETACH DELETE node
    RETURN count(node) > 0
    """
    result = await session.run(
        query, {"owner_id": str(owner_id), "project_id": str(project_id), "node_id": str(node_id)}
    )
    summary = await result.consume()
    return summary.counters.nodes_deleted > 0


async def link_nodes(
    session: AsyncSession, source_node_id: UUID, target_node_id: UUID, project_id: UUID, owner_id: UUID
) -> bool:
    # Ensure both nodes exist within the same project owned by the user before creating a link
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})
    MATCH (project)-[:HAS_NODE]->(source:Node {id: $source_node_id})
    MATCH (project)-[:HAS_NODE]->(target:Node {id: $target_node_id})
    // Use MERGE to prevent creating duplicate relationships
    MERGE (source)-[r:IS_LINKED_TO]->(target)
    // Update timestamps on both nodes when linking
    SET source.updated_at = datetime(), target.updated_at = datetime()
    // Return true if the relationship was created, which MERGE does
    RETURN r IS NOT NULL AS created
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "source_node_id": str(source_node_id),
            "target_node_id": str(target_node_id),
        },
    )
    record = await result.single()
    return record["created"] if record else False

async def unlink_nodes(
    session: AsyncSession, source_node_id: UUID, target_node_id: UUID, project_id: UUID, owner_id: UUID
) -> bool:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})
    MATCH (project)-[:HAS_NODE]->(source:Node {id: $source_node_id})-[r:IS_LINKED_TO]->(target:Node {id: $target_node_id})
    DELETE r
    // Update timestamps on both nodes when unlinking
    SET source.updated_at = datetime(), target.updated_at = datetime()
    RETURN count(r) as deleted_count
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "source_node_id": str(source_node_id),
            "target_node_id": str(target_node_id),
        },
    )
    summary = await result.consume()
    # Check if a relationship was actually deleted
    return summary.counters.relationships_deleted > 0

async def duplicate_node(
    session: AsyncSession, 
    node_id: UUID, 
    project_id: UUID, 
    owner_id: UUID,
    x_offset: int = 50,
    y_offset: int = 50
) -> Node | None:
    """Duplicate a node with all its commands and findings"""
    
    # First get the original node
    original_node = await get_node_details(session, node_id, project_id, owner_id)
    if not original_node:
        return None
    
    # Create the duplicated node
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(original:Node {id: $node_id})
    CREATE (project)-[:HAS_NODE]->(duplicate:Node {
        id: randomUUID(),
        title: $title,
        description: original.description,
        status: original.status,
        color: original.color,
        x_pos: original.x_pos + $x_offset,
        y_pos: original.y_pos + $y_offset,
        created_at: datetime(),
        updated_at: datetime()
    })
    
    // Copy tags
    WITH duplicate, original
    OPTIONAL MATCH (original)-[:HAS_TAG]->(tag:Tag)
    FOREACH (t IN CASE WHEN tag IS NOT NULL THEN [tag] ELSE [] END |
        CREATE (duplicate)-[:HAS_TAG]->(t)
    )
    
    // Copy commands
    WITH duplicate, original
    OPTIONAL MATCH (original)-[:HAS_COMMAND]->(cmd:Command)
    FOREACH (c IN CASE WHEN cmd IS NOT NULL THEN [cmd] ELSE [] END |
        CREATE (duplicate)-[:HAS_COMMAND]->(newCmd:Command {
            id: randomUUID(),
            title: c.title,
            command: c.command,
            description: c.description,
            created_at: datetime(),
            updated_at: datetime()
        })
    )
    
    // Copy finding
    WITH duplicate, original
    OPTIONAL MATCH (original)-[:HAS_FINDING]->(finding:Finding)
    FOREACH (f IN CASE WHEN finding IS NOT NULL THEN [finding] ELSE [] END |
        CREATE (duplicate)-[:HAS_FINDING]->(newFinding:Finding {
            id: randomUUID(),
            content: f.content,
            date: f.date,
            created_at: datetime(),
            updated_at: datetime()
        })
    )
    
    RETURN duplicate
    """
    
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "node_id": str(node_id),
            "title": f"{original_node.title} (Copy)",
            "x_offset": x_offset,
            "y_offset": y_offset,
        }
    )
    
    record = await result.single()
    if not record:
        return None
    
    # Return the duplicated node with all its details
    return await get_node_details(session, record["duplicate"]["id"], project_id, owner_id)

async def bulk_update_node_positions(
    session: AsyncSession,
    project_id: UUID,
    node_updates: list[NodePositionUpdate],
    owner_id: UUID,
) -> bool:
    """
    Bulk update node positions for better performance.
    """
    # First verify that the user owns the project
    verify_query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})
    RETURN project.id as project_id
    """
    result = await session.run(
        verify_query,
        owner_id=str(owner_id),
        project_id=str(project_id)
    )
    records = await result.data()
    if not records:
        return False
    
    # Build the bulk update query
    query = """
    UNWIND $updates as update
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_NODE]->(node:Node {id: update.id})
    SET node.x_pos = update.x_pos, node.y_pos = update.y_pos
    RETURN count(node) as updated_count
    """
    
    # Convert node updates to format needed by query
    updates = [
        {
            "id": str(node_update.id),
            "x_pos": node_update.x_pos,
            "y_pos": node_update.y_pos
        }
        for node_update in node_updates
    ]
    
    result = await session.run(
        query,
        owner_id=str(owner_id),
        project_id=str(project_id),
        updates=updates
    )
    
    records = await result.data()
    if records:
        updated_count = records[0]["updated_count"]
        # Return true if we updated at least one node
        return updated_count > 0
    return False 