"""
Token test scripti - Swagger'da token çalışmıyorsa bu script ile test edin
"""
import requests

# 1. Login yap
login_url = "http://localhost:8000/auth/login"
login_data = {
    "username": "admin",
    "password": "admin123"
}

print("1. Login yapılıyor...")
response = requests.post(login_url, data=login_data)
if response.status_code == 200:
    token = response.json()["access_token"]
    print(f"✅ Token alındı: {token[:50]}...")
else:
    print(f"❌ Login hatası: {response.status_code} - {response.text}")
    exit(1)

# 2. Work order oluştur
workorder_url = "http://localhost:8000/workorders/"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}
workorder_data = {
    "product_code": "PRD-001",
    "lot_no": "LOT-001",
    "qty": 100,
    "planned_start": "2024-12-22T10:00:00",
    "planned_end": "2024-12-22T14:00:00"
}

print("\n2. Work order oluşturuluyor...")
response = requests.post(workorder_url, json=workorder_data, headers=headers)
if response.status_code == 200:
    print(f"✅ Work order oluşturuldu!")
    print(f"Response: {response.json()}")
else:
    print(f"❌ Hata: {response.status_code}")
    print(f"Response: {response.text}")



