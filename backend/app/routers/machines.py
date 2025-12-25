from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.db import get_db
from app.models import Machine, MachineReading
from app.routers.auth import get_current_user

router = APIRouter(prefix="/machines", tags=["Machines"])


# Schemas
class MachineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    machine_type: str = Field(..., min_length=1, max_length=50)
    location: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field("active", pattern="^(active|maintenance|inactive)$")


class MachineReadingCreate(BaseModel):
    reading_type: str = Field(..., min_length=1, max_length=50)
    value: str = Field(..., min_length=1)
    timestamp: Optional[datetime] = None


# ---------------------------------------------------------
# ✅ List Machines
# ---------------------------------------------------------
@router.get("/")
def list_machines(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Tüm makineleri listeler.
    
    **Yetki:** Tüm roller
    """
    machines = db.query(Machine).all()
    return {
        "total": len(machines),
        "data": machines
    }


# ---------------------------------------------------------
# ✅ Create Machine
# ---------------------------------------------------------
@router.post("/")
def create_machine(
    machine_data: MachineCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Yeni makine oluşturur.
    
    **Yetki:** Tüm roller (production'da sadece admin olmalı)
    """
    existing = db.query(Machine).filter(Machine.name == machine_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu makine adı zaten kayıtlı.")
    
    machine = Machine(
        name=machine_data.name,
        machine_type=machine_data.machine_type,
        location=machine_data.location,
        status=machine_data.status
    )
    
    db.add(machine)
    db.commit()
    db.refresh(machine)
    
    return {
        "ok": True,
        "machine_id": machine.id,
        "name": machine.name
    }


# ---------------------------------------------------------
# ✅ Post Machine Reading (Mock)
# ---------------------------------------------------------
@router.post("/{machine_id}/readings")
def post_machine_reading(
    machine_id: int,
    reading_data: MachineReadingCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Makine okuması gönderir (mock endpoint).
    
    Gerçek entegrasyon için:
    - OPC-UA: PLC'lerden veri okuma
    - Modbus: RTU/TCP protokolü ile sensör okuma
    - MQTT: IoT cihazlardan mesaj alma
    
    **Yetki:** Tüm roller (production'da sadece sistem servisleri)
    """
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Makine bulunamadı.")
    
    reading = MachineReading(
        machine_id=machine_id,
        reading_type=reading_data.reading_type,
        value=reading_data.value,
        timestamp=reading_data.timestamp or datetime.utcnow()
    )
    
    db.add(reading)
    db.commit()
    db.refresh(reading)
    
    return {
        "ok": True,
        "reading_id": reading.id,
        "machine_id": machine_id,
        "reading_type": reading.reading_type,
        "value": reading.value,
        "timestamp": reading.timestamp
    }


# ---------------------------------------------------------
# ✅ Get Machine Readings
# ---------------------------------------------------------
@router.get("/{machine_id}/readings")
def get_machine_readings(
    machine_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Makine okumalarını getirir.
    
    **Yetki:** Tüm roller
    """
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Makine bulunamadı.")
    
    readings = db.query(MachineReading).filter(
        MachineReading.machine_id == machine_id
    ).order_by(MachineReading.timestamp.desc()).limit(limit).all()
    
    return {
        "machine_id": machine_id,
        "machine_name": machine.name,
        "total": len(readings),
        "data": readings
    }



