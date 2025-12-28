from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.db import get_db
from app.models import Product
from app.schemas import ProductCreate, ProductUpdate, ProductResponse
from app.routers.auth import get_current_user, require_roles

router = APIRouter(prefix="/products", tags=["Products"])


# ---------------------------------------------------------
# ✅ Ürün Listesi: Tüm roller görebilir (sadece aktif olanlar)
# ---------------------------------------------------------
@router.get("/", response_model=List[ProductResponse])
def list_products(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # ✅ Tüm giriş yapmış kullanıcılar
):
    """
    Aktif ürünleri listeler (silinmemiş olanlar).
    
    **Yetki:** Tüm roller (worker, planner, admin)
    """
    # Soft delete: Sadece deleted_at IS NULL olanları getir
    products = db.query(Product).filter(Product.deleted_at.is_(None)).all()
    return products


# ---------------------------------------------------------
# ✅ Ürün Detayı: Tüm roller görebilir
# ---------------------------------------------------------
@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # ✅ Tüm roller
):
    """
    Belirli bir ürünün detaylarını getirir (sadece aktif olanlar).
    
    **Yetki:** Tüm roller (worker, planner, admin)
    """
    # Soft delete: Sadece deleted_at IS NULL olanları getir
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.deleted_at.is_(None)
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı veya silinmiş.")
    
    return product


# ---------------------------------------------------------
# ✅ Ürün Oluştur: planner, admin veya worker
# ---------------------------------------------------------
@router.post("/", response_model=ProductResponse)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("planner", "admin", "worker"))  # ✅ planner + admin + worker
):
    """
    Yeni ürün oluşturur.
    
    **Yetki:** "planner", "admin" veya "worker" rolü
    """
    # Aynı kod ile ürün var mı kontrol et
    existing = db.query(Product).filter(Product.code == product_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu ürün kodu zaten kayıtlı.")
    
    product = Product(
        code=product_data.code,
        name=product_data.name,
        description=product_data.description,
    )
    
    db.add(product)
    db.commit()
    db.refresh(product)
    
    return product


# ---------------------------------------------------------
# ✅ Ürün Güncelle: Sadece planner veya admin
# ---------------------------------------------------------
@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("planner", "admin"))  # ✅ planner + admin
):
    """
    Ürün bilgilerini günceller.
    
    **Yetki:** "planner" veya "admin" rolü
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    
    # Sadece gönderilen alanları güncelle
    if product_data.name is not None:
        product.name = product_data.name
    if product_data.description is not None:
        product.description = product_data.description
    
    product.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(product)
    
    return product


# ---------------------------------------------------------
# ✅ Ürün Sil (Soft Delete): Sadece admin
# ---------------------------------------------------------
@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin"))  # ✅ Sadece admin
):
    """
    Ürünü soft delete yapar (deleted_at set eder, veri korunur).
    
    **Soft Delete Özellikleri:**
    - Ürün veritabanından silinmez, sadece deleted_at tarihi set edilir
    - Liste endpoint'lerinde görünmez (deleted_at IS NULL filtresi)
    - Geri getirilebilir (restore endpoint'i ile)
    - İlişkili kalıplar etkilenmez (product_id korunur)
    - İş emirlerindeki product_code'lar korunur
    
    **Yetki:** "admin" rolü
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.deleted_at.is_(None)  # Sadece aktif olanları sil
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı veya zaten silinmiş.")
    
    # İlişkili kalıpları kontrol et (bilgi amaçlı)
    from app.models import Mold
    related_molds = db.query(Mold).filter(
        Mold.product_id == product_id,
        Mold.deleted_at.is_(None)  # Sadece aktif kalıplar
    ).all()
    mold_count = len(related_molds)
    
    # Soft delete: deleted_at set et (veri korunur)
    product.deleted_at = datetime.now(timezone.utc)
    product.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(product)
    
    return {
        "ok": True, 
        "message": "Ürün soft delete ile silindi (veri korunur, geri getirilebilir).", 
        "product_id": product_id,
        "product_code": product.code,
        "deleted_at": product.deleted_at.isoformat(),
        "related_active_molds": mold_count,
        "note": f"{mold_count} aktif kalıp bu ürünle ilişkili (etkilenmedi)."
    }


# ---------------------------------------------------------
# ✅ Ürün Geri Getir (Restore): Sadece admin
# ---------------------------------------------------------
@router.post("/{product_id}/restore", response_model=ProductResponse)
def restore_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin"))  # ✅ Sadece admin
):
    """
    Silinmiş ürünü geri getirir (deleted_at'i NULL yapar).
    
    **Yetki:** "admin" rolü
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    
    if product.deleted_at is None:
        raise HTTPException(status_code=400, detail="Bu ürün zaten aktif (silinmemiş).")
    
    # Geri getir: deleted_at'i NULL yap
    product.deleted_at = None
    product.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(product)
    
    return product

