"""initial schema

Revision ID: 4c00ceecaafa
Revises:
Create Date: 2026-03-09 16:41:16.716267

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "4c00ceecaafa"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enums
    severity_enum = sa.Enum("critical", "high", "medium", "low", name="severity_enum")
    incident_status_enum = sa.Enum(
        "new", "triaging", "in_progress", "waiting_human", "resolved", "closed", name="incident_status_enum"
    )
    processing_mode_enum = sa.Enum("automatic", "semi_automatic", name="processing_mode_enum")
    message_role_enum = sa.Enum("user", "assistant", "system", name="message_role_enum")
    service_tier_enum = sa.Enum("tier1", "tier2", "tier3", name="service_tier_enum")
    risk_level_enum = sa.Enum("low", "medium", "high", "critical", name="risk_level_enum")
    action_type_enum = sa.Enum("bash_command", "human_check", "condition", "sub_runbook", name="action_type_enum")
    execution_status_enum = sa.Enum("running", "completed", "failed", "interrupted", name="execution_status_enum")

    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("display_name", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Environments
    op.create_table(
        "environments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Services
    op.create_table(
        "services",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), unique=True, nullable=False, index=True),
        sa.Column("description", sa.Text()),
        sa.Column("tier", service_tier_enum, server_default="tier3"),
        sa.Column("owner", sa.String(200)),
        sa.Column("repository_url", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Service Dependencies
    op.create_table(
        "service_dependencies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "upstream_id", sa.Uuid(), sa.ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column(
            "downstream_id", sa.Uuid(), sa.ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column("dependency_type", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Incidents
    op.create_table(
        "incidents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("source_id", sa.String(255), index=True),
        sa.Column("severity", severity_enum, server_default="medium"),
        sa.Column("status", incident_status_enum, server_default="new"),
        sa.Column("processing_mode", processing_mode_enum),
        sa.Column("category", sa.String(100)),
        sa.Column("service_id", sa.Uuid(), sa.ForeignKey("services.id")),
        sa.Column("environment_id", sa.Uuid(), sa.ForeignKey("environments.id")),
        sa.Column("thread_id", sa.String(255)),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
        sa.Column("assigned_to_id", sa.Uuid(), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Incident Events
    op.create_table(
        "incident_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "incident_id", sa.Uuid(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("data", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Incident Messages
    op.create_table(
        "incident_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "incident_id", sa.Uuid(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column("role", message_role_enum, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Runbooks
    op.create_table(
        "runbooks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("category", sa.String(100)),
        sa.Column("tags", postgresql.JSONB(), server_default="[]"),
        sa.Column("is_auto_generated", sa.Boolean(), server_default="false"),
        sa.Column("source_incident_id", sa.Uuid(), sa.ForeignKey("incidents.id")),
        sa.Column("current_version_id", sa.Uuid()),  # FK added after runbook_versions created
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Runbook Versions
    op.create_table(
        "runbook_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "runbook_id", sa.Uuid(), sa.ForeignKey("runbooks.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("changelog", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Add FK from runbooks to runbook_versions
    op.create_foreign_key("fk_runbooks_current_version", "runbooks", "runbook_versions", ["current_version_id"], ["id"])

    # Runbook Steps
    op.create_table(
        "runbook_steps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "version_id",
            sa.Uuid(),
            sa.ForeignKey("runbook_versions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("action_type", action_type_enum, nullable=False),
        sa.Column("action_config", postgresql.JSONB(), server_default="{}"),
        sa.Column("risk_level", risk_level_enum, server_default="low"),
        sa.Column("requires_approval", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Agent Executions
    op.create_table(
        "agent_executions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "incident_id", sa.Uuid(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column("thread_id", sa.String(255), nullable=False),
        sa.Column("status", execution_status_enum, server_default="running"),
        sa.Column("summary", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Execution Steps
    op.create_table(
        "execution_steps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "execution_id",
            sa.Uuid(),
            sa.ForeignKey("agent_executions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("node_name", sa.String(100), nullable=False),
        sa.Column("status", execution_status_enum, server_default="running"),
        sa.Column("input_data", postgresql.JSONB(), server_default="{}"),
        sa.Column("output_data", postgresql.JSONB(), server_default="{}"),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("execution_steps")
    op.drop_table("agent_executions")
    op.drop_table("runbook_steps")
    op.drop_constraint("fk_runbooks_current_version", "runbooks", type_="foreignkey")
    op.drop_table("runbook_versions")
    op.drop_table("runbooks")
    op.drop_table("incident_messages")
    op.drop_table("incident_events")
    op.drop_table("incidents")
    op.drop_table("service_dependencies")
    op.drop_table("services")
    op.drop_table("environments")
    op.drop_table("users")

    for name in [
        "execution_status_enum",
        "action_type_enum",
        "risk_level_enum",
        "service_tier_enum",
        "message_role_enum",
        "processing_mode_enum",
        "incident_status_enum",
        "severity_enum",
    ]:
        sa.Enum(name=name).drop(op.get_bind())
