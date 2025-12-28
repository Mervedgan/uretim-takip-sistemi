"""add paused and resumed fields to work_order_stages

Revision ID: paused_resumed_fields
Revises: c096c50476ab
Create Date: 2025-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'paused_resumed_fields'
down_revision = 'c096c50476ab'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add paused_at and resumed_at columns to work_order_stages table
    op.add_column('work_order_stages', sa.Column('paused_at', sa.DateTime(), nullable=True))
    op.add_column('work_order_stages', sa.Column('resumed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove paused_at and resumed_at columns from work_order_stages table
    op.drop_column('work_order_stages', 'resumed_at')
    op.drop_column('work_order_stages', 'paused_at')

