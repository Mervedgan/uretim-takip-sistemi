# Notification Tablosunu Düzeltme Scripti
# Kullanım: .\fix_notifications_table.ps1

Write-Host "=== NOTIFICATION TABLOSU DÜZELTME ===" -ForegroundColor Cyan
Write-Host ""

# 1. Yeni migration oluştur
Write-Host "1. Yeni migration oluşturuluyor..." -ForegroundColor Yellow
alembic revision --autogenerate -m "Add notifications table"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Migration oluşturuldu" -ForegroundColor Green
    
    # 2. Migration'ı çalıştır
    Write-Host ""
    Write-Host "2. Migration çalıştırılıyor..." -ForegroundColor Yellow
    alembic upgrade head
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migration başarılı!" -ForegroundColor Green
        Write-Host ""
        Write-Host "✅ Notification tablosu oluşturuldu!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Şimdi endpoint'i test edebilirsiniz:" -ForegroundColor Cyan
        Write-Host "  GET /issues/notifications" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Migration hatası!" -ForegroundColor Red
    }
} else {
    Write-Host "   ⚠️ Migration oluşturulamadı (tablo zaten var olabilir)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manuel kontrol:" -ForegroundColor Cyan
    Write-Host "  alembic upgrade head" -ForegroundColor Green
}



