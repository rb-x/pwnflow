import os
from typing import Dict, Any

def get_module_config() -> Dict[str, Any]:
    """Load module configuration from environment"""
    return {
        "core": {
            "enabled": True,  # Always enabled
            "version": "1.0.0"
        },
        "findings": {
            "enabled": os.getenv("MODULE_FINDINGS_ENABLED", "true").lower() == "true",
            "version": "1.0.0"
        },
        "scope": {
            "enabled": os.getenv("MODULE_SCOPE_ENABLED", "true").lower() == "true",
            "version": "1.0.0"
        },
        "timeline": {
            "enabled": os.getenv("MODULE_TIMELINE_ENABLED", "true").lower() == "true",
            "version": "1.0.0"
        },
        "ai": {
            "enabled": os.getenv("MODULE_AI_ENABLED", "false").lower() == "true",
            "version": "1.0.0"
        },
        "export": {
            "enabled": os.getenv("MODULE_EXPORT_ENABLED", "true").lower() == "true",
            "version": "1.0.0"
        }
    }

def is_module_enabled(module_name: str) -> bool:
    """Check if a module is enabled"""
    config = get_module_config()
    module = config.get(module_name, {})
    return module.get("enabled", False)