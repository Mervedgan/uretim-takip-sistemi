"""add_product_id_to_molds

Revision ID: 1affabf2331a
Revises: 8468d88a1a24
Create Date: 2025-12-27 20:19:37.070383

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1affabf2331a'
down_revision = '8468d88a1a24'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Molds tablosuna product_id sütununu ekle
    op.add_column('molds', sa.Column('product_id', sa.Integer(), nullable=True))
    
    # 2. Bu sütunu products tablosundaki 'id' sütununa Foreign Key olarak bağla
    op.create_foreign_key(
        'fk_molds_products', # Bağlantının adı
        'molds',             # Kaynak tablo
        'products',          # Hedef tablo
        ['product_id'],      # Kaynak sütun
        ['id']               # Hedef sütun
    )
    pass


def downgrade():
    # İşlemi geri almak gerekirse bağlantıyı ve sütunu sil
    op.drop_constraint('fk_molds_products', 'molds', type_='foreignkey')
    op.drop_column('molds', 'product_id')
    pass



