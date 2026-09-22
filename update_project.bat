@echo off
chcp 65001 > nul
cd /d "%~dp0"
title [Reverse Cosmos Mosaic] One-Click Update

echo ====================================================
echo  [Reverse Cosmos Mosaic] One-Click Code Sync
echo ====================================================
echo.

:: 0. Backup local config (resolution, tile size, opacity, etc.) before overwrite
if exist "data\config.json" (
    echo [GUARD] Backing up local config (resolution, tile size, etc.)...
    copy /y "data\config.json" "data\config.preserve.json" > nul
)

echo.
echo Step 1. Checking latest version from GitHub...
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set GIT_BRANCH=%%b
if "%GIT_BRANCH%"=="" set GIT_BRANCH=master
echo [INFO] Current branch: %GIT_BRANCH%
git fetch origin
if %errorlevel% neq 0 (
    echo [ERROR] Cannot reach GitHub. Check your internet connection.
    pause
    exit /b %errorlevel%
)

echo.
echo Step 2. Hard-resetting to latest remote code (local changes discarded)...
git reset --hard origin/%GIT_BRANCH%
if %errorlevel% neq 0 (
    echo [ERROR] Git sync failed.
    pause
    exit /b %errorlevel%
)

:: 3. Restore local config: merge preserved values on top of the new defaults
if exist "data\config.preserve.json" (
    node -e "const fs = require('fs'); try { const preserve = JSON.parse(fs.readFileSync('data/config.preserve.json', 'utf8')); const latest = JSON.parse(fs.readFileSync('data/config.json', 'utf8')); const merged = { ...latest, ...preserve }; if (preserve.googleSheets) { merged.googleSheets = { ...latest.googleSheets, ...preserve.googleSheets }; } fs.writeFileSync('data/config.json', JSON.stringify(merged, null, 2), 'utf8'); console.log('[CONFIG] Local config (resolution, tile size, etc.) fully restored.'); } catch(e) { try { fs.copyFileSync('data/config.preserve.json', 'data/config.json'); } catch(e2){} }"
    del /f /q "data\config.preserve.json" > nul 2>&1
)

:: 4. Install any new npm dependencies added in the latest code
echo.
echo Step 3. Syncing npm dependencies (installing new packages if any)...
call npm install --silent
if %errorlevel% neq 0 (
    echo [WARN] npm install had issues. Please check manually.
)

echo.
echo ====================================================
echo  [SUCCESS] Updated to the latest version safely!
echo  (Local config: resolution, tile size, all settings preserved)
echo ====================================================
echo.
pause
