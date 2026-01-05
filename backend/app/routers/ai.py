"""
AI Router
Üretim parametreleri tahmin API'si

Endpoints:
- GET /api/urunler → Benzersiz ürün isimlerini listele
- POST /api/recete → Ürün adına göre reçete döndür (önce DB, sonra AI)
- POST /api/ai/tahmin → Malzeme bazlı AI tahmini (yeni ürünler için)
- POST /api/ai/train → Modeli eğit
- GET /api/ai/status → Model durumunu kontrol et
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session

from app.db import get_db
from app.ai_model import ai_model
from app.models import Product

router = APIRouter(prefix="/api", tags=["AI - Üretim Tahmini"])


# ==================== Pydantic Schemas ====================

class ReceteRequest(BaseModel):
    """Reçete isteği - sadece ürün adı"""
    urun_adi: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "urun_adi": "Elektrik Prizi"
            }
        }


class MalzemeBazliTahminRequest(BaseModel):
    """Malzeme bazlı AI tahmin isteği (yeni ürünler için)"""
    malzeme: str = Field(..., description="Malzeme tipi (PP, ABS, PA6, PC, vb.)")
    parca_agirligi_g: float = Field(..., ge=0, description="Parça ağırlığı (gram) - Zorunlu")
    goz_adedi: int = Field(..., ge=1, description="Göz adedi - Zorunlu")
    
    class Config:
        json_schema_extra = {
            "example": {
                "malzeme": "PP",
                "parca_agirligi_g": 10,
                "goz_adedi": 4
            }
        }


class TahminSonucu(BaseModel):
    """Tahmin sonucu"""
    enjeksiyon_sicakligi: float
    kalip_sicakligi: float
    cevrim_suresi: float


class ReceteResponse(BaseModel):
    """Reçete yanıtı"""
    success: bool
    kaynak: Optional[str] = None  # "veritabani" veya "ai_tahmin"
    urun_adi: Optional[str] = None
    urun_kodu: Optional[str] = None
    degerler: Optional[TahminSonucu] = None
    birim: Optional[dict] = None
    malzeme: Optional[str] = None
    message: Optional[str] = None
    # Ürün bulunamadığında
    oneri: Optional[str] = None
    benzer_urunler: Optional[List[str]] = None


class TrainResponse(BaseModel):
    """Model eğitim yanıtı"""
    success: bool
    message: str
    urun_sayisi: Optional[int] = None
    train_score: Optional[float] = None
    test_score: Optional[float] = None
    urunler: Optional[List[str]] = None


class UrunListesiResponse(BaseModel):
    """Ürün listesi yanıtı"""
    success: bool
    urun_sayisi: int
    urunler: List[str]


class ModelStatusResponse(BaseModel):
    """Model durum yanıtı"""
    model_hazir: bool
    urun_sayisi: int
    message: str


# ==================== Helper Functions ====================

def urun_ara_veritabaninda(db: Session, urun_adi: str) -> Optional[Product]:
    """Ürünü veritabanında ara (büyük/küçük harf duyarsız)"""
    return db.query(Product).filter(
        Product.name.ilike(urun_adi),
        Product.deleted_at.is_(None)
    ).first()


def benzer_urunleri_bul(db: Session, urun_adi: str, limit: int = 5) -> List[str]:
    """Benzer ürünleri bul (basit kelime eşleşmesi)"""
    kelimeler = urun_adi.lower().split()
    benzerler = []
    
    products = db.query(Product.name).filter(
        Product.deleted_at.is_(None),
        Product.name.isnot(None)
    ).all()
    
    for p in products:
        if p.name:
            p_lower = p.name.lower()
            for kelime in kelimeler:
                if len(kelime) >= 3 and kelime in p_lower:
                    benzerler.append(p.name)
                    break
    
    return benzerler[:limit]


def malzeme_bazli_tahmin(db: Session, malzeme: str, parca_agirligi: float, goz_adedi: int) -> dict:
    """
    Malzeme bazlı ortalama değerler hesapla.
    Aynı malzemeyi kullanan ürünlerin ortalamasını al.
    Parça ağırlığı ve göz adedine göre ayarlama yap.
    """
    # Aynı malzemeyi kullanan ürünleri bul
    query = db.query(Product).filter(
        Product.deleted_at.is_(None),
        Product.material.ilike(f"%{malzeme}%"),
        Product.injection_temp_c.isnot(None),
        Product.mold_temp_c.isnot(None),
        Product.cycle_time_sec.isnot(None)
    )
    
    products = query.all()
    
    if not products:
        return {
            "success": False,
            "message": f"'{malzeme}' malzemesi için kayıtlı ürün bulunamadı."
        }
    
    # Ortalama hesapla
    toplam_enj = sum(p.injection_temp_c for p in products)
    toplam_kalip = sum(p.mold_temp_c for p in products)
    toplam_cevrim = sum(p.cycle_time_sec for p in products)
    n = len(products)
    
    ort_enj = toplam_enj / n
    ort_kalip = toplam_kalip / n
    ort_cevrim = toplam_cevrim / n
    
    # Parça ağırlığına göre çevrim süresini ayarla
    agirlik_listesi = [p.part_weight_g for p in products if p.part_weight_g]
    if agirlik_listesi:
        agirlik_ortalamasi = sum(agirlik_listesi) / len(agirlik_listesi)
        if agirlik_ortalamasi > 0:
            agirlik_faktoru = parca_agirligi / agirlik_ortalamasi
            # Ağır parçalar daha uzun süre gerektirir
            ort_cevrim = ort_cevrim * (0.7 + 0.3 * agirlik_faktoru)
    
    # Göz adedine göre saatlik üretim ve çevrim süresini ayarla
    goz_listesi = [p.cavity_count for p in products if p.cavity_count]
    if goz_listesi:
        goz_ortalamasi = sum(goz_listesi) / len(goz_listesi)
        if goz_ortalamasi > 0:
            goz_faktoru = goz_adedi / goz_ortalamasi
            # Daha fazla göz = daha uzun çevrim ama daha fazla ürün
            ort_cevrim = ort_cevrim * (0.8 + 0.2 * goz_faktoru)
    
    return {
        "success": True,
        "tahminler": {
            "enjeksiyon_sicakligi": round(ort_enj, 1),
            "kalip_sicakligi": round(ort_kalip, 1),
            "cevrim_suresi": round(ort_cevrim, 1)
        },
        "kaynak_urun_sayisi": n,
        "malzeme": malzeme,
        "girilen_degerler": {
            "parca_agirligi_g": parca_agirligi,
            "goz_adedi": goz_adedi
        }
    }


# ==================== Endpoints ====================

@router.get("/urunler", response_model=UrunListesiResponse)
async def urunleri_listele(db: Session = Depends(get_db)):
    """
    Veritabanındaki tüm ürün isimlerini listeler.
    """
    products = db.query(Product.name).filter(
        Product.deleted_at.is_(None),
        Product.name.isnot(None)
    ).distinct().all()
    
    urunler = sorted([p.name for p in products if p.name])
    
    return UrunListesiResponse(
        success=True,
        urun_sayisi=len(urunler),
        urunler=urunler
    )


@router.post("/recete")
async def recete_getir(request: ReceteRequest, db: Session = Depends(get_db)):
    """
    Ürün adına göre reçete döndürür.
    
    **Akış:**
    1. Veritabanında ürünü ara
    2. Varsa → Gerçek değerleri döndür ✅
    3. Yoksa → Benzer ürünleri öner, malzeme bilgisi iste
    
    **Kayıtlı ürünler için %100 doğru değer döner!**
    """
    urun_adi = request.urun_adi.strip()
    
    # 1. Veritabanında ara
    product = urun_ara_veritabaninda(db, urun_adi)
    
    if product:
        # Ürün bulundu - gerçek değerleri döndür
        if product.injection_temp_c and product.mold_temp_c and product.cycle_time_sec:
            return {
                "success": True,
                "kaynak": "veritabani",
                "urun_adi": product.name,
                "urun_kodu": product.code,
                "degerler": {
                    "enjeksiyon_sicakligi": float(product.injection_temp_c),
                    "kalip_sicakligi": float(product.mold_temp_c),
                    "cevrim_suresi": float(product.cycle_time_sec)
                },
                "birim": {
                    "enjeksiyon_sicakligi": "°C",
                    "kalip_sicakligi": "°C",
                    "cevrim_suresi": "saniye"
                },
                "malzeme": product.material,
                "message": "Ürün veritabanında bulundu. Gerçek değerler döndürüldü."
            }
        else:
            return {
                "success": False,
                "kaynak": "veritabani",
                "urun_adi": product.name,
                "message": "Ürün bulundu ancak üretim parametreleri eksik. Lütfen ürünü güncelleyin.",
                "oneri": f"POST /products/upsert ile '{product.name}' için değerleri ekleyin."
            }
    
    # 2. Ürün bulunamadı - benzer ürünleri öner
    benzerler = benzer_urunleri_bul(db, urun_adi)
    
    return {
        "success": False,
        "kaynak": None,
        "urun_adi": urun_adi,
        "message": f"'{urun_adi}' veritabanında bulunamadı.",
        "oneri": "Yeni ürün için POST /api/ai/tahmin endpoint'ini malzeme bilgisiyle kullanın.",
        "benzer_urunler": benzerler if benzerler else None
    }


@router.post("/ai/tahmin")
async def malzeme_bazli_ai_tahmin(request: MalzemeBazliTahminRequest, db: Session = Depends(get_db)):
    """
    Malzeme bazlı AI tahmini yapar (yeni ürünler için).
    
    **Nasıl çalışır:**
    - Aynı malzemeyi kullanan kayıtlı ürünlerin ortalamasını alır
    - Parça ağırlığına göre çevrim süresini ayarlar
    
    **Örnek:**
    - Malzeme: PP → PP kullanan ürünlerin ortalama değerleri
    - Malzeme: ABS → ABS kullanan ürünlerin ortalama değerleri
    """
    sonuc = malzeme_bazli_tahmin(
        db=db,
        malzeme=request.malzeme,
        parca_agirligi=request.parca_agirligi_g,
        goz_adedi=request.goz_adedi
    )
    
    if sonuc["success"]:
        return {
            "success": True,
            "kaynak": "ai_tahmin",
            "malzeme": sonuc["malzeme"],
            "degerler": {
                "enjeksiyon_sicakligi": sonuc["tahminler"]["enjeksiyon_sicakligi"],
                "kalip_sicakligi": sonuc["tahminler"]["kalip_sicakligi"],
                "cevrim_suresi": sonuc["tahminler"]["cevrim_suresi"]
            },
            "birim": {
                "enjeksiyon_sicakligi": "°C",
                "kalip_sicakligi": "°C",
                "cevrim_suresi": "saniye"
            },
            "kaynak_urun_sayisi": sonuc["kaynak_urun_sayisi"],
            "message": f"{sonuc['kaynak_urun_sayisi']} adet {request.malzeme} malzemeli ürünün ortalaması alındı."
        }
    else:
        # Mevcut malzemeleri listele
        malzemeler = db.query(Product.material).filter(
            Product.deleted_at.is_(None),
            Product.material.isnot(None)
        ).distinct().all()
        
        mevcut_malzemeler = sorted(set(m.material for m in malzemeler if m.material))
        
        return {
            "success": False,
            "message": sonuc["message"],
            "mevcut_malzemeler": mevcut_malzemeler
        }


@router.post("/ai/train", response_model=TrainResponse)
async def model_egit(db: Session = Depends(get_db)):
    """
    AI modelini veritabanındaki verilerle eğitir.
    
    **Not:** Yeni sistem veritabanından direkt değer çektiği için
    bu endpoint artık opsiyoneldir.
    """
    sonuc = ai_model.model_egit(db)
    
    return TrainResponse(
        success=sonuc["success"],
        message=sonuc["message"],
        urun_sayisi=sonuc.get("urun_sayisi"),
        train_score=sonuc.get("train_score"),
        test_score=sonuc.get("test_score"),
        urunler=sonuc.get("urunler")
    )


@router.get("/ai/status", response_model=ModelStatusResponse)
async def model_durumu(db: Session = Depends(get_db)):
    """
    Sistem durumunu kontrol eder.
    """
    # Veritabanındaki ürün sayısı
    urun_sayisi = db.query(Product).filter(
        Product.deleted_at.is_(None),
        Product.injection_temp_c.isnot(None)
    ).count()
    
    return ModelStatusResponse(
        model_hazir=True,  # Artık her zaman hazır (veritabanı kullanıyoruz)
        urun_sayisi=urun_sayisi,
        message=f"Sistem hazır. {urun_sayisi} ürün kayıtlı."
    )


@router.get("/ai/malzemeler")
async def malzemeleri_listele(db: Session = Depends(get_db)):
    """
    Veritabanındaki tüm malzeme tiplerini listeler.
    
    Yeni ürün tahmini yaparken kullanılabilecek malzemeleri gösterir.
    """
    malzemeler = db.query(Product.material).filter(
        Product.deleted_at.is_(None),
        Product.material.isnot(None)
    ).distinct().all()
    
    mevcut_malzemeler = sorted(set(m.material for m in malzemeler if m.material))
    
    return {
        "success": True,
        "malzeme_sayisi": len(mevcut_malzemeler),
        "malzemeler": mevcut_malzemeler
    }
