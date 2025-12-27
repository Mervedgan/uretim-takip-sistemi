# 🐳 Docker PostgreSQL Kurulum Rehberi

Bu rehber, Docker Compose ile PostgreSQL veritabanını nasıl başlatacağınızı açıklar.

## ✅ Önkoşullar

1. **Docker Desktop yüklü ve çalışıyor olmalı**
   - Docker Desktop'ı başlatın
   - Sistem tepsisinde Docker ikonu görünüyor olmalı

2. **.env dosyası oluşturulmuş olmalı**
   - `.env` dosyası `backend` klasöründe mevcut
   - Docker PostgreSQL ayarları yapılandırılmış

## 🚀 PostgreSQL'i Başlatma

### 1. Docker Desktop'ı Başlatın

Windows'ta Docker Desktop'ı başlatın. Sistem tepsisinde Docker ikonu görünene kadar bekleyin.

### 2. PostgreSQL Container'ını Başlatın

```powershell
cd backend
docker-compose up -d postgres
```

Bu komut:
- PostgreSQL 15 image'ını indirir (ilk seferinde)
- `production_db` adında bir container oluşturur
- Port 5433'te PostgreSQL'i başlatır
- Verileri `postgres_data` volume'ünde saklar

### 3. Container Durumunu Kontrol Edin

```powershell
docker-compose ps
```

Veya:

```powershell
docker ps
```

`production_db` container'ının `Up` durumunda olduğunu görmelisiniz.

## 🔧 Veritabanı Bağlantısını Test Etme

### PowerShell ile Test:

```powershell
# PostgreSQL client yüklüyse
psql -h localhost -p 5433 -U postgres -d production_db
# Şifre: postgres
```

### Python ile Test:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -c "from app.db import engine; print('Bağlantı başarılı!' if engine.connect() else 'Bağlantı hatası!')"
```

## 📊 Migration'ları Çalıştırma

PostgreSQL başladıktan sonra, veritabanı tablolarını oluşturmak için migration'ları çalıştırın:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

Bu komut:
- Tüm migration dosyalarını çalıştırır
- Veritabanı tablolarını oluşturur
- İlk verileri ekler (eğer seed script varsa)

## 🗄️ pgAdmin ile Veritabanını Yönetme (Opsiyonel)

pgAdmin'i başlatmak için:

```powershell
docker-compose --profile tools up -d pgadmin
```

Sonra tarayıcıda `http://localhost:5050` adresine gidin:
- Email: `admin@admin.com`
- Password: `admin`

pgAdmin'de yeni bir server ekleyin:
- Host: `postgres` (container name)
- Port: `5432`
- Username: `postgres`
- Password: `postgres`

## 🛑 PostgreSQL'i Durdurma

```powershell
docker-compose stop postgres
```

## 🗑️ PostgreSQL'i Silme (Verilerle Birlikte)

**DİKKAT:** Bu komut tüm veritabanı verilerini siler!

```powershell
docker-compose down -v
```

## 📝 Önemli Notlar

### Port Mapping
- Docker Compose'da PostgreSQL portu `5433:5432` olarak map edilmiş
- Host machine'den bağlanırken: `localhost:5433` kullanın
- Container içinden bağlanırken: `postgres:5432` kullanın

### .env Dosyası Ayarları
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/production_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
```

### Veri Kalıcılığı
- Veritabanı verileri `postgres_data` Docker volume'ünde saklanır
- Container'ı durdursanız bile veriler korunur
- Sadece `docker-compose down -v` komutu verileri siler

## 🔍 Sorun Giderme

### Docker Desktop çalışmıyor
- Docker Desktop'ı başlatın
- Sistem tepsisinde Docker ikonunu kontrol edin
- Docker Desktop'ın tamamen başlamasını bekleyin

### Port 5433 zaten kullanılıyor
- `docker-compose.yml` dosyasında portu değiştirin
- `.env` dosyasındaki `POSTGRES_PORT` değerini güncelleyin

### Container başlamıyor
```powershell
# Logları kontrol edin
docker-compose logs postgres

# Container'ı yeniden oluşturun
docker-compose up -d --force-recreate postgres
```

### Bağlantı hatası
- `.env` dosyasındaki ayarları kontrol edin
- PostgreSQL container'ının çalıştığından emin olun: `docker ps`
- Port mapping'i kontrol edin: `docker-compose ps`

## 📚 Daha Fazla Bilgi

- Docker Compose dosyası: `backend/docker-compose.yml`
- Environment variables: `backend/.env`
- Migration dosyaları: `backend/alembic/versions/`

