from loguru import logger

from chronos.agent.state import IncidentState


async def enrich_context(state: IncidentState) -> dict:
    """Enrich incident with topology and environment context."""
    logger.info(f"Enriching context for incident: {state.get('incident_id')}")

    # TODO: Phase 2 - Query topology DB, collect logs/metrics via bash tool
    return {
        "context": {"enriched": True},
        "topology": [],
    }
