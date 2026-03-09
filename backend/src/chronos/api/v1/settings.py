import uuid

from fastapi import APIRouter, HTTPException, status

from chronos.api.deps import DB
from chronos.models.ai_provider import AIProvider
from chronos.schemas.ai_provider import (
    AIModelCreate,
    AIModelList,
    AIModelResponse,
    AIModelUpdate,
    AIProviderCreate,
    AIProviderList,
    AIProviderResponse,
    AIProviderUpdate,
)
from chronos.services import ai_provider_service
from chronos.services.llm_service import invalidate_llm_cache

router = APIRouter(prefix="/settings", tags=["settings"])


def _provider_to_response(provider: AIProvider) -> AIProviderResponse:
    return AIProviderResponse(
        id=provider.id,
        name=provider.name,
        provider_type=provider.provider_type,
        base_url=provider.base_url,
        has_api_key=provider.api_key_encrypted is not None,
        is_enabled=provider.is_enabled,
        is_default=provider.is_default,
        config=provider.config,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


# --- AI Provider endpoints ---


@router.get("/ai-providers", response_model=AIProviderList)
async def list_providers(db: DB):
    providers, total = await ai_provider_service.list_providers(db)
    return AIProviderList(items=[_provider_to_response(p) for p in providers], total=total)


@router.post("/ai-providers", response_model=AIProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(db: DB, data: AIProviderCreate):
    provider = await ai_provider_service.create_provider(db, data)
    invalidate_llm_cache()
    return _provider_to_response(provider)


@router.get("/ai-providers/{provider_id}", response_model=AIProviderResponse)
async def get_provider(db: DB, provider_id: uuid.UUID):
    provider = await ai_provider_service.get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return _provider_to_response(provider)


@router.patch("/ai-providers/{provider_id}", response_model=AIProviderResponse)
async def update_provider(db: DB, provider_id: uuid.UUID, data: AIProviderUpdate):
    provider = await ai_provider_service.update_provider(db, provider_id, data)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    invalidate_llm_cache()
    return _provider_to_response(provider)


@router.delete("/ai-providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(db: DB, provider_id: uuid.UUID):
    deleted = await ai_provider_service.delete_provider(db, provider_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    invalidate_llm_cache()


@router.post("/ai-providers/{provider_id}/test")
async def test_provider(db: DB, provider_id: uuid.UUID):
    provider = await ai_provider_service.get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    api_key = await ai_provider_service.get_provider_api_key(provider)

    # Pick the first model or use a fallback
    model_id = provider.models[0].model_id if provider.models else "gpt-3.5-turbo"

    from chronos.services.llm_service import _build_llm

    try:
        llm = _build_llm(
            provider_type=provider.provider_type,
            api_key=api_key,
            base_url=provider.base_url,
            model_id=model_id,
        )
        response = await llm.ainvoke("Say 'ok' in one word.")
        return {"status": "ok", "message": str(response.content)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --- AI Model endpoints ---


@router.get("/ai-models", response_model=AIModelList)
async def list_models(db: DB, provider_id: uuid.UUID | None = None):
    models, total = await ai_provider_service.list_models(db, provider_id)
    return AIModelList(items=[AIModelResponse.model_validate(m) for m in models], total=total)


@router.post("/ai-models", response_model=AIModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(db: DB, data: AIModelCreate):
    model = await ai_provider_service.create_model(db, data)
    invalidate_llm_cache()
    return AIModelResponse.model_validate(model)


@router.patch("/ai-models/{model_id}", response_model=AIModelResponse)
async def update_model(db: DB, model_id: uuid.UUID, data: AIModelUpdate):
    model = await ai_provider_service.update_model(db, model_id, data)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    invalidate_llm_cache()
    return AIModelResponse.model_validate(model)


@router.delete("/ai-models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(db: DB, model_id: uuid.UUID):
    deleted = await ai_provider_service.delete_model(db, model_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    invalidate_llm_cache()
