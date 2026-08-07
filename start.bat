@echo off
setlocal
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V6) - Startup

:: 1. Check and Auto-Install Node.js
set NODE_CMD=node
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set NODE_CMD="%ProgramFiles%\nodejs\node.exe"
    ) else (
        if not exist "node-v20.15.1-x64.msi" (
            echo [INFO] Node.js is not installed on this PC and installer was not found.
            echo [INFO] Downloading Node.js Installer...
            powershell -Command "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.15.1/node-v20.15.1-x64.msi' -OutFile 'node-v20.15.1-x64.msi'"
        )
        if exist "node-v20.15.1-x64.msi" (
            echo [INFO] Launching Node.js Installer...
            echo ==================================================================
            echo [WARNING] Please complete the installation by clicking 'Next'.
            echo [WARNING] DO NOT check the box for "Tools for Native Modules" 
            echo           [Chocolatey/C++], as it will disrupt the auto-launch!
            echo ==================================================================
            start /wait node-v20.15.1-x64.msi
            if exist "%ProgramFiles%\nodejs\node.exe" (
                set NODE_CMD="%ProgramFiles%\nodejs\node.exe"
                echo [SUCCESS] Node.js installed successfully!
            ) else (
                echo [ERROR] Node.js installation was canceled or failed.
                pause
                exit /b 1
            )
        ) else (
            echo [ERROR] Failed to download Node.js installer. Check your internet connection.
            pause
            exit /b 1
        )
    )
)

:: 2. Check and download cloudflared
if not exist "cloudflared.exe" (
    echo [INFO] cloudflared.exe not found.
    echo [INFO] Downloading Cloudflared...
    powershell -Command "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    if exist "cloudflared.exe" (
        echo [SUCCESS] Cloudflared downloaded.
    ) else (
        echo [ERROR] Failed to download Cloudflared. Check your internet connection.
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

:: 4. Check dependencies
if not exist "node_modules" (
    echo [INFO] node_modules folder not found. Installing npm dependencies...
    if "%NODE_CMD%"=="node" (
        call npm install
    ) else (
        call "%ProgramFiles%\nodejs\npm.cmd" install
    )
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install npm dependencies. Please check your internet connection or install manually using 'npm install'.
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed successfully.
)

:: 5. Start Server
echo ==============================================
echo [START] Starting Reverse Cosmos Mosaic Server...
echo ==============================================
%NODE_CMD% src/app.js
pause
