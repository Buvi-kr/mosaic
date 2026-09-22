@echo off
chcp 65001 > nul
cd /d "%~dp0"
title [우주 한 컷 사진관] 최신 코드 원클릭 갱신

echo ====================================================
echo  [우주 한 컷 사진관] 최신 코드 원클릭 동기화
echo ====================================================
echo.

:: 0. 현장 컴퓨터의 고유 설정(1440p 해상도, 타일 크기, 투명도, 구글 시트 URL 등) 안전 백업
if exist "data\config.json" (
    echo [안전 가드] 현장 컴퓨터의 설정값(해상도, 타일크기 등)을 안전하게 백업 중...
    copy /y "data\config.json" "data\config.preserve.json" > nul
)

echo.
echo 1. 원격 GitHub 저장소의 최신 버전 확인 중...
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set GIT_BRANCH=%%b
if "%GIT_BRANCH%"=="" set GIT_BRANCH=master
echo [INFO] 현재 브랜치: %GIT_BRANCH%
git fetch origin
if %errorlevel% neq 0 (
    echo [오류] 인터넷 연결 또는 깃허브 접근을 확인해주세요.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. 로컬 충돌을 방지하고 최신 코드로 완벽 동기화 중...
git reset --hard origin/%GIT_BRANCH%
if %errorlevel% neq 0 (
    echo [오류] 깃 동기화 중 문제가 발생했습니다.
    pause
    exit /b %errorlevel%
)

:: 3. 현장 컴퓨터의 기존 설정값(1440p, tileSize 등)을 100% 그대로 유지하며 신규 옵션 병합 복원
if exist "data\config.preserve.json" (
    node -e "const fs = require('fs'); try { const preserve = JSON.parse(fs.readFileSync('data/config.preserve.json', 'utf8')); const latest = JSON.parse(fs.readFileSync('data/config.json', 'utf8')); const merged = { ...latest, ...preserve }; if (preserve.googleSheets) { merged.googleSheets = { ...latest.googleSheets, ...preserve.googleSheets }; } fs.writeFileSync('data/config.json', JSON.stringify(merged, null, 2), 'utf8'); console.log('[설정보존] 현장 컴퓨터의 기존 설정값(1440p, 타일크기 등)이 100% 복원되었습니다.'); } catch(e) { try { fs.copyFileSync('data/config.preserve.json', 'data/config.json'); } catch(e2){} }"
    del /f /q "data\config.preserve.json" > nul 2>&1
)

:: 4. 새 패키지 의존성 자동 설치
echo.
echo 3. npm 의존성 최신화 중 (새 패키지 있을 경우 자동 설치)...
call npm install --silent
if %errorlevel% neq 0 (
    echo [경고] npm install 에 문제가 있을 수 있습니다. 수동으로 확인해주세요.
)

echo.
echo ====================================================
echo  [성공] 최신 버전으로 안전하게 업데이트되었습니다!
echo  (현장 컴퓨터의 1440p 해상도, 타일 크기 및 모든 설정이 100% 보존되었습니다)
echo ====================================================
echo.
pause
