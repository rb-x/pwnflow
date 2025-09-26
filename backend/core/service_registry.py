from typing import Dict, List, Optional
from pydantic import BaseModel
from fastapi import FastAPI

class ServiceInfo(BaseModel):
    name: str
    version: str
    enabled: bool
    health_endpoint: str
    base_path: str
    description: str

class ServiceRegistry:
    def __init__(self):
        self.services: Dict[str, ServiceInfo] = {}
        self.app: Optional[FastAPI] = None

    def init_app(self, app: FastAPI):
        self.app = app

    def register_service(self, service: ServiceInfo):
        """Register a module/service"""
        self.services[service.name] = service
        if service.enabled:
            print(f"✓ Module loaded: {service.name} v{service.version}")

    def get_service(self, name: str) -> Optional[ServiceInfo]:
        return self.services.get(name)

    def list_services(self) -> List[ServiceInfo]:
        return list(self.services.values())

    def is_enabled(self, name: str) -> bool:
        service = self.services.get(name)
        return service.enabled if service else False

    def get_health_status(self) -> Dict:
        return {
            "services": {
                name: {
                    "enabled": service.enabled,
                    "version": service.version,
                    "path": service.base_path
                }
                for name, service in self.services.items()
            }
        }

registry = ServiceRegistry()