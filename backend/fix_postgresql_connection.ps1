# PostgreSQL Bağlantı Sorununu Düzeltme Scripti
# PowerShell'de Administrator olarak çalıştırın: .\fix_postgresql_connection.ps1

Write-Host "=== POSTGRESQL BAĞLANTI DÜZELTME ===" -ForegroundColor Cyan
Write-Host ""

# PostgreSQL data dizinini bul
$pgVersions = @("14", "15", "13", "12")
$pgDataPath = $null
$pgVersion = $null

foreach ($version in $pgVersions) {
    $testPath = "C:\Program Files\PostgreSQL\$version\data"
    if (Test-Path $testPath) {
        $pgDataPath = $testPath
        $pgVersion = $version
        Write-Host "✅ PostgreSQL $version bulundu: $pgDataPath" -ForegroundColor Green
        break
    }
}

if (-not $pgDataPath) {
    Write-Host "❌ PostgreSQL data dizini bulunamadı!" -ForegroundColor Red
    Write-Host "Lütfen PostgreSQL'in kurulu olduğundan emin olun." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "1. postgresql.conf dosyasını kontrol ediyoruz..." -ForegroundColor Yellow

$pgConfPath = Join-Path $pgDataPath "postgresql.conf"
if (Test-Path $pgConfPath) {
    Write-Host "   ✅ Dosya bulundu: $pgConfPath" -ForegroundColor Green
    
    # listen_addresses kontrolü
    $content = Get-Content $pgConfPath -Raw
    if ($content -match "listen_addresses\s*=") {
        Write-Host "   ⚠️ listen_addresses ayarı mevcut" -ForegroundColor Yellow
        Write-Host "   Lütfen manuel olarak 'listen_addresses = ''*''' olarak ayarlayın" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️ listen_addresses ayarı bulunamadı, eklenmeli" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Dosya bulunamadı!" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. pg_hba.conf dosyasını kontrol ediyoruz..." -ForegroundColor Yellow

$pgHbaPath = Join-Path $pgDataPath "pg_hba.conf"
if (Test-Path $pgHbaPath) {
    Write-Host "   ✅ Dosya bulundu: $pgHbaPath" -ForegroundColor Green
    
    $hbaContent = Get-Content $pgHbaPath
    $hasLocalhost = $hbaContent | Select-String -Pattern "127\.0\.0\.1"
    
    if ($hasLocalhost) {
        Write-Host "   ✅ localhost bağlantısı zaten yapılandırılmış" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ localhost bağlantısı yapılandırılmamış" -ForegroundColor Yellow
        Write-Host "   Şu satırı ekleyin (en üste):" -ForegroundColor Cyan
        Write-Host "   host    all             all             127.0.0.1/32            md5" -ForegroundColor White
    }
} else {
    Write-Host "   ❌ Dosya bulunamadı!" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Servisi yeniden başlatmak için:" -ForegroundColor Yellow
Write-Host "   Restart-Service postgresql-x64-$pgVersion" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOT: Bu dosyaları düzenlemek için Administrator yetkisi gerekebilir." -ForegroundColor Yellow
Write-Host ""



