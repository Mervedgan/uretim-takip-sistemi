# PostgreSQL Setup Script
# Docker Desktop kurulduktan SONRA çalıştırın

Write-Host "=== POSTGRESQL SETUP ===" -ForegroundColor Cyan
Write-Host ""

# 1. Docker kontrolü
Write-Host "1. Docker kontrol ediliyor..." -ForegroundColor Yellow
try {
    docker --version | Out-Null
    Write-Host "✅ Docker yüklü" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker yüklü değil!" -ForegroundColor Red
    Write-Host "   Lütfen Docker Desktop'ı kurun: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# 2. PostgreSQL container'ı başlat
Write-Host ""
Write-Host "2. PostgreSQL container başlatılıyor..." -ForegroundColor Yellow
docker-compose up -d postgres

Start-Sleep -Seconds 5

# 3. Container durumunu kontrol et
Write-Host ""
Write-Host "3. Container durumu kontrol ediliyor..." -ForegroundColor Yellow
docker-compose ps

# 4. .env dosyasını güncelle
Write-Host ""
Write-Host "4. .env dosyası güncelleniyor..." -ForegroundColor Yellow
$envContent = Get-Content .env -ErrorAction SilentlyContinue
if ($envContent) {
    $newEnvContent = $envContent | ForEach-Object {
        if ($_ -match "^DATABASE_URL=sqlite") {
            "# $_ (SQLite - disabled)"
            "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/production_db"
        } else {
            $_
        }
    }
    $newEnvContent | Set-Content .env
    Write-Host "✅ .env dosyası güncellendi" -ForegroundColor Green
} else {
    Write-Host "⚠️ .env dosyası bulunamadı, env.example'dan kopyalayın" -ForegroundColor Yellow
}

# 5. Alembic migration
Write-Host ""
Write-Host "5. Database migration çalıştırılıyor..." -ForegroundColor Yellow
alembic upgrade head

# 6. Test
Write-Host ""
Write-Host "6. PostgreSQL bağlantısı test ediliyor..." -ForegroundColor Yellow
try {
    python -c "from app.db import SessionLocal; from app.models import User; db = SessionLocal(); print(f'✅ PostgreSQL bağlantısı başarılı! Users: {db.query(User).count()}'); db.close()"
    Write-Host ""
    Write-Host "✅✅✅ PostgreSQL'e geçiş tamamlandı!" -ForegroundColor Green
} catch {
    Write-Host "❌ Bağlantı hatası. Lütfen kontrol edin." -ForegroundColor Red
}

Write-Host ""
Write-Host "Server'ı yeniden başlatın:" -ForegroundColor Cyan
Write-Host "  python -m uvicorn app.main:app --reload" -ForegroundColor White



