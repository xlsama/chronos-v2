import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from chronos.models.base import Base, TimestampMixin, UUIDMixin


class ExecutionStatus(enum.StrEnum):
    running = "running"
    completed = "completed"
    failed = "failed"
    interrupted = "interrupted"


class AgentExecution(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "agent_executions"

    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), index=True)
    thread_id: Mapped[str] = mapped_column(String(255))
    status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus, name="execution_status_enum"), default=ExecutionStatus.running
    )
    summary: Mapped[str | None] = mapped_column(Text)

    steps: Mapped[list["ExecutionStep"]] = relationship(back_populates="execution", order_by="ExecutionStep.order")


class ExecutionStep(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "execution_steps"

    execution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_executions.id", ondelete="CASCADE"), index=True)
    order: Mapped[int] = mapped_column(Integer)
    node_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus, name="execution_status_enum", create_type=False), default=ExecutionStatus.running
    )
    input_data: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    output_data: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    error: Mapped[str | None] = mapped_column(Text)

    execution: Mapped[AgentExecution] = relationship(back_populates="steps")
