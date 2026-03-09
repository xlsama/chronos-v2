from loguru import logger

from chronos.agent.state import IncidentState


async def summarize(state: IncidentState) -> dict:
    """Generate incident summary and runbook draft."""
    logger.info(f"Summarizing incident: {state.get('incident_id')}")

    # TODO: Phase 5 - LLM generates summary + runbook draft
    return {
        "final_summary": f"Incident {state.get('incident_id')} has been resolved.",
        "generated_runbook": {
            "title": f"Runbook for {state.get('category', 'unknown')} incident",
            "steps": state.get("step_results", []),
        },
    }
