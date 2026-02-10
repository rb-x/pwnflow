import os
import logging

from .base import AIProvider
from .gemini import GeminiProvider
from .openai_compat import OpenAICompatProvider

logger = logging.getLogger(__name__)

__all__ = [
    "AIProvider",
    "GeminiProvider",
    "OpenAICompatProvider",
    "get_provider",
    "get_provider_config",
]


def get_provider() -> AIProvider:
    """Factory: return the correct provider based on environment config.

    Environment variables (new):
      AI_PROVIDER  - "gemini" or "openai" (auto-detected from AI_BASE_URL if not set)
      AI_API_KEY   - API key (falls back to GOOGLE_API_KEY for backward compat)
      AI_MODEL     - Model name (falls back to GEMINI_MODEL for backward compat)
      AI_BASE_URL  - Base URL for OpenAI-compatible endpoints

    Backward compatible: existing GOOGLE_API_KEY + GEMINI_MODEL still work.
    """
    provider_type = os.getenv("AI_PROVIDER", "").lower().strip()
    api_key = os.getenv("AI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    model = os.getenv("AI_MODEL") or os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    base_url = os.getenv("AI_BASE_URL", "").strip()

    # Auto-detect provider if not explicitly set
    if not provider_type:
        provider_type = "openai" if base_url else "gemini"

    logger.info(f"AI provider: {provider_type}, model: {model}")

    if provider_type == "openai":
        if not base_url:
            base_url = "https://api.openai.com/v1"
        return OpenAICompatProvider(api_key=api_key, model=model, base_url=base_url)
    else:
        return GeminiProvider(api_key=api_key, model=model)


def get_provider_config() -> dict:
    """Return current provider configuration for health/status endpoints.
    Never exposes API keys.
    """
    api_key = os.getenv("AI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    model = os.getenv("AI_MODEL") or os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    base_url = os.getenv("AI_BASE_URL", "").strip()
    provider_type = os.getenv("AI_PROVIDER", "").lower().strip()

    if not provider_type:
        provider_type = "openai" if base_url else "gemini"

    return {
        "provider": provider_type,
        "model": model,
        "base_url": base_url if provider_type == "openai" else None,
        "configured": bool(api_key) or (provider_type == "openai" and bool(base_url)),
    }
