# Swagger Token Sorunu - Çözümler

## Sorun
Swagger'da token authorize edilse bile curl komutuna Authorization header eklenmiyor.

## Çözüm 1: Swagger'ı Tamamen Yenileyin

1. Tarayıcı cache'ini temizleyin:
   - Chrome: Ctrl+Shift+Delete → Cached images and files → Clear
   - Veya: Ctrl+Shift+R (Hard refresh)

2. Swagger'ı kapatıp tekrar açın:
   - http://localhost:8000/api-docs

3. Token'ı tekrar authorize edin

## Çözüm 2: Manuel Curl Komutu Kullanın

Swagger'da curl komutunu görünce, manuel olarak Authorization header ekleyin:

```bash
curl -X 'POST' \
  'http://localhost:8000/workorders/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
  "product_code": "PRD-001",
  "lot_no": "LOT-001",
  "qty": 100,
  "planned_start": "2024-12-22T10:00:00",
  "planned_end": "2024-12-22T14:00:00"
}'
```

## Çözüm 3: Postman Kullanın (Önerilen)

1. Postman'i indirin: https://www.postman.com/downloads/
2. Collection oluşturun
3. Environment variables:
   - `base_url`: http://localhost:8000
   - `token`: (login sonrası otomatik set edilir)
4. Login request'i oluşturun → Tests tab'ında:
   ```javascript
   pm.environment.set("token", pm.response.json().access_token);
   ```
5. Diğer request'lerde Authorization header:
   - Type: Bearer Token
   - Token: {{token}}

## Çözüm 4: PowerShell Kullanın (En Kolay)

Zaten çalışıyor! PowerShell script'lerini kullanın.



