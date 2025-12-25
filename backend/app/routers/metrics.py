from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional

from app.db import get_db
from app.models import WorkOrder, WorkOrderStage
from app.routers.auth import get_current_user

router = APIRouter(prefix="/metrics", tags=["Metrics"])


# ---------------------------------------------------------
# ✅ Work Order Metrics
# ---------------------------------------------------------
@router.get("/workorders/{wo_id}")
def get_work_order_metrics(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    İş emri için verimlilik metriklerini hesaplar.
    
    **Yetki:** Tüm roller
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order bulunamadı.")
    
    # Planned duration
    if wo.planned_start and wo.planned_end:
        planned_duration = (wo.planned_end - wo.planned_start).total_seconds() / 60  # minutes
    else:
        planned_duration = None
    
    # Get all stages
    stages = db.query(WorkOrderStage).filter(
        WorkOrderStage.work_order_id == wo_id
    ).all()
    
    # Calculate actual duration from stages
    actual_duration = None
    if stages:
        started_stages = [s for s in stages if s.actual_start]
        completed_stages = [s for s in stages if s.actual_end]
        
        if started_stages and completed_stages:
            first_start = min(s.actual_start for s in started_stages)
            last_end = max(s.actual_end for s in completed_stages)
            actual_duration = (last_end - first_start).total_seconds() / 60  # minutes
    
    # Calculate delay and efficiency
    delay_minutes = None
    efficiency_percent = None
    on_time = None
    
    if planned_duration and actual_duration:
        delay_minutes = actual_duration - planned_duration
        efficiency_percent = (planned_duration / actual_duration * 100) if actual_duration > 0 else 0
        on_time = delay_minutes <= 0
    
    # Stage statistics
    total_stages = len(stages)
    completed_stages = len([s for s in stages if s.status == "done"])
    in_progress_stages = len([s for s in stages if s.status == "in_progress"])
    planned_stages = len([s for s in stages if s.status == "planned"])
    
    return {
        "work_order_id": wo_id,
        "planned_duration_minutes": planned_duration,
        "actual_duration_minutes": actual_duration,
        "delay_minutes": delay_minutes,
        "efficiency_percent": round(efficiency_percent, 2) if efficiency_percent else None,
        "on_time": on_time,
        "stages": {
            "total": total_stages,
            "completed": completed_stages,
            "in_progress": in_progress_stages,
            "planned": planned_stages
        }
    }


# ---------------------------------------------------------
# ✅ Stage Metrics
# ---------------------------------------------------------
@router.get("/stages/{wos_id}")
def get_stage_metrics(
    wos_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Aşama için verimlilik metriklerini hesaplar.
    
    **Yetki:** Tüm roller
    """
    stage = db.query(WorkOrderStage).filter(WorkOrderStage.id == wos_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage bulunamadı.")
    
    # Planned duration
    planned_duration = None
    if stage.planned_start and stage.planned_end:
        planned_duration = (stage.planned_end - stage.planned_start).total_seconds() / 60  # minutes
    
    # Actual duration
    actual_duration = None
    if stage.actual_start and stage.actual_end:
        actual_duration = (stage.actual_end - stage.actual_start).total_seconds() / 60  # minutes
    
    # Calculate delay and efficiency
    delay_minutes = None
    efficiency_percent = None
    on_time = None
    
    if planned_duration and actual_duration:
        delay_minutes = actual_duration - planned_duration
        efficiency_percent = (planned_duration / actual_duration * 100) if actual_duration > 0 else 0
        on_time = delay_minutes <= 0
    
    return {
        "stage_id": wos_id,
        "stage_name": stage.stage_name,
        "status": stage.status,
        "planned_duration_minutes": planned_duration,
        "actual_duration_minutes": actual_duration,
        "delay_minutes": delay_minutes,
        "efficiency_percent": round(efficiency_percent, 2) if efficiency_percent else None,
        "on_time": on_time,
        "planned_start": stage.planned_start,
        "planned_end": stage.planned_end,
        "actual_start": stage.actual_start,
        "actual_end": stage.actual_end
    }



