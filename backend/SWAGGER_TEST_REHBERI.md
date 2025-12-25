# 🧪 Swagger Test Rehberi

## 📋 Test Sırası

### 1️⃣ AUTH (Kimlik Doğrulama)

#### ✅ Register - Yeni Kullanıcı Oluştur
- **Endpoint:** `POST /auth/register`
- **Authorization:** Gerekmez (Public)
- **Body:**
```json
{
  "username": "testuser",
  "password": "test123",
  "role": "worker"
}
```
- **Beklenen:** `{"ok": true, "user_id": X, "username": "testuser", "role": "worker"}`

#### ✅ Login - Token Al
- **Endpoint:** `POST /auth/login`
- **Authorization:** Gerekmez (Public)
- **Body (form-data):**
  - `username`: admin (veya oluşturduğunuz kullanıcı)
  - `password`: admin123 (veya kullanıcının şifresi)
- **Beklenen:** `{"access_token": "eyJ...", "token_type": "bearer"}`
- **ÖNEMLİ:** `access_token` değerini kopyalayın!

#### ✅ Authorize - Token'ı Swagger'a Ekle
- Sağ üstteki **"Authorize"** butonuna tıklayın
- **"BearerAuth"** bölümünde **"Value:"** alanına token'ı yapıştırın
- **"Authorize"** butonuna tıklayın
- **"Close"** butonuna tıklayın

#### ✅ List Users (Admin Only)
- **Endpoint:** `GET /auth/users`
- **Authorization:** Gerekli (Admin rolü)
- **Beklenen:** Tüm kullanıcıların listesi

#### ✅ Change User Role (Admin Only)
- **Endpoint:** `PATCH /auth/users/{user_id}/role`
- **Authorization:** Gerekli (Admin rolü)
- **Body:**
```json
{
  "role": "planner"
}
```
- **Beklenen:** `{"ok": true, "user_id": X, "old_role": "worker", "new_role": "planner"}`

---

### 2️⃣ WORK ORDERS (İş Emirleri)

#### ✅ Create Work Order (Planner/Admin)
- **Endpoint:** `POST /workorders/`
- **Authorization:** Gerekli (Planner veya Admin)
- **Body:**
```json
{
  "product_code": "PRD-001",
  "lot_no": "LOT-001",
  "qty": 100,
  "planned_start": "2025-12-23T10:00:00",
  "planned_end": "2025-12-23T14:00:00"
}
```
- **ÖNEMLİ:** `planned_end` > `planned_start` olmalı!
- **Beklenen:** 
  - `work_order_id` döner
  - Otomatik olarak 2 stage oluşturulur: "Enjeksiyon" ve "Montaj"

#### ✅ List Work Orders
- **Endpoint:** `GET /workorders/`
- **Authorization:** Gerekli (Tüm roller)
- **Beklenen:** Tüm iş emirlerinin listesi

#### ✅ Get Work Order Detail
- **Endpoint:** `GET /workorders/{wo_id}`
- **Authorization:** Gerekli (Tüm roller)
- **Beklenen:** İş emri detayı

#### ✅ Get Work Order Stages
- **Endpoint:** `GET /workorders/{wo_id}/stages`
- **Authorization:** Gerekli (Tüm roller)
- **Beklenen:** İş emrine ait tüm aşamalar

---

### 3️⃣ STAGES (Aşamalar)

#### ✅ Start Stage (Worker/Planner)
- **Endpoint:** `POST /stages/{wos_id}/start`
- **Authorization:** Gerekli (Worker veya Planner)
- **Beklenen:** 
  - Stage durumu `planned` → `in_progress` olur
  - `actual_start` zamanı kaydedilir

#### ✅ Done Stage (Worker/Planner)
- **Endpoint:** `POST /stages/{wos_id}/done`
- **Authorization:** Gerekli (Worker veya Planner)
- **ÖNEMLİ:** Önce `start` yapılmalı!
- **Beklenen:**
  - Stage durumu `in_progress` → `done` olur
  - `actual_end` zamanı kaydedilir

#### ✅ Report Issue (Worker/Planner)
- **Endpoint:** `POST /stages/{wos_id}/issue`
- **Authorization:** Gerekli (Worker veya Planner)
- **Body:**
```json
{
  "type": "machine_breakdown",
  "description": "Makine arızası var"
}
```
- **Beklenen:**
  - Issue oluşturulur
  - Manager'lara (admin, planner) notification gönderilir

---

### 4️⃣ ISSUES (Sorunlar)

#### ✅ List Issues (Admin/Planner)
- **Endpoint:** `GET /issues/`
- **Authorization:** Gerekli (Admin veya Planner)
- **Query Parameters (Opsiyonel):**
  - `status`: open, acknowledged, resolved
  - `type`: machine_breakdown, material_shortage, etc.
  - `work_order_stage_id`: Stage ID
- **Beklenen:** Filtrelenmiş issue listesi

