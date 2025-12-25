from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from .db import Base


# 👤 Kullanıcı tablosu
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)  # Şifre hash olarak saklanacak
    email = Column(String, unique=True, index=True, nullable=True)  # Email adresi
    phone = Column(String, nullable=True)  # Telefon numarası
    role = Column(String, default="worker")  # admin / manager / worker


# 🧾 İş Emri tablosu
class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(Integer, primary_key=True)
    product_code = Column(String)
    lot_no = Column(String)
    qty = Column(Integer)
    planned_start = Column(DateTime, nullable=True)
    planned_end = Column(DateTime, nullable=True)


# 🔄 İş Emri Aşamaları tablosu
class WorkOrderStage(Base):
    __tablename__ = "work_order_stages"
    id = Column(Integer, primary_key=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    stage_name = Column(String)
    planned_start = Column(DateTime, nullable=True)
    planned_end = Column(DateTime, nullable=True)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    status = Column(String, default="planned")  # planned / in_progress / done


# ⚠️ Arıza Bildirimleri tablosu
class Issue(Base):
    __tablename__ = "issues"
    id = Column(Integer, primary_key=True)
    work_order_stage_id = Column(Integer, ForeignKey("work_order_stages.id"))
    type = Column(String)          # örn: machine_breakdown, material_shortage
    description = Column(String, nullable=True)
    status = Column(String, default="open")  # open / acknowledged / resolved
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)


# 🏭 Makine tablosu
class Machine(Base):
    __tablename__ = "machines"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, index=True)
    machine_type = Column(String)  # örn: injection_molding, assembly
    location = Column(String, nullable=True)
    status = Column(String, default="active")  # active / maintenance / inactive
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# 📊 Makine Okumaları tablosu
class MachineReading(Base):
    __tablename__ = "machine_readings"
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, ForeignKey("machines.id"))
    reading_type = Column(String)  # örn: temperature, pressure, speed
    value = Column(String)  # Reading değeri (string olarak saklanır, farklı tipler için)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# 🔔 Manager Notification tablosu (DB tabanlı bildirimler)
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=True)
    recipient_role = Column(String)  # admin, planner (manager'lar)
    message = Column(String)
    read = Column(String, default="false")  # false / true
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    read_at = Column(DateTime, nullable=True)


# 📦 Ürün tablosu
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, index=True)  # Ürün kodu (örn: PRD-001)
    name = Column(String)  # Ürün adı
    description = Column(String, nullable=True)  # Açıklama
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete: Silinme tarihi (NULL = aktif)


# 🔧 Kalıp tablosu
class Mold(Base):
    __tablename__ = "molds"
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, index=True)  # Kalıp kodu (örn: MOLD-001)
    name = Column(String)  # Kalıp adı (Excel: "Kalıp Adı")
    description = Column(String, nullable=True)  # Açıklama
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)  # Hangi ürün için kullanılıyor (Excel: "Ürün Tipi")
    status = Column(String, default="active")  # active / maintenance / inactive
    
    # Excel kolonları
    cavity_count = Column(Integer, nullable=True)  # Göz Adedi
    cycle_time_sec = Column(Integer, nullable=True)  # Çevrim Süresi (sn)
    injection_temp_c = Column(Integer, nullable=True)  # Enj. Sıcaklığı (°C)
    mold_temp_c = Column(Integer, nullable=True)  # Kalıp Sıcaklığı (°C)
    material = Column(String, nullable=True)  # Malzeme
    part_weight_g = Column(Integer, nullable=True)  # Parça Ağırlığı (g)
    hourly_production = Column(Integer, nullable=True)  # Saatlik Üretim (adet)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete: Silinme tarihi (NULL = aktif)


