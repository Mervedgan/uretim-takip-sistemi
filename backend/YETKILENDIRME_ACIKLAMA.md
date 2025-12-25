# 🔐 Backend Yetkilendirme Sistemi Açıklaması

## Nasıl Çalışıyor?

### 1. **JWT Token Sistemi**
- Kullanıcı `/auth/login` endpoint'ine username ve password gönderir
- Backend şifreyi kontrol eder ve JWT token oluşturur
- Token içinde `username` ve `role` bilgisi bulunur
- Token'ın süresi `ACCESS_TOKEN_EXPIRE_MINUTES` kadar (varsayılan: 30 dakika)

### 2. **Token Doğrulama (`verify_token`)**
- Her istekte `Authorization: Bearer <token>` header'ı gönderilir
- `verify_token` fonksiyonu:
  - Token'ı parse eder
  - Token'ın geçerliliğini kontrol eder
  - Kullanıcıyı veritabanından çeker
  - `{"username": "...", "role": "...", "user_id": ...}` döndürür

### 3. **Rol Bazlı Yetkilendirme**

#### `get_current_user` - Sadece Giriş Kontrolü
```python
current_user: dict = Depends(get_current_user)
```
- **Kimler erişebilir:** Tüm giriş yapmış kullanıcılar (worker, planner, admin)
- **Kullanım:** Herkesin görmesi gereken endpoint'ler için
- **Örnek:** İş emirlerini listeleme, ürün listesi, kalıp listesi

#### `require_roles("rol1", "rol2")` - Rol Kontrolü
```python
current_user: dict = Depends(require_roles("planner", "admin"))
```
- **Kimler erişebilir:** Sadece belirtilen rollere sahip kullanıcılar
- **Kullanım:** Sadece belirli rollerin yapabileceği işlemler için
- **Örnek:** İş emri oluşturma (planner/admin), kullanıcı rolü değiştirme (admin)

### 4. **Mevcut Endpoint Yetkilendirmeleri**

| Endpoint | Method | Yetki | Açıklama |
|----------|--------|-------|----------|
| `/auth/login` | POST | Public | Herkes giriş yapabilir |
| `/auth/register` | POST | Public | Herkes kayıt olabilir |
| `/auth/users` | GET | Admin | Sadece admin kullanıcı listesini görebilir |
| `/auth/users/{id}/role` | PATCH | Admin | Sadece admin rol değiştirebilir |
| `/workorders/` | POST | Planner/Admin | İş emri oluşturma |
| `/workorders/` | GET | Tüm roller | İş emirlerini listeleme |
| `/workorders/{id}` | GET | Tüm roller | İş emri detayı |
| `/stages/{id}/start` | POST | Worker/Planner | Aşama başlatma |
| `/stages/{id}/done` | POST | Worker/Planner | Aşama bitirme |

### 5. **Ürün ve Kalıp Endpoint'leri**

**Yeni eklenen endpoint'ler:**
- `GET /products/` - Tüm roller görebilir (get_current_user)
- `POST /products/` - Planner/Admin oluşturabilir (require_roles)
- `GET /molds/` - Tüm roller görebilir (get_current_user)
- `POST /molds/` - Planner/Admin oluşturabilir (require_roles)

**Neden tüm roller görebilir?**
- Operatörler (worker) üretim yaparken ürün ve kalıp bilgilerine ihtiyaç duyar
- Planlayıcılar (planner) iş emri oluştururken ürün ve kalıp seçmeli
- Yöneticiler (admin) tüm verileri görmeli

## Örnek Kullanım

### Frontend'den İstek Gönderme

```typescript
// 1. Login yap
const response = await fetch('http://localhost:8000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    username: 'worker1',
    password: 'password123'
  })
});
const { access_token } = await response.json();

// 2. Token ile istek gönder
const products = await fetch('http://localhost:8000/products/', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});
```

## Güvenlik Notları

1. **Token Süresi:** Token'lar 30 dakika sonra geçersiz olur (config'den değiştirilebilir)
2. **HTTPS:** Production'da mutlaka HTTPS kullanılmalı
3. **Secret Key:** Production'da güçlü bir SECRET_KEY kullanılmalı
4. **CORS:** Sadece güvenilir origin'lerden istek kabul edilmeli

