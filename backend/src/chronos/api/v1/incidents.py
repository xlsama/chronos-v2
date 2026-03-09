import uuid

from fastapi import APIRouter, HTTPException, Query, status

from chronos.api.deps import DB
from chronos.models.incident import IncidentStatus, Severity
from chronos.schemas.incident import IncidentCreate, IncidentList, IncidentResponse, IncidentUpdate
from chronos.services import incident_service

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create(db: DB, data: IncidentCreate):
    return await incident_service.create_incident(db, data)


@router.get("", response_model=IncidentList)
async def list_all(
    db: DB,
    status: IncidentStatus | None = None,
    severity: Severity | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    items, total = await incident_service.list_incidents(
        db, status=status, severity=severity, offset=offset, limit=limit
    )
    return IncidentList(items=items, total=total)


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_one(db: DB, incident_id: uuid.UUID):
    incident = await incident_service.get_incident(db, incident_id)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update(db: DB, incident_id: uuid.UUID, data: IncidentUpdate):
    incident = await incident_service.update_incident(db, incident_id, data)
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident
