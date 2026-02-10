# Backward compatibility alias.
# All logic has moved to providers/base.py + providers/gemini.py.
# Import paths that reference GeminiService will continue to work.
from providers.gemini import GeminiProvider as GeminiService  # noqa: F401

__all__ = ["GeminiService"]
