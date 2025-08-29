from uuid import UUID, uuid4
from typing import List, Optional
from datetime import datetime
from neo4j import AsyncSession, AsyncTransaction
from schemas.project import ProjectCreate, ProjectUpdate, ProjectInDB

async def _create_project_from_template_tx(
    tx: AsyncTransaction, project_in: ProjectCreate, owner_id: UUID, new_project_id: UUID
) -> Optional[dict]:
    # 1. Verify ownership of the source template
    check_query = "MATCH (u:User {id: $owner_id})-[:OWNS]->(t:Template {id: $template_id}) RETURN t.id"
    template_result = await tx.run(check_query, owner_id=str(owner_id), template_id=str(project_in.source_template_id))
    if not await template_result.single():
        return None

    # 2. Create the new Project node
    now = datetime.utcnow().isoformat()
    project_query = """
    MATCH (u:User {id: $owner_id})
    CREATE (p:Project {
        id: $new_id, 
        name: $name, 
        description: $desc, 
        layout_direction: $layout_direction,
        created_at: $created_at,
        updated_at: $updated_at
    })
    CREATE (u)-[:OWNS]->(p)
    """
    await tx.run(
        project_query,
        owner_id=str(owner_id),
        new_id=str(new_project_id),
        name=project_in.name,
        desc=project_in.description,
        layout_direction=project_in.layout_direction or 'TB',
        created_at=now,
        updated_at=now
    )

    # 3. Handle CategoryTags - use provided tags or clone from template
    if project_in.category_tags is not None and len(project_in.category_tags) > 0:
        # Use provided tags
        for tag_name in project_in.category_tags:
            tag_query = """
            MATCH (p:Project {id: $project_id})
            MERGE (ct:CategoryTag {name: $tag_name})
            MERGE (p)-[:HAS_CATEGORY_TAG]->(ct)
            """
            await tx.run(tag_query, project_id=str(new_project_id), tag_name=tag_name)
    else:
        # Clone tags from template
        clone_tags_query = """
        MATCH (t:Template {id: $source_template_id})-[:HAS_CATEGORY_TAG]->(ct:CategoryTag)
        WITH ct
        MATCH (p:Project {id: $new_project_id})
        MERGE (p)-[:HAS_CATEGORY_TAG]->(ct)
        """
        await tx.run(clone_tags_query, source_template_id=str(project_in.source_template_id), new_project_id=str(new_project_id))

    # 4. Clone Nodes and build an ID map
    get_nodes_query = "MATCH (:Template {id: $source_id})-[:HAS_NODE]->(n:Node) RETURN n"
    nodes_result = await tx.run(get_nodes_query, source_id=str(project_in.source_template_id))
    original_nodes = [dict(rec["n"]) for rec in await nodes_result.data()]
    node_map = {}

    for node_props in original_nodes:
        original_id = node_props.pop("id")
        new_node_id = uuid4()
        node_map[original_id] = new_node_id
        create_node_query = "MATCH (p:Project {id: $project_id}) CREATE (p)-[:HAS_NODE]->(n:Node $props) SET n.id = $new_id"
        await tx.run(create_node_query, project_id=str(new_project_id), props=node_props, new_id=str(new_node_id))

        # Clone node sub-entities (Tags, Commands)
        get_tags_query = "MATCH (:Node {id: $original_node_id})-[:HAS_TAG]->(tag:Tag) RETURN tag"
        tags_result = await tx.run(get_tags_query, original_node_id=str(original_id))
        for record in await tags_result.data():
            tag_node = record['tag']
            link_tag_query = "MATCH (n:Node {id: $new_node_id}), (t:Tag {name: $tag_name}) MERGE (n)-[:HAS_TAG]->(t)"
            await tx.run(link_tag_query, new_node_id=str(new_node_id), tag_name=tag_node['name'])

        get_commands_query = "MATCH (:Node {id: $original_node_id})-[:HAS_COMMAND]->(c:Command) RETURN c"
        commands_result = await tx.run(get_commands_query, original_node_id=str(original_id))
        for record in await commands_result.data():
            command_props = dict(record['c'])
            command_props.pop('id')
            new_command_id = uuid4()
            create_command_query = "MATCH (n:Node {id: $new_node_id}) CREATE (n)-[:HAS_COMMAND]->(c:Command $props) SET c.id = $new_command_id"
            await tx.run(create_command_query, new_node_id=str(new_node_id), props=command_props, new_command_id=str(new_command_id))

    # 5. Clone node relationships
    get_rels_query = "MATCH (:Template {id: $source_id})-[:HAS_NODE]->(s:Node)-[:IS_LINKED_TO]->(t:Node) RETURN s.id as source, t.id as target"
    rels_result = await tx.run(get_rels_query, source_id=str(project_in.source_template_id))
    for rel in await rels_result.data():
        new_source_id = node_map.get(rel["source"])
        new_target_id = node_map.get(rel["target"])
        if new_source_id and new_target_id:
            link_query = "MATCH (s:Node {id: $source_id}), (t:Node {id: $target_id}) MERGE (s)-[:IS_LINKED_TO]->(t)"
            await tx.run(link_query, source_id=str(new_source_id), target_id=str(new_target_id))

    # 6. Clone contexts and variables
    get_contexts_query = "MATCH (:Template {id: $source_id})-[:HAS_CONTEXT]->(c:Context) RETURN c"
    contexts_result = await tx.run(get_contexts_query, source_id=str(project_in.source_template_id))
    for context_record in await contexts_result.data():
        context_props = dict(context_record["c"])
        original_context_id = context_props.pop("id")
        new_context_id = uuid4()
        create_context_query = "MATCH (p:Project {id: $project_id}) CREATE (p)-[:HAS_CONTEXT]->(c:Context $props) SET c.id = $new_id"
        await tx.run(create_context_query, project_id=str(new_project_id), props=context_props, new_id=str(new_context_id))

        get_vars_query = "MATCH (:Context {id: $context_id})-[:HAS_VARIABLE]->(v:Variable) RETURN v"
        vars_result = await tx.run(get_vars_query, context_id=str(original_context_id))
        for var_record in await vars_result.data():
            var_props = dict(var_record["v"])
            var_props.pop("id")
            new_var_id = uuid4()
            create_var_query = "MATCH (c:Context {id: $context_id}) CREATE (c)-[:HAS_VARIABLE]->(v:Variable $props) SET v.id = $new_id"
            await tx.run(create_var_query, context_id=str(new_context_id), props=var_props, new_id=str(new_var_id))

    # 7. Return the final project
    final_query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(p:Project {id: $project_id})
    OPTIONAL MATCH (p)-[:HAS_CATEGORY_TAG]->(ct:CategoryTag)
    RETURN p.id as id, p.name as name, p.description as description, p.layout_direction as layout_direction, u.id as owner_id, COLLECT(ct.name) as category_tags
    """
    final_result = await tx.run(final_query, owner_id=str(owner_id), project_id=str(new_project_id))
    project_record = await final_result.single()
    
    if not project_record:
        return None
        
    return dict(project_record)

async def create_project_from_template(session: AsyncSession, project_in: ProjectCreate, owner_id: UUID) -> Optional[ProjectInDB]:
    new_project_id = uuid4()
    result_dict = await session.execute_write(
        _create_project_from_template_tx,
        project_in=project_in,
        owner_id=owner_id,
        new_project_id=new_project_id,
    )
    if result_dict:
        return ProjectInDB.model_validate(result_dict)
    return None

async def create_project(session: AsyncSession, project_in: ProjectCreate, owner_id: UUID) -> Optional[ProjectInDB]:
    if project_in.source_template_id:
        return await create_project_from_template(session, project_in, owner_id)
    
    new_project_id = uuid4()
    
    # Create project
    now = datetime.utcnow().isoformat()
    query = """
    MATCH (u:User {id: $owner_id})
    CREATE (p:Project {
        id: $new_project_id, 
        name: $name, 
        description: $description, 
        layout_direction: $layout_direction,
        created_at: $created_at,
        updated_at: $updated_at
    })
    CREATE (u)-[:OWNS]->(p)
    RETURN p
    """
    result = await session.run(
        query,
        new_project_id=str(new_project_id),
        owner_id=str(owner_id),
        name=project_in.name,
        description=project_in.description,
        layout_direction=project_in.layout_direction or 'TB',
        created_at=now,
        updated_at=now
    )
    
    # Add category tags if provided
    if project_in.category_tags:
        # Remove duplicates while preserving order
        unique_tags = list(dict.fromkeys(project_in.category_tags))
        for tag_name in unique_tags:
            if tag_name.strip():  # Skip empty tags
                tag_query = """
                MATCH (p:Project {id: $project_id})
                MERGE (ct:CategoryTag {name: $tag_name})
                MERGE (p)-[:HAS_CATEGORY_TAG]->(ct)
                """
                await session.run(tag_query, project_id=str(new_project_id), tag_name=tag_name.strip())
    
    # Return the project with tags
    return await get_project(session, new_project_id, owner_id)

async def get_project(session: AsyncSession, project_id: UUID, owner_id: UUID) -> Optional[ProjectInDB]:
    query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(p:Project {id: $project_id})
    OPTIONAL MATCH (p)-[:HAS_CATEGORY_TAG]->(ct:CategoryTag)
    OPTIONAL MATCH (p)-[:HAS_NODE]->(n:Node)
    OPTIONAL MATCH (p)-[:HAS_CONTEXT]->(ctx:Context)
    WITH p, u, COLLECT(DISTINCT ct.name) as category_tags, COUNT(DISTINCT n) as node_count, COUNT(DISTINCT ctx) as context_count
    RETURN p.id as id, p.name as name, p.description as description, p.layout_direction as layout_direction, 
           u.id as owner_id, category_tags, node_count, context_count,
           p.created_at as created_at, p.updated_at as updated_at
    """
    result = await session.run(query, owner_id=str(owner_id), project_id=str(project_id))
    record = await result.single()
    if record:
        # Convert id and owner_id to UUID if they're strings
        data = dict(record)
        if isinstance(data.get('id'), str):
            data['id'] = UUID(data['id'])
        if isinstance(data.get('owner_id'), str):
            data['owner_id'] = UUID(data['owner_id'])
        return ProjectInDB(**data)
    return None

