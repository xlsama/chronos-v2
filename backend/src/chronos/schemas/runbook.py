import uuid
from datetime import datetime

from pydantic import BaseModel

from chronos.models.runbook import ActionType, RiskLevel


class RunbookStepCreate(BaseModel):
    order: int
    title: str
    description: str | None = None
    action_type: ActionType
    action_config: dict | None = None
    risk_level: RiskLevel = RiskLevel.low
    requires_approval: bool = False


class RunbookCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    content: str
    steps: list[RunbookStepCreate] | None = None


class RunbookUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None


class RunbookStepResponse(BaseModel):
    id: uuid.UUID
    order: int
    title: str
    description: str | None
    action_type: ActionType
    action_config: dict | None
    risk_level: RiskLevel
    requires_approval: bool

    model_config = {"from_attributes": True}


class RunbookVersionResponse(BaseModel):
    id: uuid.UUID
    version: int
    content: str
    changelog: str | None
    created_at: datetime
    steps: list[RunbookStepResponse]

    model_config = {"from_attributes": True}


class RunbookResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    category: str | None
    tags: list | None
    is_auto_generated: bool
    source_incident_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RunbookList(BaseModel):
    items: list[RunbookResponse]
    total: int
