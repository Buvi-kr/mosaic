const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const RELEASE_DIR = path.join(DIST_DIR, 'Mosaic_Release');
const NODE_VERSION = process.version; // e.g., 'v20.15.1'
const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}/win-x64/node.exe`;
const NODE_DEST = path.join(RELEASE_DIR, 'bin', 'node.exe');

const FOLDERS_TO_COPY = ['src', 'public', 'node_modules', 'scripts'];
const FILES_TO_COPY = ['package.json', 'cloudflared.exe'];

// Helper for downloading a file
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

// Generate the start.bat for the user
function generateStartBat() {
    const batContent = `@echo off
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
    fs.writeFileSync(path.join(RELEASE_DIR, 'start.bat'), batContent, 'utf8');
}

async function build() {
    console.log('🚀 Starting Portable Release Build...');
    
    // 1. Clean dist
    console.log('[1/6] Cleaning up dist folder...');
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(RELEASE_DIR, 'bin'), { recursive: true });

    // 2. Download node.exe (matching current system node version to prevent ABI mismatch)
    console.log(`[2/6] Downloading portable node.exe (${NODE_VERSION})...`);
    await downloadFile(NODE_URL, NODE_DEST);

    // 3. Copy Folders (src, public, node_modules)
    console.log('[3/6] Copying source folders and dependencies...');
    FOLDERS_TO_COPY.forEach(folder => {
        const srcPath = path.join(ROOT_DIR, folder);
        if (fs.existsSync(srcPath)) {
            console.log(`      Copying ${folder}...`);
            try {
                // Use robocopy for robust copying on Windows, especially for node_modules
                const destPath = path.join(RELEASE_DIR, folder);
                fs.mkdirSync(destPath, { recursive: true });
                execSync(`robocopy "${srcPath}" "${destPath}" /E /MT:8`, { stdio: 'ignore' });
            } catch (err) {
                // robocopy exits with code 1-7 on success, >=8 on failure
                if (err.status >= 8) {
                    throw new Error(`Failed to copy ${folder} using robocopy`);
                }
            }
        }
    });

    // 3.5 Copy necessary Data (Skip apod_originals to save space)
    console.log('[3.5/6] Copying essential database files (skipping heavy originals)...');
    const dataDest = path.join(RELEASE_DIR, 'data');
    fs.mkdirSync(dataDest, { recursive: true });
    
    // Copy config.json if exists
    const configSrc = path.join(ROOT_DIR, 'data', 'config.json');
    if (fs.existsSync(configSrc)) {
        fs.copyFileSync(configSrc, path.join(dataDest, 'config.json'));
    }

    // Copy themes folder (contains lightweight tileDB.json and kdtree)
    const themesSrc = path.join(ROOT_DIR, 'data', 'themes');
    if (fs.existsSync(themesSrc)) {
        const destPath = path.join(dataDest, 'themes');
        fs.mkdirSync(destPath, { recursive: true });
        try {
            execSync(`robocopy "${themesSrc}" "${destPath}" /E /MT:8`, { stdio: 'ignore' });
        } catch (err) {
            if (err.status >= 8) {
                console.error('Failed to copy themes');
            }
        }
    }

    // 4. Copy Files
    console.log('[4/6] Copying required files...');
    FILES_TO_COPY.forEach(file => {
        const srcPath = path.join(ROOT_DIR, file);
        if (fs.existsSync(srcPath)) {
            console.log(`      Copying ${file}...`);
            fs.copyFileSync(srcPath, path.join(RELEASE_DIR, file));
        }
    });

    // 5. Generate start.bat
    console.log('[5/6] Generating portable start.bat...');
    generateStartBat();

    // 6. Zip the release
    console.log('[6/6] Zipping the release folder (this might take a minute)...');
    try {
        const zipDest = path.join(DIST_DIR, 'Mosaic_V4_Portable.zip');
        // Use PowerShell's Compress-Archive
        execSync(`powershell -Command "Compress-Archive -Path '${RELEASE_DIR}' -DestinationPath '${zipDest}' -Force"`, { stdio: 'inherit' });
        console.log(`✅ Build Complete! Zip file created at: ${zipDest}`);
    } catch (err) {
        console.error('❌ Failed to create zip file:', err);
    }
}

build().catch(err => {
    console.error('Build failed:', err);
});
