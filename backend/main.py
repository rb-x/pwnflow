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
    logger.info("Starting Pwnflow Backend")
    logger.info(f"GOOGLE_API_KEY set: {'Yes' if settings.GOOGLE_API_KEY else 'No'}")
    if settings.GOOGLE_API_KEY:
        logger.info(f"GOOGLE_API_KEY first 10 chars: {settings.GOOGLE_API_KEY[:10]}...")
    logger.info(f"GEMINI_MODEL: {settings.GEMINI_MODEL}")
    
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
    
    # Ensure database schema exists (eliminates Neo4j warnings)
    # Disabled by default - uncomment if you get Neo4j label warnings
    # try:
    #     from ensure_schema_improved import ensure_schema_improved
    #     await ensure_schema_improved()
    #     logger.info("Database schema verified")
    # except Exception as e:
    #     logger.debug(f"Schema verification skipped: {e}")
    
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
        version="1.1.0",
        description="Pwnflow API - A mind mapping platform for cybersecurity professionals",
        lifespan=lifespan
    )

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

    # Routers
    app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
    app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects")
    app.include_router(templates.router, prefix=f"{settings.API_V1_STR}/templates")
    app.include_router(category_tags.router, prefix=f"{settings.API_V1_STR}/category-tags", tags=["category-tags"])
    app.include_router(ai_generation.router, prefix=f"{settings.API_V1_STR}", tags=["ai-generation"])
    app.include_router(legacy_import.router, prefix=f"{settings.API_V1_STR}", tags=["legacy-import"])
    app.include_router(exports.router, prefix=f"{settings.API_V1_STR}/exports")
    
    # WebSocket router (not under API version prefix)
    app.include_router(websocket.router, tags=["websocket"])
    
    @app.get(f"{settings.API_V1_STR}/health", tags=["health"])
    async def health_check():
        """Health check endpoint to verify the service is running"""
        health_status = {
            "status": "healthy",
            "service": "pwnflow-backend",
            "checks": {}
        }
        
        try:
            driver = app.state.neo4j_driver
            with driver.session() as session:
                result = session.run("RETURN 1 as test")
                result.single()
            health_status["checks"]["neo4j"] = "healthy"
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["checks"]["neo4j"] = f"unhealthy: {str(e)}"
        
        return health_status
    
    return app

app = create_app() 