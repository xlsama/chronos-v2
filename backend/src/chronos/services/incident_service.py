import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from chronos.models.incident import Incident, IncidentEvent, IncidentStatus, Severity
from chronos.schemas.incident import IncidentCreate, IncidentUpdate


async def create_incident(db: AsyncSession, data: IncidentCreate) -> Incident:
    incident = Incident(
        title=data.title,
        description=data.description,
        source=data.source,
        source_id=data.source_id,
        severity=data.severity,
        category=data.category,
        service_id=data.service_id,
        environment_id=data.environment_id,
        metadata_=data.metadata_,
    )
    db.add(incident)
    await db.flush()

    event = IncidentEvent(incident_id=incident.id, event_type="created", data={"source": data.source})
    db.add(event)
    await db.commit()
    await db.refresh(incident)
    return incident


async def get_incident(db: AsyncSession, incident_id: uuid.UUID) -> Incident | None:
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    return result.scalar_one_or_none()


async def list_incidents(
    db: AsyncSession,
    *,
    status: IncidentStatus | None = None,
    severity: Severity | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Incident], int]:
    query = select(Incident)
    count_query = select(func.count()).select_from(Incident)

    if status:
        query = query.where(Incident.status == status)
        count_query = count_query.where(Incident.status == status)
    if severity:
        query = query.where(Incident.severity == severity)
        count_query = count_query.where(Incident.severity == severity)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.order_by(Incident.created_at.desc()).offset(offset).limit(limit))
    return list(result.scalars().all()), total


async def update_incident(db: AsyncSession, incident_id: uuid.UUID, data: IncidentUpdate) -> Incident | None:
    incident = await get_incident(db, incident_id)
    if not incident:
        return None

    update_data = data.model_dump(exclude_unset=True)
    old_status = incident.status

    for field, value in update_data.items():
        setattr(incident, field, value)

    if "status" in update_data and update_data["status"] != old_status:
        event = IncidentEvent(
            incident_id=incident.id,
            event_type="status_changed",
            data={"old": old_status, "new": update_data["status"]},
        )
        db.add(event)

    await db.commit()
    await db.refresh(incident)
    return incident
