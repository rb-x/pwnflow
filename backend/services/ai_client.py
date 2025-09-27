import httpx
import os
import asyncio
from typing import Optional, Dict, Any, List
import logging

from schemas.ai_generation import AIGenerationResponse, AIGenerationOptions

logger = logging.getLogger(__name__)

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001")

class AIServiceClient:
    """Client for AI microservice - all AI logic is in the microservice"""

    def __init__(self):
        self.base_url = AI_SERVICE_URL
        self.client = httpx.AsyncClient(timeout=120.0)  # Long timeout for AI tasks

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    def _ensure_client(self) -> None:
        if self.client.is_closed:
            self.client = httpx.AsyncClient(timeout=120.0)

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if not self.client.is_closed:
            await self.client.aclose()

    async def is_available(self) -> bool:
        """Check if AI service is running"""
        try:
            self._ensure_client()
            response = await self.client.get(f"{self.base_url}/health")
            response.raise_for_status()
            return True
        except Exception as e:
            logger.warning(f"AI service not available: {e}")
            return False

    async def generate_nodes_with_relationships(
        self,
        prompt: str,
        parent_node: Optional[Dict],
        existing_nodes: List[Dict],
        options: AIGenerationOptions
    ) -> AIGenerationResponse:
        """Generate nodes - uses Celery queue in AI service"""

        if not await self.is_available():
            raise Exception("AI service not available")

        # Use async endpoint with Celery task queue
        task_id = await self.generate_nodes_async(
            prompt=prompt,
            parent_node=parent_node,
            existing_nodes=existing_nodes,
            options=options
        )

        # Poll for result and parse into response model
        result = await self.get_task_result(task_id, timeout=120)

        if isinstance(result, dict) and result.get("error"):
            raise Exception(result["error"])

        return AIGenerationResponse.parse_obj(result)

    async def generate_nodes_async(
        self,
        prompt: str,
        parent_node: Optional[Dict],
        existing_nodes: List[Dict],
        options: AIGenerationOptions
    ) -> str:
        """Start async generation - returns task_id"""

        self._ensure_client()
        response = await self.client.post(
            f"{self.base_url}/generate-nodes",
            json={
                "prompt": prompt,
                "parent_node": parent_node,
                "existing_nodes": existing_nodes,
                "options": options.dict() if options else {}
            }
        )
        response.raise_for_status()

        data = response.json()
        return data["task_id"]

    async def get_task_result(self, task_id: str, timeout: int = 60) -> Any:
        """Poll for async task result and return raw payload."""

        start = asyncio.get_event_loop().time()

        while asyncio.get_event_loop().time() - start < timeout:
            self._ensure_client()
            response = await self.client.get(f"{self.base_url}/tasks/{task_id}")
            response.raise_for_status()
            data = response.json()

            status = data.get("status")

            if status == "success":
                return data.get("result")
            if status == "failed":
                raise Exception(data.get("error", "Task failed"))
            if status in {"pending", "processing"}:
                await asyncio.sleep(1)
                continue

            raise Exception(f"Unknown task status: {status}")

        raise Exception("Task timeout")

    async def expand_single_node(self, node_data: Dict) -> Dict:
        """Expand a single node"""
        self._ensure_client()
        response = await self.client.post(
            f"{self.base_url}/expand-node",
            json=node_data
        )
        response.raise_for_status()
        task_id = response.json()["task_id"]
        result = await self.get_task_result(task_id)
        if isinstance(result, dict) and result.get("error"):
            raise Exception(result["error"])
        return result

    async def suggest_connections(self, nodes: List[Dict]) -> Dict:
        """Suggest connections between nodes"""
        self._ensure_client()
        response = await self.client.post(
            f"{self.base_url}/suggest-connections",
            json={"nodes": nodes}
        )
        response.raise_for_status()
        task_id = response.json()["task_id"]
        result = await self.get_task_result(task_id)
        if isinstance(result, dict) and result.get("error"):
            raise Exception(result["error"])
        return result

    async def chat(self, system_prompt: str = "", user_message: str = "", response_mime_type: str = "text/plain", **kwargs) -> Any:
        """Chat with AI - forwards to microservice"""

        try:
            self._ensure_client()
            response = await self.client.post(
                f"{self.base_url}/chat",
                json={
                    "system_prompt": system_prompt,
                    "user_message": user_message,
                    "response_mime_type": response_mime_type,
                }
            )
            response.raise_for_status()

            task_id = response.json()["task_id"]
            result = await self.get_task_result(task_id, timeout=120)
            if isinstance(result, dict) and result.get("error"):
                raise Exception(result["error"])
            return result
        except Exception as e:
            logger.error(f"AI microservice chat failed: {e}")
            raise

ai_client = AIServiceClient()
