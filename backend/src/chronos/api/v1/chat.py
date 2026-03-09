import uuid

import orjson
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from chronos.api.deps import DB
from chronos.models.incident import IncidentMessage, MessageRole
from chronos.schemas.chat import ChatCompletionRequest, ChatSendRequest
from chronos.services import chat_service, completions_service, execution_service, incident_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/completions")
async def chat_completions(db: DB, request: ChatCompletionRequest):
    """OpenAI-compatible chat completions endpoint."""
    incident = await incident_service.get_incident(db, request.incident_id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if request.stream:
        return StreamingResponse(
            completions_service.stream_chat_completion(db, request),
            media_type="text/event-stream",
        )

    response = await completions_service.non_stream_chat_completion(db, request)
    return response


@router.get("/stream/{incident_id}")
async def stream(incident_id: uuid.UUID):
    """SSE endpoint. Multiple clients can subscribe to the same incident."""

    async def event_generator():
        async for event in chat_service.subscribe_events(incident_id):
            yield f"event: {event['event']}\ndata: {orjson.dumps(event['data']).decode()}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send(db: DB, data: ChatSendRequest):
    """Send a message. If agent is paused (interrupt), this resumes it."""
    incident = await incident_service.get_incident(db, data.incident_id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    message = IncidentMessage(
        incident_id=data.incident_id,
        role=MessageRole.user,
        content=data.content,
    )
    db.add(message)
    await db.commit()

    await chat_service.publish_event(
        data.incident_id, "user_message", {"content": data.content}
    )

    resumed = await execution_service.resume_agent(data.incident_id, data.content)

    return {"status": "resumed" if resumed else "sent"}


@router.post("/trigger/{incident_id}", status_code=status.HTTP_202_ACCEPTED)
async def trigger(db: DB, incident_id: uuid.UUID):
    """Manually start agent execution for an incident."""
    incident = await incident_service.get_incident(db, incident_id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if execution_service.is_running(incident_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Agent already running")

    await execution_service.start_agent(
        incident_id,
        execution_service.build_initial_state(incident),
    )

    return {"status": "triggered", "incident_id": str(incident_id)}


@router.post("/cancel/{incident_id}", status_code=status.HTTP_200_OK)
async def cancel(incident_id: uuid.UUID):
    """Cancel a running agent."""
    cancelled = await execution_service.cancel_agent(incident_id)
    if not cancelled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No running agent for this incident")
    return {"status": "cancelled"}
