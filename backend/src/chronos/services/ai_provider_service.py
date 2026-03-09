import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from chronos.core.encryption import decrypt_value, encrypt_value
from chronos.models.ai_provider import AIModel, AIProvider, ModelType
from chronos.schemas.ai_provider import (
    AIModelCreate,
    AIModelUpdate,
    AIProviderCreate,
    AIProviderUpdate,
)

# --- AI Provider CRUD ---


async def create_provider(db: AsyncSession, data: AIProviderCreate) -> AIProvider:
    if data.is_default:
        await _clear_default_providers(db)

    provider = AIProvider(
        name=data.name,
        provider_type=data.provider_type,
        base_url=data.base_url,
        api_key_encrypted=encrypt_value(data.api_key) if data.api_key else None,
        is_enabled=data.is_enabled,
        is_default=data.is_default,
        config=data.config,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


async def list_providers(db: AsyncSession) -> tuple[list[AIProvider], int]:
    count = await db.scalar(select(func.count()).select_from(AIProvider))
    result = await db.execute(
        select(AIProvider).options(selectinload(AIProvider.models)).order_by(AIProvider.created_at)
    )
    return list(result.scalars().all()), count or 0


async def get_provider(db: AsyncSession, provider_id: uuid.UUID) -> AIProvider | None:
    result = await db.execute(
        select(AIProvider).options(selectinload(AIProvider.models)).where(AIProvider.id == provider_id)
    )
    return result.scalar_one_or_none()


async def update_provider(db: AsyncSession, provider_id: uuid.UUID, data: AIProviderUpdate) -> AIProvider | None:
    provider = await get_provider(db, provider_id)
    if not provider:
        return None

    update_data = data.model_dump(exclude_unset=True)

    if "api_key" in update_data:
        api_key = update_data.pop("api_key")
        provider.api_key_encrypted = encrypt_value(api_key) if api_key else None

    if update_data.get("is_default"):
        await _clear_default_providers(db, exclude_id=provider_id)

    for key, value in update_data.items():
        setattr(provider, key, value)

    await db.commit()
    await db.refresh(provider)
    return provider


async def delete_provider(db: AsyncSession, provider_id: uuid.UUID) -> bool:
    provider = await get_provider(db, provider_id)
    if not provider:
        return False
    await db.delete(provider)
    await db.commit()
    return True


async def get_default_provider(db: AsyncSession) -> AIProvider | None:
    result = await db.execute(
        select(AIProvider)
        .options(selectinload(AIProvider.models))
        .where(AIProvider.is_default.is_(True), AIProvider.is_enabled.is_(True))
    )
    return result.scalar_one_or_none()


async def get_provider_api_key(provider: AIProvider) -> str | None:
    if not provider.api_key_encrypted:
        return None
    return decrypt_value(provider.api_key_encrypted)


# --- AI Model CRUD ---


async def create_model(db: AsyncSession, data: AIModelCreate) -> AIModel:
    if data.is_default:
        await _clear_default_models(db, data.model_type)

    model = AIModel(
        provider_id=data.provider_id,
        name=data.name,
        model_id=data.model_id,
        model_type=data.model_type,
        is_default=data.is_default,
        config=data.config,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


async def list_models(db: AsyncSession, provider_id: uuid.UUID | None = None) -> tuple[list[AIModel], int]:
    query = select(AIModel)
    count_query = select(func.count()).select_from(AIModel)

    if provider_id:
        query = query.where(AIModel.provider_id == provider_id)
        count_query = count_query.where(AIModel.provider_id == provider_id)

    count = await db.scalar(count_query)
    result = await db.execute(query.order_by(AIModel.created_at))
    return list(result.scalars().all()), count or 0


async def get_model(db: AsyncSession, model_id: uuid.UUID) -> AIModel | None:
    return await db.get(AIModel, model_id)


async def update_model(db: AsyncSession, model_id: uuid.UUID, data: AIModelUpdate) -> AIModel | None:
    model = await get_model(db, model_id)
    if not model:
        return None

    update_data = data.model_dump(exclude_unset=True)

    if update_data.get("is_default"):
        model_type = update_data.get("model_type", model.model_type)
        await _clear_default_models(db, model_type)

    for key, value in update_data.items():
        setattr(model, key, value)

    await db.commit()
    await db.refresh(model)
    return model


async def delete_model(db: AsyncSession, model_id: uuid.UUID) -> bool:
    model = await get_model(db, model_id)
    if not model:
        return False
    await db.delete(model)
    await db.commit()
    return True


async def get_default_model(db: AsyncSession, model_type: ModelType = ModelType.chat) -> AIModel | None:
    result = await db.execute(
        select(AIModel).where(AIModel.is_default.is_(True), AIModel.model_type == model_type)
    )
    return result.scalar_one_or_none()


# --- Helpers ---


async def _clear_default_providers(db: AsyncSession, exclude_id: uuid.UUID | None = None) -> None:
    query = select(AIProvider).where(AIProvider.is_default.is_(True))
    if exclude_id:
        query = query.where(AIProvider.id != exclude_id)
    result = await db.execute(query)
    for provider in result.scalars().all():
        provider.is_default = False


async def _clear_default_models(db: AsyncSession, model_type: ModelType) -> None:
    result = await db.execute(
        select(AIModel).where(AIModel.is_default.is_(True), AIModel.model_type == model_type)
    )
    for model in result.scalars().all():
        model.is_default = False
