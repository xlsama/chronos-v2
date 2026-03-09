import asyncio
import uuid
from typing import Any

from langgraph.types import Command
from loguru import logger
from sqlalchemy import func, select

from chronos.agent.runtime import get_compiled_graph
from chronos.core.database import async_session_factory
from chronos.models.execution import AgentExecution, ExecutionStatus, ExecutionStep
from chronos.models.incident import Incident, IncidentStatus, ProcessingMode
from chronos.services import chat_service

_running_tasks: dict[uuid.UUID, asyncio.Task] = {}


def build_initial_state(
    incident: Incident,
    *,
    service_name: str | None = None,
    environment: str | None = None,
) -> dict[str, Any]:
    metadata = incident.metadata_ or {}
    return {
        "incident_id": str(incident.id),
        "thread_id": incident.thread_id or str(incident.id),
        "raw_event": {
            "title": incident.title,
            "description": incident.description,
            "severity": incident.severity.value if incident.severity else "medium",
            "service": service_name or metadata.get("service"),
            "environment": environment or metadata.get("environment"),
        },
    }


def _graph_config(thread_id: str) -> dict[str, dict[str, str]]:
    return {"configurable": {"thread_id": thread_id}}


def _should_track_node(name: str | None) -> bool:
    return bool(name and name != "LangGraph" and not name.startswith("route_"))


def _coerce_processing_mode(value: Any) -> ProcessingMode | None:
    if value is None:
        return None
    try:
        return ProcessingMode(value)
    except ValueError:
        return None


async def _create_execution_record(incident_id: uuid.UUID, thread_id: str) -> uuid.UUID:
    async with async_session_factory() as db:
        execution = AgentExecution(incident_id=incident_id, thread_id=thread_id, status=ExecutionStatus.running)
        db.add(execution)
        await db.commit()
        await db.refresh(execution)
        return execution.id


