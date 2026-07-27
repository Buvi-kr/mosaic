@echo off
setlocal
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V6) - Startup

:: 1. Check and download Node.js
set NODE_CMD=node
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "node.exe" (
        set NODE_CMD=.\node.exe
    ) else (
        echo [INFO] Node.js not found.
        echo [INFO] Downloading Node.js v20.15.1 Portable...
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.15.1/win-x64/node.exe' -OutFile 'node.exe'"
        if exist "node.exe" (
            set NODE_CMD=.\node.exe
            echo [SUCCESS] Node.js downloaded.
        ) else (
            echo [ERROR] Failed to download Node.js. Check your internet connection.
            pause
            exit /b 1
        )
    )
)

:: 2. Check and download cloudflared
if not exist "cloudflared.exe" (
    echo [INFO] cloudflared.exe not found.
    echo [INFO] Downloading Cloudflared...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    if exist "cloudflared.exe" (
        echo [SUCCESS] Cloudflared downloaded.
    ) else (
        echo [ERROR] Failed to download Cloudflared.
    )
)

:: 3. Cleanup zombie processes and ports
echo [CLEANUP] Killing leftover cloudflared and port 3000 processes...
taskkill /F /IM cloudflared.exe /T >nul 2>&1

:: Kill only LISTENING processes on port 3000 (ignore TIME_WAIT, ESTABLISHED, etc.)
powershell -Command "netstat -aon | Select-String 'LISTENING' | Select-String ':3000 ' | ForEach-Object { $pid = ($_ -split '\s+')[-1]; if ($pid -ne '0') { taskkill /F /PID $pid /T 2>$null } }"

:: Wait and verify port 3000 is actually free before starting
set RETRY_COUNT=0
:check_port
powershell -Command "if (netstat -aon | Select-String 'LISTENING' | Select-String ':3000 ') { exit 1 } else { exit 0 }"
if %ERRORLEVEL% equ 0 goto port_free

set /a RETRY_COUNT+=1
if %RETRY_COUNT% geq 10 (
    echo [ERROR] Port 3000 is still in use after 10 seconds.
    echo [ERROR] Please close the program using port 3000 manually.
    pause
    exit /b 1
)
echo [CLEANUP] Port 3000 still occupied, retrying... (%RETRY_COUNT%/10)
timeout /t 1 /nobreak >nul
powershell -Command "netstat -aon | Select-String 'LISTENING' | Select-String ':3000 ' | ForEach-Object { $pid = ($_ -split '\s+')[-1]; if ($pid -ne '0') { taskkill /F /PID $pid /T 2>$null } }"
goto check_port

:port_free
echo [CLEANUP] Port 3000 is free. Ready to start.

:: 4. Check and install dependencies
if not exist "node_modules" (
    echo [INFO] node_modules not found. Running npm install...
    call npm -v >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm command not found. Please install Node.js globally.
        pause
        exit /b 1
    )
    call npm install
)

:: 5. Start Server
echo ==============================================
echo [START] Starting Reverse Cosmos Mosaic Server...
echo ==============================================
%NODE_CMD% src/app.js
pause
