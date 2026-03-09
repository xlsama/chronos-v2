from __future__ import annotations

from functools import lru_cache
from typing import Any

from langchain_core.language_models import BaseChatModel
from loguru import logger
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from chronos.core.config import settings
from chronos.models.ai_provider import ModelType, ProviderType
from chronos.services.ai_provider_service import get_default_model, get_default_provider, get_provider_api_key

_llm_cache: dict[str, BaseChatModel] = {}
_openai_client_cache: dict[str, tuple[AsyncOpenAI, str]] = {}


def invalidate_llm_cache() -> None:
    _llm_cache.clear()
    _openai_client_cache.clear()


async def get_llm(db: AsyncSession, model_type: ModelType = ModelType.chat) -> BaseChatModel:
    provider = await get_default_provider(db)
    if provider:
        model = await get_default_model(db, model_type)
        if model:
            cache_key = f"{provider.id}:{model.id}"
            if cache_key in _llm_cache:
                return _llm_cache[cache_key]

            api_key = await get_provider_api_key(provider)
            llm = _build_llm(
                provider_type=provider.provider_type,
                api_key=api_key,
                base_url=provider.base_url,
                model_id=model.model_id,
                model_config=model.config,
            )
            _llm_cache[cache_key] = llm
            logger.info(f"Created LLM from DB config: provider={provider.name}, model={model.model_id}")
            return llm

    return _build_llm_from_env()


async def get_openai_client(db: AsyncSession, model_type: ModelType = ModelType.chat) -> tuple[AsyncOpenAI, str]:
    """Get an AsyncOpenAI client and model ID for direct OpenAI API calls."""
    provider = await get_default_provider(db)
    if provider:
        model = await get_default_model(db, model_type)
        if model:
            cache_key = f"{provider.id}:{model.id}"
            if cache_key in _openai_client_cache:
                return _openai_client_cache[cache_key]

            api_key = await get_provider_api_key(provider)
            client = AsyncOpenAI(api_key=api_key, base_url=provider.base_url)
            _openai_client_cache[cache_key] = (client, model.model_id)
            logger.info(f"Created OpenAI client from DB config: provider={provider.name}, model={model.model_id}")
            return client, model.model_id

    return _build_openai_client_from_env()


@lru_cache(maxsize=1)
def _build_openai_client_from_env() -> tuple[AsyncOpenAI, str]:
    if not settings.DASHSCOPE_API_KEY:
        raise ValueError("No AI provider configured: neither DB default nor DASHSCOPE_API_KEY env var is set")

    logger.info(f"Creating OpenAI client from env: model={settings.DASHSCOPE_MODEL}")
    client = AsyncOpenAI(api_key=settings.DASHSCOPE_API_KEY, base_url=settings.DASHSCOPE_BASE_URL)
    return client, settings.DASHSCOPE_MODEL


@lru_cache(maxsize=1)
def _build_llm_from_env() -> BaseChatModel:
    if not settings.DASHSCOPE_API_KEY:
        raise ValueError("No AI provider configured: neither DB default nor DASHSCOPE_API_KEY env var is set")

    logger.info(f"Creating LLM from env: model={settings.DASHSCOPE_MODEL}, base_url={settings.DASHSCOPE_BASE_URL}")
    return _build_llm(
        provider_type=ProviderType.openai_compatible,
        api_key=settings.DASHSCOPE_API_KEY,
        base_url=settings.DASHSCOPE_BASE_URL,
        model_id=settings.DASHSCOPE_MODEL,
    )


def _build_llm(
    *,
    provider_type: ProviderType,
    api_key: str | None,
    base_url: str | None,
    model_id: str,
    model_config: dict[str, Any] | None = None,
) -> BaseChatModel:
    config = model_config or {}

    if provider_type in (ProviderType.openai, ProviderType.openai_compatible, ProviderType.azure_openai):
        from langchain_openai import ChatOpenAI

        kwargs: dict[str, Any] = {
            "model": model_id,
            "api_key": api_key,
            **config,
        }
        if base_url:
            kwargs["base_url"] = base_url

        return ChatOpenAI(**kwargs)

    if provider_type == ProviderType.anthropic:
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=model_id,
            api_key=api_key,
            **config,
        )

    raise ValueError(f"Unsupported provider type: {provider_type}")
