from abc import ABC, abstractmethod
from fastapi import APIRouter
from typing import Optional

class BaseModule(ABC):
    """Base class for all modules"""

    def __init__(self):
        self.router = APIRouter()
        self.enabled = True

    @abstractmethod
    def get_name(self) -> str:
        """Module name"""
        pass

    @abstractmethod
    def get_version(self) -> str:
        """Module version"""
        pass

    @abstractmethod
    def get_description(self) -> str:
        """Module description"""
        pass

    @abstractmethod
    def setup_routes(self) -> APIRouter:
        """Setup and return module routes"""
        pass

    def health_check(self) -> dict:
        """Module health check"""
        return {
            "status": "healthy",
            "module": self.get_name(),
            "version": self.get_version()
        }

    def init_module(self, config: Optional[dict] = None):
        """Initialize module with config"""
        if config:
            self.enabled = config.get("enabled", True)
        return self.setup_routes()