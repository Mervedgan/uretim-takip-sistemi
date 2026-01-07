"""Molds tablosunun düzeltildiğini doğrula"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

from app.db import SessionLocal
from app.models import Product, Mold

db = SessionLocal()

# Tüm molds'ları product'larıyla birlikte kontrol et
molds = db.query(Mold).filter(Mold.deleted_at.is_(None)).order_by(Mold.id).all()

print("Mold-Product Baglantilari (ilk 10):")
print("="*80)

for m in molds[:10]:
    if m.product_id:
        p = db.query(Product).filter(Product.id == m.product_id).first()
        if p:
            code_match = "✓" if m.code == p.code else "✗"
            name_match = "✓" if m.name == p.name else "✗"
            print(f"  Mold: {m.code:10} ({m.name:30}) -> Product: {p.code:10} ({p.name:30}) [Code:{code_match} Name:{name_match}]")
        else:
            print(f"  Mold: {m.code:10} -> Product ID {m.product_id} BULUNAMADI!")
    else:
        print(f"  Mold: {m.code:10} -> Product ID: None")

print("\n" + "="*80)
print(f"Toplam aktif mold: {len(molds)}")
print(f"Product ID baglantili: {sum(1 for m in molds if m.product_id)}")

# Code ve name eşleşmelerini kontrol et
code_matches = 0
name_matches = 0

for m in molds:
    if m.product_id:
        p = db.query(Product).filter(Product.id == m.product_id).first()
        if p:
            if m.code == p.code:
                code_matches += 1
            if m.name == p.name:
                name_matches += 1

print(f"\nCode eslesmesi: {code_matches}/{len(molds)}")
print(f"Name eslesmesi: {name_matches}/{len(molds)}")

db.close()

