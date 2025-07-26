from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import json
import asyncio

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
    AIChatResponse
)
from services.ai_orchestrator import AIOrchestrator
from services.ai_auth import AIAuthorizationService
from core.config import settings


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
    # Check if Gemini API key is configured
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured. Please set GOOGLE_API_KEY environment variable."
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
    # Check if Gemini API key is configured
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured. Please set GOOGLE_API_KEY environment variable."
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
    # Check if Gemini API key is configured
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured. Please set GOOGLE_API_KEY environment variable."
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
    # Check if Gemini API key is configured
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured. Please set GOOGLE_API_KEY environment variable."
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