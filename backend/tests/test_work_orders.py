import pytest
from datetime import datetime, timedelta
from app.models import WorkOrder


@pytest.fixture
def work_order_data():
    """Sample work order data"""
    return {
        "product_code": "PRD-001",
        "lot_no": "LOT-001",
        "qty": 100,
        "planned_start": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        "planned_end": (datetime.utcnow() + timedelta(hours=3)).isoformat()
    }


def test_create_work_order(client, admin_token, work_order_data):
    """Test creating work order as admin"""
    response = client.post(
        "/workorders/",
        json=work_order_data,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert "work_order_id" in response.json()
    assert "stages_created" in response.json()


def test_create_work_order_unauthorized(client, auth_token, work_order_data):
    """Test worker cannot create work order"""
    response = client.post(
        "/workorders/",
        json=work_order_data,
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 403


def test_list_work_orders(client, auth_token):
    """Test listing work orders"""
    response = client.get(
        "/workorders/",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    assert "total" in response.json()
    assert "data" in response.json()


def test_get_work_order(client, auth_token, admin_token, work_order_data):
    """Test getting work order detail"""
    # Create work order first
    create_response = client.post(
        "/workorders/",
        json=work_order_data,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    wo_id = create_response.json()["work_order_id"]
    
    # Get work order
    response = client.get(
        f"/workorders/{wo_id}",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    assert response.json()["id"] == wo_id


def test_validation_qty_negative(client, admin_token):
    """Test validation: qty must be > 0"""
    response = client.post(
        "/workorders/",
        json={
            "product_code": "PRD-001",
            "lot_no": "LOT-001",
            "qty": -10,  # Invalid
            "planned_start": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "planned_end": (datetime.utcnow() + timedelta(hours=3)).isoformat()
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 422  # Validation error



