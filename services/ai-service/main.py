from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from dotenv import load_dotenv
import logging

load_dotenv()

app = FastAPI(
    title="AI Service",
    version=os.getenv("SERVICE_VERSION", "dev"),
    description="AI generation microservice for pwnflow"
)

from celery_app import celery_app
from tasks import (
    generate_nodes_with_relationships_task,
    expand_single_node_task,
    suggest_connections_task,
    chat_with_context_task
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Request/Response models
class GenerateNodesRequest(BaseModel):
    prompt: str
    parent_node: Optional[Dict] = None
    existing_nodes: List[Dict] = []
    options: Optional[Dict] = None

class TaskResponse(BaseModel):
    task_id: str
    status: str = "pending"
    result: Optional[Any] = None


class ChatRequest(BaseModel):
    system_prompt: str
    user_message: str
    response_mime_type: Optional[str] = "text/plain"

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-service",
        "version": os.getenv("SERVICE_VERSION", "dev"),
        "gemini_configured": bool(os.getenv("GOOGLE_API_KEY"))
    }

# Async endpoints (using Celery)
@app.post(
    "/generate-nodes",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_nodes(request: GenerateNodesRequest, response: Response):
    """Generate nodes asynchronously using Celery"""
    task = generate_nodes_with_relationships_task.delay(
        prompt=request.prompt,
        parent_node=request.parent_node,
        existing_nodes=request.existing_nodes,
        options=request.options
    )

    response.headers["Location"] = f"/tasks/{task.id}"
    return TaskResponse(task_id=task.id)

@app.post(
    "/expand-node",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def expand_node(request: Dict, response: Response):
    """Expand a single node with children"""
    task = expand_single_node_task.delay(**request)
    response.headers["Location"] = f"/tasks/{task.id}"
    return TaskResponse(task_id=task.id)

@app.post(
    "/suggest-connections",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def suggest_connections(request: Dict, response: Response):
    """Suggest connections between nodes"""
    task = suggest_connections_task.delay(**request)
    response.headers["Location"] = f"/tasks/{task.id}"
    return TaskResponse(task_id=task.id)

@app.post(
    "/chat",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def chat(request: ChatRequest, response: Response):
    """Chat with AI about the mindmap using Celery"""
    task = chat_with_context_task.delay(
        system_prompt=request.system_prompt,
        user_message=request.user_message,
        response_mime_type=request.response_mime_type or "text/plain",
    )
    response.headers["Location"] = f"/tasks/{task.id}"
    return TaskResponse(task_id=task.id)

# Synchronous endpoints (for backwards compatibility)
@app.post("/generate-nodes-sync")
async def generate_nodes_sync(request: GenerateNodesRequest):
    """Synchronous generation - blocks until complete"""
    task = generate_nodes_with_relationships_task.apply_async(
        kwargs=request.dict(),
        time_limit=60
    )

    try:
        result = task.get(timeout=60)
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"Sync generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Task status endpoint
@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get status and result of an async task"""
    task = celery_app.AsyncResult(task_id)

    if task.state == "PENDING":
        return {"task_id": task_id, "status": "pending"}
    elif task.state == "PROGRESS":
        return {"task_id": task_id, "status": "processing", "progress": task.info}
    elif task.state == "SUCCESS":
        return {"task_id": task_id, "status": "success", "result": task.result}
    elif task.state == "FAILURE":
        return {"task_id": task_id, "status": "failed", "error": str(task.info)}
    else:
        return {"task_id": task_id, "status": task.state.lower()}

# Synchronous chat endpoint
@app.post("/chat-sync")
async def chat_sync(request: ChatRequest):
    """Synchronous chat - blocks until complete"""
    import asyncio
    from gemini_service import GeminiService

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    try:
        async with GeminiService(api_key) as service:
            result = await service.chat(
                system_prompt=request.system_prompt,
                user_message=request.user_message,
                response_mime_type=request.response_mime_type or "text/plain",
            )
            return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
