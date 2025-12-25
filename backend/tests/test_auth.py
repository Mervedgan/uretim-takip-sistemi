import pytest
from app.models import User


def test_register(client):
    """Test user registration"""
    response = client.post(
        "/auth/register",
        json={
            "username": "newuser",
            "password": "password123",
            "role": "worker"
        }
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert "user_id" in response.json()


def test_register_duplicate(client, test_user):
    """Test duplicate username registration"""
    response = client.post(
        "/auth/register",
        json={
            "username": "testuser",
            "password": "password123",
            "role": "worker"
        }
    )
    assert response.status_code == 400


def test_login(client, test_user):
    """Test user login"""
    response = client.post(
        "/auth/login",
        data={"username": "testuser", "password": "testpass123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_login_invalid_credentials(client):
    """Test login with invalid credentials"""
    response = client.post(
        "/auth/login",
        data={"username": "wronguser", "password": "wrongpass"}
    )
    assert response.status_code == 401


def test_list_users(client, admin_token):
    """Test admin can list users"""
    response = client.get(
        "/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_users_unauthorized(client, auth_token):
    """Test non-admin cannot list users"""
    response = client.get(
        "/auth/users",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 403


def test_change_user_role(client, admin_token, test_user):
    """Test admin can change user role"""
    response = client.patch(
        f"/auth/users/{test_user.id}/role",
        json={"role": "planner"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["new_role"] == "planner"

