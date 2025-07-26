from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from neo4j import AsyncDriver, AsyncSession
from pydantic import ValidationError

from core.config import settings
from core import security
from schemas.token import TokenPayload
from schemas.user import User
from crud import user as user_crud
from db.database import get_driver

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login/access-token"
)

async def get_session() -> AsyncSession:
    """
    Provides a Neo4j session for database operations.
    """
    driver = get_driver()
    # Don't specify database parameter - use default database
    async with driver.session() as session:
        yield session

async def get_current_user(
    session: AsyncSession = Depends(get_session),
    token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = await user_crud.get_user(session, user_id=token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user.dict()) 