from uuid import UUID, uuid4
from typing import List, Optional
from neo4j import AsyncSession, AsyncTransaction
from neo4j.time import DateTime as Neo4jDateTime

from schemas.template import TemplateCreate, TemplateUpdate, TemplateInDB

# --- Helper Functions ---

def convert_neo4j_datetime(dt):
    """Convert Neo4j DateTime to Python datetime"""
    if isinstance(dt, Neo4jDateTime):
        return dt.to_native()
    return dt

async def _create_template_from_project_tx(
    tx: AsyncTransaction, template_in: TemplateCreate, owner_id: UUID, new_template_id: UUID
) -> Optional[dict]:
    # 1. Verify ownership
    check_query = "MATCH (u:User {id: $owner_id})-[:OWNS]->(p:Project {id: $project_id}) RETURN p.id"
    project_result = await tx.run(check_query, owner_id=str(owner_id), project_id=str(template_in.source_project_id))
    if not await project_result.single():
        return None

    # 2. Create the new Template node
    template_query = """
    MATCH (u:User {id: $owner_id})
    CREATE (t:Template {id: $new_id, name: $name, description: $desc})
    CREATE (u)-[:OWNS]->(t)
    """
    await tx.run(
        template_query,
        owner_id=str(owner_id),
        new_id=str(new_template_id),
        name=template_in.name,
        desc=template_in.description,
    )

    # 2.5 Clone Category Tags
    if template_in.category_tags is not None and len(template_in.category_tags) > 0:
        # Use provided tags
        for tag_name in template_in.category_tags:
            tag_query = """
            MATCH (t:Template {id: $template_id})
            MERGE (ct:CategoryTag {name: $tag_name})
            MERGE (t)-[:HAS_CATEGORY_TAG]->(ct)
            """
            await tx.run(tag_query, template_id=str(new_template_id), tag_name=tag_name)
    else:
        # Clone tags from project
        clone_template_tags_query = """
        MATCH (:Project {id: $source_project_id})-[:HAS_CATEGORY_TAG]->(ct:CategoryTag)
        WITH ct
        MATCH (t:Template {id: $new_template_id})
        MERGE (t)-[:HAS_CATEGORY_TAG]->(ct)
        """
        await tx.run(clone_template_tags_query, source_project_id=str(template_in.source_project_id), new_template_id=str(new_template_id))

    # 3. Clone Nodes and build an ID map
    get_nodes_query = "MATCH (:Project {id: $source_id})-[:HAS_NODE]->(n:Node) RETURN n"
    nodes_result = await tx.run(get_nodes_query, source_id=str(template_in.source_project_id))
    original_nodes = [dict(rec["n"]) for rec in await nodes_result.data()]
    node_map = {}

    for node_props in original_nodes:
        original_id = node_props.pop("id")
        new_node_id = uuid4()
        node_map[original_id] = new_node_id
        
        # Clear findings and reset status when creating template (like we do with sensitive variables)
        node_props["findings"] = ""
        node_props["status"] = "NOT_STARTED"
        
        create_node_query = """
        MATCH (t:Template {id: $template_id})
        CREATE (t)-[:HAS_NODE]->(n:Node $props)
        SET n.id = $new_id, n.created_at = datetime(), n.updated_at = datetime()
        """
        await tx.run(create_node_query, template_id=str(new_template_id), props=node_props, new_id=str(new_node_id))

        # 3.5 Clone Node -> Tag and Node -> Command relationships
        original_node_id = original_id
        
        # Clone tags for the node
        get_tags_query = "MATCH (:Node {id: $original_node_id})-[:HAS_TAG]->(tag:Tag) RETURN tag"
        tags_result = await tx.run(get_tags_query, original_node_id=str(original_node_id))
        for record in await tags_result.data():
            tag_node = record['tag']
            link_tag_query = """
            MATCH (n:Node {id: $new_node_id}), (t:Tag {name: $tag_name})
            MERGE (n)-[:HAS_TAG]->(t)
            """
            await tx.run(link_tag_query, new_node_id=str(new_node_id), tag_name=tag_node['name'])

        # Clone commands for the node
        get_commands_query = "MATCH (:Node {id: $original_node_id})-[:HAS_COMMAND]->(c:Command) RETURN c"
        commands_result = await tx.run(get_commands_query, original_node_id=str(original_node_id))
        for record in await commands_result.data():
            command_props = dict(record['c'])
            command_props.pop('id') # Remove old ID
            new_command_id = uuid4()
            create_command_query = """
            MATCH (n:Node {id: $new_node_id})
            CREATE (n)-[:HAS_COMMAND]->(c:Command $props)
            SET c.id = $new_command_id
            """
            await tx.run(create_command_query, new_node_id=str(new_node_id), props=command_props, new_command_id=str(new_command_id))

    # 4. Clone node relationships
    get_rels_query = "MATCH (:Project {id: $source_id})-[:HAS_NODE]->(s:Node)-[:IS_LINKED_TO]->(t:Node) RETURN s.id as source, t.id as target"
    rels_result = await tx.run(get_rels_query, source_id=str(template_in.source_project_id))
    for rel in await rels_result.data():
        new_source_id = node_map.get(rel["source"])
        new_target_id = node_map.get(rel["target"])
        if new_source_id and new_target_id:
            link_query = "MATCH (s:Node {id: $source_id}), (t:Node {id: $target_id}) MERGE (s)-[:IS_LINKED_TO]->(t)"
            await tx.run(link_query, source_id=str(new_source_id), target_id=str(new_target_id))

    # 5. Clone contexts and variables
    get_contexts_query = "MATCH (:Project {id: $source_id})-[:HAS_CONTEXT]->(c:Context) RETURN c"
    contexts_result = await tx.run(get_contexts_query, source_id=str(template_in.source_project_id))
    for context_record in await contexts_result.data():
        context_props = dict(context_record["c"])
        original_context_id = context_props.pop("id")
        new_context_id = uuid4()
        create_context_query = "MATCH (t:Template {id: $template_id}) CREATE (t)-[:HAS_CONTEXT]->(c:Context $props) SET c.id = $new_id"
        await tx.run(create_context_query, template_id=str(new_template_id), props=context_props, new_id=str(new_context_id))

        get_vars_query = "MATCH (:Context {id: $context_id})-[:HAS_VARIABLE]->(v:Variable) RETURN v"
        vars_result = await tx.run(get_vars_query, context_id=str(original_context_id))
        for var_record in await vars_result.data():
            var_props = dict(var_record["v"])
            var_props.pop("id")
            new_var_id = uuid4()
            create_var_query = "MATCH (c:Context {id: $context_id}) CREATE (c)-[:HAS_VARIABLE]->(v:Variable $props) SET v.id = $new_id, v.value = 'REPLACE_ME'"
            await tx.run(create_var_query, context_id=str(new_context_id), props=var_props, new_id=str(new_var_id))

    # 6. Return the final template with category tags
    final_query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(t:Template {id: $template_id})
    OPTIONAL MATCH (t)-[:HAS_CATEGORY_TAG]->(ct:CategoryTag)
    RETURN t.id as id, t.name as name, t.description as description, u.id as owner_id, COLLECT(ct.name) as category_tags
    """
    final_result = await tx.run(final_query, owner_id=str(owner_id), template_id=str(new_template_id))
    template_record = await final_result.single()
    
    if not template_record:
        return None
        
    return dict(template_record)

async def create_template_from_project(session: AsyncSession, template_in: TemplateCreate, owner_id: UUID) -> Optional[TemplateInDB]:
    new_template_id = uuid4()
    result_dict = await session.execute_write(
        _create_template_from_project_tx,
        template_in=template_in,
        owner_id=owner_id,
        new_template_id=new_template_id,
    )
    if result_dict:
        return TemplateInDB.model_validate(result_dict)
    return None

async def create_template(session: AsyncSession, template_in: TemplateCreate, owner_id: UUID) -> Optional[TemplateInDB]:
    """
    Creates a new Template either from scratch or from an existing project.
    """
    if template_in.source_project_id:
        return await create_template_from_project(session, template_in, owner_id)
    
    new_template_id = uuid4()
    
    # Create template
    query = """
    MATCH (u:User {id: $owner_id})
    CREATE (t:Template {id: $new_template_id, name: $name, description: $description})
    CREATE (u)-[:OWNS]->(t)
    RETURN t
    """
    result = await session.run(
        query,
        new_template_id=str(new_template_id),
        owner_id=str(owner_id),
        name=template_in.name,
        description=template_in.description,
    )
    
    # Add category tags if provided
    if template_in.category_tags:
        unique_tags = list(dict.fromkeys(template_in.category_tags))
        for tag_name in unique_tags:
            if tag_name.strip():
                tag_query = """
                MATCH (t:Template {id: $template_id})
                MERGE (ct:CategoryTag {name: $tag_name})
                MERGE (t)-[:HAS_CATEGORY_TAG]->(ct)
                """
                await session.run(tag_query, template_id=str(new_template_id), tag_name=tag_name.strip())
    
    # Return the template with tags
    return await get_template(session, new_template_id, owner_id)

async def get_template(session: AsyncSession, template_id: UUID, owner_id: UUID) -> Optional[TemplateInDB]:
    """
    Retrieves a single template by its ID, ensuring it belongs to the owner.
    """
    query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(t:Template {id: $template_id})
    OPTIONAL MATCH (t)-[:HAS_CATEGORY_TAG]->(ct:CategoryTag)
    OPTIONAL MATCH (t)-[:HAS_NODE]->(n:Node)
    OPTIONAL MATCH (t)-[:HAS_CONTEXT]->(ctx:Context)
    WITH t, u, COLLECT(DISTINCT ct.name) as category_tags, COUNT(DISTINCT n) as node_count, COUNT(DISTINCT ctx) as context_count
    RETURN t.id as id, t.name as name, t.description as description, u.id as owner_id, category_tags, node_count, context_count
    """
    result = await session.run(query, owner_id=str(owner_id), template_id=str(template_id))
    template_record = await result.single()
    if template_record:
        return TemplateInDB(**template_record)
    return None

