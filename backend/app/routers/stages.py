from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import WorkOrderStage, Issue, Notification
from app.schemas import StartDoneResponse, IssueCreate
from app.routers.auth import require_roles
from app.utils.state_machine import validate_state_transition

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
    s = db.query(WorkOrderStage).filter(WorkOrderStage.id == wos_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stage not found")

    # ✅ State machine validation
    if s.status != "planned":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start stage. Current status: {s.status}. Expected: 'planned'"
        )

    if s.actual_start is None:
        try:
            validate_state_transition(s.status, "in_progress")
            s.actual_start = datetime.now(timezone.utc)
            s.status = "in_progress"
            db.commit()
            db.refresh(s)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

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
    s = db.query(WorkOrderStage).filter(WorkOrderStage.id == wos_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stage not found")

    if s.actual_start is None:
        raise HTTPException(status_code=400, detail="Stage not started yet")

    # ✅ State machine validation
    if s.status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete stage. Current status: {s.status}. Expected: 'in_progress'"
        )

    if s.actual_end is None:
        try:
            validate_state_transition(s.status, "done")
            s.actual_end = datetime.now(timezone.utc)
            s.status = "done"
            db.commit()
            db.refresh(s)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

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
    s = db.query(WorkOrderStage).filter(WorkOrderStage.id == wos_id).first()
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

    # ✅ DB tabanlı notification oluştur (manager'lara bildir)
    for role in ["admin", "planner"]:
        notification = Notification(
            issue_id=issue.id,
            recipient_role=role,
            message=f"New issue #{issue.id} reported: {payload.type} - {payload.description or 'No description'}"
        )
        db.add(notification)
    
    db.commit()

    return {
        "ok": True, 
        "issue_id": issue.id,
        "reported_by": current_user["username"],  # ✅ Kullanıcı bilgisi
        "notifications_sent": 2  # admin + planner
    }

