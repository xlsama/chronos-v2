import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from chronos.api.deps import DB
from chronos.models.topology import Environment, Service, ServiceDependency
from chronos.schemas.topology import (
    EnvironmentCreate,
    EnvironmentResponse,
    ServiceCreate,
    ServiceDependencyCreate,
    ServiceDependencyResponse,
    ServiceResponse,
    ServiceUpdate,
)

router = APIRouter(tags=["topology"])

# --- Services ---

services_router = APIRouter(prefix="/services")


@services_router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(db: DB, data: ServiceCreate):
    service = Service(**data.model_dump())
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service


@services_router.get("", response_model=list[ServiceResponse])
async def list_services(db: DB, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
    result = await db.execute(select(Service).order_by(Service.name).offset(offset).limit(limit))
    return list(result.scalars().all())


@services_router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(db: DB, service_id: uuid.UUID):
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


@services_router.patch("/{service_id}", response_model=ServiceResponse)
async def update_service(db: DB, service_id: uuid.UUID, data: ServiceUpdate):
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(service, field, value)

    await db.commit()
    await db.refresh(service)
    return service


@services_router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(db: DB, service_id: uuid.UUID):
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    await db.delete(service)
    await db.commit()


@services_router.post("/dependencies", response_model=ServiceDependencyResponse, status_code=status.HTTP_201_CREATED)
async def add_dependency(db: DB, data: ServiceDependencyCreate):
    dep = ServiceDependency(**data.model_dump())
    db.add(dep)
    await db.commit()
    await db.refresh(dep)
    return dep


@services_router.get("/{service_id}/dependencies", response_model=list[ServiceDependencyResponse])
async def get_dependencies(db: DB, service_id: uuid.UUID):
    result = await db.execute(
        select(ServiceDependency).where(
            (ServiceDependency.upstream_id == service_id) | (ServiceDependency.downstream_id == service_id)
        )
    )
    return list(result.scalars().all())


router.include_router(services_router)

# --- Environments ---

env_router = APIRouter(prefix="/environments")


@env_router.post("", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
async def create_environment(db: DB, data: EnvironmentCreate):
    env = Environment(**data.model_dump())
    db.add(env)
    await db.commit()
    await db.refresh(env)
    return env


@env_router.get("", response_model=list[EnvironmentResponse])
async def list_environments(db: DB):
    result = await db.execute(select(Environment).order_by(Environment.name))
    return list(result.scalars().all())


router.include_router(env_router)