async def get_all_templates_for_user(session: AsyncSession, owner_id: UUID, skip: int = 0, limit: int = 100) -> List[TemplateInDB]:
    """
    Retrieves all templates owned by a specific user with pagination.
    """
    query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(t:Template)
    OPTIONAL MATCH (t)-[:HAS_CATEGORY_TAG]->(ct:CategoryTag)
    OPTIONAL MATCH (t)-[:HAS_NODE]->(n:Node)
    OPTIONAL MATCH (t)-[:HAS_CONTEXT]->(ctx:Context)
    WITH t, u, COLLECT(DISTINCT ct.name) as category_tags, COUNT(DISTINCT n) as node_count, COUNT(DISTINCT ctx) as context_count
    RETURN t.id as id, t.name as name, t.description as description, u.id as owner_id, category_tags, node_count, context_count
    ORDER BY t.name
    SKIP $skip
    LIMIT $limit
    """
    result = await session.run(query, owner_id=str(owner_id), skip=skip, limit=limit)
    records = await result.data()
    return [TemplateInDB(**record) for record in records]

async def update_template(session: AsyncSession, template_id: UUID, template_in: TemplateUpdate, owner_id: UUID) -> Optional[TemplateInDB]:
    """
    Updates a template's details, ensuring it belongs to the owner.
    """
    # First verify ownership
    template = await get_template(session, template_id, owner_id)
    if not template:
        return None
        
    set_clauses = []
    params = {"template_id": str(template_id), "owner_id": str(owner_id)}
    
    update_data = template_in.model_dump(exclude_unset=True)
    
    if "name" in update_data:
        set_clauses.append("t.name = $name")
        params["name"] = update_data["name"]
    if "description" in update_data:
        set_clauses.append("t.description = $description")
        params["description"] = update_data["description"]
        
    if set_clauses:
        query = f"""
        MATCH (u:User {{id: $owner_id}})-[:OWNS]->(t:Template {{id: $template_id}})
        SET {', '.join(set_clauses)}
        """
        await session.run(query, **params)
    
    # Handle category tags update if provided
    if "category_tags" in update_data:
        # Remove all existing tags
        remove_query = """
        MATCH (t:Template {id: $template_id})-[r:HAS_CATEGORY_TAG]->(:CategoryTag)
        DELETE r
        """
        await session.run(remove_query, template_id=str(template_id))
        
        # Add new tags
        if update_data["category_tags"]:
            unique_tags = list(dict.fromkeys(update_data["category_tags"]))
            for tag_name in unique_tags:
                if tag_name.strip():
                    add_query = """
                    MATCH (t:Template {id: $template_id})
                    MERGE (ct:CategoryTag {name: $tag_name})
                    MERGE (t)-[:HAS_CATEGORY_TAG]->(ct)
                    """
                    await session.run(add_query, template_id=str(template_id), tag_name=tag_name.strip())
    
    return await get_template(session, template_id, owner_id)

async def delete_template(session: AsyncSession, template_id: UUID, owner_id: UUID) -> bool:
    """
    Deletes a template by its ID, ensuring it belongs to the owner.
    """
    query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(t:Template {id: $template_id})
    DETACH DELETE t
    RETURN count(t) as deleted_count
    """
    result = await session.run(query, owner_id=str(owner_id), template_id=str(template_id))
    summary = await result.consume()
    return summary.counters.nodes_deleted > 0


