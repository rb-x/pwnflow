from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from neo4j import AsyncSession
import logging

from core.config import settings
from db.database import get_session
from db.redis import is_token_blacklisted
from schemas.user import User
from crud import user as user_crud

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login/access-token")

async def get_current_user(
    session: AsyncSession = Depends(get_session), token: str = Depends(oauth2_scheme)
) -> User:
    logger.info(f"Authenticating user with token: {token[:20]}...")
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        logger.info(f"Token payload: {payload}")
        token_data = payload.get("sub")
        jti = payload.get("jti")
        
        if token_data is None:
            logger.error("No 'sub' field in token payload")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Could not validate credentials",
            )
        
        # All tokens must have JTI
        if not jti:
            logger.error("Token missing JTI")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid token",
            )
        
        # Check if token is blacklisted
        if await is_token_blacklisted(jti):
            logger.error(f"Token {jti} is blacklisted")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
            )
            
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    
    logger.info(f"Looking up user with ID: {token_data}")
    # Convert string ID to UUID
    from uuid import UUID
    user_id = UUID(token_data)
    user = await user_crud.get_user(session=session, user_id=user_id)
    
    if not user:
        logger.error(f"User not found with ID: {token_data}")
        raise HTTPException(status_code=404, detail="User not found")
    
    return user
