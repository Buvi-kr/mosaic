@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Reverse Cosmos Mosaic (V5) - A to Z Manager

:: Node.js 실행 파일 자동 확인 및 다운로드 로직
set NODE_CMD=node
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "node.exe" (
        set NODE_CMD=.\node.exe
    ) else (
        echo ==============================================
        echo [INFO] 시스템에 Node.js가 발견되지 않았습니다.
        echo [INFO] 구동에 필요한 Node.js (v20.15.1) 바이너리를 자동 다운로드합니다... (약 1~2초 소요)
        echo ==============================================
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.15.1/win-x64/node.exe' -OutFile 'node.exe'"
        if exist "node.exe" (
            set NODE_CMD=.\node.exe
            echo [SUCCESS] Node.js 다운로드 완료!
        ) else (
            echo [ERROR] 다운로드에 실패했습니다. 인터넷 연결을 확인하세요.
            pause
            exit /b 1
        )
    )
)

:: Cloudflared 실행 파일 자동 확인 및 다운로드 로직
if not exist "cloudflared.exe" (
    echo ==============================================
    echo [INFO] 외부 접속용 Cloudflared가 발견되지 않았습니다.
    echo [INFO] 공식 바이너리를 자동 다운로드합니다... (약 10~20초 소요)
    echo ==============================================
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    if exist "cloudflared.exe" (
        echo [SUCCESS] Cloudflared 다운로드 완료!
    ) else (
        echo [ERROR] 다운로드에 실패했습니다. 수동으로 다운로드해주세요.
    )
)

:menu
cls
echo ========================================================
echo   🌌 Reverse Cosmos Mosaic (V5) - 통합 관리자 (A to Z)
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
if not exist "node_modules" (
    echo [INFO] 필수 패키지가 없습니다. 설치를 진행합니다...
    call npm -v >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm 명령어를 찾을 수 없습니다. (포터블 환경이 아닌 개발 환경에서는 Node.js 정식 설치가 필요합니다)
        pause
        goto menu
    )
    call npm install
)
echo [START] Starting the main server...
%NODE_CMD% src/app.js
pause
goto menu

:build_release
cls
echo ==============================================
echo [BUILD] 포터블 릴리즈 생성을 시작합니다...
echo ==============================================
%NODE_CMD% scripts/build_release.js
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
    %NODE_CMD% scripts/build.db.js %theme%
) else if "%build_opt%"=="2" (
    %NODE_CMD% scripts/build.db.js %theme% --index-only
) else (
    echo 잘못된 입력입니다.
)
echo.
echo 완료되었습니다! 엔터를 누르면 메뉴로 돌아갑니다.
pause
goto menu
