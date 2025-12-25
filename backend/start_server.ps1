# Server Başlatma Scripti
# PowerShell'de çalıştırın: .\start_server.ps1

Write-Host "=== SERVER BAŞLATILIYOR ===" -ForegroundColor Cyan

# Eski process'leri durdur
Write-Host "Eski process'ler durduruluyor..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.Path -like '*python*'} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Server'ı başlat
Write-Host "Server başlatılıyor..." -ForegroundColor Yellow
Write-Host "URL: http://localhost:8000" -ForegroundColor Green
Write-Host "Swagger: http://localhost:8000/api-docs" -ForegroundColor Green
Write-Host ""
Write-Host "Durdurmak için: Ctrl+C" -ForegroundColor Yellow
Write-Host ""

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000



