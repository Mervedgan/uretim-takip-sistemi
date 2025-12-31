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
    # product_id zaten 78852365d9a1 migration'ında eklenmiş
    # Sadece foreign key constraint eklemeye çalış (eğer yoksa)
    bind = op.get_bind()
    
    # Kolonun var olup olmadığını kontrol et
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('molds')]
    
    if 'product_id' not in columns:
        # Eğer kolon yoksa ekle
        op.add_column('molds', sa.Column('product_id', sa.Integer(), nullable=True))
    
    # SQLite doesn't support ALTER TABLE ADD CONSTRAINT
    # Foreign key zaten initial migration'da eklenmiş olabilir
    if bind.dialect.name != 'sqlite':
        # Foreign key'in var olup olmadığını kontrol et
        fks = [fk['name'] for fk in inspector.get_foreign_keys('molds')]
        if 'fk_molds_products' not in fks:
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
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.drop_constraint('fk_molds_products', 'molds', type_='foreignkey')
    op.drop_column('molds', 'product_id')
    pass



