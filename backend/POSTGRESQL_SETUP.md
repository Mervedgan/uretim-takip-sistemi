# PostgreSQL'e Geçiş Rehberi

## ⚠️ ÖNEMLİ NOT
**Swagger sorunu PostgreSQL ile ilgili DEĞİL!** Bu FastAPI/Swagger UI'ın bilinen bir bug'ı. PostgreSQL'e geçseniz de aynı sorun olacak. PowerShell kullanmak en iyi çözüm.

## Seçenek 1: Docker Desktop ile PostgreSQL (Önerilen)

### Adım 1: Docker Desktop Kurulumu
1. Docker Desktop'ı indirin: https://www.docker.com/products/docker-desktop
2. Kurun ve başlatın
3. Docker'ın çalıştığını kontrol edin (sistem tray'de Docker ikonu)

### Adım 2: PostgreSQL Container'ı Başlat
```powershell
cd C:\Users\90541\uretim-takip-sistemi\backend
docker-compose up -d postgres
```

### Adım 3: .env Dosyasını Güncelle
`.env` dosyasında:
```env
# SQLite'ı yorum satırı yap
# DATABASE_URL=sqlite:///./database.db

# PostgreSQL'i aktif et
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/production_db
```

### Adım 4: Alembic Migration Çalıştır
```powershell
alembic upgrade head
```

### Adım 5: Server'ı Yeniden Başlat
```powershell
python -m uvicorn app.main:app --reload
```

## Seçenek 2: Manuel PostgreSQL Kurulumu

1. PostgreSQL'i indirin: https://www.postgresql.org/download/windows/
2. Kurun (port: 5432, password: postgres)
3. Database oluşturun:
   ```sql
   CREATE DATABASE production_db;
   ```
4. .env dosyasını güncelleyin
5. Alembic migration çalıştırın

## Seçenek 3: Şimdilik SQLite ile Devam Et

- SQLite zaten çalışıyor ✅
- Development için yeterli
- Production'da PostgreSQL kullanılabilir
- Swagger sorunu PostgreSQL ile ilgili değil

## Veri Migrasyonu (SQLite → PostgreSQL)

Eğer SQLite'da veri varsa:
```powershell
python scripts/migrate_sqlite_to_postgres.py
```

## Kontrol

PostgreSQL bağlantısını test edin:
```powershell
python -c "from app.db import SessionLocal; from app.models import User; db = SessionLocal(); print(f'Users: {db.query(User).count()}'); db.close()"
```



