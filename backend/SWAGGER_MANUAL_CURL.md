# Swagger'da Manuel Curl Kullanımı

## Adım Adım Rehber

### 1. Token'ı Alın
1. Swagger'da `POST /auth/login` endpoint'ini açın
2. "Try it out" → username: `admin`, password: `admin123`
3. "Execute" yapın
4. Response'dan `access_token` değerini **TAMAMEN** kopyalayın
   - Örnek: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc2NjQyNjE1MH0.KnHMkjxNWkQkSMgx2kCYxUWcmG7_U3Y68`

### 2. Endpoint'i Açın
1. Test etmek istediğiniz endpoint'e gidin (örn: `POST /workorders/`)
2. "Try it out" butonuna tıklayın
3. Request body'yi doldurun
4. **"Execute" YAPMAYIN** - Önce curl komutunu düzenleyin

### 3. Curl Komutunu Düzenleyin
Swagger'da gösterilen curl komutunu bulun. Şöyle görünecek:

```bash
curl -X 'POST' \
  'http://localhost:8000/workorders/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "product_code": "PRD-001",
  ...
}'
```

### 4. Authorization Header Ekleyin
`-H 'Content-Type: application/json' \` satırından SONRA, `-d` satırından ÖNCE şunu ekleyin:

```bash
curl -X 'POST' \
  'http://localhost:8000/workorders/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc2NjQyNjE1MH0.KnHMkjxNWkQkSMgx2kCYxUWcmG7_U3Y68' \
  -d '{
  "product_code": "PRD-001",
  ...
}'
```

### 5. PowerShell'de Çalıştırın
1. Curl komutunu kopyalayın
2. PowerShell'i açın
3. Yapıştırın ve Enter'a basın

**ÖNEMLİ:** Windows'ta `curl` komutu PowerShell'in `Invoke-WebRequest` alias'ı olabilir. Eğer hata alırsanız, komutu PowerShell formatına çevirin veya `curl.exe` kullanın.

### Alternatif: PowerShell Formatına Çevirin

Curl komutunu PowerShell'e çevirmek için:

```powershell
# Token'ı değişkene al
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Headers
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Body
$body = @{
    product_code = "PRD-001"
    lot_no = "LOT-001"
    qty = 100
    planned_start = "2024-12-22T10:00:00"
    planned_end = "2024-12-22T14:00:00"
} | ConvertTo-Json

# İstek gönder
Invoke-RestMethod -Uri "http://localhost:8000/workorders/" -Method POST -Headers $headers -Body $body
```



