from uuid import UUID
from neo4j import AsyncSession
from schemas.context import (
    Context,
    ContextCreate,
    ContextUpdate,
    VariableCreate,
    VariableUpdate,
    VariableInDB,
)

# --- Context CRUD ---

async def create_context_for_project(
    session: AsyncSession, context_in: ContextCreate, project_id: UUID, owner_id: UUID
) -> Context | None:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})
    CREATE (project)-[:HAS_CONTEXT]->(context:Context {
        id: randomUUID(),
        name: $name,
        description: $description
    })
    RETURN context
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "name": context_in.name,
            "description": context_in.description,
        },
    )
    record = await result.single()
    if not record:
        return None

    context_data = dict(record["context"])
    context_data["variables"] = []  # Explicitly add empty list for new context
    return Context.model_validate(context_data)

async def get_all_contexts_for_project(
    session: AsyncSession, project_id: UUID, owner_id: UUID
) -> list[Context]:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_CONTEXT]->(context:Context)
    OPTIONAL MATCH (context)-[:HAS_VARIABLE]->(v:Variable)
    WITH context, collect(v) as variables
    RETURN context, variables
    ORDER BY context.name
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
        },
    )
    records = await result.data()
    contexts = []
    for record in records:
        context_data = dict(record["context"])
        # Add variables to context data
        context_data["variables"] = [dict(v) for v in record["variables"] if v is not None]
        contexts.append(Context.model_validate(context_data))
    return contexts

async def get_context_with_variables(
    session: AsyncSession, context_id: UUID, project_id: UUID, owner_id: UUID, include_sensitive: bool
) -> Context | None:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_CONTEXT]->(context:Context {id: $context_id})
    OPTIONAL MATCH (context)-[:HAS_VARIABLE]->(v:Variable)
    WHERE $include_sensitive = true OR v.sensitive = false
    RETURN context, collect(v) as variables
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "context_id": str(context_id),
            "include_sensitive": include_sensitive,
        },
    )
    record = await result.single()
    if not record:
        return None
    
    context_data = dict(record["context"])
    variables_data = [dict(var) for var in record["variables"]]
    context_data["variables"] = [VariableInDB.model_validate(var) for var in variables_data]
    
    return Context.model_validate(context_data)

async def delete_context(session: AsyncSession, context_id: UUID, project_id: UUID, owner_id: UUID) -> bool:
    # Deletes context and all its variables due to DETACH DELETE
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_CONTEXT]->(context:Context {id: $context_id})
    DETACH DELETE context
    RETURN count(context) > 0
    """
    result = await session.run(
        query, {"owner_id": str(owner_id), "project_id": str(project_id), "context_id": str(context_id)}
    )
    summary = await result.consume()
    return summary.counters.nodes_deleted > 0

# --- Variable CRUD ---

async def get_variable_in_context(
    session: AsyncSession, variable_id: UUID, context_id: UUID, project_id: UUID, owner_id: UUID
) -> VariableInDB | None:
    # Ownership is checked by matching the full path from user to variable
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_CONTEXT]->(context:Context {id: $context_id})-[:HAS_VARIABLE]->(v:Variable {id: $variable_id})
    RETURN v
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "context_id": str(context_id),
            "variable_id": str(variable_id),
        },
    )
    record = await result.single()
    return VariableInDB.model_validate(record["v"]) if record else None

async def add_variable_to_context(
    session: AsyncSession, variable_in: VariableCreate, context_id: UUID, project_id: UUID, owner_id: UUID
) -> VariableInDB | None:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_CONTEXT]->(context:Context {id: $context_id})
    CREATE (context)-[:HAS_VARIABLE]->(variable:Variable {
        id: randomUUID(),
        name: $name,
        value: $value,
        description: $description,
        sensitive: $sensitive
    })
    RETURN variable
    """
    result = await session.run(
        query,
        {
            "owner_id": str(owner_id),
            "project_id": str(project_id),
            "context_id": str(context_id),
            "name": variable_in.name,
            "value": variable_in.value,
            "description": variable_in.description,
            "sensitive": variable_in.sensitive,
        },
    )
    record = await result.single()
    return VariableInDB.model_validate(record["variable"]) if record else None

async def update_variable_in_context(
    session: AsyncSession, variable_id: UUID, variable_in: VariableUpdate, context_id: UUID, project_id: UUID, owner_id: UUID
) -> VariableInDB | None:
    props = variable_in.model_dump(exclude_unset=True)
    if not props:
        get_query = """
        MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_CONTEXT]->(context:Context {id: $context_id})-[:HAS_VARIABLE]->(v:Variable {id: $variable_id})
        RETURN v
        """
        result = await session.run(get_query, {"owner_id": str(owner_id), "project_id": str(project_id), "context_id": str(context_id), "variable_id": str(variable_id)})
        record = await result.single()
        return VariableInDB.model_validate(record["v"]) if record else None

    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_CONTEXT]->(context:Context {id: $context_id})-[:HAS_VARIABLE]->(v:Variable {id: $variable_id})
    SET v += $props
    RETURN v
    """
    result = await session.run(query, {"owner_id": str(owner_id), "project_id": str(project_id), "context_id": str(context_id), "variable_id": str(variable_id), "props": props})
    record = await result.single()
    return VariableInDB.model_validate(record["v"]) if record else None

async def delete_variable_from_context(
    session: AsyncSession, variable_id: UUID, context_id: UUID, project_id: UUID, owner_id: UUID
) -> bool:
    query = """
    MATCH (user:User {id: $owner_id})-[:OWNS]->(project:Project {id: $project_id})-[:HAS_CONTEXT]->(context:Context {id: $context_id})-[r:HAS_VARIABLE]->(v:Variable {id: $variable_id})
    DELETE r, v
    RETURN count(v) > 0
    """
    result = await session.run(query, {"owner_id": str(owner_id), "project_id": str(project_id), "context_id": str(context_id), "variable_id": str(variable_id)})
    summary = await result.consume()
    return summary.counters.nodes_deleted > 0 