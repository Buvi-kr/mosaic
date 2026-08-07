const fs = require('fs');
const path = require('path');
const https = require('https');
const archiver = require('archiver');
const ROOT_DIR = path.join(__dirname, '..');
const ZIP_PATH = path.join(ROOT_DIR, 'Mosaic_V6_Release.zip');
const NODE_VERSION = 'v20.15.1';
const FOLDERS_TO_COPY = ['src', 'public', 'node_modules', 'scripts'];
const FILES_TO_COPY = ['package.json', 'cloudflared.exe', 'node-v20.15.1-x64.msi'];

function getStartBatContent() {
    return `@echo off
setlocal
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V6) - Startup

:: 1. Check and Auto-Install Node.js
set NODE_CMD=node
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "%ProgramFiles%\\nodejs\\node.exe" (
        set NODE_CMD="%ProgramFiles%\\nodejs\\node.exe"
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
            if exist "%ProgramFiles%\\nodejs\\node.exe" (
                set NODE_CMD="%ProgramFiles%\\nodejs\\node.exe"
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

:: 2. Check cloudflared
if not exist "cloudflared.exe" (
    echo [ERROR] cloudflared.exe not found.
    pause
    exit /b 1
)

:: 3. Cleanup zombie processes and ports
echo [CLEANUP] Killing leftover cloudflared and port 3000 processes...
taskkill /F /IM cloudflared.exe /T >nul 2>&1

powershell -Command "netstat -aon | Select-String 'LISTENING' | Select-String ':3000 ' | ForEach-Object { $pid = ($_ -split '\\s+')[-1]; if ($pid -ne '0') { taskkill /F /PID $pid /T 2>$null } }"

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
powershell -Command "netstat -aon | Select-String 'LISTENING' | Select-String ':3000 ' | ForEach-Object { $pid = ($_ -split '\\s+')[-1]; if ($pid -ne '0') { taskkill /F /PID $pid /T 2>$null } }"
goto check_port

:port_free
echo [CLEANUP] Port 3000 is free. Ready to start.

:: 4. Check dependencies
if not exist "node_modules" (
    echo [INFO] node_modules folder not found. Installing npm dependencies...
    if "%NODE_CMD%"=="node" (
        call npm install
    ) else (
        call "%ProgramFiles%\\nodejs\\npm.cmd" install
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
`;
}

async function build() {
    console.log('🚀 Starting Release Package Build (Direct-to-Zip)...');

    const output = fs.createWriteStream(ZIP_PATH);
    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    output.on('close', function() {
        console.log(`✅ Build Complete! Zip file created at: ${ZIP_PATH}`);
        console.log(`Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    });

    archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
            console.warn('Warning:', err);
        } else {
            throw err;
        }
    });

    archive.on('error', function(err) {
        throw err;
    });

    archive.pipe(output);

    // 1. Add start.bat
    console.log('[1/4] Adding start.bat...');
    archive.append(getStartBatContent(), { name: 'Mosaic_Release/start.bat' });

    // 2. Add Source Folders & Files
    console.log('[2/4] Adding source folders and files...');
    FOLDERS_TO_COPY.forEach(folder => {
        const srcPath = path.join(ROOT_DIR, folder);
        if (fs.existsSync(srcPath)) {
            archive.directory(srcPath, `Mosaic_Release/${folder}`);
        }
    });

    FILES_TO_COPY.forEach(file => {
        const srcPath = path.join(ROOT_DIR, file);
        if (fs.existsSync(srcPath)) {
            archive.file(srcPath, { name: `Mosaic_Release/${file}` });
        }
    });

    // 3. Add Data (config.json & themes)
    console.log('[3/4] Adding essential data files (config.json & themes only)...');
    const configSrc = path.join(ROOT_DIR, 'data', 'config.json');
    if (fs.existsSync(configSrc)) {
        archive.file(configSrc, { name: 'Mosaic_Release/data/config.json' });
    }

    const themesSrc = path.join(ROOT_DIR, 'data', 'themes');
    if (fs.existsSync(themesSrc)) {
        archive.directory(themesSrc, 'Mosaic_Release/data/themes');
    }

    console.log('⏳ Finalizing zip file...');
    await archive.finalize();
}

build().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
