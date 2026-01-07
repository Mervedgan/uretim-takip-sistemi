"""Molds tablosunu doğrula"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.models import Product, Mold

db = SessionLocal()

products = db.query(Product).filter(Product.deleted_at.is_(None)).count()
molds = db.query(Mold).filter(Mold.deleted_at.is_(None)).count()
molds_with_product = db.query(Mold).filter(
    Mold.deleted_at.is_(None),
    Mold.product_id.isnot(None)
).count()

print(f"Products: {products}")
print(f"Molds: {molds}")
print(f"Molds with product_id: {molds_with_product}")

# Örnek bağlantıları göster
print("\nOrnek mold-urun baglantilari:")
samples = db.query(Mold).filter(Mold.deleted_at.is_(None)).limit(5).all()
for m in samples:
    if m.product_id:
        p = db.query(Product).filter(Product.id == m.product_id).first()
        print(f"  Mold: {m.code} -> Product ID: {m.product_id} ({p.name if p else 'N/A'})")
    else:
        print(f"  Mold: {m.code} -> Product ID: None")

db.close()

