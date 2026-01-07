"""
Molds Tablosunu Products Bağlantılarına Göre Geri Yükleme Scripti

Bu script:
1. Products tablosundaki tüm aktif ürünleri alır
2. Her ürün için bir mold oluşturur (eğer yoksa)
3. product_id'yi doğru şekilde bağlar
"""

import sys
import os
from datetime import datetime, timezone

# Windows terminal encoding sorununu çöz
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Backend dizinini path'e ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.models import Product, Mold


def restore_molds():
    """Products tablosundaki ürünler için molds oluştur"""
    db = SessionLocal()
    
    try:
        # Aktif ürünleri al
        products = db.query(Product).filter(
            Product.deleted_at.is_(None)
        ).all()
        
        print(f"[*] Toplam {len(products)} aktif urun bulundu.")
        
        if len(products) == 0:
            print("[!] Aktif urun bulunamadi. Once urun ekleyin.")
            return
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        
        for product in products:
            # Bu ürün için zaten bir mold var mı kontrol et
            existing_mold = db.query(Mold).filter(
                Mold.product_id == product.id,
                Mold.deleted_at.is_(None)
            ).first()
            
            if existing_mold:
                print(f"[>] Urun '{product.name}' (ID: {product.id}) icin zaten mold var: {existing_mold.code}")
                skipped_count += 1
                continue
            
            # Mold kodu oluştur (ürün kodundan türet)
            if product.code:
                # Ürün kodu varsa: PRD-001 -> MOLD-001
                mold_code = product.code.replace("PRD-", "MOLD-").replace("PROD-", "MOLD-")
                if not mold_code.startswith("MOLD-"):
                    mold_code = f"MOLD-{product.code}"
            else:
                # Ürün kodu yoksa: MOLD-PRODUCT-{id}
                mold_code = f"MOLD-PRODUCT-{product.id}"
            
            # Aynı kod ile başka bir mold var mı kontrol et
            code_exists = db.query(Mold).filter(
                Mold.code == mold_code,
                Mold.deleted_at.is_(None)
            ).first()
            
            if code_exists:
                # Kod çakışıyorsa ID ekle
                mold_code = f"MOLD-{product.id}-{product.code or 'PRODUCT'}"
            
            # Mold adı oluştur
            mold_name = f"{product.name} Kalıbı" if product.name else f"Kalıp {product.id}"
            
            # Yeni mold oluştur
            new_mold = Mold(
                code=mold_code,
                name=mold_name,
                description=f"{product.name} ürünü için kalıp" if product.name else None,
                product_id=product.id,
                status="active",
                created_at=datetime.now(timezone.utc)
            )
            
            db.add(new_mold)
            created_count += 1
            print(f"[+] Mold olusturuldu: {mold_code} -> Product: {product.name} (ID: {product.id})")
        
        # Silinmiş mold'ları kontrol et ve geri getir
        deleted_molds = db.query(Mold).filter(
            Mold.deleted_at.isnot(None)
        ).all()
        
        for deleted_mold in deleted_molds:
            if deleted_mold.product_id:
                # İlgili ürün hala aktif mi kontrol et
                product = db.query(Product).filter(
                    Product.id == deleted_mold.product_id,
                    Product.deleted_at.is_(None)
                ).first()
                
                if product:
                    # Urun aktifse mold'u geri getir
                    deleted_mold.deleted_at = None
                    deleted_mold.updated_at = datetime.now(timezone.utc)
                    updated_count += 1
                    print(f"[*] Silinmis mold geri getirildi: {deleted_mold.code} -> Product: {product.name}")
        
        # Değişiklikleri kaydet
        db.commit()
        
        print("\n" + "="*60)
        print("OZET:")
        print(f"   [+] Olusturulan mold sayisi: {created_count}")
        print(f"   [*] Geri getirilen mold sayisi: {updated_count}")
        print(f"   [>] Atlanan mold sayisi: {skipped_count}")
        print(f"   [*] Toplam aktif urun: {len(products)}")
        print("="*60)
        
        # Son durumu goster
        total_molds = db.query(Mold).filter(Mold.deleted_at.is_(None)).count()
        print(f"\n[+] Toplam aktif mold sayisi: {total_molds}")
        
    except Exception as e:
        db.rollback()
        print(f"[!] Hata olustu: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("Molds tablosunu products baglantilarina gore geri yukluyor...")
    print("="*60)
    restore_molds()
    print("\n[+] Islem tamamlandi!")

