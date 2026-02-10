import json
import logging
from typing import AsyncGenerator, Optional

import httpx

from .base import AIProvider

logger = logging.getLogger(__name__)


class OpenAICompatProvider(AIProvider):
    """OpenAI-compatible API provider.

    Works with: OpenAI, Ollama, vLLM, LM Studio, LocalAI,
    Groq, Together AI, DeepSeek, Mistral, and any server
    implementing the /v1/chat/completions endpoint.
    """

    def __init__(self, api_key: str, model: str, base_url: str):
        super().__init__(api_key=api_key, model=model, base_url=base_url)
        self.client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=60.0)
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
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        request_data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_json:
            request_data["response_format"] = {"type": "json_object"}

        url = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}

        # Only add auth header if key is provided (Ollama/local need no key)
        if self.api_key and self.api_key.strip():
            headers["Authorization"] = f"Bearer {self.api_key}"

        logger.info(
            f"Making OpenAI-compatible API call to {self.base_url} model: {self.model}"
        )

        try:
            response = await self.client.post(
                url, json=request_data, headers=headers
            )
            # If server rejects response_format, retry without it
            if response.status_code == 400 and response_json:
                logger.info("Server rejected response_format, retrying without it")
                request_data.pop("response_format", None)
                response = await self.client.post(
                    url, json=request_data, headers=headers
                )

            logger.info(f"OpenAI-compat API response status: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"OpenAI-compat API error response: {response.text}")
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenAI-compat API HTTP error: {e}")
            logger.error(f"Response body: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling OpenAI-compat API: {e}")
            raise

        result = response.json()

        choices = result.get("choices", [])
        if not choices:
            raise ValueError("No choices in OpenAI-compatible response")

        text = choices[0].get("message", {}).get("content", "")
        if not text:
            raise ValueError("Empty content in OpenAI-compatible response")

        return text

    async def generate_content_stream(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ) -> AsyncGenerator[str, None]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        request_data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        url = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.api_key and self.api_key.strip():
            headers["Authorization"] = f"Bearer {self.api_key}"

        logger.info(
            f"Streaming OpenAI-compatible API call to {self.base_url} model: {self.model}"
        )

        async with self.client.stream(
            "POST", url, json=request_data, headers=headers
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                logger.error(f"OpenAI-compat stream error: {body.decode()}")
                raise httpx.HTTPStatusError(
                    f"HTTP {response.status_code}",
                    request=response.request,
                    response=response,
                )

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

    async def get_provider_name(self) -> str:
        return f"openai-compat ({self.model} @ {self.base_url})"