#### ✅ Update Issue Status (Admin/Planner)
- **Endpoint:** `PATCH /issues/{issue_id}/status?new_status=acknowledged`
- **Authorization:** Gerekli (Admin veya Planner)
- **Query Parameter:** `new_status` = open, acknowledged, resolved
- **Beklenen:**
  - Issue durumu güncellenir
  - Manager'lara notification gönderilir

#### ✅ Get Notifications (Admin/Planner)
- **Endpoint:** `GET /issues/notifications`
- **Authorization:** Gerekli (Admin veya Planner)
- **Query Parameters (Opsiyonel):**
  - `read`: true, false
- **Beklenen:** Manager bildirimleri listesi

#### ✅ Mark Notification as Read (Admin/Planner)
- **Endpoint:** `PATCH /issues/notifications/{notification_id}/read`
- **Authorization:** Gerekli (Admin veya Planner)
- **Beklenen:** Bildirim okundu olarak işaretlenir

---

### 5️⃣ METRICS (Verimlilik)

#### ✅ Get Work Order Metrics
- **Endpoint:** `GET /metrics/workorders/{wo_id}`
- **Authorization:** Gerekli (Tüm roller)
- **Beklenen:**
  - `planned_duration_minutes`
  - `actual_duration_minutes`
  - `delay_minutes`
  - `efficiency_percent`
  - `on_time` (true/false)
  - Stage istatistikleri

#### ✅ Get Stage Metrics
- **Endpoint:** `GET /metrics/stages/{wos_id}`
- **Authorization:** Gerekli (Tüm roller)
- **Beklenen:**
  - `planned_duration_minutes`
  - `actual_duration_minutes`
  - `delay_minutes`
  - `efficiency_percent`
  - `on_time` (true/false)

---

### 6️⃣ MACHINES (Makineler)

#### ✅ List Machines
- **Endpoint:** `GET /machines/`
- **Authorization:** Gerekli (Tüm roller)
- **Beklenen:** Tüm makinelerin listesi

#### ✅ Create Machine
- **Endpoint:** `POST /machines/`
- **Authorization:** Gerekli (Tüm roller)
- **Body:**
```json
{
  "name": "Enjeksiyon Makinesi 1",
  "machine_type": "injection_molding",
  "location": "Üretim Hattı A",
  "status": "active"
}
```
- **Beklenen:** `{"ok": true, "machine_id": X, "name": "..."}`

#### ✅ Post Machine Reading (Mock)
- **Endpoint:** `POST /machines/{machine_id}/readings`
- **Authorization:** Gerekli (Tüm roller)
- **Body:**
```json
{
  "reading_type": "temperature",
  "value": "75.5",
  "timestamp": "2025-12-23T13:00:00"
}
```
- **Beklenen:** `{"ok": true, "reading_id": X, "value": "75.5"}`

#### ✅ Get Machine Readings
- **Endpoint:** `GET /machines/{machine_id}/readings?limit=100`
- **Authorization:** Gerekli (Tüm roller)
- **Beklenen:** Makine okumaları listesi

---

## 🎯 Test Senaryosu (Sıralı)

1. **Register** → Yeni kullanıcı oluştur
2. **Login** → Token al
3. **Authorize** → Token'ı Swagger'a ekle
4. **Create Work Order** → İş emri oluştur (otomatik stage'ler oluşur)
5. **List Work Orders** → Oluşturulan iş emrini gör
6. **Get Work Order Stages** → Stage'leri gör
7. **Start Stage** → Bir stage'i başlat
8. **Done Stage** → Stage'i bitir
9. **Report Issue** → Sorun bildir (notification oluşur)
10. **List Issues** → Issue'ları gör
11. **Get Notifications** → Bildirimleri gör
12. **Update Issue Status** → Issue durumunu güncelle
13. **Get Work Order Metrics** → Verimlilik metriklerini gör
14. **Create Machine** → Makine oluştur
15. **Post Machine Reading** → Makine okuması gönder

---

## ⚠️ Hata Durumları

### 401 Unauthorized
- **Sebep:** Token eksik veya geçersiz
- **Çözüm:** Login yapıp token alın, Authorize'a ekleyin

### 403 Forbidden
- **Sebep:** Rol yetkisi yok
- **Çözüm:** Doğru rol ile login yapın (admin, planner, worker)

### 422 Unprocessable Entity
- **Sebep:** Validation hatası
- **Çözüm:** 
  - `planned_start < planned_end` olmalı
  - `qty > 0` olmalı
  - String alanlar boş olamaz

### 404 Not Found
- **Sebep:** Kayıt bulunamadı
- **Çözüm:** Doğru ID kullanın

---

## 💡 İpuçları

1. **Token Süresi:** Token 60 dakika geçerli (varsayılan)
2. **Role Test:** Farklı rollerle test edin (admin, planner, worker)
3. **State Machine:** Stage'ler sırayla: `planned` → `in_progress` → `done`
4. **Auto Stages:** Work order oluşturulunca otomatik 2 stage oluşur
5. **Notifications:** Issue oluşturulunca manager'lara otomatik bildirim gider



