@echo off
title SHEcurity Operations Server & Live Monitoring Dashboard
echo ==========================================================
echo       SHEcurity Live Operations Dashboard Launcher
echo ==========================================================
echo.
echo [1/2] Changing directory to website backend...
cd /d "%~dp0website-server\backend"

echo [2/2] Launching server on port 3000...
echo.
echo Access Modes:
echo   - Laptop Browser:       http://localhost:3000
echo   - Phone (Same Wi-Fi):   Local IP printed below
echo   - Phone (Any Network):  Cloudflare Tunnel URL auto-generated below!
echo.
echo Opening dashboard in default web browser...
start http://localhost:3000

echo.
echo Server is starting with Global Cloud Tunnel for remote testing...
echo ==========================================================
node server.js

pause
