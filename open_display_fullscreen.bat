@echo off
chcp 65001 >nul
title Reverse Cosmos Mosaic - Edge Fullscreen Launcher

echo ==========================================================
echo    Reverse Cosmos Mosaic - Edge Fullscreen Launcher
echo ==========================================================
echo.

set "EDGE_EXE="

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if "%EDGE_EXE%"=="" if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if "%EDGE_EXE%"=="" if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if "%EDGE_EXE%"=="" if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "EDGE_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if "%EDGE_EXE%"=="" if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "EDGE_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if "%EDGE_EXE%"=="" if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "EDGE_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not "%EDGE_EXE%"=="" (
    echo [OK] Browser Detected: "%EDGE_EXE%"
    echo [INFO] Launching in True Exhibition KIOSK Fullscreen Mode...
    echo.
    set "FULLSCREEN_DIR=%TEMP%\mosaic_fullscreen_profile"
    if not exist "%FULLSCREEN_DIR%" mkdir "%FULLSCREEN_DIR%"
    start "" "%EDGE_EXE%" --user-data-dir="%FULLSCREEN_DIR%" --start-fullscreen "http://localhost:3000/display.html" --no-first-run --no-default-browser-check
    echo [SUCCESS] Edge Fullscreen Launched! (Press F11 anytime to toggle)
) else (
    echo [WARN] Dedicated browser not found, launching default browser...
    echo        (Press [F] or [F11] on screen to toggle fullscreen)
    start http://localhost:3000/display.html
)

echo.
ping 127.0.0.1 -n 3 >nul
