import pytest
from datetime import datetime, timedelta
from app.models import WorkOrder, WorkOrderStage


@pytest.fixture
def work_order_with_stage(client, admin_token, db):
    """Create a work order with stage for testing"""
    wo = WorkOrder(
        product_code="PRD-001",
        lot_no="LOT-001",
        qty=100,
        planned_start=datetime.utcnow(),
        planned_end=datetime.utcnow() + timedelta(hours=2)
    )
    db.add(wo)
    db.commit()
    db.refresh(wo)
    
    stage = WorkOrderStage(
        work_order_id=wo.id,
        stage_name="Test Stage",
        planned_start=datetime.utcnow(),
        planned_end=datetime.utcnow() + timedelta(minutes=30),
        status="planned"
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    
    return wo, stage


def test_start_stage(client, auth_token, work_order_with_stage):
    """Test starting a stage"""
    wo, stage = work_order_with_stage
    response = client.post(
        f"/stages/{stage.id}/start",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    assert response.json()["actual_start"] is not None


def test_start_stage_invalid_state(client, auth_token, work_order_with_stage, db):
    """Test starting a stage that's already in progress"""
    wo, stage = work_order_with_stage
    stage.status = "in_progress"
    db.commit()
    
    response = client.post(
        f"/stages/{stage.id}/start",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 400


def test_done_stage(client, auth_token, work_order_with_stage, db):
    """Test completing a stage"""
    wo, stage = work_order_with_stage
    # First start the stage
    stage.status = "in_progress"
    stage.actual_start = datetime.utcnow()
    db.commit()
    
    response = client.post(
        f"/stages/{stage.id}/done",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "done"
    assert response.json()["actual_end"] is not None


def test_done_stage_not_started(client, auth_token, work_order_with_stage):
    """Test completing a stage that hasn't started"""
    wo, stage = work_order_with_stage
    response = client.post(
        f"/stages/{stage.id}/done",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 400



