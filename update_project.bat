@echo off
chcp 65001 > nul
title [우주 한 컷 사진관] 최신 코드 원클릭 갱신

echo ====================================================
echo  [우주 한 컷 사진관] 최신 코드 원클릭 동기화
echo ====================================================
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

echo.
echo ====================================================
echo  [성공] 최신 버전으로 안전하게 업데이트되었습니다!
echo  (참고: data/config.local.json 설정은 그대로 보존됩니다)
echo ====================================================
echo.
pause
