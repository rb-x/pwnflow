import logging
from typing import Optional

import httpx

from .base import AIProvider

logger = logging.getLogger(__name__)


class GeminiProvider(AIProvider):
    """Google Gemini API provider using direct REST calls."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        super().__init__(
            api_key=api_key,
            model=model,
            base_url="https://generativelanguage.googleapis.com/v1beta/models",
        )
        self.client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    async def generate_content(
        self,
        prompt: str,
        system_prompt: str,
        response_json: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ) -> str:
        request_data = {
            "contents": [
                {"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if response_json:
            request_data["generationConfig"]["responseMimeType"] = "application/json"

        url = f"{self.base_url}/{self.model}:generateContent"
        headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": self.api_key,
        }

        logger.info(f"Making Gemini API call to model: {self.model}")

        try:
            response = await self.client.post(url, json=request_data, headers=headers)
            logger.info(f"Gemini API response status: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"Gemini API error response: {response.text}")
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Gemini API HTTP error: {e}")
            logger.error(f"Response body: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling Gemini API: {e}")
            raise

        result = response.json()

        candidates = result.get("candidates", [])
        if not candidates:
            raise ValueError("No candidates in Gemini response")

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            raise ValueError("No parts in Gemini response content")

        text = parts[0].get("text", "")
        if not text:
            raise ValueError("No text in Gemini response")

        return text

    async def get_provider_name(self) -> str:
        return f"gemini ({self.model})"
