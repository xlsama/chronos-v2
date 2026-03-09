import time
import uuid
from collections.abc import AsyncGenerator

import orjson
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chronos.core.database import async_session_factory
from chronos.core.redis import redis_client
from chronos.models.incident import Incident, IncidentMessage, MessageRole
from chronos.schemas.chat import ChatCompletionRequest, ContentPartText
from chronos.services import chat_service, execution_service, incident_service, llm_service


def _build_incident_system_prompt(incident: Incident, recent_messages: list[IncidentMessage]) -> str:
    parts = [
        "你是 Chronos AI 助手，正在协助处理一个事件。",
        f"事件标题: {incident.title}",
    ]
    if incident.description:
        parts.append(f"事件描述: {incident.description}")
    parts.append(f"严重度: {incident.severity.value}")
    parts.append(f"状态: {incident.status.value}")

    if recent_messages:
        parts.append("\n最近的对话记录:")
        for msg in recent_messages[-10:]:
            parts.append(f"[{msg.role.value}]: {msg.content}")

    return "\n".join(parts)


def _extract_user_text(request: ChatCompletionRequest) -> str:
    for msg in reversed(request.messages):
        if msg.role == "user":
            if isinstance(msg.content, str):
                return msg.content
            return " ".join(p.text for p in msg.content if isinstance(p, ContentPartText))
    return ""


def _extract_user_content_parts(request: ChatCompletionRequest) -> list | None:
    for msg in reversed(request.messages):
        if msg.role == "user" and isinstance(msg.content, list):
            return [p.model_dump() for p in msg.content]
    return None


async def _get_recent_messages(incident_id: uuid.UUID) -> list[IncidentMessage]:
    async with async_session_factory() as db:
        result = await db.execute(
            select(IncidentMessage)
            .where(IncidentMessage.incident_id == incident_id)
            .order_by(IncidentMessage.created_at.desc())
            .limit(20)
        )
        messages = list(result.scalars().all())
        messages.reverse()
        return messages


async def _save_user_message(
    incident_id: uuid.UUID,
    content: str,
    content_parts: list | None = None,
) -> None:
    async with async_session_factory() as db:
        msg = IncidentMessage(
            incident_id=incident_id,
            role=MessageRole.user,
            content=content,
            content_parts=content_parts,
        )
        db.add(msg)
        await db.commit()


async def _save_assistant_message(incident_id: uuid.UUID, content: str) -> None:
    async with async_session_factory() as db:
        msg = IncidentMessage(
            incident_id=incident_id,
            role=MessageRole.assistant,
            content=content,
        )
        db.add(msg)
        await db.commit()


def _make_sse_line(
    chunk_id: str,
    model: str,
    created: int,
    *,
    content: str | None = None,
    role: str | None = None,
    finish_reason: str | None = None,
) -> str:
    delta: dict = {}
    if role:
        delta["role"] = role
    if content:
        delta["content"] = content
    chunk = {
        "id": chunk_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }
    return f"data: {orjson.dumps(chunk).decode()}\n\n"


async def _stream_direct(
    db: AsyncSession,
    request: ChatCompletionRequest,
    incident: Incident,
) -> AsyncGenerator[str, None]:
    client, model_id = await llm_service.get_openai_client(db)

    # Build messages: system prompt + user messages
    recent_messages = await _get_recent_messages(incident.id)
    system_prompt = _build_incident_system_prompt(incident, recent_messages)

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        if msg.role != "system":
            messages.append(msg.model_dump())

    # Save user message
    user_text = _extract_user_text(request)
    await _save_user_message(incident.id, user_text, _extract_user_content_parts(request))
    await chat_service.publish_event(incident.id, "user_message", {"content": user_text})

    # Stream from OpenAI-compatible API — proxy chunks directly
    stream = await client.chat.completions.create(
        model=model_id,
        messages=messages,
        stream=True,
    )

    full_content = ""
    async for chunk in stream:
        # Proxy the chunk as-is
        yield f"data: {chunk.model_dump_json()}\n\n"

        # Extract content for DB save + Redis publish
        if chunk.choices and chunk.choices[0].delta.content:
            token = chunk.choices[0].delta.content
            full_content += token
            await chat_service.publish_event(incident.id, "token", {"content": token})

    yield "data: [DONE]\n\n"
    await _save_assistant_message(incident.id, full_content)


async def _stream_agent_resume(
    request: ChatCompletionRequest,
    incident: Incident,
) -> AsyncGenerator[str, None]:
    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    model = request.model or "default"
    created = int(time.time())
    user_text = _extract_user_text(request)

    await _save_user_message(incident.id, user_text)
    await chat_service.publish_event(incident.id, "user_message", {"content": user_text})

    # Subscribe to Redis before resuming to avoid race condition
    channel = f"incident:{incident.id}:events"
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)

    try:
        resumed = await execution_service.resume_agent(incident.id, user_text)
        if not resumed:
            yield _make_sse_line(
                chunk_id, model, created,
                content="[Agent not in interrupt state]", finish_reason="stop",
            )
            yield "data: [DONE]\n\n"
            return

        yield _make_sse_line(chunk_id, model, created, role="assistant")

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            event = orjson.loads(message["data"])
            event_type = event.get("event")
            data = event.get("data", {})

            if event_type == "token":
                token = data.get("content", "")
                if token:
                    yield _make_sse_line(chunk_id, model, created, content=token)
            elif event_type in ("complete", "interrupt", "error", "cancelled"):
                yield _make_sse_line(chunk_id, model, created, finish_reason="stop")
                yield "data: [DONE]\n\n"
                return
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()


async def stream_chat_completion(
    db: AsyncSession,
    request: ChatCompletionRequest,
) -> AsyncGenerator[str, None]:
    incident = await incident_service.get_incident(db, request.incident_id)
    if not incident:
        raise ValueError("Incident not found")

    # Check if agent is in interrupt state
    is_interrupted = False
    try:
        from chronos.agent.runtime import get_compiled_graph

        graph = get_compiled_graph()
        config = {"configurable": {"thread_id": str(incident.id)}}
        state = await graph.aget_state(config)
        is_interrupted = bool(state.interrupts)
    except Exception:
        logger.debug("Could not check agent state, using direct mode")

    if is_interrupted:
        async for chunk in _stream_agent_resume(request, incident):
            yield chunk
    else:
        async for chunk in _stream_direct(db, request, incident):
            yield chunk


async def non_stream_chat_completion(
    db: AsyncSession,
    request: ChatCompletionRequest,
) -> dict:
    """Collect streaming response into a single ChatCompletion response."""
    full_content = ""
    async for line in stream_chat_completion(db, request):
        if line.startswith("data: [DONE]"):
            break
        if line.startswith("data: "):
            data = orjson.loads(line[6:])
            choices = data.get("choices", [])
            if choices:
                content = choices[0].get("delta", {}).get("content")
                if content:
                    full_content += content

    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": request.model or "default",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": full_content}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
