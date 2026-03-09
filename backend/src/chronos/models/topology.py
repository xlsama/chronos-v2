import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from chronos.models.base import Base, TimestampMixin, UUIDMixin


class ServiceTier(enum.StrEnum):
    tier1 = "tier1"
    tier2 = "tier2"
    tier3 = "tier3"


class Environment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "environments"

    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class Service(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "services"

    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    tier: Mapped[ServiceTier] = mapped_column(Enum(ServiceTier, name="service_tier_enum"), default=ServiceTier.tier3)
    owner: Mapped[str | None] = mapped_column(String(200))
    repository_url: Mapped[str | None] = mapped_column(String(500))

    upstream_deps: Mapped[list["ServiceDependency"]] = relationship(
        foreign_keys="ServiceDependency.downstream_id", back_populates="downstream"
    )
    downstream_deps: Mapped[list["ServiceDependency"]] = relationship(
        foreign_keys="ServiceDependency.upstream_id", back_populates="upstream"
    )


class ServiceDependency(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "service_dependencies"

    upstream_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), index=True)
    downstream_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), index=True)
    dependency_type: Mapped[str] = mapped_column(String(50))  # database, api, queue, cache

    upstream: Mapped[Service] = relationship(foreign_keys=[upstream_id], back_populates="downstream_deps")
    downstream: Mapped[Service] = relationship(foreign_keys=[downstream_id], back_populates="upstream_deps")
