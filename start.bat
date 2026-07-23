@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V4) - A to Z Manager

:menu
cls
echo ========================================================
echo   🌌 Reverse Cosmos Mosaic (V4) - 통합 관리자 (A to Z)
echo ========================================================
echo.
echo   1. 🚀 서버 시작 (전시용 및 로컬 테스트)
echo   2. 📦 배포용 포터블 파일 생성 (USB 1-Click 실행버전)
echo   3. 🛠️ 특정 테마 DB 수동 빌드 (타일 재처리 및 k-d tree 재생성)
echo   4. ❌ 종료
echo.
echo ========================================================
set /p choice="원하시는 작업의 번호를 입력하세요 (1-4): "

if "%choice%"=="1" goto start_server
if "%choice%"=="2" goto build_release
if "%choice%"=="3" goto build_theme
if "%choice%"=="4" exit
goto menu

:start_server
cls
echo ==============================================
echo [CLEANUP] Cleaning up zombie processes and ports...
echo ==============================================
taskkill /F /IM cloudflared.exe /T >nul 2>&1
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr ":3000 "') DO (
    taskkill /F /PID %%a /T >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo ==============================================
echo [START] System Starting...
echo ==============================================
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js가 설치되어 있지 않거나 PATH에 없습니다!
    pause
    goto menu
)
if not exist "node_modules" (
    echo [INFO] 필수 패키지가 없습니다. 설치를 진행합니다...
    call npm install
)
echo [START] Starting the main server...
node src/app.js
pause
goto menu

:build_release
cls
echo ==============================================
echo [BUILD] 포터블 릴리즈 생성을 시작합니다...
echo ==============================================
node scripts/build_release.js
echo.
echo 완료되었습니다! 엔터를 누르면 메뉴로 돌아갑니다.
pause
goto menu

:build_theme
cls
echo ==============================================
echo [BUILD] 테마 DB 빌더
echo ==============================================
echo 팁: public/raw_tiles/ 폴더 안의 테마 이름을 입력하세요. (예: default_nasa)
set /p theme="빌드할 테마 이름: "
if "%theme%"=="" (
    echo 테마 이름이 입력되지 않았습니다.
    pause
    goto menu
)
echo.
echo [1] 전체 빌드 (이미지 리사이즈 + DB 생성)
echo [2] 인덱스만 퀵 리빌드 (이미지 처리 건너뛰기)
set /p build_opt="옵션을 선택하세요 (1-2): "

if "%build_opt%"=="1" (
    node scripts/build.db.js %theme%
) else if "%build_opt%"=="2" (
    node scripts/build.db.js %theme% --index-only
) else (
    echo 잘못된 입력입니다.
)
echo.
echo 완료되었습니다! 엔터를 누르면 메뉴로 돌아갑니다.
pause
goto menu
