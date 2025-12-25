"""add_excel_columns_to_molds

Revision ID: d0b9240f0a85
Revises: 6cc51186dc46
Create Date: 2025-12-25 17:22:10.766096

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd0b9240f0a85'
down_revision = '6cc51186dc46'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Excel kolonlarını molds tablosuna ekle
    op.add_column('molds', sa.Column('cavity_count', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('cycle_time_sec', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('injection_temp_c', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('mold_temp_c', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('material', sa.String(), nullable=True))
    op.add_column('molds', sa.Column('part_weight_g', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('hourly_production', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Excel kolonlarını kaldır
    op.drop_column('molds', 'hourly_production')
    op.drop_column('molds', 'part_weight_g')
    op.drop_column('molds', 'material')
    op.drop_column('molds', 'mold_temp_c')
    op.drop_column('molds', 'injection_temp_c')
    op.drop_column('molds', 'cycle_time_sec')
    op.drop_column('molds', 'cavity_count')



