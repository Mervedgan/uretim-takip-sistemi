"""move_mold_fields_to_products

Revision ID: move_mold_to_product
Revises: paused_resumed_fields
Create Date: 2025-12-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'move_mold_to_product'
down_revision = 'paused_resumed_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Products tablosuna yeni kolonları ekle
    op.add_column('products', sa.Column('cavity_count', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('cycle_time_sec', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('injection_temp_c', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('mold_temp_c', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('material', sa.String(), nullable=True))
    op.add_column('products', sa.Column('part_weight_g', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('hourly_production', sa.Integer(), nullable=True))
    
    # Molds tablosundan products tablosuna veri taşı
    # Her product için, ona bağlı ilk mold'un verilerini al
    connection = op.get_bind()
    connection.execute(text("""
        UPDATE products p
        SET 
            cavity_count = (SELECT cavity_count FROM molds m WHERE m.product_id = p.id AND m.deleted_at IS NULL LIMIT 1),
            cycle_time_sec = (SELECT cycle_time_sec FROM molds m WHERE m.product_id = p.id AND m.deleted_at IS NULL LIMIT 1),
            injection_temp_c = (SELECT injection_temp_c FROM molds m WHERE m.product_id = p.id AND m.deleted_at IS NULL LIMIT 1),
            mold_temp_c = (SELECT mold_temp_c FROM molds m WHERE m.product_id = p.id AND m.deleted_at IS NULL LIMIT 1),
            material = (SELECT material FROM molds m WHERE m.product_id = p.id AND m.deleted_at IS NULL LIMIT 1),
            part_weight_g = (SELECT part_weight_g FROM molds m WHERE m.product_id = p.id AND m.deleted_at IS NULL LIMIT 1),
            hourly_production = (SELECT hourly_production FROM molds m WHERE m.product_id = p.id AND m.deleted_at IS NULL LIMIT 1)
        WHERE EXISTS (SELECT 1 FROM molds m WHERE m.product_id = p.id AND m.deleted_at IS NULL)
    """))
    
    # Molds tablosundan bu kolonları kaldır
    op.drop_column('molds', 'hourly_production')
    op.drop_column('molds', 'part_weight_g')
    op.drop_column('molds', 'material')
    op.drop_column('molds', 'mold_temp_c')
    op.drop_column('molds', 'injection_temp_c')
    op.drop_column('molds', 'cycle_time_sec')
    op.drop_column('molds', 'cavity_count')


def downgrade() -> None:
    # Molds tablosuna kolonları geri ekle
    op.add_column('molds', sa.Column('cavity_count', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('cycle_time_sec', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('injection_temp_c', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('mold_temp_c', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('material', sa.String(), nullable=True))
    op.add_column('molds', sa.Column('part_weight_g', sa.Integer(), nullable=True))
    op.add_column('molds', sa.Column('hourly_production', sa.Integer(), nullable=True))
    
    # Products'tan molds'a veri geri taşı
    connection = op.get_bind()
    connection.execute(text("""
        UPDATE molds m
        SET 
            cavity_count = (SELECT cavity_count FROM products p WHERE p.id = m.product_id),
            cycle_time_sec = (SELECT cycle_time_sec FROM products p WHERE p.id = m.product_id),
            injection_temp_c = (SELECT injection_temp_c FROM products p WHERE p.id = m.product_id),
            mold_temp_c = (SELECT mold_temp_c FROM products p WHERE p.id = m.product_id),
            material = (SELECT material FROM products p WHERE p.id = m.product_id),
            part_weight_g = (SELECT part_weight_g FROM products p WHERE p.id = m.product_id),
            hourly_production = (SELECT hourly_production FROM products p WHERE p.id = m.product_id)
        WHERE m.product_id IS NOT NULL
    """))
    
    # Products tablosundan kolonları kaldır
    op.drop_column('products', 'hourly_production')
    op.drop_column('products', 'part_weight_g')
    op.drop_column('products', 'material')
    op.drop_column('products', 'mold_temp_c')
    op.drop_column('products', 'injection_temp_c')
    op.drop_column('products', 'cycle_time_sec')
    op.drop_column('products', 'cavity_count')


