from fastapi import APIRouter, status

from chronos.api.deps import DB
from chronos.schemas.incident import IncidentResponse
from chronos.schemas.webhook import WebhookPayload
from chronos.services import execution_service, webhook_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/ingest", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def ingest(db: DB, payload: WebhookPayload):
    incident = await webhook_service.ingest_generic_webhook(db, payload)

    if not execution_service.is_running(incident.id):
        await execution_service.start_agent(
            incident.id,
            execution_service.build_initial_state(
                incident,
                service_name=payload.service,
                environment=payload.environment,
            ),
        )

    return incident
