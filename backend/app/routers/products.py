from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.db import get_db
from app.models import Product
from app.schemas import ProductCreate, ProductUpdate, ProductResponse, ProductUpsert
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
        # Molds'tan taşınan alanlar (Excel kolonları)
        cavity_count=product_data.cavity_count,
        cycle_time_sec=product_data.cycle_time_sec,
        injection_temp_c=product_data.injection_temp_c,
        mold_temp_c=product_data.mold_temp_c,
        material=product_data.material,
        part_weight_g=product_data.part_weight_g,
        hourly_production=product_data.hourly_production,
    )
    
    db.add(product)
    db.commit()
    db.refresh(product)
    
    return product


# ---------------------------------------------------------
# ✅ Ürün Upsert: Varsa güncelle, yoksa ekle (AI eğitimi için)
# ---------------------------------------------------------
@router.post("/upsert")
def upsert_product(
    product_data: ProductUpsert,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("planner", "admin", "worker"))
):
    """
    Ürün ekleme veya güncelleme (Upsert).
    
    - **Ürün adı varsa:** Mevcut ürünü günceller
    - **Ürün adı yoksa:** Yeni ürün oluşturur
    
    Bu endpoint AI modeli eğitimi için idealdir.
    `auto_train: true` gönderilirse güncelleme sonrası model otomatik eğitilir.
    
    **Yetki:** "planner", "admin" veya "worker" rolü
    """
    # Ürün adına göre ara (büyük/küçük harf duyarsız)
    existing = db.query(Product).filter(
        Product.name.ilike(product_data.name),
        Product.deleted_at.is_(None)
    ).first()
    
    is_new = False
    
    if existing:
        # Güncelle
        if product_data.description is not None:
            existing.description = product_data.description
        if product_data.cavity_count is not None:
            existing.cavity_count = product_data.cavity_count
        if product_data.cycle_time_sec is not None:
            existing.cycle_time_sec = product_data.cycle_time_sec
        if product_data.injection_temp_c is not None:
            existing.injection_temp_c = product_data.injection_temp_c
        if product_data.mold_temp_c is not None:
            existing.mold_temp_c = product_data.mold_temp_c
        if product_data.material is not None:
            existing.material = product_data.material
        if product_data.part_weight_g is not None:
            existing.part_weight_g = product_data.part_weight_g
        if product_data.hourly_production is not None:
            existing.hourly_production = product_data.hourly_production
        
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        product = existing
    else:
        # Yeni oluştur
        is_new = True
        code = product_data.code or f"PRD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        
        # Kod benzersiz mi kontrol et
        code_exists = db.query(Product).filter(Product.code == code).first()
        if code_exists:
            code = f"{code}-{datetime.now(timezone.utc).strftime('%f')[:4]}"
        
        product = Product(
            code=code,
            name=product_data.name,
            description=product_data.description,
            cavity_count=product_data.cavity_count,
            cycle_time_sec=product_data.cycle_time_sec,
            injection_temp_c=product_data.injection_temp_c,
            mold_temp_c=product_data.mold_temp_c,
            material=product_data.material,
            part_weight_g=product_data.part_weight_g,
            hourly_production=product_data.hourly_production,
        )
        db.add(product)
        db.commit()
        db.refresh(product)
    
    # Otomatik AI eğitimi
    train_result = None
    if product_data.auto_train:
        try:
            from app.ai_model import ai_model
            train_result = ai_model.model_egit(db)
        except Exception as e:
            train_result = {"success": False, "message": str(e)}
    
    return {
        "ok": True,
        "action": "created" if is_new else "updated",
        "product": {
            "id": product.id,
            "code": product.code,
            "name": product.name,
            "injection_temp_c": product.injection_temp_c,
            "mold_temp_c": product.mold_temp_c,
            "cycle_time_sec": product.cycle_time_sec,
            "material": product.material,
        },
        "ai_training": train_result
    }


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
    
    # Molds'tan taşınan alanlar (Excel kolonları)
    if product_data.cavity_count is not None:
        product.cavity_count = product_data.cavity_count
    if product_data.cycle_time_sec is not None:
        product.cycle_time_sec = product_data.cycle_time_sec
    if product_data.injection_temp_c is not None:
        product.injection_temp_c = product_data.injection_temp_c
    if product_data.mold_temp_c is not None:
        product.mold_temp_c = product_data.mold_temp_c
    if product_data.material is not None:
        product.material = product_data.material
    if product_data.part_weight_g is not None:
        product.part_weight_g = product_data.part_weight_g
    if product_data.hourly_production is not None:
        product.hourly_production = product_data.hourly_production
    
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

