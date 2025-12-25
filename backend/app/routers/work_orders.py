from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import WorkOrder, WorkOrderStage
from app.schemas import WorkOrderCreate
from app.routers.auth import require_roles, get_current_user

router = APIRouter(prefix="/workorders", tags=["Work Orders"])

# Default stages to auto-create
DEFAULT_STAGES = [
    {"name": "Enjeksiyon", "duration_minutes": 30},
    {"name": "Montaj", "duration_minutes": 60},
]


# ---------------------------------------------------------
# ✅ İş Emri Oluştur: Sadece planner veya admin
# ---------------------------------------------------------
@router.post(
    "/",
    dependencies=[Depends(require_roles("planner", "admin"))]
)
def create_work_order(
    wo_data: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("planner", "admin"))  # ✅ planner + admin
):
    """
    Yeni iş emri oluşturur.
    
    **Yetki:** "planner" veya "admin" rolü
    """
    wo = WorkOrder(
        product_code=wo_data.product_code,
        lot_no=wo_data.lot_no,
        qty=wo_data.qty,
        planned_start=wo_data.planned_start,
        planned_end=wo_data.planned_end,
    )

    db.add(wo)
    db.commit()
    db.refresh(wo)

    # ✅ Auto-create default stages
    stages_created = []
    current_start = wo_data.planned_start
    
    for stage_config in DEFAULT_STAGES:
        stage_end = current_start + timedelta(minutes=stage_config["duration_minutes"])
        
        # Son stage'in bitişi work order'ın bitişini geçmemeli
        if stage_end > wo_data.planned_end:
            stage_end = wo_data.planned_end
        
        stage = WorkOrderStage(
            work_order_id=wo.id,
            stage_name=stage_config["name"],
            planned_start=current_start,
            planned_end=stage_end,
            status="planned"
        )
        db.add(stage)
        stages_created.append({
            "id": stage.id,
            "name": stage.stage_name,
            "planned_start": stage.planned_start,
            "planned_end": stage.planned_end
        })
        
        current_start = stage_end
    
    db.commit()

    return {
        "ok": True, 
        "work_order_id": wo.id,
        "created_by": current_user["username"],
        "stages_created": len(stages_created),
        "stages": stages_created
    }


# ---------------------------------------------------------
# ✅ İş Emirlerini Listele: Tüm roller görebilir
# ---------------------------------------------------------
@router.get("/")
def list_work_orders(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # ✅ Tüm giriş yapmış kullanıcılar
):
    """
    Tüm iş emirlerini listeler.
    
    **Yetki:** Tüm roller (worker, planner, admin)
    """
    work_orders = db.query(WorkOrder).all()
    
    return {
        "total": len(work_orders),
        "data": work_orders,
        "requested_by": current_user["username"]
    }


# ---------------------------------------------------------
# ✅ İş Emri Detayı: Tüm roller görebilir
# ---------------------------------------------------------
@router.get("/{wo_id}")
def get_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # ✅ Tüm roller
):
    """
    Belirli bir iş emrinin detaylarını getirir.
    
    **Yetki:** Tüm roller (worker, planner, admin)
    """
    wo = db.query(WorkOrder).get(wo_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order bulunamadı.")
    
    return wo


# ---------------------------------------------------------
# ✅ İş Emrine Ait Aşamalar: Tüm roller görebilir
# ---------------------------------------------------------
@router.get("/{wo_id}/stages")
def get_work_order_stages(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)  # ✅ Tüm roller
):
    """
    Bir iş emrinin aşamalarını getirir.
    
    **Yetki:** Tüm roller (worker, planner, admin)
    """
    stages = db.query(WorkOrderStage).filter(
        WorkOrderStage.work_order_id == wo_id
    ).all()

    return stages
