from loguru import logger

from chronos.agent.state import IncidentState


async def replan(state: IncidentState) -> dict:
    """Adjust plan based on execution results."""
    logger.info(f"Replanning for incident: {state.get('incident_id')}")

    # TODO: Phase 2 - LLM re-evaluates and adjusts plan
    return {
        "plan": [{"step": 1, "action": "retry", "description": "Retry with adjusted approach"}],
        "current_step_index": 0,
    }
