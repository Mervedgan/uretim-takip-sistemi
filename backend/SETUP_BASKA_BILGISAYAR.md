# 🖥️ Başka Bilgisayarda Kurulum Rehberi

Bu rehber, projeyi başka bir bilgisayarda PostgreSQL ile çalıştırmak için gerekli adımları içerir.

## ✅ Gereksinimler

- Python 3.9 veya üzeri
- PostgreSQL 14+ (veya Docker Desktop)
- Git (projeyi klonlamak için)

## 📋 Kurulum Adımları

### 1. Projeyi İndirin

```powershell
# Projeyi klonlayın veya ZIP olarak indirin
cd C:\Users\KULLANICI_ADI
git clone <repository-url>
# veya ZIP'i açın
```

### 2. Backend Klasörüne Gidin

```powershell
cd uretim-takip-sistemi\backend
```

### 3. Virtual Environment Oluşturun

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 4. Dependencies Yükleyin

```powershell
pip install -r requirements.txt
```

### 5. PostgreSQL Kurulumu (İki Seçenek)

#### Seçenek A: Docker Desktop ile (Önerilen)

1. **Docker Desktop'ı indirin ve kurun:**
   - https://www.docker.com/products/docker-desktop
   - Kurulumdan sonra Docker Desktop'ı başlatın

2. **PostgreSQL'i başlatın:**
   ```powershell
   docker-compose up -d postgres
   ```

3. **PostgreSQL hazır!** (Varsayılan ayarlar: postgres/postgres@localhost:5432)

#### Seçenek B: Manuel PostgreSQL Kurulumu

1. **PostgreSQL'i indirin ve kurun:**
   - https://www.postgresql.org/download/windows/
   - Kurulum sırasında şifre belirleyin (örnek: `postgres123`)

2. **PostgreSQL servisinin çalıştığını kontrol edin:**
   ```powershell
   Get-Service postgresql*
   ```

3. **Veritabanı oluşturun:**
   ```powershell
   # psql ile bağlanın
   psql -U postgres
   # PostgreSQL shell'de:
   CREATE DATABASE production_db;
   \q
   ```

### 6. Environment Variables Ayarlayın

```powershell
# .env.example dosyasını .env olarak kopyalayın
Copy-Item env.example .env

# .env dosyasını düzenleyin
notepad .env
```

**.env dosyasında şunları ayarlayın:**

```env
# PostgreSQL bağlantısı (Docker kullanıyorsanız)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/production_db

# VEYA manuel kurulumda (şifreniz farklıysa)
# DATABASE_URL=postgresql://postgres:SIZIN_SIFRENIZ@localhost:5432/production_db

# JWT Secret Key (DEĞİŞTİRİN!)
SECRET_KEY=super-secret-key-change-in-production-BURAYA-RANDOM-BIR-DEGER

# Diğer ayarlar (varsayılan değerler genelde yeterli)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ENVIRONMENT=development
CORS_ORIGINS=*
LOG_LEVEL=INFO
```

**ÖNEMLİ:** `SECRET_KEY` değerini mutlaka değiştirin! Güvenli bir key oluşturmak için:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 7. Database Migration Çalıştırın

```powershell
# Tüm tabloları oluşturur
alembic upgrade head
```

**Kontrol:**
```powershell
# Migration durumunu kontrol edin
alembic current
```

### 8. (Opsiyonel) Seed Data Ekleyin

```powershell
# Test verisi eklemek için
python app/seed.py
```

### 9. Server'ı Başlatın

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 10. Test Edin

Tarayıcıda açın:
- **Swagger UI:** http://localhost:8000/api-docs
- **API Root:** http://localhost:8000/

## 🔧 Sorun Giderme

### PostgreSQL Bağlantı Hatası

**Hata:** `connection to server at "localhost" (::1), port 5432 failed`

**Çözümler:**

1. **PostgreSQL servisinin çalıştığını kontrol edin:**
   ```powershell
   Get-Service postgresql*
   ```

2. **Servisi başlatın:**
   ```powershell
   Start-Service postgresql-x64-14
   ```

3. **PostgreSQL yapılandırmasını kontrol edin:**
   - `C:\Program Files\PostgreSQL\14\data\postgresql.conf`
   - `listen_addresses = '*'` olmalı
   - `C:\Program Files\PostgreSQL\14\data\pg_hba.conf`
   - `host all all 127.0.0.1/32 md5` satırı olmalı

4. **Servisi yeniden başlatın:**
   ```powershell
   Restart-Service postgresql-x64-14
   ```

### Migration Hatası

**Hata:** `Table already exists` veya `Table does not exist`

**Çözüm:**

```powershell
# Migration durumunu kontrol edin
alembic current

# Tüm migration'ları çalıştırın
alembic upgrade head

# Eğer sorun devam ederse, migration'ı resetleyin (DİKKAT: Veri kaybı olur!)
# alembic downgrade base
# alembic upgrade head
```

### Port 8000 Kullanımda

**Hata:** `Address already in use`

**Çözüm:**

```powershell
# Port'u değiştirin
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001

# VEYA kullanan process'i bulun ve durdurun
netstat -ano | findstr :8000
taskkill /PID <PID_NUMARASI> /F
```

## ✅ Kurulum Kontrol Listesi

- [ ] Python 3.9+ kurulu
- [ ] PostgreSQL kurulu veya Docker Desktop kurulu
- [ ] Proje klasörüne gidildi
- [ ] Virtual environment oluşturuldu ve aktif
- [ ] Dependencies yüklendi (`pip install -r requirements.txt`)
- [ ] `.env` dosyası oluşturuldu ve düzenlendi
- [ ] PostgreSQL çalışıyor
- [ ] Migration çalıştırıldı (`alembic upgrade head`)
- [ ] Server başlatıldı (`python -m uvicorn app.main:app --reload`)
- [ ] Swagger UI açılıyor (http://localhost:8000/api-docs)
- [ ] Login yapılabiliyor
- [ ] Token ile endpoint'ler çalışıyor

## 📝 İlk Kullanım

1. **Admin kullanıcısı oluşturun:**
   ```powershell
   # Swagger'da veya curl ile:
   POST /auth/register
   {
     "username": "admin",
     "password": "admin123",
     "role": "admin"
   }
   ```

2. **Login yapın:**
   ```powershell
   POST /auth/login
   username: admin
   password: admin123
   ```

3. **Token'ı alın ve Swagger'da Authorize'a ekleyin**

4. **Test edin:**
   - Work order oluşturun
   - Stage'leri görüntüleyin
   - Issue bildirin
   - Metrics görüntüleyin

## 🎯 Hızlı Komutlar

```powershell
# Tüm kurulumu tek seferde
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item env.example .env
notepad .env  # DATABASE_URL ve SECRET_KEY'i düzenleyin
docker-compose up -d postgres  # veya PostgreSQL'i manuel başlatın
alembic upgrade head
python -m uvicorn app.main:app --reload
```

## 📞 Destek

Sorun yaşarsanız:
1. `logs/app.log` dosyasını kontrol edin
2. Server log'larını kontrol edin
3. PostgreSQL log'larını kontrol edin
4. Migration durumunu kontrol edin (`alembic current`)



