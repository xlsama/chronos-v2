import operator
from typing import Annotated, Literal

from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict


class IncidentState(TypedDict, total=False):
    incident_id: str
    thread_id: str
    raw_event: dict
    incident_summary: str
    severity: str
    category: str
    service_name: str | None
    environment: str | None
    context: dict
    topology: list[dict]
    matched_skills: list[dict]
    skill_content: str | None
    matched_runbooks: list[dict]
    selected_runbook: dict | None
    processing_mode: Literal["automatic", "semi_automatic"] | None
    confidence_score: float
    plan: list[dict]
    current_step_index: int
    step_results: Annotated[list[dict], operator.add]
    messages: Annotated[list[BaseMessage], operator.add]
    observations: Annotated[list[dict], operator.add]
    final_summary: str | None
    generated_runbook: dict | None
