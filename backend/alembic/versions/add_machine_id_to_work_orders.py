"""add_machine_id_to_work_orders

Revision ID: add_machine_id_wo
Revises: 
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_machine_id_wo'
down_revision = 'move_mold_to_product'  # Son migration'ın revision ID'si
branch_labels = None
depends_on = None


def upgrade() -> None:
    # work_orders tablosuna machine_id kolonu ekle
    op.add_column('work_orders', 
        sa.Column('machine_id', sa.Integer(), nullable=True)
    )
    # Foreign key constraint ekle
    # SQLite doesn't support ALTER TABLE ADD CONSTRAINT
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.create_foreign_key(
            'fk_work_orders_machine_id',
            'work_orders', 'machines',
            ['machine_id'], ['id']
        )


def downgrade() -> None:
    # Foreign key constraint'i kaldır
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.drop_constraint('fk_work_orders_machine_id', 'work_orders', type_='foreignkey')
    # machine_id kolonunu kaldır
    op.drop_column('work_orders', 'machine_id')

