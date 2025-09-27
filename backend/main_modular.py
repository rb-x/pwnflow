import sys
import os
import logging
import secrets
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from neo4j import AsyncSession

from db.database import get_driver, close_driver
from db.redis import close_redis
from api.v1 import auth, projects, templates, category_tags, ai_generation, legacy_import, exports
from api.exception_handlers import validation_exception_handler
from routers import websocket
from core.config import settings
from core.service_registry import registry, ServiceInfo
from config.modules import get_module_config, is_module_enabled
from fastapi.middleware.cors import CORSMiddleware
from crud import user as user_crud
from schemas.user import UserCreate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger = logging.getLogger(__name__)
    logger.info("Starting Pwnflow Backend (Modular)")
    logger.info(f"GOOGLE_API_KEY set: {'Yes' if settings.GOOGLE_API_KEY else 'No'}")
    if settings.GOOGLE_API_KEY:
        logger.info(f"GOOGLE_API_KEY first 10 chars: {settings.GOOGLE_API_KEY[:10]}...")
    logger.info(f"GEMINI_MODEL: {settings.GEMINI_MODEL}")

    # Register enabled modules
    module_config = get_module_config()
    for module_name, config in module_config.items():
        service = ServiceInfo(
            name=module_name,
            version=config.get("version", "1.0.0"),
            enabled=config.get("enabled", False),
            health_endpoint=f"/health/{module_name}",
            base_path=f"{settings.API_V1_STR}/{module_name}",
            description=f"{module_name.capitalize()} module"
        )
        registry.register_service(service)

    app.state.neo4j_driver = get_driver()

    # Create admin user if no users exist
    try:
        async with app.state.neo4j_driver.session() as session:
            existing_users = await session.run("MATCH (u:User) RETURN COUNT(u) as count")
            user_count = (await existing_users.single())["count"]

            if user_count == 0:
                logger.warning("No users found in database!")
                logger.warning("Use CLI to create user: python create_user.py create admin admin@pwnflow.local")
                logger.warning("Registration is disabled by default for security")
    except Exception as e:
        logger.error(f"Failed to create admin user: {e}")

    yield
    # Shutdown
    await close_driver()
    await close_redis()

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        version="2.0.0-modular",
        description="Pwnflow API - Modular Architecture",
        lifespan=lifespan
    )

    # Initialize registry
    registry.init_app(app)

    # CORS middleware
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Add custom exception handler for validation errors
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    # Core routers (always enabled)
    app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
    app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects")

    # Conditional module loading
    if is_module_enabled("templates"):
        app.include_router(templates.router, prefix=f"{settings.API_V1_STR}/templates")

    if is_module_enabled("ai"):
        app.include_router(ai_generation.router, prefix=f"{settings.API_V1_STR}", tags=["ai-generation"])

    if is_module_enabled("export"):
        app.include_router(exports.router, prefix=f"{settings.API_V1_STR}/exports")
        app.include_router(legacy_import.router, prefix=f"{settings.API_V1_STR}", tags=["legacy-import"])

    app.include_router(category_tags.router, prefix=f"{settings.API_V1_STR}/category-tags", tags=["category-tags"])

    # WebSocket router (not under API version prefix)
    app.include_router(websocket.router, tags=["websocket"])

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "version": "2.0.0-modular",
            "modules": registry.get_health_status()
        }

    # Module discovery endpoint
    @app.get(f"{settings.API_V1_STR}/modules")
    async def list_modules():
        return {
            "modules": [
                {
                    "name": service.name,
                    "version": service.version,
                    "enabled": service.enabled,
                    "path": service.base_path
                }
                for service in registry.list_services()
            ]
        }

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main_modular:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        reload_dirs=["./"],
        log_level="info"
    )