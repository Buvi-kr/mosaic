@echo off
setlocal
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V4 Multi-Theme) - Developer Mode

echo ==============================================
echo [CLEANUP] Cleaning up zombie processes and ports...
echo ==============================================

:: Kill any existing cloudflared zombie processes
taskkill /F /IM cloudflared.exe /T >nul 2>&1

:: Kill any node processes holding port 3000
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr ":3000 "') DO (
    taskkill /F /PID %%a /T >nul 2>&1
)

:: Wait 2 seconds for ports to fully release and avoid EADDRINUSE
timeout /t 2 /nobreak >nul

echo ==============================================
echo [START] System Starting (Developer Mode)...
echo ==============================================

:: Check if Node is installed
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo [INFO] To build a portable release that doesn't need Node.js, run 'node scripts/build_release.js' on a PC with Node installed.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Required packages not found. Installing now...
    call npm install
)

echo [START] Starting the main server...
node src/app.js

pause
