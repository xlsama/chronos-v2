from __future__ import annotations

from contextlib import AbstractAsyncContextManager
from typing import Any

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.state import CompiledStateGraph
from loguru import logger

from chronos.agent.graph import build_graph
from chronos.agent.skills.loader import SkillLoader
from chronos.core.config import settings

_compiled_graph: CompiledStateGraph | None = None
_checkpointer_cm: AbstractAsyncContextManager[Any] | None = None
_skill_loader: SkillLoader | None = None


async def _build_checkpointer() -> Any:
    global _checkpointer_cm

    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    except ImportError as exc:
        logger.warning(f"Postgres checkpointer unavailable, falling back to in-memory saver: {exc}")
        return InMemorySaver()

    try:
        saver_cm = AsyncPostgresSaver.from_conn_string(settings.sync_database_url)
        _checkpointer_cm = saver_cm
        saver = await saver_cm.__aenter__()
        await saver.setup()
        logger.info("Initialized Postgres checkpointer for LangGraph")
        return saver
    except Exception as exc:
        logger.warning(f"Failed to initialize Postgres checkpointer, using in-memory saver: {exc}")
        if _checkpointer_cm is not None:
            await _checkpointer_cm.__aexit__(None, None, None)
            _checkpointer_cm = None
        return InMemorySaver()


async def init_agent_runtime(skill_loader: SkillLoader) -> None:
    global _compiled_graph, _skill_loader

    if _compiled_graph is not None:
        _skill_loader = skill_loader
        return

    checkpointer = await _build_checkpointer()
    _compiled_graph = build_graph().compile(checkpointer=checkpointer)
    _skill_loader = skill_loader


async def shutdown_agent_runtime() -> None:
    global _compiled_graph, _checkpointer_cm, _skill_loader

    _compiled_graph = None
    _skill_loader = None

    if _checkpointer_cm is not None:
        await _checkpointer_cm.__aexit__(None, None, None)
        _checkpointer_cm = None


def get_compiled_graph() -> CompiledStateGraph:
    if _compiled_graph is None:
        raise RuntimeError("Agent runtime is not initialized")
    return _compiled_graph


def get_skill_loader() -> SkillLoader | None:
    return _skill_loader


async def get_agent_llm():
    """Get an LLM instance for agent nodes."""
    from langchain_core.language_models import BaseChatModel

    from chronos.core.database import async_session_factory
    from chronos.services.llm_service import get_llm

    async with async_session_factory() as db:
        llm: BaseChatModel = await get_llm(db)
    return llm
