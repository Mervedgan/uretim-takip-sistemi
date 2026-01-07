"""
İlk 50 Yanlış Oluşturulmuş Mold'u Kalıcı Olarak Sil

Bu script ilk oluşturulan yanlış formatlı mold'ları (ID 1-50) kalıcı olarak siler.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

from app.db import SessionLocal
from app.models import Mold

def delete_old_molds():
    """İlk 50 mold'u kalıcı olarak sil"""
    db = SessionLocal()
    
    try:
        # İlk 50 mold'u bul (ID 1-50)
        old_molds = db.query(Mold).filter(
            Mold.id >= 1,
            Mold.id <= 50
        ).all()
        
        print(f"[*] {len(old_molds)} eski mold bulundu (ID 1-50)")
        
        if len(old_molds) == 0:
            print("[!] Silinecek mold bulunamadi.")
            return
        
        # Örnek göster
        print("\nSilinecek mold ornekleri:")
        for m in old_molds[:5]:
            print(f"  ID: {m.id}, Code: {m.code}, Name: {m.name}")
        
        # Onay
        print(f"\n[*] {len(old_molds)} mold kalici olarak silinecek...")
        
        # Kalıcı silme (hard delete)
        deleted_count = 0
        for mold in old_molds:
            db.delete(mold)
            deleted_count += 1
        
        db.commit()
        
        print(f"[+] {deleted_count} mold kalici olarak silindi.")
        
        # Son durumu kontrol et
        remaining_molds = db.query(Mold).filter(Mold.deleted_at.is_(None)).count()
        total_molds = db.query(Mold).count()
        
        print("\n" + "="*60)
        print("OZET:")
        print(f"   [-] Silinen mold sayisi: {deleted_count}")
        print(f"   [*] Kalan aktif mold sayisi: {remaining_molds}")
        print(f"   [*] Toplam mold (silinenler dahil): {total_molds}")
        print("="*60)
        
    except Exception as e:
        db.rollback()
        print(f"[!] Hata olustu: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("Ilk 50 yanlis olusturulmus mold'u kalici olarak siliyor...")
    print("="*60)
    delete_old_molds()
    print("\n[+] Islem tamamlandi!")

