from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

# 👤 Kullanıcı Schemas
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    email: Optional[str] = Field(None, max_length=255, description="Email adresi")
    phone: Optional[str] = Field(None, max_length=20, description="Telefon numarası")
    role: Optional[str] = Field("worker", pattern="^(admin|planner|worker)$")

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    
    class Config:
        from_attributes = True

class RoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(admin|planner|worker)$")

class StartDoneResponse(BaseModel):
    ok: bool
    work_order_stage_id: int
    status: str
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None

class IssueCreate(BaseModel):
    type: str
    description: Optional[str] = None

class WorkOrderCreate(BaseModel):
    product_code: str
    lot_no: str
    qty: int  # Hedef ürün sayısı
    produced_qty: Optional[int] = Field(0, ge=0)  # Mevcut üretilen ürün sayısı (varsayılan: 0)
    planned_start: datetime
    planned_end: datetime
    stage_count: Optional[int] = Field(2, ge=1)  # Üretim aşama sayısı (varsayılan: 2)
    stage_names: Optional[List[str]] = None  # Kullanıcı tarafından girilen aşama isimleri
    machine_id: Optional[int] = None  # Üretim için seçilen makine ID'si


# 📦 Ürün Schemas
class ProductCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="Ürün kodu (örn: PRD-001)")
    name: str = Field(..., min_length=1, max_length=200, description="Ürün adı")
    description: Optional[str] = Field(None, max_length=500, description="Ürün açıklaması")
    
    # Molds'tan taşınan alanlar (Excel kolonları)
    cavity_count: Optional[int] = Field(None, ge=1, description="Göz Adedi")
    cycle_time_sec: Optional[int] = Field(None, ge=1, description="Çevrim Süresi (sn)")
    injection_temp_c: Optional[int] = Field(None, ge=0, description="Enj. Sıcaklığı (°C)")
    mold_temp_c: Optional[int] = Field(None, ge=0, description="Kalıp Sıcaklığı (°C)")
    material: Optional[str] = Field(None, max_length=100, description="Malzeme")
    part_weight_g: Optional[int] = Field(None, ge=0, description="Parça Ağırlığı (g)")
    hourly_production: Optional[int] = Field(None, ge=0, description="Saatlik Üretim (adet)")

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    
    # Molds'tan taşınan alanlar (Excel kolonları)
    cavity_count: Optional[int] = Field(None, ge=1)
    cycle_time_sec: Optional[int] = Field(None, ge=1)
    injection_temp_c: Optional[int] = Field(None, ge=0)
    mold_temp_c: Optional[int] = Field(None, ge=0)
    material: Optional[str] = Field(None, max_length=100)
    part_weight_g: Optional[int] = Field(None, ge=0)
    hourly_production: Optional[int] = Field(None, ge=0)


class ProductUpsert(BaseModel):
    """Ürün ekleme veya güncelleme (varsa güncelle, yoksa ekle)"""
    name: str = Field(..., min_length=1, max_length=200, description="Ürün adı (anahtar alan)")
    code: Optional[str] = Field(None, max_length=50, description="Ürün kodu (opsiyonel, yoksa otomatik oluşturulur)")
    description: Optional[str] = Field(None, max_length=500, description="Ürün açıklaması")
    
    # Üretim parametreleri (AI eğitimi için önemli)
    cavity_count: Optional[int] = Field(None, ge=1, description="Göz Adedi")
    cycle_time_sec: Optional[int] = Field(None, ge=1, description="Çevrim Süresi (sn)")
    injection_temp_c: Optional[int] = Field(None, ge=0, description="Enj. Sıcaklığı (°C)")
    mold_temp_c: Optional[int] = Field(None, ge=0, description="Kalıp Sıcaklığı (°C)")
    material: Optional[str] = Field(None, max_length=100, description="Malzeme")
    part_weight_g: Optional[int] = Field(None, ge=0, description="Parça Ağırlığı (g)")
    hourly_production: Optional[int] = Field(None, ge=0, description="Saatlik Üretim (adet)")
    
    # AI eğitim kontrolü
    auto_train: Optional[bool] = Field(False, description="True ise güncelleme sonrası AI modeli otomatik eğitilir")

class ProductResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    
    # Molds'tan taşınan alanlar (Excel kolonları)
    cavity_count: Optional[int] = None
    cycle_time_sec: Optional[int] = None
    injection_temp_c: Optional[int] = None
    mold_temp_c: Optional[int] = None
    material: Optional[str] = None
    part_weight_g: Optional[int] = None
    hourly_production: Optional[int] = None
    
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime] = None  # Soft delete: NULL = aktif
    
    class Config:
        from_attributes = True


# 🔧 Kalıp Schemas
class MoldCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="Kalıp kodu (örn: MOLD-001)")
    name: str = Field(..., min_length=1, max_length=200, description="Kalıp adı")
    description: Optional[str] = Field(None, max_length=500, description="Kalıp açıklaması")
    product_id: Optional[int] = Field(None, description="Hangi ürün için kullanılıyor")
    status: Optional[str] = Field("active", pattern="^(active|maintenance|inactive)$")
    
    # Excel kolonları kaldırıldı - artık products tablosunda

class MoldUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    product_id: Optional[int] = None
    status: Optional[str] = Field(None, pattern="^(active|maintenance|inactive)$")
    
    # Excel kolonları kaldırıldı - artık products tablosunda

class MoldResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    product_id: Optional[int]
    status: str
    
    # Excel kolonları kaldırıldı - artık products tablosunda
    
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime] = None  # Soft delete: NULL = aktif
    
    class Config:
        from_attributes = True
