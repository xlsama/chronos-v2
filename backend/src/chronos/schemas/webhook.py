from pydantic import BaseModel


class WebhookPayload(BaseModel):
    source: str = "generic"
    source_id: str | None = None
    title: str
    description: str | None = None
    severity: str | None = None
    service: str | None = None
    environment: str | None = None
    labels: dict[str, str] | None = None
    raw: dict | None = None
