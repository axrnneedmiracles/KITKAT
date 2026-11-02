Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       SHEcurity Live Operations Dashboard Launcher" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$BackendDir = Join-Path $PSScriptRoot "website-server\backend"
Set-Location $BackendDir

Write-Host "Starting Node.js server on port 3000..." -ForegroundColor Green
Write-Host "Access URLs:" -ForegroundColor White
Write-Host "  - Laptop Browser: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  - Android Phone:  http://192.168.1.100:3000" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:3000"
node server.js
