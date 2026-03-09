import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from chronos.models.base import Base, TimestampMixin, UUIDMixin


class RiskLevel(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Runbook(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "runbooks"

    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    is_auto_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    source_incident_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("incidents.id"), nullable=True)
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("runbook_versions.id", use_alter=True), nullable=True
    )

    versions: Mapped[list["RunbookVersion"]] = relationship(
        foreign_keys="RunbookVersion.runbook_id", back_populates="runbook"
    )


class RunbookVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "runbook_versions"

    runbook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("runbooks.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[str] = mapped_column(Text)
    changelog: Mapped[str | None] = mapped_column(Text)

    runbook: Mapped[Runbook] = relationship(foreign_keys=[runbook_id], back_populates="versions")
    steps: Mapped[list["RunbookStep"]] = relationship(back_populates="version", order_by="RunbookStep.order")


class ActionType(enum.StrEnum):
    bash_command = "bash_command"
    human_check = "human_check"
    condition = "condition"
    sub_runbook = "sub_runbook"


class RunbookStep(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "runbook_steps"

    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("runbook_versions.id", ondelete="CASCADE"), index=True)
    order: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    action_type: Mapped[ActionType] = mapped_column(Enum(ActionType, name="action_type_enum"))
    action_config: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel, name="risk_level_enum"), default=RiskLevel.low)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)

    version: Mapped[RunbookVersion] = relationship(back_populates="steps")
