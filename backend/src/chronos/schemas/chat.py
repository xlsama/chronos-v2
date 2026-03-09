import uuid
from typing import Literal

from pydantic import BaseModel

# --- Existing types ---


class ChatSendRequest(BaseModel):
    incident_id: uuid.UUID
    content: str


class SSEEvent(BaseModel):
    event: str
    data: dict


# --- OpenAI-compatible request types ---


class ContentPartText(BaseModel):
    type: Literal["text"] = "text"
    text: str


class ImageURL(BaseModel):
    url: str  # data:image/png;base64,... or https://...
    detail: Literal["auto", "low", "high"] = "auto"


class ContentPartImage(BaseModel):
    type: Literal["image_url"] = "image_url"
    image_url: ImageURL


ContentPart = ContentPartText | ContentPartImage


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str | list[ContentPart]


class ChatCompletionRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None
    stream: bool = True
    temperature: float | None = None
    max_tokens: int | None = None
    incident_id: uuid.UUID
