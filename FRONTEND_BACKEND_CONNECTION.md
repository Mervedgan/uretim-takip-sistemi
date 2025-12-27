# 🔗 Frontend-Backend Bağlantı Rehberi

Bu rehber, React Native frontend'in FastAPI backend'e nasıl bağlandığını açıklar.

## ✅ Yapılan Değişiklikler

### 1. API Configuration (`GP1/src/utils/apiConfig.ts`)
- Platform-specific URL desteği eklendi
- Android emulator: `http://10.0.2.2:8000`
- iOS simulator: `http://localhost:8000`
- Fiziksel cihaz için IP adresi desteği

### 2. API Client (`GP1/src/utils/api.ts`)
- Hardcoded URL kaldırıldı
- `apiConfig.ts`'den URL kullanılıyor
- Eksik `metricsAPI` eklendi
- Tüm API çağrıları merkezi yapılandırmadan geliyor

### 3. Backend CORS Ayarları
- Backend zaten tüm origin'lere izin veriyor (`CORS_ORIGINS=*`)
- Development için uygun

## 🚀 Backend'i Başlatma

### Windows PowerShell ile:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Veya hazır script kullanın:
```powershell
cd backend
.\start_server.ps1
```

### Backend Başarıyla Çalışıyorsa:
- Tarayıcıda `http://localhost:8000` adresine gidin
- `{"msg": "Merhaba, backend çalışıyor!"}` mesajını görmelisiniz
- API dokümantasyonu: `http://localhost:8000/api-docs`

## 📱 Frontend'i Başlatma

### React Native Development Server:

```powershell
cd GP1
npm install  # İlk kurulum için
npm start
```

### Android Emulator:
```powershell
npm run android
```

### iOS Simulator (Mac only):
```powershell
npm run ios
```

## 🔧 Fiziksel Cihazda Test Etme

Fiziksel bir cihazda test ediyorsanız, bilgisayarınızın yerel IP adresini kullanmanız gerekir.

### IP Adresinizi Bulma:

**Windows:**
```powershell
ipconfig
# IPv4 Address değerini bulun (örn: 192.168.1.100)
```

**Mac/Linux:**
```bash
ifconfig
# veya
ip addr
```

### Frontend'de IP Adresini Ayarlama:

`GP1/src/utils/apiConfig.ts` dosyasını açın ve şu satırı güncelleyin:

```typescript
// Fiziksel cihaz için IP adresinizi buraya yazın
export const API_BASE_URL = 'http://192.168.1.100:8000';  // IP adresinizi buraya yazın
```

**Önemli:** Backend ve frontend aynı WiFi ağında olmalıdır!

## 🧪 Bağlantıyı Test Etme

### 1. Backend Test:
```powershell
# PowerShell'de
curl http://localhost:8000
# Veya tarayıcıda http://localhost:8000 adresine gidin
```

### 2. Frontend'den Backend'e İstek:
- Uygulamayı açın ve login ekranına gidin
- Herhangi bir API çağrısı yapın (login, work orders, vb.)
- React Native debugger veya console'da hataları kontrol edin

### 3. Yaygın Hatalar ve Çözümleri:

**Hata: "Network request failed"**
- Backend çalışıyor mu kontrol edin
- IP adresi doğru mu kontrol edin
- Firewall ayarlarını kontrol edin (Windows Firewall port 8000'i engelliyor olabilir)

**Hata: "Connection refused"**
- Backend'in `0.0.0.0:8000` adresinde çalıştığından emin olun
- `localhost` yerine `0.0.0.0` kullanın

**Hata: "CORS error"**
- Backend'de `CORS_ORIGINS=*` ayarının olduğundan emin olun
- `.env` dosyasını kontrol edin

## 📝 API Endpoint'leri

Tüm endpoint'ler `GP1/src/utils/apiConfig.ts` dosyasında tanımlıdır:

- **Authentication:** `/auth/login`, `/auth/register`
- **Work Orders:** `/workorders/`, `/workorders/{id}`
- **Stages:** `/stages/{id}/start`, `/stages/{id}/done`
- **Machines:** `/machines/`, `/machines/{id}/readings`
- **Products:** `/products/`
- **Molds:** `/molds/`
- **Metrics:** `/metrics/workorders/{id}`, `/metrics/stages/{id}`

## 🔐 Authentication

Frontend, JWT token'ları `AsyncStorage`'da saklar ve her istekte `Authorization: Bearer <token>` header'ı ile gönderir.

Token yönetimi `GP1/src/utils/api.ts` dosyasındaki `apiClient` interceptor'ları tarafından otomatik yapılır.

## 📚 Daha Fazla Bilgi

- Backend API Dokümantasyonu: `http://localhost:8000/api-docs`
- Backend README: `backend/README.md`
- Frontend README: `GP1/README.md`

