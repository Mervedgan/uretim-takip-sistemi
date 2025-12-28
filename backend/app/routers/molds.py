from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.db import get_db
from app.models import Mold, Product
from app.schemas import MoldCreate, MoldUpdate, MoldResponse
from app.routers.auth import get_current_user, require_roles

router = APIRouter(prefix="/molds", tags=["Molds"])


# ---------------------------------------------------------
# ✅ Kalıp Listesi: Tüm roller görebilir (sadece aktif olanlar)
# ---------------------------------------------------------
@router.get("/", response_model=List[MoldResponse])
def list_molds(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # ✅ Tüm giriş yapmış kullanıcılar
):
    """
    Aktif kalıpları listeler (silinmemiş olanlar).
    
    **Yetki:** Tüm roller (worker, planner, admin)
    """
    # Soft delete: Sadece deleted_at IS NULL olanları getir
    molds = db.query(Mold).filter(Mold.deleted_at.is_(None)).all()
    return molds


# ---------------------------------------------------------
# ✅ Kalıp Detayı: Tüm roller görebilir
# ---------------------------------------------------------
@router.get("/{mold_id}", response_model=MoldResponse)
def get_mold(
    mold_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # ✅ Tüm roller
):
    """
    Belirli bir kalıbın detaylarını getirir (sadece aktif olanlar).
    
    **Yetki:** Tüm roller (worker, planner, admin)
    """
    # Soft delete: Sadece deleted_at IS NULL olanları getir
    mold = db.query(Mold).filter(
        Mold.id == mold_id,
        Mold.deleted_at.is_(None)
    ).first()
    if not mold:
        raise HTTPException(status_code=404, detail="Kalıp bulunamadı veya silinmiş.")
    
    return mold


# ---------------------------------------------------------
# ✅ Kalıp Oluştur: Sadece planner veya admin
# ---------------------------------------------------------
@router.post("/", response_model=MoldResponse)
def create_mold(
    mold_data: MoldCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("planner", "admin"))  # ✅ planner + admin
):
    """
    Yeni kalıp oluşturur.
    
    **Yetki:** "planner" veya "admin" rolü
    """
    # Aynı kod ile aktif kalıp var mı kontrol et (soft delete kontrolü)
    existing = db.query(Mold).filter(
        Mold.code == mold_data.code,
        Mold.deleted_at.is_(None)  # Sadece aktif olanları kontrol et
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu kalıp kodu zaten kayıtlı.")
    
    # Product ID varsa kontrol et (aktif ürün olmalı)
    if mold_data.product_id:
        product = db.query(Product).filter(
            Product.id == mold_data.product_id,
            Product.deleted_at.is_(None)  # Sadece aktif ürünler
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Belirtilen ürün bulunamadı veya silinmiş.")
    
    mold = Mold(
        code=mold_data.code,
        name=mold_data.name,
        description=mold_data.description,
        product_id=mold_data.product_id,
        status=mold_data.status or "active",
        # Excel kolonları kaldırıldı - artık products tablosunda
    )
    
    db.add(mold)
    db.commit()
    db.refresh(mold)
    
    return mold


# ---------------------------------------------------------
# ✅ Kalıp Güncelle: Sadece planner veya admin
# ---------------------------------------------------------
@router.patch("/{mold_id}", response_model=MoldResponse)
def update_mold(
    mold_id: int,
    mold_data: MoldUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("planner", "admin"))  # ✅ planner + admin
):
    """
    Kalıp bilgilerini günceller.
    
    **Yetki:** "planner" veya "admin" rolü
    """
    mold = db.query(Mold).filter(Mold.id == mold_id).first()
    if not mold:
        raise HTTPException(status_code=404, detail="Kalıp bulunamadı.")
    
    # Product ID varsa kontrol et (aktif ürün olmalı)
    if mold_data.product_id is not None:
        if mold_data.product_id != 0:  # 0 ise null yapmak için
            product = db.query(Product).filter(
                Product.id == mold_data.product_id,
                Product.deleted_at.is_(None)  # Sadece aktif ürünler
            ).first()
            if not product:
                raise HTTPException(status_code=404, detail="Belirtilen ürün bulunamadı veya silinmiş.")
            mold.product_id = mold_data.product_id
        else:
            mold.product_id = None
    elif mold_data.product_id is None:
        pass  # Değiştirme
    
    # Sadece gönderilen alanları güncelle
    if mold_data.name is not None:
        mold.name = mold_data.name
    if mold_data.description is not None:
        mold.description = mold_data.description
    if mold_data.status is not None:
        mold.status = mold_data.status
    
    # Excel kolonları kaldırıldı - artık products tablosunda
    
    mold.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(mold)
    
    return mold


# ---------------------------------------------------------
# ✅ Kalıp Sil (Soft Delete): Sadece admin
# ---------------------------------------------------------
@router.delete("/{mold_id}")
def delete_mold(
    mold_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin"))  # ✅ Sadece admin
):
    """
    Kalıbı soft delete yapar (deleted_at set eder, veri korunur).
    
    **Soft Delete Özellikleri:**
    - Kalıp veritabanından silinmez, sadece deleted_at tarihi set edilir
    - Liste endpoint'lerinde görünmez (deleted_at IS NULL filtresi)
    - Geri getirilebilir (restore endpoint'i ile)
    - Ürün ilişkisi korunur (product_id değişmez)
    
    **Yetki:** "admin" rolü
    """
    mold = db.query(Mold).filter(
        Mold.id == mold_id,
        Mold.deleted_at.is_(None)  # Sadece aktif olanları sil
    ).first()
    if not mold:
        raise HTTPException(status_code=404, detail="Kalıp bulunamadı veya zaten silinmiş.")
    
    # Soft delete: deleted_at set et (veri korunur)
    mold.deleted_at = datetime.now(timezone.utc)
    mold.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(mold)
    
    return {
        "ok": True, 
        "message": "Kalıp soft delete ile silindi (veri korunur, geri getirilebilir).", 
        "mold_id": mold_id,
        "mold_code": mold.code,
        "deleted_at": mold.deleted_at.isoformat()
    }


# ---------------------------------------------------------
# ✅ Kalıp Geri Getir (Restore): Sadece admin
# ---------------------------------------------------------
@router.post("/{mold_id}/restore", response_model=MoldResponse)
def restore_mold(
    mold_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin"))  # ✅ Sadece admin
):
    """
    Silinmiş kalıbı geri getirir (deleted_at'i NULL yapar).
    
    **Yetki:** "admin" rolü
    """
    mold = db.query(Mold).filter(Mold.id == mold_id).first()
    if not mold:
        raise HTTPException(status_code=404, detail="Kalıp bulunamadı.")
    
    if mold.deleted_at is None:
        raise HTTPException(status_code=400, detail="Bu kalıp zaten aktif (silinmemiş).")
    
    # Product ID varsa kontrol et (aktif ürün olmalı)
    if mold.product_id:
        product = db.query(Product).filter(
            Product.id == mold.product_id,
            Product.deleted_at.is_(None)
        ).first()
        if not product:
            raise HTTPException(
                status_code=400, 
                detail="Bu kalıp silinmiş bir ürüne bağlı. Önce ürünü geri getirin."
            )
    
    # Geri getir: deleted_at'i NULL yap
    mold.deleted_at = None
    mold.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(mold)
    
    return mold

