# Work Order Oluşturma Scripti
# PowerShell'de çalıştırın: .\test_workorder.ps1

Write-Host "=== 1. Login yapılıyor... ===" -ForegroundColor Cyan
$login = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" `
    -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123"

$token = $login.access_token
Write-Host "✅ Token alındı!" -ForegroundColor Green
Write-Host ""

Write-Host "=== 2. Headers oluşturuluyor... ===" -ForegroundColor Cyan
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
Write-Host "✅ Headers hazır!" -ForegroundColor Green
Write-Host ""

Write-Host "=== 3. Body hazırlanıyor... ===" -ForegroundColor Cyan
$body = @{
    product_code = "PRD-001"
    lot_no = "LOT-001"
    qty = 100
    planned_start = "2024-12-22T10:00:00"
    planned_end = "2024-12-22T14:00:00"
} | ConvertTo-Json

Write-Host "Body:" -ForegroundColor Yellow
Write-Host $body
Write-Host ""

Write-Host "=== 4. Work Order oluşturuluyor... ===" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/workorders/" `
        -Method POST `
        -Headers $headers `
        -Body $body
    
    Write-Host "✅✅✅ BAŞARILI!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Hata oluştu!" -ForegroundColor Red
    Write-Host $_.Exception.Message
}



