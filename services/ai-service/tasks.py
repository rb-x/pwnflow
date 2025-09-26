from celery import current_task
from celery_app import celery_app
from gemini_service import GeminiService
from schemas import (
    AIGenerationResponse, AIGenerationOptions,
    AINode, AIRelationship
)
import os
import logging
import json

logger = logging.getLogger(__name__)

@celery_app.task(name="ai.generate_nodes_with_relationships")
def generate_nodes_with_relationships_task(
    prompt: str,
    parent_node: dict = None,
    existing_nodes: list = None,
    options: dict = None
) -> dict:
    """Generate nodes and relationships using Gemini"""

    current_task.update_state(state='PROGRESS', meta={'status': 'Initializing AI...'})

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {"error": "AI service not configured"}

    try:
        # Use async context manager synchronously (Celery tasks are sync)
        import asyncio

        async def _generate():
            async with GeminiService(api_key) as service:
                # Parse options if provided
                opts = AIGenerationOptions(**options) if options else AIGenerationOptions()

                current_task.update_state(state='PROGRESS', meta={'status': 'Generating with AI...'})

                response = await service.generate_nodes_with_relationships(
                    prompt=prompt,
                    parent_node=parent_node,
                    existing_nodes=existing_nodes or [],
                    options=opts
                )

                # Convert to dict for JSON serialization
                return response.dict()

        # Run async function in sync context
        result = asyncio.run(_generate())

        logger.info(f"Generated {len(result.get('nodes', []))} nodes")
        return result

    except Exception as e:
        logger.error(f"Generation failed: {e}")
        return {"error": str(e)}

@celery_app.task(name="ai.expand_single_node")
def expand_single_node_task(
    node_id: str,
    node_title: str,
    node_description: str = None,
    project_context: dict = None
) -> dict:
    """Expand a single node with AI-generated children"""

    current_task.update_state(state='PROGRESS', meta={'status': 'Expanding node...'})

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {"error": "AI service not configured"}

    try:
        import asyncio

        async def _expand():
            async with GeminiService(api_key) as service:
                return await service.expand_single_node(
                    node={'id': node_id, 'title': node_title, 'description': node_description},
                    context=project_context
                )

        result = asyncio.run(_expand())
        return result

    except Exception as e:
        logger.error(f"Node expansion failed: {e}")
        return {"error": str(e)}

@celery_app.task(name="ai.suggest_connections")
def suggest_connections_task(
    nodes: list,
    existing_relationships: list = None
) -> dict:
    """Suggest connections between nodes"""

    current_task.update_state(state='PROGRESS', meta={'status': 'Analyzing connections...'})

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {"error": "AI service not configured"}

    try:
        import asyncio

        async def _suggest():
            async with GeminiService(api_key) as service:
                return await service.suggest_connections(
                    nodes=nodes,
                    existing_relationships=existing_relationships or []
                )

        result = asyncio.run(_suggest())
        return result

    except Exception as e:
        logger.error(f"Connection suggestion failed: {e}")
        return {"error": str(e)}

@celery_app.task(name="ai.chat_with_context")
def chat_with_context_task(
    system_prompt: str,
    user_message: str,
    response_mime_type: str = "text/plain"
) -> dict:
    """Chat with AI about the mindmap using Gemini"""

    current_task.update_state(state='PROGRESS', meta={'status': 'Processing chat...'})

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {"error": "AI service not configured"}

    try:
        import asyncio

        async def _chat():
            async with GeminiService(api_key) as service:
                return await service.chat(
                    system_prompt=system_prompt,
                    user_message=user_message,
                    response_mime_type=response_mime_type
                )

        result = asyncio.run(_chat())
        return result

    except Exception as e:
        logger.error(f"Chat failed: {e}")
        return {"error": str(e)}