async def bulk_delete_templates(session: AsyncSession, template_ids: List[UUID], owner_id: UUID) -> dict:
    """
    Delete multiple templates atomically. Returns a summary of deleted templates.
    This deletes all related data including nodes, contexts, commands, etc.
    """
    query = """
    MATCH (u:User {id: $owner_id})-[:OWNS]->(t:Template)
    WHERE t.id IN $template_ids
    WITH t, t.id as template_id
    DETACH DELETE t
    RETURN template_id
    """
    
    result = await session.run(
        query, 
        owner_id=str(owner_id), 
        template_ids=[str(tid) for tid in template_ids]
    )
    
    deleted_ids = []
    async for record in result:
        deleted_ids.append(UUID(record["template_id"]))
    
    # Find which ones were not deleted (didn't exist or no permission)
    requested_set = set(template_ids)
    deleted_set = set(deleted_ids)
    not_found = list(requested_set - deleted_set)
    
    return {
        "deleted": deleted_ids,
        "not_found": not_found,
        "total_requested": len(template_ids),
        "total_deleted": len(deleted_ids)
    }

async def get_all_nodes_for_template(session: AsyncSession, template_id: UUID, owner_id: UUID) -> Optional[List[dict]]:
    """
    Retrieves all nodes for a specific template, ensuring it belongs to the owner.
    Returns None if template doesn't exist, empty list if template exists but has no nodes.
    """
    # First check if the template exists and belongs to the user
    check_query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(template:Template {id: $template_id})
    RETURN template.id as id
    """
    check_result = await session.run(
        check_query,
        {
            "owner_id": str(owner_id),
            "template_id": str(template_id),
        },
    )
    if not await check_result.single():
        return None
    
    # Now get all nodes
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(template:Template {id: $template_id})-[:HAS_NODE]->(node:Node)
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
    RETURN node, tags, commands, parents, collect(child.id) as children
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "template_id": str(template_id),
        },
    )
    nodes = []
    async for record in result:
        node_data = dict(record["node"])
        node_data["tags"] = record["tags"]
        node_data["commands"] = record["commands"]
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
            
        nodes.append(node_data)
    return nodes


async def get_all_contexts_for_template(session: AsyncSession, template_id: UUID, owner_id: UUID) -> List[dict]:
    """
    Retrieves all contexts with their variables for a specific template.
    Returns empty list if template exists but has no contexts.
    """
    # First check if the template exists and belongs to the user
    check_query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(template:Template {id: $template_id})
    RETURN template.id as id
    """
    check_result = await session.run(
        check_query,
        {
            "owner_id": str(owner_id),
            "template_id": str(template_id),
        },
    )
    if not await check_result.single():
        return []
    
    # Now get all contexts with their variables
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(template:Template {id: $template_id})-[:HAS_CONTEXT]->(context:Context)
    OPTIONAL MATCH (context)-[:HAS_VARIABLE]->(variable:Variable)
    WITH context, collect(variable) as variables
    RETURN context, variables
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "template_id": str(template_id),
        },
    )
    
    contexts = []
    async for record in result:
        context_data = dict(record["context"])
        
        # Convert Neo4j DateTime objects to Python datetime
        if "created_at" in context_data:
            context_data["created_at"] = convert_neo4j_datetime(context_data["created_at"])
        if "updated_at" in context_data:
            context_data["updated_at"] = convert_neo4j_datetime(context_data["updated_at"])
        
        # Process variables
        context_data["variables"] = []
        for var in record["variables"]:
            if var is not None:
                var_data = dict(var)
                # Convert Neo4j DateTime objects for variables
                if "created_at" in var_data:
                    var_data["created_at"] = convert_neo4j_datetime(var_data["created_at"])
                if "updated_at" in var_data:
                    var_data["updated_at"] = convert_neo4j_datetime(var_data["updated_at"])
                context_data["variables"].append(var_data)
        
        contexts.append(context_data)
    
    return contexts 