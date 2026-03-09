from loguru import logger

from chronos.agent.state import IncidentState


async def verify(state: IncidentState) -> dict:
    """Verify whether the issue has been resolved."""
    logger.info(f"Verifying resolution for incident: {state.get('incident_id')}")

    # TODO: Phase 2 - LLM verifies resolution
    return {
        "step_results": [{"verified": True, "message": "Issue resolved (stub)"}],
    }
