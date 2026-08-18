@echo off
chcp 65001 > nul
echo [Blender Workspace] 모자이크 데이터 추출 중...
node export_mosaic_data.js
pause
