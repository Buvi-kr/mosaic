@echo off
chcp 65001 > nul
title [우주 한 컷 사진관] 최신 코드 원클릭 갱신

echo ====================================================
echo  [우주 한 컷 사진관] 최신 코드 원클릭 동기화
echo ====================================================
:: 0. 현장 컴퓨터의 고유 설정(구글 시트 URL 등) 안전 백업
if exist "data\config.json" (
    echo [안전 가드] 현장 컴퓨터의 설정을 안전하게 백업 중...
    copy /y "data\config.json" "data\config.backup.json" > nul
    if not exist "data\config.local.json" (
        copy /y "data\config.json" "data\config.local.json" > nul
    )
)

echo.
echo 1. 원격 GitHub 저장소의 최신 버전 확인 중...
git fetch origin master
if %errorlevel% neq 0 (
    echo [오류] 인터넷 연결 또는 깃허브 접근을 확인해주세요.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. 로컬 충돌을 방지하고 최신 코드로 완벽 동기화 중...
git reset --hard origin/master
if %errorlevel% neq 0 (
    echo [오류] 깃 동기화 중 문제가 발생했습니다.
    pause
    exit /b %errorlevel%
)

:: 3. 백업된 현장 설정 복원 보장
if exist "data\config.backup.json" (
    if not exist "data\config.local.json" (
        copy /y "data\config.backup.json" "data\config.local.json" > nul
    )
)

echo.
echo ====================================================
echo  [성공] 최신 버전으로 안전하게 업데이트되었습니다!
echo  (현장 컴퓨터의 구글 시트 URL 및 설정이 100% 보존되었습니다)
echo ====================================================
echo.
pause
