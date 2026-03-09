from loguru import logger

from chronos.agent.state import IncidentState


async def plan(state: IncidentState) -> dict:
    """Generate execution plan based on skills and runbooks."""
    logger.info(f"Planning for incident: {state.get('incident_id')}")

    # TODO: Phase 2 - LLM generates plan using skill content + runbook reference
    return {
        "plan": [{"step": 1, "action": "investigate", "description": "Investigate the issue"}],
        "current_step_index": 0,
    }
