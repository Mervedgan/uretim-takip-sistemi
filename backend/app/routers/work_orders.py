from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import WorkOrder, WorkOrderStage, User
from app.schemas import WorkOrderCreate
from app.routers.auth import require_roles, get_current_user

router = APIRouter(prefix="/workorders", tags=["Work Orders"])

# Default stages to auto-create
DEFAULT_STAGES = [
    {"name": "Enjeksiyon", "duration_minutes": 30},
    {"name": "Montaj", "duration_minutes": 60},
]


# ---------------------------------------------------------
# ✅ İş Emri Oluştur: planner, admin veya worker
# ---------------------------------------------------------
@router.post(
    "/",
    dependencies=[Depends(require_roles("planner", "admin", "worker"))]
)
def create_work_order(
    wo_data: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("planner", "admin", "worker"))  # ✅ planner + admin + worker
):
    """
    Yeni iş emri oluşturur.
    
    **Yetki:** "planner", "admin" veya "worker" rolü
    """
    wo = WorkOrder(
        product_code=wo_data.product_code,
        lot_no=wo_data.lot_no,
        qty=wo_data.qty,
        produced_qty=wo_data.produced_qty or 0,  # Mevcut üretilen ürün sayısı (varsayılan: 0)
        planned_start=wo_data.planned_start,
        planned_end=wo_data.planned_end,
        created_by=current_user["user_id"],  # Work order'ı oluşturan kullanıcının ID'si
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
        db.flush()  # ID'yi almak için flush yap (commit yapmadan)
        
        stages_created.append({
            "id": stage.id,
            "name": stage.stage_name,
            "planned_start": stage.planned_start.isoformat() if stage.planned_start else None,
            "planned_end": stage.planned_end.isoformat() if stage.planned_end else None
        })
        
        current_start = stage_end
    
    db.commit()  # Tüm stage'leri commit et

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
    
    # Work order'ları serialize ederken created_by kullanıcı bilgisini ekle
    result = []
    for wo in work_orders:
        wo_dict = {
            "id": wo.id,
            "product_code": wo.product_code,
            "lot_no": wo.lot_no,
            "qty": wo.qty,  # Hedef ürün sayısı
            "produced_qty": wo.produced_qty or 0,  # Mevcut üretilen ürün sayısı
            "planned_start": wo.planned_start.isoformat() if wo.planned_start else None,
            "planned_end": wo.planned_end.isoformat() if wo.planned_end else None,
            "created_by": wo.created_by,
        }
        # created_by kullanıcısının username'ini ekle
        if wo.created_by:
            creator = db.query(User).filter(User.id == wo.created_by).first()
            if creator:
                wo_dict["created_by_username"] = creator.username
        result.append(wo_dict)
    
    return {
        "total": len(work_orders),
        "data": result,
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
