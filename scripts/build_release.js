const fs = require('fs');
const path = require('path');
const https = require('https');
const archiver = require('archiver');

const ROOT_DIR = path.join(__dirname, '..');
const ZIP_PATH = path.join(ROOT_DIR, 'Mosaic_V4_Portable.zip');
const NODE_VERSION = process.version;
const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}/win-x64/node.exe`;

const FOLDERS_TO_COPY = ['src', 'public', 'node_modules', 'scripts'];
const FILES_TO_COPY = ['package.json', 'cloudflared.exe'];

// Generate the start.bat for the user
function getStartBatContent() {
    return `@echo off
setlocal
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V4 Multi-Theme)

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
