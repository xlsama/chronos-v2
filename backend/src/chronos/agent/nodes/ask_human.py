from langchain_core.messages import HumanMessage
from langgraph.types import interrupt
from loguru import logger

from chronos.agent.state import IncidentState


async def ask_human(state: IncidentState) -> dict:
    """Interrupt execution and wait for human input."""
    logger.info(f"Asking human for incident: {state.get('incident_id')}")

    human_input = interrupt(
        {
            "question": "Agent needs your input to proceed.",
            "incident_id": state.get("incident_id"),
            "context": state.get("incident_summary", ""),
        }
    )

    return {
        "messages": [HumanMessage(content=human_input)],
    }
