"""add ai provider and model tables

Revision ID: 5e5f224c385c
Revises: 4c00ceecaafa
Create Date: 2026-03-09 17:13:30.962453

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5e5f224c385c'
down_revision: str | None = '4c00ceecaafa'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('ai_providers',
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('provider_type', sa.Enum('openai', 'openai_compatible', 'anthropic', 'azure_openai', name='provider_type_enum'), nullable=False),
    sa.Column('base_url', sa.String(length=500), nullable=True),
    sa.Column('api_key_encrypted', sa.Text(), nullable=True),
    sa.Column('is_enabled', sa.Boolean(), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('ai_models',
    sa.Column('provider_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('model_id', sa.String(length=200), nullable=False),
    sa.Column('model_type', sa.Enum('chat', 'embedding', name='model_type_enum'), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['provider_id'], ['ai_providers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('provider_id', 'model_id', name='uq_provider_model')
    )
    op.create_index(op.f('ix_ai_models_provider_id'), 'ai_models', ['provider_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_models_provider_id'), table_name='ai_models')
    op.drop_table('ai_models')
    op.drop_table('ai_providers')
