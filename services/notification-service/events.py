import asyncio
import json
import logging
from typing import AsyncGenerator

import redis.asyncio as redis

from dispatcher import dispatch_event
from settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

EVENT_CHANNEL = "pwnflow.events"


async def subscribe(channel: str = EVENT_CHANNEL) -> AsyncGenerator[dict, None]:
    client = redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)
    logger.info("Subscribed to Redis channel %s", channel)

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                payload = json.loads(message["data"])
                yield payload
            except json.JSONDecodeError as exc:
                logger.warning("Invalid JSON payload on channel %s: %s", channel, exc)
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await client.aclose()


async def run_event_loop():
    logger.info("Notification service event loop ready")
    async for payload in subscribe():
        await dispatch_event(payload)


async def start_background_task() -> asyncio.Task:
    return asyncio.create_task(run_event_loop(), name="notification-event-loop")
