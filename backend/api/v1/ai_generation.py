from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import json
import asyncio
import logging

from db.database import get_session
from api.dependencies import get_current_user
from neo4j import AsyncSession
from schemas.user import User
from schemas.ai_generation import (
    AIGenerationRequest,
    AIGenerationResponse,
    AIExpandNodeRequest,
    AISuggestConnectionsRequest,
    AIChatRequest,
    AIChatStreamRequest,
    AIChatResponse,
    ChatMode,
)
from services.ai_orchestrator import AIOrchestrator
from services.ai_auth import AIAuthorizationService
from core.config import settings

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/projects/{project_id}/ai",
    tags=["ai-generation"]
)


@router.post("/generate", response_model=Dict)
async def generate_ai_nodes(
    project_id: str,
    request: AIGenerationRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Generate mind map nodes using AI

    - Requires project ownership
    - Subject to rate limits based on subscription tier
    - Generates nodes with descriptions and commands
    - Creates intelligent relationships between nodes
    """
    # Check if AI microservice is available
    from services.ai_client import ai_client
    if not await ai_client.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not available. Please check if the AI microservice is running."
        )

    # Authorize the request
    auth_service = AIAuthorizationService(session)
    user_info = await auth_service.authorize_ai_request(
        current_user.id, project_id
    )

    # Generate and create nodes
    orchestrator = AIOrchestrator(session)
    try:
        result = await orchestrator.generate_and_create_nodes(
            project_id=project_id,
            user_id=current_user.id,
            request=request
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI generation failed: {str(e)}"
        )


@router.post("/generate-stream")
async def generate_ai_nodes_stream(
    project_id: str,
    request: AIGenerationRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Generate mind map nodes using AI with streaming response

    Returns Server-Sent Events stream for real-time updates
    """
    # Check if AI microservice is available
    from services.ai_client import ai_client
    if not await ai_client.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not available. Please check if the AI microservice is running."
        )

    # Authorize the request
    auth_service = AIAuthorizationService(session)
    await auth_service.authorize_ai_request(current_user.id, project_id)

    async def event_generator():
        # Create a new session for the streaming response
        async for stream_session in get_session():
            orchestrator = AIOrchestrator(stream_session)

            try:
                # For now, we'll simulate streaming by breaking up the response
                # In a real implementation, you'd stream from Gemini API
                result = await orchestrator.generate_and_create_nodes(
                    project_id=project_id,
                    user_id=current_user.id,
                    request=request
                )

                # Stream nodes one by one
                for node in result["nodes"]:
                    event = {
                        "type": "node",
                        "data": node
                    }
                    yield f"data: {json.dumps(event)}\n\n"
                    await asyncio.sleep(0.1)  # Small delay for effect

                # Stream relationships
                for rel in result["relationships"]:
                    event = {
                        "type": "relationship",
                        "data": rel
                    }
                    yield f"data: {json.dumps(event)}\n\n"
                    await asyncio.sleep(0.05)

                # Send completion event
                event = {
                    "type": "complete",
                    "metadata": result["metadata"]
                }
                yield f"data: {json.dumps(event)}\n\n"

            except Exception as e:
                event = {
                    "type": "error",
                    "message": str(e)
                }
                yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/expand-node/{node_id}", response_model=Dict)
