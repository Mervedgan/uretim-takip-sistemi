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
    try:
        # Datetime objelerini kontrol et ve gerekirse dönüştür
        from datetime import datetime, timezone
        
        # Eğer string ise datetime'a çevir
        if isinstance(wo_data.planned_start, str):
            planned_start = datetime.fromisoformat(wo_data.planned_start.replace('Z', '+00:00'))
        else:
            planned_start = wo_data.planned_start
            
        if isinstance(wo_data.planned_end, str):
            planned_end = datetime.fromisoformat(wo_data.planned_end.replace('Z', '+00:00'))
        else:
            planned_end = wo_data.planned_end
        
        # Timezone-aware yap (eğer değilse)
        if planned_start.tzinfo is None:
            planned_start = planned_start.replace(tzinfo=timezone.utc)
        if planned_end.tzinfo is None:
            planned_end = planned_end.replace(tzinfo=timezone.utc)
        
        wo = WorkOrder(
            product_code=wo_data.product_code,
            lot_no=wo_data.lot_no,
            qty=wo_data.qty,
            produced_qty=wo_data.produced_qty or 0,  # Mevcut üretilen ürün sayısı (varsayılan: 0)
            planned_start=planned_start,
            planned_end=planned_end,
            created_by=current_user["user_id"],  # Work order'ı oluşturan kullanıcının ID'si
            machine_id=wo_data.machine_id,  # Üretim için seçilen makine ID'si
        )

        db.add(wo)
        db.commit()
        db.refresh(wo)

        # ✅ Auto-create stages
        stages_created = []
        current_start = planned_start
        
        # Kullanıcının belirttiği aşama sayısını kullan, yoksa varsayılan 2
        num_stages = wo_data.stage_count if wo_data.stage_count else 2
        
        # Toplam süreyi aşamalara eşit olarak böl
        total_duration = (planned_end - planned_start).total_seconds() / 60  # dakika cinsinden
        stage_duration = total_duration / num_stages  # Her aşama için süre
        
        # Aşama isimleri oluştur
        stage_names = []
        if wo_data.stage_names and len(wo_data.stage_names) == num_stages:
            # Kullanıcı aşama isimleri girdiyse onları kullan
            stage_names = wo_data.stage_names
        elif num_stages == 1:
            stage_names = ["Üretim"]
        elif num_stages == 2:
            stage_names = ["Enjeksiyon", "Montaj"]
        else:
            # 3 veya daha fazla aşama için genel isimler
            stage_names = [f"Aşama {i+1}" for i in range(num_stages)]
        
        for i in range(num_stages):
            # Son aşama için kalan tüm süreyi kullan
            if i == num_stages - 1:
                stage_end = planned_end
            else:
                stage_end = current_start + timedelta(minutes=stage_duration)
                # Son stage'in bitişi work order'ın bitişini geçmemeli
                if stage_end > planned_end:
                    stage_end = planned_end
            
            stage = WorkOrderStage(
                work_order_id=wo.id,
                stage_name=stage_names[i],
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
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error creating work order: {error_detail}")
        raise HTTPException(
            status_code=500,
            detail=f"İş emri oluşturulurken hata oluştu: {str(e)}"
        )


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
            "machine_id": wo.machine_id,  # Üretim için seçilen makine ID'si
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
