"""add multimodal columns to incident_messages

Revision ID: ebc277a2a950
Revises: 5e5f224c385c
Create Date: 2026-03-09 21:55:51.096808

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ebc277a2a950'
down_revision: str | None = '5e5f224c385c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('incident_messages', sa.Column('content_parts', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('incident_messages', sa.Column('attachments', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('incident_messages', 'attachments')
    op.drop_column('incident_messages', 'content_parts')
