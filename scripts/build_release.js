const fs = require('fs');
const path = require('path');
const https = require('https');
const archiver = require('archiver');
const ROOT_DIR = path.join(__dirname, '..');
const ZIP_PATH = path.join(ROOT_DIR, 'Mosaic_V6_Portable.zip');
const NODE_VERSION = 'v20.15.1'; // 고정 LTS 버전 사용 (exhibition PC 호환성)
const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}/win-x64/node.exe`;
const FOLDERS_TO_COPY = ['src', 'public', 'node_modules', 'scripts'];
const FILES_TO_COPY = ['package.json', 'cloudflared.exe'];

// Generate the start.bat for the user
function getStartBatContent() {
    return `@echo off
setlocal
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V6) - Portable

echo ==============================================
echo [CLEANUP] Cleaning up zombie processes and ports...
echo ==============================================

:: Kill any existing cloudflared zombie processes
taskkill /F /IM cloudflared.exe /T >nul 2>&1

:: Kill only LISTENING processes on port 3000
powershell -Command "netstat -aon | Select-String 'LISTENING' | Select-String ':3000 ' | ForEach-Object { $pid = ($_ -split '\\s+')[-1]; if ($pid -ne '0') { taskkill /F /PID $pid /T 2>$null } }"

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
powershell -Command "netstat -aon | Select-String 'LISTENING' | Select-String ':3000 ' | ForEach-Object { $pid = ($_ -split '\\s+')[-1]; if ($pid -ne '0') { taskkill /F /PID $pid /T 2>$null } }"
goto check_port

:port_free
echo [CLEANUP] Port 3000 is free. Ready to start.

echo ==============================================
echo [START] System Starting...
echo ==============================================
echo [INFO] Starting the main server using bundled Portable Node.js...

:: Execute the bundled node.exe
.\\bin\\node.exe .\\src\\app.js

pause
`;
}

async function build() {
    console.log('🚀 Starting Portable Release Build (Direct-to-Zip)...');

    // Create a file to stream archive data to.
    const output = fs.createWriteStream(ZIP_PATH);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', function() {
        console.log(`✅ Build Complete! Zip file created at: ${ZIP_PATH}`);
        console.log(`Total bytes: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
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

    // Pipe archive data to the file
    archive.pipe(output);

    // 1. Add start.bat
    console.log('[1/4] Adding start.bat...');
    archive.append(getStartBatContent(), { name: 'Mosaic_Release/start.bat' });

    // 2. Download and stream node.exe
    console.log(`[2/4] Downloading and streaming node.exe (${NODE_VERSION}) directly into zip...`);
    await new Promise((resolve, reject) => {
        https.get(NODE_URL, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to get node.exe (${response.statusCode})`));
            }
            archive.append(response, { name: 'Mosaic_Release/bin/node.exe' });
            resolve();
        }).on('error', reject);
    });

    // 3. Add Folders and Files
    console.log('[3/4] Adding source folders, node_modules, and required files (Directly from disk)...');
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

    // 4. Add necessary Data (config.json, themes)
    console.log('[4/4] Adding essential data files (config.json & themes only)...');
    const configSrc = path.join(ROOT_DIR, 'data', 'config.json');
    if (fs.existsSync(configSrc)) {
        archive.file(configSrc, { name: 'Mosaic_Release/data/config.json' });
    }

    const themesSrc = path.join(ROOT_DIR, 'data', 'themes');
    if (fs.existsSync(themesSrc)) {
        archive.directory(themesSrc, 'Mosaic_Release/data/themes');
    }

    // Finalize the archive (this will finish zipping all queued files and streams)
    console.log('⏳ Finalizing zip file (this might take a few minutes)...');
    await archive.finalize();
}

build().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
