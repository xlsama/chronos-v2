from loguru import logger

from chronos.agent.state import IncidentState


async def classify(state: IncidentState) -> dict:
    """LLM-based classification of incident severity and category."""
    logger.info(f"Classifying incident: {state.get('incident_id')}")

    # TODO: Phase 2 - Use LLM to classify
    return {
        "category": state.get("category", "unknown"),
        "severity": state.get("severity", "medium"),
    }
