from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List

from app.db import get_db
from app.models import Issue, Notification, User
from app.routers.auth import require_roles, get_current_user

router = APIRouter(prefix="/issues", tags=["Issues"])


# ---------------------------------------------------------
# ✅ List Issues (Manager/Admin/Worker)
# ---------------------------------------------------------
@router.get("/")
def list_issues(
    status: Optional[str] = Query(None, description="Filter by status: open, acknowledged, resolved"),
    issue_type: Optional[str] = Query(None, alias="type", description="Filter by issue type"),
    work_order_stage_id: Optional[int] = Query(None, description="Filter by work order stage ID"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "planner", "worker"))  # ✅ admin + planner + worker
):
    """
    Tüm issue'ları listeler (filtreleme ile).
    
    **Yetki:** "admin", "planner" veya "worker" rolü
    """
    query = db.query(Issue)
    
    # Apply filters
    if status:
        query = query.filter(Issue.status == status)
    if issue_type:
        query = query.filter(Issue.type == issue_type)
    if work_order_stage_id:
        query = query.filter(Issue.work_order_stage_id == work_order_stage_id)
    
    issues = query.order_by(Issue.created_at.desc()).all()
    
    return {
        "total": len(issues),
        "data": issues
    }


# ---------------------------------------------------------
# ✅ Update Issue Status
# ---------------------------------------------------------
@router.patch("/{issue_id}/status")
def update_issue_status(
    issue_id: int,
    new_status: str = Query(..., description="New status: open, acknowledged, resolved"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "planner"))
):
    """
    Issue durumunu günceller.
    
    **Yetki:** "admin" veya "planner" rolü
    """
    if new_status not in ["open", "acknowledged", "resolved"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Must be one of: open, acknowledged, resolved"
        )
    
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue bulunamadı.")
    
    old_status = issue.status
    issue.status = new_status
    now = datetime.now(timezone.utc)
    
    # Update timestamps
    if new_status == "acknowledged" and not issue.acknowledged_at:
        issue.acknowledged_at = now
    elif new_status == "resolved" and not issue.resolved_at:
        issue.resolved_at = now
    
    db.commit()
    db.refresh(issue)
    
    # ✅ DB tabanlı notification oluştur (manager'lara bildir)
    if new_status == "acknowledged":
        # Manager'lara (admin, planner) bildirim gönder
        for role in ["admin", "planner"]:
            notification = Notification(
                issue_id=issue.id,
                recipient_role=role,
                message=f"Issue #{issue.id} acknowledged by {current_user['username']}"
            )
            db.add(notification)
    elif new_status == "resolved":
        # Manager'lara çözüldü bildirimi
        for role in ["admin", "planner"]:
            notification = Notification(
                issue_id=issue.id,
                recipient_role=role,
                message=f"Issue #{issue.id} resolved by {current_user['username']}"
            )
            db.add(notification)
    
    db.commit()
    
    return {
        "ok": True,
        "issue_id": issue.id,
        "old_status": old_status,
        "new_status": issue.status,
        "updated_by": current_user["username"]
    }


# ---------------------------------------------------------
# ✅ Get Notifications (Manager/Admin)
# ---------------------------------------------------------
@router.get("/notifications")
def get_notifications(
    read: Optional[str] = Query(None, description="Filter by read status: true, false"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "planner"))
):
    """
    Manager/Admin için bildirimleri listeler.
    
    **Yetki:** "admin" veya "planner" rolü
    
    **Query Parameters:**
    - `read`: "true" veya "false" (opsiyonel)
    """
    # Validation: read parametresi sadece "true" veya "false" olabilir
    if read is not None and read not in ["true", "false"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid 'read' parameter. Must be 'true' or 'false'"
        )
    
    try:
        query = db.query(Notification).filter(
            Notification.recipient_role == current_user["role"]
        )
        
        if read:
            query = query.filter(Notification.read == read)
        
        notifications = query.order_by(Notification.created_at.desc()).all()
        
        return {
            "total": len(notifications),
            "unread_count": len([n for n in notifications if n.read == "false"]),
            "data": notifications
        }
    except Exception as e:
        # Daha detaylı hata mesajı
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}. Make sure notifications table exists. Run: alembic upgrade head"
        )


# ---------------------------------------------------------
# ✅ Mark Notification as Read
# ---------------------------------------------------------
@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "planner"))
):
    """
    Bildirimi okundu olarak işaretler.
    
    **Yetki:** "admin" veya "planner" rolü
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_role == current_user["role"]
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification bulunamadı.")
    
    notification.read = "true"
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    
    return {
        "ok": True,
        "notification_id": notification.id,
        "read": notification.read,
        "read_at": notification.read_at
    }