async def _get_latest_execution(incident_id: uuid.UUID) -> AgentExecution | None:
    async with async_session_factory() as db:
        result = await db.execute(
            select(AgentExecution)
            .where(AgentExecution.incident_id == incident_id)
            .order_by(AgentExecution.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()


async def _next_step_order(execution_id: uuid.UUID) -> int:
    async with async_session_factory() as db:
        result = await db.execute(
            select(func.max(ExecutionStep.order)).where(ExecutionStep.execution_id == execution_id)
        )
        max_order = result.scalar_one()
        return (max_order or 0) + 1


async def _create_step_record(execution_id: uuid.UUID, node_name: str, order: int) -> uuid.UUID:
    async with async_session_factory() as db:
        step = ExecutionStep(
            execution_id=execution_id,
            order=order,
            node_name=node_name,
            status=ExecutionStatus.running,
        )
        db.add(step)
        await db.commit()
        await db.refresh(step)
        return step.id


async def _update_step_record(
    step_id: uuid.UUID,
    *,
    status: ExecutionStatus,
    output_data: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    async with async_session_factory() as db:
        result = await db.execute(select(ExecutionStep).where(ExecutionStep.id == step_id))
        step = result.scalar_one_or_none()
        if step is None:
            return
        step.status = status
        if output_data is not None:
            step.output_data = output_data
        if error is not None:
            step.error = error
        await db.commit()


async def _update_execution_record(
    execution_id: uuid.UUID,
    *,
    status: ExecutionStatus,
    summary: str | None = None,
) -> None:
    async with async_session_factory() as db:
        result = await db.execute(select(AgentExecution).where(AgentExecution.id == execution_id))
        execution = result.scalar_one_or_none()
        if execution is None:
            return
        execution.status = status
        if summary is not None:
            execution.summary = summary
        await db.commit()


async def _update_incident_record(
    incident_id: uuid.UUID,
    *,
    status: IncidentStatus | None = None,
    processing_mode: ProcessingMode | None = None,
    thread_id: str | None = None,
) -> None:
    async with async_session_factory() as db:
        result = await db.execute(select(Incident).where(Incident.id == incident_id))
        incident = result.scalar_one_or_none()
        if incident is None:
            return
        if status is not None:
            incident.status = status
        if processing_mode is not None:
            incident.processing_mode = processing_mode
        if thread_id is not None:
            incident.thread_id = thread_id
        await db.commit()


async def _mark_active_steps(
    active_steps: dict[str, uuid.UUID],
    *,
    status: ExecutionStatus,
    error: str | None = None,
) -> None:
    for step_id in active_steps.values():
        await _update_step_record(step_id, status=status, error=error)


async def _drive_graph(
    incident_id: uuid.UUID,
    execution_id: uuid.UUID,
    graph_input: dict[str, Any] | Command,
    *,
    started_event: str,
    started_payload: dict[str, Any],
) -> None:
    graph = get_compiled_graph()
    thread_id = str(incident_id)
    config = _graph_config(thread_id)
    step_order = await _next_step_order(execution_id)
    active_steps: dict[str, uuid.UUID] = {}

    try:
        await chat_service.publish_event(incident_id, started_event, started_payload)

        async for event in graph.astream_events(graph_input, config=config, version="v2"):
            kind = event["event"]
            name = event.get("name")
            run_id = event.get("run_id")

            if kind == "on_chain_start" and _should_track_node(name) and run_id:
                step_id = await _create_step_record(execution_id, name, step_order)
                active_steps[run_id] = step_id
                step_order += 1
                await chat_service.publish_event(incident_id, "node_start", {"node": name})
            elif kind == "on_chain_end" and _should_track_node(name):
                if run_id and run_id in active_steps:
                    await _update_step_record(active_steps.pop(run_id), status=ExecutionStatus.completed)
                await chat_service.publish_event(incident_id, "node_end", {"node": name})
            elif kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    await chat_service.publish_event(incident_id, "token", {"content": chunk.content})

        state = await graph.aget_state(config)
        processing_mode = _coerce_processing_mode(
            state.values.get("processing_mode") if isinstance(state.values, dict) else None
        )
        final_summary = state.values.get("final_summary") if isinstance(state.values, dict) else None

        if state.interrupts:
            await _mark_active_steps(active_steps, status=ExecutionStatus.interrupted)
            await _update_execution_record(
                execution_id,
                status=ExecutionStatus.interrupted,
                summary=final_summary,
            )
            await _update_incident_record(
                incident_id,
                status=IncidentStatus.waiting_human,
                processing_mode=processing_mode,
                thread_id=thread_id,
            )
            await chat_service.publish_event(incident_id, "status_change", {"status": IncidentStatus.waiting_human})
            await chat_service.publish_event(
                incident_id,
                "interrupt",
                {"interrupts": [interrupt.value for interrupt in state.interrupts]},
            )
            return

        await _update_execution_record(
            execution_id,
            status=ExecutionStatus.completed,
            summary=final_summary,
        )
        await _update_incident_record(
            incident_id,
            status=IncidentStatus.resolved,
            processing_mode=processing_mode,
            thread_id=thread_id,
        )
        await chat_service.publish_event(incident_id, "status_change", {"status": IncidentStatus.resolved})
        await chat_service.publish_event(incident_id, "complete", {"incident_id": str(incident_id)})

    except asyncio.CancelledError:
        await _mark_active_steps(active_steps, status=ExecutionStatus.interrupted, error="Execution cancelled")
        await _update_execution_record(execution_id, status=ExecutionStatus.interrupted)
        await _update_incident_record(incident_id, status=IncidentStatus.waiting_human, thread_id=thread_id)
        raise
    except Exception as exc:
        error = str(exc)
        logger.exception(f"Agent failed for incident {incident_id}")
        await _mark_active_steps(active_steps, status=ExecutionStatus.failed, error=error)
        await _update_execution_record(execution_id, status=ExecutionStatus.failed, summary=error)
        await chat_service.publish_event(incident_id, "error", {"error": error})
    finally:
        _running_tasks.pop(incident_id, None)


async def start_agent(incident_id: uuid.UUID, initial_state: dict[str, Any]) -> None:
    if incident_id in _running_tasks and not _running_tasks[incident_id].done():
        logger.warning(f"Agent already running for incident {incident_id}")
        return

    thread_id = initial_state.get("thread_id") or str(incident_id)
    await _update_incident_record(incident_id, status=IncidentStatus.triaging, thread_id=thread_id)
    await chat_service.publish_event(incident_id, "status_change", {"status": IncidentStatus.triaging})

    execution_id = await _create_execution_record(incident_id, thread_id)
    task = asyncio.create_task(
        _drive_graph(
            incident_id,
            execution_id,
            initial_state,
            started_event="agent_started",
            started_payload={"incident_id": str(incident_id)},
        )
    )
    _running_tasks[incident_id] = task
    logger.info(f"Started agent task for incident {incident_id}")


async def resume_agent(incident_id: uuid.UUID, human_input: str) -> bool:
    if incident_id in _running_tasks and not _running_tasks[incident_id].done():
        logger.warning(f"Agent already running for incident {incident_id}")
        return False

    graph = get_compiled_graph()
    config = _graph_config(str(incident_id))
    state = await graph.aget_state(config)
    if not state.interrupts:
        return False

    execution = await _get_latest_execution(incident_id)
    if execution is None:
        execution_id = await _create_execution_record(incident_id, str(incident_id))
    else:
        execution_id = execution.id
        await _update_execution_record(execution_id, status=ExecutionStatus.running)

    await _update_incident_record(incident_id, status=IncidentStatus.in_progress)
    await chat_service.publish_event(incident_id, "status_change", {"status": IncidentStatus.in_progress})

    task = asyncio.create_task(
        _drive_graph(
            incident_id,
            execution_id,
            Command(resume=human_input),
            started_event="agent_resumed",
            started_payload={"input": human_input},
        )
    )
    _running_tasks[incident_id] = task
    return True


def is_running(incident_id: uuid.UUID) -> bool:
    task = _running_tasks.get(incident_id)
    return task is not None and not task.done()


async def cancel_agent(incident_id: uuid.UUID) -> bool:
    task = _running_tasks.get(incident_id)
    if task and not task.done():
        task.cancel()
        execution = await _get_latest_execution(incident_id)
        if execution is not None:
            await _update_execution_record(execution.id, status=ExecutionStatus.interrupted)
        await _update_incident_record(incident_id, status=IncidentStatus.waiting_human)
        _running_tasks.pop(incident_id, None)
        await chat_service.publish_event(incident_id, "status_change", {"status": IncidentStatus.waiting_human})
        await chat_service.publish_event(incident_id, "cancelled", {"incident_id": str(incident_id)})
        return True
    return False
