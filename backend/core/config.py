from pydantic_settings import BaseSettings
from typing import List, Union, Optional

class Settings(BaseSettings):
    # API Configuration
    API_V1_STR: str
    PROJECT_NAME: str

    # Neo4j Database Configuration
    NEO4J_URI: str
    NEO4J_USER: str
    NEO4J_PASSWORD: str
    NEO4J_DATABASE: str
    
    # Redis Settings
    REDIS_URL: str

    # JWT Settings
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # AI Settings (deprecated - moved to AI microservice)
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Registration Control
    ENABLE_REGISTRATION: bool = False
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str]

    class Config:
        env_file = "../.env"  # Use root .env file
        case_sensitive = True
        # Also read from environment variables
        env_file_encoding = 'utf-8'

settings = Settings()
