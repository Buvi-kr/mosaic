@echo off
title Reverse Cosmos Mosaic (V3 Ultimate Edition)

echo ==============================================
echo [CLEANUP] Cleaning up zombie processes and ports...
echo ==============================================

:: Kill any existing cloudflared zombie processes
taskkill /F /IM cloudflared.exe /T >nul 2>&1

:: Kill any node processes holding port 3000
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr ":3000 "') DO (
    taskkill /F /PID %%a /T >nul 2>&1
)

echo ==============================================
echo [START] V3 Ultimate Edition System Starting...
echo ==============================================

if not exist "node_modules" (
    echo [INFO] Packages not installed. Installing...
    npm install
)

echo [INFO] Starting the server...
node src/app.js
pause
