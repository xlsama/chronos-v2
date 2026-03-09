from loguru import logger

from chronos.agent.state import IncidentState


async def decide_mode(state: IncidentState) -> dict:
    """Decide between automatic and semi-automatic processing mode."""
    logger.info(f"Deciding mode for incident: {state.get('incident_id')}")

    severity = state.get("severity", "medium")
    has_runbook = state.get("selected_runbook") is not None

    # Rules-based: critical severity or no runbook → semi-auto
    if severity == "critical" or not has_runbook:
        mode = "semi_automatic"
        confidence = 0.3
    else:
        mode = "automatic"
        confidence = 0.8

    # TODO: Phase 2 - LLM-assisted mode decision

    return {
        "processing_mode": mode,
        "confidence_score": confidence,
    }
