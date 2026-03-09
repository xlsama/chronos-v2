from loguru import logger

from chronos.agent.state import IncidentState


async def observe(state: IncidentState) -> dict:
    """Check execution results and decide next action."""
    logger.info(f"Observing results for incident: {state.get('incident_id')}")

    results = state.get("step_results", [])
    last = results[-1] if results else {}

    return {
        "observations": [{"step": last.get("step", 0), "result": last.get("status", "unknown")}],
    }
