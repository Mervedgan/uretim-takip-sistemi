# PowerShell ile Tüm Endpoint'leri Test Etme Scripti
# Kullanım: .\test_all_endpoints.ps1

Write-Host "=== API TEST SCRIPT ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8000"

# 1. Register
Write-Host "1. Register - Yeni kullanıcı oluşturuluyor..." -ForegroundColor Yellow
$registerBody = @{
    username = "testuser_$(Get-Random)"
    password = "test123"
    role = "worker"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -ContentType "application/json" -Body $registerBody
    Write-Host "   ✅ Kullanıcı oluşturuldu: $($registerResponse.username)" -ForegroundColor Green
    $testUsername = $registerResponse.username
} catch {
    Write-Host "   ⚠️ Register hatası (kullanıcı zaten var olabilir)" -ForegroundColor Yellow
    $testUsername = "testuser"
}

# 2. Login
Write-Host ""
Write-Host "2. Login - Token alınıyor..." -ForegroundColor Yellow
$loginBody = "username=admin&password=admin123"
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $loginBody
    $token = $loginResponse.access_token
    Write-Host "   ✅ Token alındı!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Login hatası!" -ForegroundColor Red
    Write-Host "   Hata: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Headers
$headers = @{}
$headers["Authorization"] = "Bearer " + $token
$headers["Content-Type"] = "application/json"

# 3. List Users (Admin)
Write-Host ""
Write-Host "3. List Users..." -ForegroundColor Yellow
try {
    $users = Invoke-RestMethod -Uri "$baseUrl/auth/users" -Method GET -Headers $headers
    Write-Host "   ✅ $($users.Count) kullanıcı bulundu" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Create Work Order
Write-Host ""
Write-Host "4. Create Work Order..." -ForegroundColor Yellow
$startTime = (Get-Date).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss")
$endTime = (Get-Date).AddHours(5).ToString("yyyy-MM-ddTHH:mm:ss")

$woBody = @{
    product_code = "PRD-TEST-$(Get-Random)"
    lot_no = "LOT-TEST-$(Get-Random)"
    qty = 100
    planned_start = $startTime
    planned_end = $endTime
} | ConvertTo-Json

try {
    $woResponse = Invoke-RestMethod -Uri "$baseUrl/workorders/" -Method POST -Headers $headers -Body $woBody
    $woId = $woResponse.work_order_id
    Write-Host "   ✅ Work Order oluşturuldu: ID=$woId" -ForegroundColor Green
    Write-Host "   ✅ $($woResponse.stages_created) stage otomatik oluşturuldu" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 5. Get Work Order Stages
Write-Host ""
Write-Host "5. Get Work Order Stages..." -ForegroundColor Yellow
try {
    $stages = Invoke-RestMethod -Uri "$baseUrl/workorders/$woId/stages" -Method GET -Headers $headers
    Write-Host "   ✅ $($stages.Count) stage bulundu" -ForegroundColor Green
    $firstStageId = $stages[0].id
    Write-Host "   ✅ İlk stage ID: $firstStageId" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Start Stage
Write-Host ""
Write-Host "6. Start Stage (ID: $firstStageId)..." -ForegroundColor Yellow
try {
    $startResponse = Invoke-RestMethod -Uri "$baseUrl/stages/$firstStageId/start" -Method POST -Headers $headers
    Write-Host "   ✅ Stage başlatıldı: $($startResponse.status)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 7. Done Stage
Write-Host ""
Write-Host "7. Done Stage (ID: $firstStageId)..." -ForegroundColor Yellow
try {
    $doneResponse = Invoke-RestMethod -Uri "$baseUrl/stages/$firstStageId/done" -Method POST -Headers $headers
    Write-Host "   ✅ Stage tamamlandı: $($doneResponse.status)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 8. Report Issue
Write-Host ""
Write-Host "8. Report Issue..." -ForegroundColor Yellow
$issueBody = @{
    type = "machine_breakdown"
    description = "Test issue - Makine arızası"
} | ConvertTo-Json

try {
    $issueResponse = Invoke-RestMethod -Uri "$baseUrl/stages/$firstStageId/issue" -Method POST -Headers $headers -Body $issueBody
    $issueId = $issueResponse.issue_id
    Write-Host "   ✅ Issue oluşturuldu: ID=$issueId" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 9. List Issues
Write-Host ""
Write-Host "9. List Issues..." -ForegroundColor Yellow
try {
    $issues = Invoke-RestMethod -Uri "$baseUrl/issues/" -Method GET -Headers $headers
    Write-Host "   ✅ $($issues.total) issue bulundu" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 10. Get Notifications
Write-Host ""
Write-Host "10. Get Notifications..." -ForegroundColor Yellow
try {
    $notifications = Invoke-RestMethod -Uri "$baseUrl/issues/notifications" -Method GET -Headers $headers
    Write-Host "   ✅ $($notifications.total) bildirim bulundu ($($notifications.unread_count) okunmamış)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 11. Get Work Order Metrics
Write-Host ""
Write-Host "11. Get Work Order Metrics..." -ForegroundColor Yellow
try {
    $metrics = Invoke-RestMethod -Uri "$baseUrl/metrics/workorders/$woId" -Method GET -Headers $headers
    Write-Host "   ✅ Verimlilik: $($metrics.efficiency_percent)%" -ForegroundColor Green
    Write-Host "   ✅ Gecikme: $($metrics.delay_minutes) dakika" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 12. Create Machine
Write-Host ""
Write-Host "12. Create Machine..." -ForegroundColor Yellow
$machineBody = @{
    name = "Test Machine $(Get-Random)"
    machine_type = "injection_molding"
    location = "Test Location"
    status = "active"
} | ConvertTo-Json

try {
    $machineResponse = Invoke-RestMethod -Uri "$baseUrl/machines/" -Method POST -Headers $headers -Body $machineBody
    $machineId = $machineResponse.machine_id
    Write-Host "   ✅ Makine oluşturuldu: ID=$machineId" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

# 13. Post Machine Reading
Write-Host ""
Write-Host "13. Post Machine Reading..." -ForegroundColor Yellow
$readingBody = @{
    reading_type = "temperature"
    value = "75.5"
} | ConvertTo-Json

try {
    $readingResponse = Invoke-RestMethod -Uri "$baseUrl/machines/$machineId/readings" -Method POST -Headers $headers -Body $readingBody
    Write-Host "   ✅ Makine okuması gönderildi: ID=$($readingResponse.reading_id)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TEST TAMAMLANDI ===" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Tüm endpoint'ler test edildi!" -ForegroundColor Green
