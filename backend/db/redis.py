import redis.asyncio as redis
from typing import Optional
import os
import time
import logging
from core.config import settings

logger = logging.getLogger(__name__)

# Redis client instance
redis_client: Optional[redis.Redis] = None

async def get_redis_client() -> redis.Redis:
    """Get or create Redis client"""
    global redis_client
    if not redis_client:
        redis_client = redis.from_url(
            settings.REDIS_URL or "redis://localhost:6379",
            encoding="utf-8",
            decode_responses=True
        )
    return redis_client

async def close_redis():
    """Close Redis connection"""
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None

async def blacklist_token(jti: str, exp_timestamp: int):
    """
    Add a token to the blacklist.
    The token will be automatically removed when it expires.
    
    Args:
        jti: JWT ID (unique identifier for the token)
        exp_timestamp: Token expiration timestamp
    """
    logger.info(f"Blacklisting token with JTI: {jti}")
    client = await get_redis_client()
    # Calculate TTL (time to live) in seconds
    ttl = exp_timestamp - int(time.time())
    if ttl > 0:
        # Store in Redis with expiration
        key = f"blacklist:{jti}"
        await client.setex(key, ttl, "1")
        logger.info(f"Token {jti} blacklisted with TTL: {ttl} seconds")
    else:
        logger.warning(f"Token {jti} already expired, not blacklisting")

async def is_token_blacklisted(jti: str) -> bool:
    """Check if a token is blacklisted"""
    logger.debug(f"Checking if token {jti} is blacklisted")
    client = await get_redis_client()
    exists = await client.exists(f"blacklist:{jti}") > 0
    logger.debug(f"Token {jti} blacklisted: {exists}")
    return exists