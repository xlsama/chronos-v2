from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chronos.models.incident import Incident, IncidentEvent, Severity
from chronos.schemas.webhook import WebhookPayload

SEVERITY_MAP = {
    "critical": Severity.critical,
    "high": Severity.high,
    "warning": Severity.medium,
    "medium": Severity.medium,
    "low": Severity.low,
    "info": Severity.low,
}


async def ingest_generic_webhook(db: AsyncSession, payload: WebhookPayload) -> Incident:
    if payload.source_id:
        existing = await db.execute(
            select(Incident).where(Incident.source == payload.source, Incident.source_id == payload.source_id)
        )
        incident = existing.scalar_one_or_none()
        if incident is not None:
            return incident

    severity = SEVERITY_MAP.get(payload.severity or "medium", Severity.medium)

    incident = Incident(
        title=payload.title,
        description=payload.description,
        source=payload.source,
        source_id=payload.source_id,
        severity=severity,
        thread_id="pending",
        metadata_={
            "labels": payload.labels,
            "raw": payload.raw,
            "service": payload.service,
            "environment": payload.environment,
        },
    )
    db.add(incident)
    await db.flush()
    incident.thread_id = str(incident.id)

    event = IncidentEvent(
        incident_id=incident.id,
        event_type="created",
        data={"source": payload.source, "via": "webhook"},
    )
    db.add(event)
    await db.commit()
    await db.refresh(incident)
    return incident
