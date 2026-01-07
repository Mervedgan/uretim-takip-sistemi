"""
Molds Tablosunu Products Tablosundaki Gerçek Verilere Göre Düzelt

Bu script:
1. Tüm molds'ları siler (soft delete)
2. Products tablosundaki gerçek verilere göre yeni molds oluşturur
3. Product ID bağlantılarını doğru şekilde kurar
"""

import sys
import os
from datetime import datetime, timezone

# Backend dizinini path'e ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Windows terminal encoding sorununu coz
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

from app.db import SessionLocal
from app.models import Product, Mold


def fix_molds_from_products():
    """Products tablosundaki gerçek verilere göre molds'u düzelt"""
    db = SessionLocal()
    
    try:
        # Tüm aktif ürünleri al (ID'ye göre sırala)
        products = db.query(Product).filter(
            Product.deleted_at.is_(None)
        ).order_by(Product.id).all()
        
        print(f"[*] Toplam {len(products)} aktif urun bulundu.")
        
        if len(products) == 0:
            print("[!] Aktif urun bulunamadi.")
            return
        
        # Mevcut tüm molds'ları soft delete yap (temiz başlangıç için)
        existing_molds = db.query(Mold).filter(Mold.deleted_at.is_(None)).all()
        if existing_molds:
            print(f"[*] {len(existing_molds)} mevcut mold soft delete yapiliyor...")
            for mold in existing_molds:
                mold.deleted_at = datetime.now(timezone.utc)
                mold.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        print("[+] Mevcut molds temizlendi.")
        
        # Her product için doğru mold oluştur
        created_count = 0
        
        for product in products:
            # Mold kodu: Product code'unu kullan (KP-01, KP-02, vs.)
            # Eğer product code yoksa ID'den oluştur
            if product.code:
                mold_code = product.code  # KP-01, KP-02, etc.
            else:
                # Product code yoksa ID'den oluştur
                mold_code = f"KP-{product.id}"
            
            # Aynı kod ile aktif mold var mı kontrol et
            existing_mold = db.query(Mold).filter(
                Mold.code == mold_code,
                Mold.deleted_at.is_(None)
            ).first()
            
            if existing_mold:
                # Zaten varsa product_id'yi güncelle
                existing_mold.product_id = product.id
                existing_mold.updated_at = datetime.now(timezone.utc)
                print(f"[*] Mold guncellendi: {mold_code} -> Product ID: {product.id} ({product.name})")
                continue
            
            # Mold adı: Product name'i kullan (kalıp ekleme)
            mold_name = product.name if product.name else f"Kalip {product.id}"
            
            # Description: Product description'dan veya product name'den
            mold_description = product.description if product.description else f"{product.name} icin kalip" if product.name else None
            
            # Yeni mold oluştur
            new_mold = Mold(
                code=mold_code,
                name=mold_name,
                description=mold_description,
                product_id=product.id,
                status="active",
                created_at=datetime.now(timezone.utc)
            )
            
            db.add(new_mold)
            created_count += 1
            print(f"[+] Mold olusturuldu: {mold_code} -> Product ID: {product.id} ({product.name})")
        
        # Değişiklikleri kaydet
        db.commit()
        
        # Son durumu kontrol et
        total_molds = db.query(Mold).filter(Mold.deleted_at.is_(None)).count()
        molds_with_product = db.query(Mold).filter(
            Mold.deleted_at.is_(None),
            Mold.product_id.isnot(None)
        ).count()
        
        print("\n" + "="*60)
        print("OZET:")
        print(f"   [+] Olusturulan/Guncellenen mold sayisi: {created_count}")
        print(f"   [*] Toplam aktif urun: {len(products)}")
        print(f"   [*] Toplam aktif mold: {total_molds}")
        print(f"   [*] Product ID baglantili mold: {molds_with_product}")
        print("="*60)
        
        # Örnek bağlantıları göster
        print("\nOrnek mold-urun baglantilari:")
        samples = db.query(Mold).filter(
            Mold.deleted_at.is_(None),
            Mold.product_id.isnot(None)
        ).order_by(Mold.id).limit(5).all()
        
        for m in samples:
            p = db.query(Product).filter(Product.id == m.product_id).first()
            if p:
                print(f"  Mold: {m.code} (ID: {m.id}) -> Product: {p.code} - {p.name} (ID: {p.id})")
        
    except Exception as e:
        db.rollback()
        print(f"[!] Hata olustu: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("Molds tablosunu products tablosundaki gercek verilere gore duzeltiyor...")
    print("="*60)
    fix_molds_from_products()
    print("\n[+] Islem tamamlandi!")

