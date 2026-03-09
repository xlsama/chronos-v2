import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from chronos.api.deps import DB
from chronos.models.execution import AgentExecution

router = APIRouter(prefix="/executions", tags=["executions"])


@router.get("")
async def list_executions(
    db: DB,
    incident_id: uuid.UUID | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    query = select(AgentExecution)
    if incident_id:
        query = query.where(AgentExecution.incident_id == incident_id)
    result = await db.execute(query.order_by(AgentExecution.created_at.desc()).offset(offset).limit(limit))
    return list(result.scalars().all())


@router.get("/{execution_id}")
async def get_execution(db: DB, execution_id: uuid.UUID):
    result = await db.execute(
        select(AgentExecution).options(selectinload(AgentExecution.steps)).where(AgentExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return execution
