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
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


