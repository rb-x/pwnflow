from typing import Optional
from uuid import UUID
from neo4j import AsyncSession

from core.security import get_password_hash, verify_password
from schemas.user import UserCreate, UserInDB, UserUpdate

async def get_user_by_username(session: AsyncSession, *, username: str) -> Optional[UserInDB]:
    query = "MATCH (u:User {username: $username}) RETURN u"
    result = await session.run(query, username=username)
    record = await result.single()
    if record:
        return UserInDB(**record["u"])
    return None

async def get_user(session: AsyncSession, *, user_id: UUID) -> Optional[UserInDB]:
    query = "MATCH (u:User {id: $id}) RETURN u"
    result = await session.run(query, id=str(user_id))
    record = await result.single()
    if record:
        return UserInDB(**record["u"])
    return None 

async def create_user(session: AsyncSession, *, user_in: UserCreate) -> UserInDB:
    hashed_password = get_password_hash(user_in.password)
    user = UserInDB(**user_in.dict(), hashed_password=hashed_password)
    
    query = """
    CREATE (u:User {
        id: $id,
        username: $username,
        email: $email,
        hashed_password: $hashed_password,
        is_active: $is_active
    })
    RETURN u
    """
    await session.run(
        query,
        id=str(user.id),
        username=user.username,
        email=user.email,
        hashed_password=user.hashed_password,
        is_active=user.is_active
    )
    return user

async def authenticate_user(session: AsyncSession, *, username: str, password: str) -> Optional[UserInDB]:
    user = await get_user_by_username(session, username=username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

async def update_user(session: AsyncSession, *, user_id: UUID, user_update: UserUpdate) -> Optional[UserInDB]:
    # Build SET clause dynamically based on provided fields
    set_clauses = []
    params = {"user_id": str(user_id)}
    
    if user_update.username is not None:
        set_clauses.append("u.username = $username")
        params["username"] = user_update.username
    
    if user_update.email is not None:
        set_clauses.append("u.email = $email")
        params["email"] = user_update.email
    
    if user_update.password is not None:
        set_clauses.append("u.hashed_password = $hashed_password")
        params["hashed_password"] = get_password_hash(user_update.password)
    
    if not set_clauses:
        # No fields to update
        return await get_user(session, user_id=user_id)
    
    query = f"""
    MATCH (u:User {{id: $user_id}})
    SET {', '.join(set_clauses)}
    RETURN u
    """
    
    result = await session.run(query, **params)
    record = await result.single()
    
    if record:
        return UserInDB(**record["u"])
    return None