async def expand_node_with_ai(
    project_id: str,
    node_id: str,
    request: AIExpandNodeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Expand an existing node with AI-generated child nodes

    - Generates child nodes based on the instruction
    - Maintains parent-child relationships
    - Limited depth to prevent excessive generation
    """
    # Authorize
    auth_service = AIAuthorizationService(session)
    await auth_service.authorize_ai_request(current_user.id, project_id)

    # Verify node belongs to project
    query = """
    MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node {id: $node_id})
    RETURN n.id as node_id
    """
    result = await session.run(
        query,
        {"project_id": project_id, "node_id": node_id}
    )
    record = await result.single()

    if not record:
        raise HTTPException(404, "Node not found in project")

    # Create generation request with the node as parent
    generation_request = AIGenerationRequest(
        prompt=request.instruction,
        parent_node_id=node_id,
        options={
            "max_depth": request.depth,
            "max_nodes": 10 * request.depth,  # Reasonable limit
            "auto_connect": True
        }
    )

    # Generate nodes
    orchestrator = AIOrchestrator(db)
    result = await orchestrator.generate_and_create_nodes(
        project_id=project_id,
        user_id=current_user.id,
        request=generation_request
    )

    return result


@router.post("/suggest-connections", response_model=List[Dict])
async def suggest_node_connections(
    project_id: str,
    request: AISuggestConnectionsRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Suggest connections for a node using AI analysis

    - Analyzes node content to find meaningful relationships
    - Can search within project or specific nodes
    - Returns confidence scores and reasons
    """
    # Authorize
    auth_service = AIAuthorizationService(session)
    await auth_service.authorize_ai_request(current_user.id, project_id)

    # Get source node
    query = """
    MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node {id: $node_id})
    RETURN n {.*} as node
    """
    result = await session.run(
        query,
        {"project_id": project_id, "node_id": request.source_node_id}
    )
    record = await result.single()

    if not record:
        raise HTTPException(404, "Source node not found")

    source_node = record["node"]

    # Get target nodes based on scope
    if request.target_scope == "specific_nodes" and request.target_node_ids:
        target_query = """
        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node)
        WHERE n.id IN $node_ids
        RETURN n {.*} as node
        """
        result = await session.run(
            target_query,
            {
                "project_id": project_id,
                "node_ids": request.target_node_ids
            }
        )
        target_nodes = []
        async for record in result:
            target_nodes.append(record)
    else:
        # Get all project nodes
        target_query = """
        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node)
        WHERE n.id <> $source_id
        RETURN n {.*} as node
        LIMIT 100
        """
        result = await session.run(
            target_query,
            {
                "project_id": project_id,
                "source_id": request.source_node_id
            }
        )
        target_nodes = []
        async for record in result:
            target_nodes.append(record)

    # TODO: Implement AI-based connection suggestion
    # For now, return a simple implementation
    suggestions = []

    # Simple keyword matching as placeholder
    source_desc = source_node.get("description", "").lower()
    source_words = set(source_desc.split())

    for target in target_nodes:
        target_node = target["node"]
        target_desc = target_node.get("description", "").lower()
        target_words = set(target_desc.split())

        # Calculate simple similarity
        common_words = source_words.intersection(target_words)
        if len(common_words) > 2:
            confidence = min(len(common_words) / 10, 1.0)
            suggestions.append({
                "source_id": source_node["id"],
                "target_id": target_node["id"],
                "target_title": target_node["title"],
                "relationship_type": "relates_to",
                "confidence": confidence,
                "reason": f"Nodes share common concepts: {', '.join(list(common_words)[:5])}"
            })

    # Sort by confidence
    suggestions.sort(key=lambda x: x["confidence"], reverse=True)

    return suggestions[:10]  # Return top 10 suggestions



