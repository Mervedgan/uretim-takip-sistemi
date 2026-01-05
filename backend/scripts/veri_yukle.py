"""
CSV Veri Yükleme Scripti
uretim_verisi.csv dosyasını okuyup PostgreSQL products tablosuna yükler.
"""

import sys
import os
import csv
from datetime import datetime, timezone

# Backend klasörünü path'e ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db import engine, SessionLocal
from app.models import Product


def temizle_sayi(deger: str) -> float:
    """
    Virgül/nokta düzeltmeleri yapar.
    Örn: "2,05" → 2.05, "05" → 5
    """
    if not deger or deger.strip() == '':
        return None
    
    # Boşlukları temizle
    deger = deger.strip()
    
    # Virgülü noktaya çevir (Türkçe ondalık formatı)
    deger = deger.replace(',', '.')
    
    try:
        return float(deger)
    except ValueError:
        return None


def temizle_int(deger: str) -> int:
    """Değeri integer'a çevirir."""
    sayi = temizle_sayi(deger)
    if sayi is None:
        return None
    return int(sayi)


def csv_yukle(csv_dosya: str = None):
    """
    CSV dosyasını okur ve products tablosuna yükler.
    """
    if csv_dosya is None:
        csv_dosya = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'uretim_verisi.csv'
        )
    
    if not os.path.exists(csv_dosya):
        print(f"❌ CSV dosyası bulunamadı: {csv_dosya}")
        return False
    
    print(f"📂 CSV dosyası okunuyor: {csv_dosya}")
    
    db: Session = SessionLocal()
    yuklenen = 0
    hatali = 0
    guncellenen = 0
    
    try:
        with open(csv_dosya, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for satir_no, row in enumerate(reader, start=2):
                try:
                    # CSV sütunlarını oku
                    kalip_adi = row.get('Kalıp Adı', '').strip()
                    urun_adi = row.get('Ürün Adı', '').strip()
                    goz_adedi = temizle_int(row.get('Göz Adedi', ''))
                    cevrim_suresi = temizle_int(row.get('Çevrim Süresi ', ''))  # Sonunda boşluk var!
                    enjeksiyon_sicakligi = temizle_int(row.get('Enjeksiyon Sıcaklığı', ''))
                    kalip_sicakligi = temizle_int(row.get('Kalıp Sıcaklığı ', ''))  # Sonunda boşluk var!
                    malzeme = row.get('Malzeme', '').strip()
                    parca_agirligi = temizle_sayi(row.get('Parça Ağırlığı (g)', ''))
                    saatlik_uretim = temizle_int(row.get('Saatlik Üretim (adet)', ''))
                    
                    if not urun_adi:
                        print(f"⚠️ Satır {satir_no}: Ürün adı boş, atlanıyor.")
                        hatali += 1
                        continue
                    
                    # Ürün kodu oluştur (kalıp adından)
                    urun_kodu = kalip_adi if kalip_adi else f"PRD-{satir_no}"
                    
                    # Mevcut ürünü kontrol et
                    mevcut = db.query(Product).filter(Product.code == urun_kodu).first()
                    
                    if mevcut:
                        # Güncelle
                        mevcut.name = urun_adi
                        mevcut.cavity_count = goz_adedi
                        mevcut.cycle_time_sec = cevrim_suresi
                        mevcut.injection_temp_c = enjeksiyon_sicakligi
                        mevcut.mold_temp_c = kalip_sicakligi
                        mevcut.material = malzeme
                        mevcut.part_weight_g = int(parca_agirligi) if parca_agirligi else None
                        mevcut.hourly_production = saatlik_uretim
                        mevcut.updated_at = datetime.now(timezone.utc)
                        guncellenen += 1
                        print(f"🔄 Güncellendi: {urun_kodu} - {urun_adi}")
                    else:
                        # Yeni ürün oluştur
                        yeni_urun = Product(
                            code=urun_kodu,
                            name=urun_adi,
                            description=f"CSV'den yüklendi - {kalip_adi}",
                            cavity_count=goz_adedi,
                            cycle_time_sec=cevrim_suresi,
                            injection_temp_c=enjeksiyon_sicakligi,
                            mold_temp_c=kalip_sicakligi,
                            material=malzeme,
                            part_weight_g=int(parca_agirligi) if parca_agirligi else None,
                            hourly_production=saatlik_uretim,
                            created_at=datetime.now(timezone.utc)
                        )
                        db.add(yeni_urun)
                        yuklenen += 1
                        print(f"✅ Eklendi: {urun_kodu} - {urun_adi}")
                    
                except Exception as e:
                    print(f"❌ Satır {satir_no} hatası: {e}")
                    hatali += 1
                    continue
            
            db.commit()
            
    except Exception as e:
        print(f"❌ CSV okuma hatası: {e}")
        db.rollback()
        return False
    finally:
        db.close()
    
    print("\n" + "="*50)
    print(f"📊 Yükleme Özeti:")
    print(f"   ✅ Yeni eklenen: {yuklenen}")
    print(f"   🔄 Güncellenen: {guncellenen}")
    print(f"   ❌ Hatalı/Atlanan: {hatali}")
    print(f"   📦 Toplam işlenen: {yuklenen + guncellenen + hatali}")
    print("="*50)
    
    return True


if __name__ == "__main__":
    print("🚀 CSV Veri Yükleme Başlatılıyor...")
    print("="*50)
    
    basarili = csv_yukle()
    
    if basarili:
        print("\n✅ Veri yükleme tamamlandı!")
    else:
        print("\n❌ Veri yükleme başarısız!")
        sys.exit(1)


