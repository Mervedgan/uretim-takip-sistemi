# PostgreSQL'e Geçiş - Adım Adım Rehber

## ✅ PostgreSQL Kurulu - Şimdi Ne Yapmalıyız?

### ADIM 1: Database Oluştur (pgAdmin veya psql ile)

**Seçenek A: pgAdmin ile (Görsel)**
1. pgAdmin'i açın
2. Sol tarafta "Servers" → PostgreSQL server'ınızı genişletin
3. "Databases" üzerine sağ tıklayın → "Create" → "Database..."
4. Database adı: `production_db`
5. Owner: `postgres`
6. "Save" butonuna tıklayın

**Seçenek B: psql ile (Komut satırı)**
```sql
psql -U postgres
CREATE DATABASE production_db;
\q
```

### ADIM 2: .env Dosyasını Güncelle

Backend klasöründeki `.env` dosyasını açın ve şunu değiştirin:

**ÖNCE (SQLite):**
```env
DATABASE_URL=sqlite:///./database.db
```

**SONRA (PostgreSQL):**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/production_db
```

**Not:** Eğer PostgreSQL şifreniz farklıysa, `postgres:postgres` kısmını `postgres:SIZIN_SIFRENIZ` olarak değiştirin.

### ADIM 3: Alembic Migration Çalıştır

PowerShell'de:
```powershell
cd C:\Users\90541\uretim-takip-sistemi\backend
alembic upgrade head
```

Bu komut tüm tabloları PostgreSQL'de oluşturur.

### ADIM 4: Mevcut Verileri Migrate Et (Opsiyonel)

Eğer SQLite'da veri varsa ve taşımak istiyorsanız:
```powershell
python scripts/migrate_sqlite_to_postgres.py
```

### ADIM 5: Server'ı Yeniden Başlat

```powershell
python -m uvicorn app.main:app --reload
```

### ADIM 6: Test Et

```powershell
# Bağlantıyı test et
python -c "from app.db import SessionLocal; from app.models import User; db = SessionLocal(); print(f'✅ PostgreSQL bağlantısı başarılı! Users: {db.query(User).count()}'); db.close()"
```

## ✅ Tamamlandı!

Artık PostgreSQL kullanıyorsunuz. Tüm endpoint'ler aynı şekilde çalışacak.



