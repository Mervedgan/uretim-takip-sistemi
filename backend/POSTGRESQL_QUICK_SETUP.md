# PostgreSQL'e Hızlı Geçiş

## Seçenek 1: Docker Desktop (Önerilen - Kolay)

### Adım 1: Docker Desktop İndir ve Kur
1. https://www.docker.com/products/docker-desktop adresine gidin
2. "Download for Windows" butonuna tıklayın
3. İndirilen dosyayı çalıştırın ve kurulumu tamamlayın
4. Bilgisayarı yeniden başlatın (gerekirse)
5. Docker Desktop'ı başlatın (sistem tray'de Docker ikonu görünmeli)

### Adım 2: PostgreSQL Container'ı Başlat
```powershell
cd C:\Users\90541\uretim-takip-sistemi\backend
docker-compose up -d postgres
```

### Adım 3: .env Dosyasını Güncelle
`.env` dosyasını açın ve şunu değiştirin:
```env
# Eski (SQLite):
# DATABASE_URL=sqlite:///./database.db

# Yeni (PostgreSQL):
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/production_db
```

### Adım 4: Alembic Migration
```powershell
alembic upgrade head
```

### Adım 5: Server'ı Yeniden Başlat
```powershell
python -m uvicorn app.main:app --reload
```

## Seçenek 2: Manuel PostgreSQL Kurulumu

1. PostgreSQL'i indirin: https://www.postgresql.org/download/windows/
2. Kurulum sırasında:
   - Port: 5432
   - Superuser password: postgres (veya istediğiniz)
3. pgAdmin veya psql ile database oluşturun:
   ```sql
   CREATE DATABASE production_db;
   ```
4. .env dosyasını güncelleyin
5. Alembic migration çalıştırın

## Kontrol

PostgreSQL bağlantısını test edin:
```powershell
python -c "from app.db import SessionLocal; from app.models import User; db = SessionLocal(); print(f'✅ PostgreSQL bağlantısı başarılı! Users: {db.query(User).count()}'); db.close()"
```



