import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from chronos.models.base import Base, TimestampMixin, UUIDMixin


class Severity(enum.StrEnum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class IncidentStatus(enum.StrEnum):
    new = "new"
    triaging = "triaging"
    in_progress = "in_progress"
    waiting_human = "waiting_human"
    resolved = "resolved"
    closed = "closed"


class ProcessingMode(enum.StrEnum):
    automatic = "automatic"
    semi_automatic = "semi_automatic"


class Incident(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incidents"

    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(100))
    source_id: Mapped[str | None] = mapped_column(String(255), index=True)
    severity: Mapped[Severity] = mapped_column(Enum(Severity, name="severity_enum"), default=Severity.medium)
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, name="incident_status_enum"), default=IncidentStatus.new
    )
    processing_mode: Mapped[ProcessingMode | None] = mapped_column(
        Enum(ProcessingMode, name="processing_mode_enum"), nullable=True
    )
    category: Mapped[str | None] = mapped_column(String(100))
    service_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("services.id"), nullable=True)
    environment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("environments.id"), nullable=True)
    thread_id: Mapped[str | None] = mapped_column(String(255))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, default=dict)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    events: Mapped[list["IncidentEvent"]] = relationship(back_populates="incident", order_by="IncidentEvent.created_at")
    messages: Mapped[list["IncidentMessage"]] = relationship(
        back_populates="incident", order_by="IncidentMessage.created_at"
    )


class IncidentEvent(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incident_events"

    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(100))
    data: Mapped[dict | None] = mapped_column(JSONB, default=dict)

    incident: Mapped[Incident] = relationship(back_populates="events")


class MessageRole(enum.StrEnum):
    user = "user"
    assistant = "assistant"
    system = "system"


class IncidentMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incident_messages"

    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), index=True)
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole, name="message_role_enum"))
    content: Mapped[str] = mapped_column(Text)
    content_parts: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    attachments: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    incident: Mapped[Incident] = relationship(back_populates="messages")
