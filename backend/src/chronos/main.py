from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from chronos.api.v1.router import api_router
from chronos.core.logging import setup_logging


async def _seed_default_provider() -> None:
    """Auto-create a DashScope provider if no default exists and env var is set."""
    from chronos.core.config import settings

    if not settings.DASHSCOPE_API_KEY:
        return

    from sqlalchemy import select

    from chronos.core.database import async_session_factory
    from chronos.models.ai_provider import AIProvider

    async with async_session_factory() as db:
        result = await db.execute(select(AIProvider).where(AIProvider.is_default.is_(True)))
        if result.scalar_one_or_none():
            return

        from chronos.schemas.ai_provider import AIModelCreate, AIProviderCreate
        from chronos.services import ai_provider_service

        provider = await ai_provider_service.create_provider(
            db,
            AIProviderCreate(
                name="阿里百炼 (DashScope)",
                provider_type="openai_compatible",
                base_url=settings.DASHSCOPE_BASE_URL,
                api_key=settings.DASHSCOPE_API_KEY,
                is_default=True,
            ),
        )
        await ai_provider_service.create_model(
            db,
            AIModelCreate(
                provider_id=provider.id,
                name=settings.DASHSCOPE_MODEL,
                model_id=settings.DASHSCOPE_MODEL,
                model_type="chat",
                is_default=True,
            ),
        )
        logger.info(f"Seeded default AI provider: {provider.name} with model {settings.DASHSCOPE_MODEL}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()

    from chronos.agent.runtime import init_agent_runtime, shutdown_agent_runtime
    from chronos.agent.skills.loader import SkillLoader
    from chronos.core.config import settings

    loader = SkillLoader(settings.skills_dir_path)
    loader.load_catalog()
    await init_agent_runtime(loader)
    app.state.skill_loader = loader

    await _seed_default_provider()

    yield

    await shutdown_agent_runtime()

    from chronos.core.redis import redis_client

    await redis_client.aclose()


app = FastAPI(
    title="Chronos",
    description="AI-powered incident management platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
