import uuid
from datetime import datetime

from pydantic import BaseModel

from chronos.models.incident import IncidentStatus, ProcessingMode, Severity


class IncidentCreate(BaseModel):
    title: str
    description: str | None = None
    source: str = "manual"
    source_id: str | None = None
    severity: Severity = Severity.medium
    category: str | None = None
    service_id: uuid.UUID | None = None
    environment_id: uuid.UUID | None = None
    metadata_: dict | None = None


class IncidentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    severity: Severity | None = None
    status: IncidentStatus | None = None
    category: str | None = None
    assigned_to_id: uuid.UUID | None = None


class IncidentResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    source: str
    source_id: str | None
    severity: Severity
    status: IncidentStatus
    processing_mode: ProcessingMode | None
    category: str | None
    service_id: uuid.UUID | None
    environment_id: uuid.UUID | None
    thread_id: str | None
    metadata_: dict | None
    assigned_to_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IncidentList(BaseModel):
    items: list[IncidentResponse]
    total: int
