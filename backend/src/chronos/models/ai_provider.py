import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from chronos.models.base import Base, TimestampMixin, UUIDMixin


class ProviderType(enum.StrEnum):
    openai = "openai"
    openai_compatible = "openai_compatible"
    anthropic = "anthropic"
    azure_openai = "azure_openai"


class ModelType(enum.StrEnum):
    chat = "chat"
    embedding = "embedding"


class AIProvider(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ai_providers"

    name: Mapped[str] = mapped_column(String(200), unique=True)
    provider_type: Mapped[ProviderType] = mapped_column(Enum(ProviderType, name="provider_type_enum"))
    base_url: Mapped[str | None] = mapped_column(String(500))
    api_key_encrypted: Mapped[str | None] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict)

    models: Mapped[list["AIModel"]] = relationship(back_populates="provider", cascade="all, delete-orphan")


class AIModel(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ai_models"
    __table_args__ = (UniqueConstraint("provider_id", "model_id", name="uq_provider_model"),)

    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_providers.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    model_id: Mapped[str] = mapped_column(String(200))
    model_type: Mapped[ModelType] = mapped_column(Enum(ModelType, name="model_type_enum"))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict)

    provider: Mapped[AIProvider] = relationship(back_populates="models")
