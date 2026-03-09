from loguru import logger

from chronos.agent.state import IncidentState


async def retrieve_runbooks(state: IncidentState) -> dict:
    """Match skills by category/tags and retrieve relevant runbooks via LLM."""
    logger.info(f"Retrieving runbooks for incident: {state.get('incident_id')}")

    # TODO: Phase 5 - Load runbook metadata, LLM match
    # TODO: Phase 6 - Match skills via SkillLoader
    return {
        "matched_skills": [],
        "skill_content": None,
        "matched_runbooks": [],
        "selected_runbook": None,
    }