async def get_all_projects_for_user(session: AsyncSession, owner_id: UUID, skip: int = 0, limit: int = 100) -> List[ProjectInDB]:
    query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(p:Project)
    OPTIONAL MATCH (p)-[:HAS_CATEGORY_TAG]->(ct:CategoryTag)
    OPTIONAL MATCH (p)-[:HAS_NODE]->(n:Node)
    OPTIONAL MATCH (p)-[:HAS_CONTEXT]->(ctx:Context)
    WITH p, u, COLLECT(DISTINCT ct.name) as category_tags, COUNT(DISTINCT n) as node_count, COUNT(DISTINCT ctx) as context_count
    RETURN p.id as id, p.name as name, p.description as description, p.layout_direction as layout_direction, 
           u.id as owner_id, category_tags, node_count, context_count,
           p.created_at as created_at, p.updated_at as updated_at
    ORDER BY p.name
    SKIP $skip
    LIMIT $limit
    """
    result = await session.run(query, owner_id=str(owner_id), skip=skip, limit=limit)
    records = await result.data()
    return [ProjectInDB(**record) for record in records]

async def update_project(session: AsyncSession, project_id: UUID, project_in: ProjectUpdate, owner_id: UUID) -> Optional[ProjectInDB]:
    # First verify ownership
    project = await get_project(session, project_id, owner_id)
    if not project:
        return None
        
    set_clauses = []
    params = {"project_id": str(project_id), "owner_id": str(owner_id)}
    
    update_data = project_in.model_dump(exclude_unset=True)

    if "name" in update_data:
        set_clauses.append("p.name = $name")
        params["name"] = update_data["name"]
    if "description" in update_data:
        set_clauses.append("p.description = $description")
        params["description"] = update_data["description"]
    if "layout_direction" in update_data:
        set_clauses.append("p.layout_direction = $layout_direction")
        params["layout_direction"] = update_data["layout_direction"]
    
    # Always update the updated_at timestamp
    set_clauses.append("p.updated_at = $updated_at")
    params["updated_at"] = datetime.utcnow().isoformat()

    if set_clauses:
        query = f"""
        MATCH (u:User {{id: $owner_id}})-[:OWNS]->(p:Project {{id: $project_id}})
        SET {', '.join(set_clauses)}
        """
        await session.run(query, **params)
    
    # Handle category tags update if provided
    if "category_tags" in update_data:
        # Remove all existing tags
        remove_query = """
        MATCH (p:Project {id: $project_id})-[r:HAS_CATEGORY_TAG]->(:CategoryTag)
        DELETE r
        """
        await session.run(remove_query, project_id=str(project_id))
        
        # Add new tags
        if update_data["category_tags"]:
            # Remove duplicates while preserving order
            unique_tags = list(dict.fromkeys(update_data["category_tags"]))
            for tag_name in unique_tags:
                if tag_name.strip():  # Skip empty tags
                    add_query = """
                    MATCH (p:Project {id: $project_id})
                    MERGE (ct:CategoryTag {name: $tag_name})
                    MERGE (p)-[:HAS_CATEGORY_TAG]->(ct)
                    """
                    await session.run(add_query, project_id=str(project_id), tag_name=tag_name.strip())

    return await get_project(session, project_id, owner_id)

async def delete_project(session: AsyncSession, project_id: UUID, owner_id: UUID) -> bool:
    query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(p:Project {id: $project_id})
    DETACH DELETE p
    """
    summary = await (await session.run(query, owner_id=str(owner_id), project_id=str(project_id))).consume()
    return summary.counters.nodes_deleted > 0


