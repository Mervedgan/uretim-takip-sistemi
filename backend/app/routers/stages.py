from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import WorkOrderStage, Issue
from app.schemas import StartDoneResponse, IssueCreate
from app.routers.auth import require_roles  # ✅ Import helper

router = APIRouter(prefix="/stages", tags=["stages"])


# ---------------------------------------------------------
# ✅ Stage Başlat: Worker veya Planner
# ---------------------------------------------------------
@router.post("/{wos_id}/start", response_model=StartDoneResponse)
def start_stage(
    wos_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("worker", "planner"))  # ✅ worker + planner
):
    """
    Bir aşamayı başlatır.
    
    **Yetki:** "worker" veya "planner" rolü
    """
    s = db.query(WorkOrderStage).get(wos_id)
    if not s:
        raise HTTPException(status_code=404, detail="Stage not found")

    if s.actual_start is None:
        s.actual_start = datetime.now(timezone.utc)
        s.status = "in_progress"
        db.commit()
        db.refresh(s)

    return {
        "ok": True,
        "work_order_stage_id": s.id,
        "status": s.status,
        "actual_start": s.actual_start,
        "actual_end": s.actual_end,
    }


# ---------------------------------------------------------
# ✅ Stage Bitir: Worker veya Planner
# ---------------------------------------------------------
@router.post("/{wos_id}/done", response_model=StartDoneResponse)
def done_stage(
    wos_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("worker", "planner"))  # ✅ worker + planner
):
    """
    Bir aşamayı bitirir.
    
    **Yetki:** "worker" veya "planner" rolü
    """
    s = db.query(WorkOrderStage).get(wos_id)
    if not s:
        raise HTTPException(status_code=404, detail="Stage not found")

    if s.actual_start is None:
        raise HTTPException(status_code=400, detail="Stage not started yet")

    if s.actual_end is None:
        s.actual_end = datetime.now(timezone.utc)
        s.status = "done"
        db.commit()
        db.refresh(s)

    return {
        "ok": True,
        "work_order_stage_id": s.id,
        "status": s.status,
        "actual_start": s.actual_start,
        "actual_end": s.actual_end,
    }


# ---------------------------------------------------------
# ✅ Issue Bildir: Worker veya Planner
# ---------------------------------------------------------
@router.post("/{wos_id}/issue")
def report_issue(
    wos_id: int,
    payload: IssueCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("worker", "planner"))  # ✅ worker + planner
):
    """
    Bir aşamada sorun bildirir.
    
    **Yetki:** "worker" veya "planner" rolü
    """
    s = db.query(WorkOrderStage).get(wos_id)
    if not s:
        raise HTTPException(status_code=404, detail="Stage not found")

    issue = Issue(
        work_order_stage_id=wos_id,
        type=payload.type,
        description=payload.description,
        created_by=current_user["user_id"],  # ✅ Kim bildirdi?
    )

    db.add(issue)
    db.commit()
    db.refresh(issue)

    return {
        "ok": True, 
        "issue_id": issue.id,
        "reported_by": current_user["username"]  # ✅ Kullanıcı bilgisi
    }

