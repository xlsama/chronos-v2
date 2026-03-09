import uuid

from pydantic import BaseModel


class ChatSendRequest(BaseModel):
    incident_id: uuid.UUID
    content: str


class SSEEvent(BaseModel):
    event: str
    data: dict