async def bulk_delete_projects(session: AsyncSession, project_ids: List[UUID], owner_id: UUID) -> dict:
    """
    Delete multiple projects atomically. Returns a summary of deleted projects.
    This deletes all related data including nodes, contexts, commands, etc.
    """
    query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(p:Project)
    WHERE p.id IN $project_ids
    WITH p, p.id as project_id
    DETACH DELETE p
    RETURN project_id
    """
    
    result = await session.run(
        query, 
        owner_id=str(owner_id), 
        project_ids=[str(pid) for pid in project_ids]
    )
    
    deleted_ids = []
    async for record in result:
        deleted_ids.append(UUID(record["project_id"]))
    
    # Find which ones were not deleted (didn't exist or no permission)
    requested_set = set(project_ids)
    deleted_set = set(deleted_ids)
    not_found = list(requested_set - deleted_set)
    
    return {
        "deleted": deleted_ids,
        "not_found": not_found,
        "total_requested": len(project_ids),
        "total_deleted": len(deleted_ids)
    }

async def add_category_tag_to_project(session: AsyncSession, project_id: UUID, tag_name: str, owner_id: UUID) -> Optional[ProjectInDB]:
    # Ensure the project exists and is owned by the user
    project = await get_project(session, project_id, owner_id)
    if not project:
        return None
        
    query = """
    MATCH (p:Project {id: $project_id})
    MERGE (ct:CategoryTag {name: $tag_name})
    MERGE (p)-[:HAS_CATEGORY_TAG]->(ct)
    """
    await session.run(query, project_id=str(project_id), tag_name=tag_name)
    return await get_project(session, project_id, owner_id)

async def remove_category_tag_from_project(session: AsyncSession, project_id: UUID, tag_name: str, owner_id: UUID) -> Optional[ProjectInDB]:
    # Ensure the project exists and is owned by the user
    project = await get_project(session, project_id, owner_id)
    if not project:
        return None

    query = """
    MATCH (p:Project {id: $project_id})-[r:HAS_CATEGORY_TAG]->(ct:CategoryTag {name: $tag_name})
    DELETE r
    """
    await session.run(query, project_id=str(project_id), tag_name=tag_name)
    return await get_project(session, project_id, owner_id)


async def import_template_to_project(
    session: AsyncSession, 
    project_id: UUID, 
    template_id: UUID, 
    owner_id: UUID,
    offset_x: Optional[int] = None,
    offset_y: Optional[int] = None
) -> bool:
    """
    Import all nodes and relationships from a template into an existing project.
    Returns True if successful, False otherwise.
    """
    # If offsets not provided, calculate smart positioning
    if offset_x is None or offset_y is None:
        # Find the bounding box of existing nodes
        bbox_query = """
        MATCH (u:User {id: $owner_id})-[:OWNS]->(p:Project {id: $project_id})-[:HAS_NODE]->(n:Node)
        WITH MAX(n.x_pos) as max_x, MIN(n.x_pos) as min_x, MIN(n.y_pos) as min_y
        RETURN max_x, min_x, min_y
        """
        bbox_result = await session.run(bbox_query, owner_id=str(owner_id), project_id=str(project_id))
        bbox_data = await bbox_result.single()
        
        if bbox_data and bbox_data["max_x"] is not None:
            # Position new nodes to the right of existing ones
            offset_x = int(bbox_data["max_x"]) + 300  # Add padding
            offset_y = int(bbox_data["min_y"])
        else:
            # No existing nodes, start at default position
            offset_x = 100
            offset_y = 100
    
    query = """
    // Verify ownership of both project and template
    MATCH (u:User {id: $owner_id})-[:OWNS]->(p:Project {id: $project_id})
    MATCH (u)-[:OWNS]->(t:Template {id: $template_id})
    
    // Get all nodes from the template
    MATCH (t)-[:HAS_NODE]->(tn:Node)
    
    // Create a mapping of old node IDs to new node IDs
    WITH p, tn, randomUUID() as new_node_id
    
    // Create new nodes in the project
    CREATE (p)-[:HAS_NODE]->(n:Node {
        id: new_node_id,
        title: tn.title,
        description: tn.description,
        status: tn.status,
        findings: tn.findings,
        x_pos: tn.x_pos + $offset_x,
        y_pos: tn.y_pos + $offset_y
    })
    
    // Copy tags
    WITH p, tn, n
    OPTIONAL MATCH (tn)-[:HAS_TAG]->(tag:Tag)
    FOREACH (t IN CASE WHEN tag IS NOT NULL THEN [tag] ELSE [] END |
        MERGE (n)-[:HAS_TAG]->(t)
    )
    
    // Copy commands
    WITH p, tn, n
    OPTIONAL MATCH (tn)-[:HAS_COMMAND]->(cmd:Command)
    FOREACH (c IN CASE WHEN cmd IS NOT NULL THEN [cmd] ELSE [] END |
        CREATE (n)-[:HAS_COMMAND]->(new_cmd:Command {
            id: randomUUID(),
            title: c.title,
            command: c.command,
            description: c.description
        })
    )
    
    // Return node mappings for relationship creation
    RETURN tn.id as old_id, n.id as new_id
    """
    
    try:
        # First, create all nodes and get the ID mappings
        result = await session.run(
            query,
            owner_id=str(owner_id),
            project_id=str(project_id),
            template_id=str(template_id),
            offset_x=offset_x,
            offset_y=offset_y
        )
        
        # Build mapping of old IDs to new IDs
        id_mapping = {}
        async for record in result:
            id_mapping[record["old_id"]] = record["new_id"]
        
        if not id_mapping:
            return False  # No nodes were imported
        
        # Now copy the relationships using IS_LINKED_TO
        relationship_query = """
        MATCH (p:Project {id: $project_id})
        MATCH (p)-[:HAS_NODE]->(n1:Node {id: $new_source_id})
        MATCH (p)-[:HAS_NODE]->(n2:Node {id: $new_target_id})
        MERGE (n1)-[:IS_LINKED_TO]->(n2)
        """
        
        # Find all relationships in the template
        template_relationships_query = """
        MATCH (t:Template {id: $template_id})
        MATCH (t)-[:HAS_NODE]->(source:Node)-[:IS_LINKED_TO]->(target:Node)<-[:HAS_NODE]-(t)
        RETURN source.id as source_id, target.id as target_id
        """
        
        relationships_result = await session.run(
            template_relationships_query,
            template_id=str(template_id)
        )
        
        # Copy each relationship
        async for rel_record in relationships_result:
            old_source_id = rel_record["source_id"]
            old_target_id = rel_record["target_id"]
            
            # Only create relationship if both nodes were imported
            if old_source_id in id_mapping and old_target_id in id_mapping:
                new_source_id = id_mapping[old_source_id]
                new_target_id = id_mapping[old_target_id]
                
                await session.run(
                    relationship_query,
                    project_id=str(project_id),
                    new_source_id=new_source_id,
                    new_target_id=new_target_id
                )
        
        return True
        
    except Exception as e:
        return False