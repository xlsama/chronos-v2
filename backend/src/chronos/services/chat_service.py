import uuid

import orjson
from loguru import logger

from chronos.core.redis import redis_client


def _channel(incident_id: uuid.UUID) -> str:
    return f"incident:{incident_id}:events"


async def publish_event(incident_id: uuid.UUID, event_type: str, data: dict) -> None:
    channel = _channel(incident_id)
    payload = orjson.dumps({"event": event_type, "data": data}).decode()
    await redis_client.publish(channel, payload)
    logger.debug(f"Published {event_type} to {channel}")


async def subscribe_events(incident_id: uuid.UUID):
    channel = _channel(incident_id)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield orjson.loads(message["data"])
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
