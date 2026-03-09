import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from chronos.api.deps import DB
from chronos.models.runbook import Runbook, RunbookStep, RunbookVersion
from chronos.schemas.runbook import RunbookCreate, RunbookList, RunbookResponse, RunbookUpdate, RunbookVersionResponse

router = APIRouter(prefix="/runbooks", tags=["runbooks"])


@router.post("", response_model=RunbookResponse, status_code=status.HTTP_201_CREATED)
async def create(db: DB, data: RunbookCreate):
    runbook = Runbook(
        title=data.title,
        description=data.description,
        category=data.category,
        tags=data.tags,
    )
    db.add(runbook)
    await db.flush()

    version = RunbookVersion(runbook_id=runbook.id, version=1, content=data.content)
    db.add(version)
    await db.flush()

    if data.steps:
        for step_data in data.steps:
            step = RunbookStep(version_id=version.id, **step_data.model_dump())
            db.add(step)

    runbook.current_version_id = version.id
    await db.commit()
    await db.refresh(runbook)
    return runbook


@router.get("", response_model=RunbookList)
async def list_all(
    db: DB,
    category: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    query = select(Runbook)
    count_query = select(func.count()).select_from(Runbook)

    if category:
        query = query.where(Runbook.category == category)
        count_query = count_query.where(Runbook.category == category)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.order_by(Runbook.created_at.desc()).offset(offset).limit(limit))
    return RunbookList(items=list(result.scalars().all()), total=total)


@router.get("/{runbook_id}", response_model=RunbookResponse)
async def get_one(db: DB, runbook_id: uuid.UUID):
    result = await db.execute(select(Runbook).where(Runbook.id == runbook_id))
    runbook = result.scalar_one_or_none()
    if not runbook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Runbook not found")
    return runbook


@router.get("/{runbook_id}/versions/{version_id}", response_model=RunbookVersionResponse)
async def get_version(db: DB, runbook_id: uuid.UUID, version_id: uuid.UUID):
    result = await db.execute(
        select(RunbookVersion)
        .options(selectinload(RunbookVersion.steps))
        .where(RunbookVersion.id == version_id, RunbookVersion.runbook_id == runbook_id)
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return version


@router.patch("/{runbook_id}", response_model=RunbookResponse)
async def update(db: DB, runbook_id: uuid.UUID, data: RunbookUpdate):
    result = await db.execute(select(Runbook).where(Runbook.id == runbook_id))
    runbook = result.scalar_one_or_none()
    if not runbook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Runbook not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(runbook, field, value)

    await db.commit()
    await db.refresh(runbook)
    return runbook
