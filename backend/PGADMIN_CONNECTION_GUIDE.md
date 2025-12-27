# 🗄️ pgAdmin Bağlantı Rehberi

pgAdmin'de `production_db` veritabanını görmek için doğru bağlantı ayarlarını kullanmanız gerekiyor.

## ✅ Veritabanı Durumu

Veritabanı oluşturulmuş ve çalışıyor:
- **Veritabanı Adı:** `production_db`
- **Kullanıcı:** `postgres`
- **Şifre:** `postgres`
- **Port:** `5433` (host machine'den), `5432` (container içinden)

## 🚀 pgAdmin'i Başlatma

Eğer pgAdmin çalışmıyorsa:

```powershell
cd backend
docker-compose --profile tools up -d pgadmin
```

pgAdmin şu adreste çalışacak: `http://localhost:5050`

## 🔧 pgAdmin'de Server Ekleme

### 1. pgAdmin'e Giriş Yapın
- URL: `http://localhost:5050`
- Email: `admin@admin.com`
- Password: `admin`

### 2. Yeni Server Ekleyin

**ÖNEMLİ:** pgAdmin container içinden çalıştığı için, PostgreSQL container'ına **container name** ile bağlanmalıdır.

1. Sol panelde **"Servers"** üzerine sağ tıklayın
2. **"Register" > "Server"** seçin

### 3. General Tab
- **Name:** `Production DB` (istediğiniz isim)

### 4. Connection Tab
- **Host name/address:** `postgres` ⚠️ **ÖNEMLİ: `localhost` DEĞİL, `postgres` (container name)**
- **Port:** `5432` (container içindeki port)
- **Maintenance database:** `postgres`
- **Username:** `postgres`
- **Password:** `postgres`
- **Save password:** ✅ İşaretleyin

### 5. Advanced Tab (Opsiyonel)
- **DB restriction:** `production_db` (sadece bu veritabanını göster)

### 6. Save

Artık `production_db` veritabanını görebilmelisiniz!

## 🔍 Sorun Giderme

### Veritabanı görünmüyor

1. **Container'ların çalıştığını kontrol edin:**
   ```powershell
   docker-compose ps
   ```
   Hem `production_db` hem de `pgadmin` `Up` durumunda olmalı.

2. **pgAdmin'de doğru host kullanıldığından emin olun:**
   - ❌ Yanlış: `localhost` veya `127.0.0.1`
   - ✅ Doğru: `postgres` (container name)

3. **Port'un doğru olduğundan emin olun:**
   - Container içinden: `5432`
   - Host machine'den (psql ile): `5433`

4. **pgAdmin'i yeniden başlatın:**
   ```powershell
   docker-compose restart pgadmin
   ```

### Bağlantı hatası alıyorsunuz

1. **PostgreSQL container'ının healthy olduğunu kontrol edin:**
   ```powershell
   docker-compose ps
   ```
   Status `Up (healthy)` olmalı.

2. **Network bağlantısını kontrol edin:**
   ```powershell
   docker network inspect backend_backend_network
   ```
   Her iki container da aynı network'te olmalı.

3. **pgAdmin loglarını kontrol edin:**
   ```powershell
   docker-compose logs pgadmin
   ```

## 📊 Veritabanını Doğrudan Kontrol Etme

pgAdmin yerine terminal'den de kontrol edebilirsiniz:

```powershell
# Veritabanı listesi
docker exec production_db psql -U postgres -l

# production_db'ye bağlanma
docker exec -it production_db psql -U postgres -d production_db

# Tabloları görme
\dt

# Çıkış
\q
```

## 🎯 Hızlı Kontrol Komutları

```powershell
# Container durumları
docker-compose ps

# PostgreSQL logları
docker-compose logs postgres

# pgAdmin logları
docker-compose logs pgadmin

# Veritabanı listesi
docker exec production_db psql -U postgres -l
```

## 📝 Özet

pgAdmin'de veritabanını görmek için:
1. ✅ pgAdmin çalışıyor mu? (`http://localhost:5050`)
2. ✅ Server eklerken **Host:** `postgres` (container name)
3. ✅ **Port:** `5432` (container içindeki port)
4. ✅ **Username:** `postgres`
5. ✅ **Password:** `postgres`

**En yaygın hata:** Host olarak `localhost` kullanmak. pgAdmin container içinden çalıştığı için, PostgreSQL container'ına container name (`postgres`) ile bağlanmalıdır.

