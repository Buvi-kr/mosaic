@echo off
setlocal
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V5) - Startup

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

:: 3. Cleanup zombie processes
echo [CLEANUP] Cleaning up zombie processes and ports...
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr ":3000 "') DO (
    taskkill /F /PID %%a /T >nul 2>&1
)
timeout /t 2 /nobreak >nul

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
