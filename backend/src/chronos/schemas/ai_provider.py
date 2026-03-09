import uuid
from datetime import datetime

from pydantic import BaseModel

from chronos.models.ai_provider import ModelType, ProviderType

# --- AI Provider ---


class AIProviderCreate(BaseModel):
    name: str
    provider_type: ProviderType
    base_url: str | None = None
    api_key: str | None = None
    is_enabled: bool = True
    is_default: bool = False
    config: dict = {}


class AIProviderUpdate(BaseModel):
    name: str | None = None
    provider_type: ProviderType | None = None
    base_url: str | None = None
    api_key: str | None = None
    is_enabled: bool | None = None
    is_default: bool | None = None
    config: dict | None = None


class AIProviderResponse(BaseModel):
    id: uuid.UUID
    name: str
    provider_type: ProviderType
    base_url: str | None
    has_api_key: bool
    is_enabled: bool
    is_default: bool
    config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIProviderList(BaseModel):
    items: list[AIProviderResponse]
    total: int


# --- AI Model ---


class AIModelCreate(BaseModel):
    provider_id: uuid.UUID
    name: str
    model_id: str
    model_type: ModelType = ModelType.chat
    is_default: bool = False
    config: dict = {}


class AIModelUpdate(BaseModel):
    name: str | None = None
    model_id: str | None = None
    model_type: ModelType | None = None
    is_default: bool | None = None
    config: dict | None = None


class AIModelResponse(BaseModel):
    id: uuid.UUID
    provider_id: uuid.UUID
    name: str
    model_id: str
    model_type: ModelType
    is_default: bool
    config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIModelList(BaseModel):
    items: list[AIModelResponse]
    total: int
