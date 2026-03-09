from loguru import logger

from chronos.agent.state import IncidentState


async def ingest(state: IncidentState) -> dict:
    """Parse webhook payload and normalize incident fields."""
    raw = state.get("raw_event", {})
    logger.info(f"Ingesting incident: {state.get('incident_id')}")

    return {
        "incident_summary": raw.get("title", ""),
        "severity": raw.get("severity", "medium"),
        "service_name": raw.get("service"),
        "environment": raw.get("environment"),
        "context": {},
        "current_step_index": 0,
    }
