from langgraph.graph import END, StateGraph

from chronos.agent.nodes.ask_human import ask_human
from chronos.agent.nodes.classify import classify
from chronos.agent.nodes.decide_mode import decide_mode
from chronos.agent.nodes.enrich import enrich_context
from chronos.agent.nodes.execute import execute
from chronos.agent.nodes.finalize import finalize
from chronos.agent.nodes.ingest import ingest
from chronos.agent.nodes.observe import observe
from chronos.agent.nodes.plan import plan
from chronos.agent.nodes.replan import replan
from chronos.agent.nodes.retrieve import retrieve_runbooks
from chronos.agent.nodes.summarize import summarize
from chronos.agent.nodes.verify import verify
from chronos.agent.state import IncidentState


def route_mode(state: IncidentState) -> str:
    if state.get("processing_mode") == "automatic":
        return "plan"
    return "ask_human"


def route_observe(state: IncidentState) -> str:
    results = state.get("step_results", [])
    if not results:
        return "execute"

    last = results[-1]
    if last.get("needs_human"):
        return "ask_human"
    if last.get("needs_replan"):
        return "replan"

    plan = state.get("plan", [])
    idx = state.get("current_step_index", 0)
    if idx < len(plan):
        return "execute"

    return "verify"


def route_verify(state: IncidentState) -> str:
    results = state.get("step_results", [])
    if results and results[-1].get("verified"):
        return "summarize"
    if results and results[-1].get("needs_human"):
        return "ask_human"
    return "replan"


def route_human(state: IncidentState) -> str:
    messages = state.get("messages", [])
    if not messages:
        return "plan"

    last_msg = messages[-1]
    content = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    if "execute" in content.lower():
        return "execute"
    if "verify" in content.lower():
        return "verify"
    return "plan"


def build_graph() -> StateGraph:
    graph = StateGraph(IncidentState)

    graph.add_node("ingest", ingest)
    graph.add_node("enrich", enrich_context)
    graph.add_node("classify", classify)
    graph.add_node("retrieve", retrieve_runbooks)
    graph.add_node("decide_mode", decide_mode)
    graph.add_node("plan", plan)
    graph.add_node("execute", execute)
    graph.add_node("observe", observe)
    graph.add_node("ask_human", ask_human)
    graph.add_node("replan", replan)
    graph.add_node("verify", verify)
    graph.add_node("summarize", summarize)
    graph.add_node("finalize", finalize)

    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "enrich")
    graph.add_edge("enrich", "classify")
    graph.add_edge("classify", "retrieve")
    graph.add_edge("retrieve", "decide_mode")
    graph.add_conditional_edges("decide_mode", route_mode, {"plan": "plan", "ask_human": "ask_human"})
    graph.add_edge("plan", "execute")
    graph.add_edge("execute", "observe")
    graph.add_conditional_edges(
        "observe",
        route_observe,
        {"execute": "execute", "ask_human": "ask_human", "replan": "replan", "verify": "verify"},
    )
    graph.add_conditional_edges(
        "ask_human",
        route_human,
        {"plan": "plan", "execute": "execute", "verify": "verify"},
    )
    graph.add_edge("replan", "execute")
    graph.add_conditional_edges(
        "verify", route_verify, {"summarize": "summarize", "ask_human": "ask_human", "replan": "replan"}
    )
    graph.add_edge("summarize", "finalize")
    graph.add_edge("finalize", END)

    return graph
