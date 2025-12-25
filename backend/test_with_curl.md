# Curl ile API Test Etme Rehberi

## Adım 1: Token Alın

### Windows PowerShell'de:

```powershell
# Login yap ve token al
$response = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" `
    -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123"

# Token'ı göster
$token = $response.access_token
Write-Host "Token: $token"
```

### Veya Swagger'dan:
1. `POST /auth/login` endpoint'ini açın
2. username: `admin`, password: `admin123` girin
3. Execute yapın
4. Response'dan `access_token` değerini kopyalayın

## Adım 2: Curl Komutunu Hazırlayın

Token'ı aldıktan sonra, aşağıdaki komutta `YOUR_TOKEN_HERE` yerine token'ı yapıştırın:

### Windows PowerShell (Invoke-RestMethod):

```powershell
# Token'ı değişkene al
$token = "YOUR_TOKEN_HERE"

# Headers hazırla
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Request body
$body = @{
    product_code = "PRD-001"
    lot_no = "LOT-001"
    qty = 100
    planned_start = "2024-12-22T10:00:00"
    planned_end = "2024-12-22T14:00:00"
} | ConvertTo-Json

# İstek gönder
Invoke-RestMethod -Uri "http://localhost:8000/workorders/" `
    -Method POST `
    -Headers $headers `
    -Body $body
```

### Linux/Mac/Git Bash (gerçek curl):

```bash
# Token'ı değişkene al
TOKEN="YOUR_TOKEN_HERE"

# İstek gönder
curl -X 'POST' \
  'http://localhost:8000/workorders/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
  "product_code": "PRD-001",
  "lot_no": "LOT-001",
  "qty": 100,
  "planned_start": "2024-12-22T10:00:00",
  "planned_end": "2024-12-22T14:00:00"
}'
```

## Adım 3: Tek Komutla Test (PowerShell)

```powershell
# Login + Work Order oluştur (tek seferde)
$login = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/x-www-form-urlencoded" -Body "username=admin&password=admin123"
$token = $login.access_token
$headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
$body = @{product_code="PRD-001"; lot_no="LOT-001"; qty=100; planned_start="2024-12-22T10:00:00"; planned_end="2024-12-22T14:00:00"} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/workorders/" -Method POST -Headers $headers -Body $body
```



