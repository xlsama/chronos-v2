import uuid
from datetime import datetime

from pydantic import BaseModel

from chronos.models.topology import ServiceTier


class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    tier: ServiceTier = ServiceTier.tier3
    owner: str | None = None
    repository_url: str | None = None


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tier: ServiceTier | None = None
    owner: str | None = None
    repository_url: str | None = None


class ServiceResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    tier: ServiceTier
    owner: str | None
    repository_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServiceDependencyCreate(BaseModel):
    upstream_id: uuid.UUID
    downstream_id: uuid.UUID
    dependency_type: str


class ServiceDependencyResponse(BaseModel):
    id: uuid.UUID
    upstream_id: uuid.UUID
    downstream_id: uuid.UUID
    dependency_type: str

    model_config = {"from_attributes": True}


class EnvironmentCreate(BaseModel):
    name: str
    description: str | None = None


class EnvironmentResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
