from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from typing import Any, Optional
from neo4j import AsyncSession
from jose import jwt

from core import security
from core.config import settings
from schemas.user import UserCreate, User, UserUpdate
from schemas.token import Token
from crud import user as user_crud
from db.redis import blacklist_token
from api.v1.dependencies import get_session
from api.dependencies import get_current_user, oauth2_scheme


router = APIRouter()

async def blacklist_current_token(token: str = Depends(oauth2_scheme)):
    """Extract token info and blacklist it"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            await blacklist_token(jti, exp)
    except Exception:
        # If we can't decode the token, we can't blacklist it
        pass

@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Create new user.
    """
    user = await user_crud.get_user_by_username(session, username=user_in.username)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = await user_crud.create_user(session, user_in=user_in)
    return user

@router.post("/login/access-token", response_model=Token)
async def login_for_access_token(
    session: AsyncSession = Depends(get_session),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = await user_crud.authenticate_user(
        session, username=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        str(user.id), expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }

@router.get("/me", response_model=User)
async def read_users_me(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get current user info.
    """
    return current_user

@router.put("/me", response_model=User)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    token: str = Depends(oauth2_scheme)
) -> Any:
    """
    Update current user.
    If email or password is changed, the token will be blacklisted and user must re-login.
    """
    # Check if email or password is being changed
    email_changed = user_update.email and user_update.email != current_user.email
    password_changed = user_update.password is not None
    
    # Update user
    updated_user = await user_crud.update_user(
        session, 
        user_id=current_user.id, 
        user_update=user_update
    )
    
    if not updated_user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    
    # If email or password changed, blacklist the token
    if email_changed or password_changed:
        await blacklist_current_token(token)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credentials changed. Please login again with your new credentials.",
            headers={"X-Credentials-Changed": "true"}
        )
    
    return updated_user

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user)
) -> None:
    """
    Logout current user by blacklisting their token.
    """
    await blacklist_current_token(token)