@router.post("/chat", response_model=AIChatResponse)
async def chat_with_ai(
    project_id: str,
    request: AIChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    General purpose AI chat with context awareness

    - Can provide general assistance without creating nodes
    - When node_id is provided, uses node context for better responses
    - Can suggest node improvements, descriptions, or child nodes
    """
    # Check if AI microservice is available
    from services.ai_client import ai_client
    if not await ai_client.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not available. Please check if the AI microservice is running."
        )

    # Authorize the request
    auth_service = AIAuthorizationService(session)
    await auth_service.authorize_ai_request(current_user.id, project_id)

    # Get node context if provided
    node_context = None
    if request.node_id:
        query = """
        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node {id: $node_id})
        OPTIONAL MATCH (n)-[:HAS_COMMAND]->(cmd:Command)
        WITH n, collect(cmd) as commands
        RETURN n {
            .*,
            commands: commands
        } as node
        """
        result = await session.run(
            query,
            {"project_id": project_id, "node_id": request.node_id}
        )
        record = await result.single()

        if record:
            node_context = record["node"]

    # Get project context with tags
    project_query = """
    MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
    OPTIONAL MATCH (p)-[:HAS_NODE]->(n:Node)
    OPTIONAL MATCH (p)-[:HAS_NODE]->(:Node)-[:HAS_TAG]->(t:Tag)
    WITH p, count(DISTINCT n) as node_count, collect(DISTINCT t.name) as tags
    RETURN p {
        .id, .name, .description,
        tags: tags
    } as project,
    node_count
    """
    result = await session.run(
        project_query,
        {"user_id": str(current_user.id), "project_id": project_id}
    )
    record = await result.single()
    project_context = record["project"] if record else None
    node_count = record["node_count"] if record else 0

    # Use AI orchestrator's chat method
    orchestrator = AIOrchestrator(session)
    response = await orchestrator.chat_with_context(
        message=request.message,
        project_context=project_context,
        node_context=node_context,
        node_count=node_count,
        mode=request.mode,
        project_id=project_id
    )

    return response


NODE_CREATION_TRIGGERS = [
    "create", "add", "build", "generate", "suggest nodes",
    "make nodes", "new nodes", "expand", "create nodes",
]


def _extract_nodes(result: Any) -> list:
    """Extract node list from various LLM response shapes."""
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except (json.JSONDecodeError, TypeError):
            return []

    if isinstance(result, list):
        # Raw array of nodes
        return [n for n in result if isinstance(n, dict) and "title" in n]

    if isinstance(result, dict):
        # Shape: {"directives": {"action": "suggest_nodes", "nodes": [...]}}
        directives = result.get("directives")
        if isinstance(directives, dict):
            nodes = directives.get("nodes", [])
            if isinstance(nodes, list) and nodes:
                return nodes

        # Shape: {"nodes": [...]}
        nodes = result.get("nodes", [])
        if isinstance(nodes, list) and nodes:
            return nodes

        # Shape: {"suggestions": [...]}
        nodes = result.get("suggestions", [])
        if isinstance(nodes, list) and nodes:
            return nodes

    return []


def _should_generate_suggestions(message: str) -> bool:
    msg_lower = message.lower()
    return any(trigger in msg_lower for trigger in NODE_CREATION_TRIGGERS)


@router.post("/chat-stream")
async def chat_stream(
    project_id: str,
    request: AIChatStreamRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Streaming AI chat with conversation memory.

    Returns typed SSE events:
    - event: token  — streamed text chunks
    - event: suggestions — node suggestion cards (if applicable)
    - event: done — stream complete
    - event: error — on failure
    """
    from services.ai_client import ai_client

    if not await ai_client.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not available.",
        )

    auth_service = AIAuthorizationService(session)
    await auth_service.authorize_ai_request(current_user.id, project_id)

    # Gather context (same as /chat)
    node_context = None
    if request.node_id:
        query = """
        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node {id: $node_id})
        OPTIONAL MATCH (n)-[:HAS_COMMAND]->(cmd:Command)
        WITH n, collect(cmd) as commands
        RETURN n { .*, commands: commands } as node
        """
        result = await session.run(
            query, {"project_id": project_id, "node_id": request.node_id}
        )
        record = await result.single()
        if record:
            node_context = record["node"]

    project_query = """
    MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
    OPTIONAL MATCH (p)-[:HAS_NODE]->(n:Node)
    OPTIONAL MATCH (p)-[:HAS_NODE]->(:Node)-[:HAS_TAG]->(t:Tag)
    WITH p, count(DISTINCT n) as node_count, collect(DISTINCT t.name) as tags
    RETURN p { .id, .name, .description, tags: tags } as project, node_count
    """
    result = await session.run(
        project_query,
        {"user_id": str(current_user.id), "project_id": project_id},
    )
    record = await result.single()
    project_context = record["project"] if record else None
    node_count = record["node_count"] if record else 0

    # Build system prompt via orchestrator (reuse context-building logic)
    orchestrator = AIOrchestrator(session)
    all_nodes = await orchestrator._get_all_project_nodes_for_chat(project_id) if project_id else []

    # Build context string
    context_parts = []
    if project_context:
        context_parts.append(f"Project: {project_context.get('name', 'Unnamed')}")
        if project_context.get("description"):
            context_parts.append(f"Project Description: {project_context['description']}")
        context_parts.append(f"Total Nodes: {node_count}")
        if project_context.get("tags"):
            context_parts.append(f"Project Tags: {', '.join(project_context['tags'])}")

    if all_nodes:
        context_parts.append("\n## All Nodes in Project:")
        for node in all_nodes[:20]:
            node_info = f"- **{node['title']}** (ID: {node['id'][:8]}...)"
            if node.get("description"):
                desc = node["description"][:100] + "..." if len(node["description"]) > 100 else node["description"]
                node_info += f"\n  Description: {desc}"
            context_parts.append(node_info)

    if node_context:
        context_parts.append(f"\n## Current Selected Node:")
        context_parts.append(f"**{node_context.get('title', 'Unnamed')}**")
        if node_context.get("description"):
            context_parts.append(f"Description:\n{node_context['description']}")

    context = "\n".join(context_parts) if context_parts else "No specific context available."

    # Inject conversation history
    history_text = ""
    if request.history:
        history_lines = []
        for msg in request.history[-10:]:
            prefix = "User" if msg.role == "user" else "Assistant"
            # Truncate long assistant messages in history
            content = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
            history_lines.append(f"{prefix}: {content}")
        history_text = "\n## Recent Conversation:\n" + "\n".join(history_lines)

    # Streaming system prompt — NO JSON requirement, just markdown
    stream_system_prompt = f"""You are an elite cybersecurity expert and tactical advisor integrated into Pwnflow. Think of yourself as a seasoned pentester with a dry sense of humor who's seen it all.

## Your Personality:
- Professional but approachable
- Occasionally witty, never at the expense of clarity
- Zero motivational fluff — only actionable tradecraft

## Project Context:
{context}
{history_text}

## Instructions:
- Respond in markdown. Do NOT wrap your response in JSON.
- Reference nodes by title when relevant.
- For casual greetings, keep it short and friendly.
- For technical questions, provide detailed, actionable responses.
- Include real commands with real parameters when relevant.
- Balance offensive and defensive perspectives.
- Use {{{{VARIABLE_NAME}}}} placeholders for dynamic values in commands.
- Prefer modern tools: nxc over crackmapexec, ldeep for LDAP, certipy for ADCS."""

    async def event_generator():
        full_reply = []
        try:
            async for line in ai_client.chat_stream(
                system_prompt=stream_system_prompt,
                user_message=request.message,
            ):
                # Forward SSE events from AI service
                if line.startswith("event: token"):
                    yield line + "\n"
                elif line.startswith("data: "):
                    # Extract text for buffering
                    try:
                        data = json.loads(line[6:])
                        if "t" in data:
                            full_reply.append(data["t"])
                    except json.JSONDecodeError:
                        pass
                    yield line + "\n\n"
                elif line.startswith("event: error"):
                    yield line + "\n"
                elif line.startswith("event: done"):
                    pass  # We'll emit done ourselves after suggestions
                else:
                    yield line + "\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
            return

        # Phase 2: Node suggestions (conditional)
        if _should_generate_suggestions(request.message):
            try:
                full_reply_text = "".join(full_reply)
                suggestion_prompt = f"""Based on this conversation, create node suggestions.
The user asked: {request.message}
Your reply was: {full_reply_text[:1000]}

Return a JSON object with this structure:
{{
  "directives": {{
    "action": "suggest_nodes",
    "nodes": [
      {{
        "title": "Node Title",
        "description": "Detailed markdown description",
        "suggested_commands": [
          {{
            "title": "[Phase] Command Name",
            "command": "actual command with {{{{VARIABLE_NAME}}}}",
            "description": "What it does"
          }}
        ],
        "node_type": "tool|technique|concept|vulnerability",
        "parent_title": null,
        "suggested_tags": ["tag1", "tag2"]
      }}
    ]
  }}
}}
Return ONLY valid JSON. No markdown, no extra text."""

                result = await ai_client.chat_suggestions(
                    system_prompt="You generate structured node suggestions for a cybersecurity mind map. Return ONLY valid JSON.",
                    user_message=suggestion_prompt,
                )

                nodes = _extract_nodes(result)
                if nodes:
                    logger.info(f"Emitting {len(nodes)} node suggestions")
                    yield f"event: suggestions\ndata: {json.dumps({'nodes': nodes})}\n\n"
                else:
                    logger.warning(f"No nodes extracted from suggestion result: {str(result)[:300]}")

            except Exception as e:
                logger.error(f"Suggestion generation failed: {e}")
                # Don't fail the whole stream — suggestions are optional

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/suggest-children/{node_id}", response_model=Dict)
async def suggest_child_nodes(
    project_id: str,
    node_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Suggest child nodes for a specific node using AI

    - Analyzes the node's title and description
    - Suggests 3-5 relevant child nodes
    - Returns suggestions without creating them
    """
    # Check if AI microservice is available
    from services.ai_client import ai_client
    if not await ai_client.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not available. Please check if the AI microservice is running."
        )

    # Authorize the request
    auth_service = AIAuthorizationService(session)
    await auth_service.authorize_ai_request(current_user.id, project_id)

    # Get node details
    query = """
    MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node {id: $node_id})
    OPTIONAL MATCH (n)-[:HAS_COMMAND]->(cmd:Command)
    WITH n, collect(cmd) as commands
    RETURN n {
        .*,
        commands: commands
    } as node
    """
    result = await session.run(
        query,
        {"project_id": project_id, "node_id": node_id}
    )
    record = await result.single()

    if not record:
        raise HTTPException(404, "Node not found in project")

    node = record["node"]

    # Get project tags for context
    tags_query = """
    MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node)-[:HAS_TAG]->(t:Tag)
    RETURN DISTINCT t.name as tag_name
    ORDER BY tag_name
    LIMIT 20
    """
    tags_result = await session.run(
        tags_query,
        {"project_id": project_id}
    )
    project_tags = []
    async for tag_record in tags_result:
        project_tags.append(tag_record["tag_name"])

    # Use AI orchestrator to get suggestions
    orchestrator = AIOrchestrator(session)
    suggestions = await orchestrator.suggest_child_nodes(
        node_title=node.get("title", ""),
        node_description=node.get("description", ""),
        node_commands=[cmd.get("command", "") for cmd in node.get("commands", [])],
        project_tags=project_tags
    )

    return {
        "parent_node": {
            "id": node_id,
            "title": node.get("title", "")
        },
        "suggestions": suggestions
    }
