@echo off
cd /d "%~dp0"
python render_video.py %*
if errorlevel 1 pause
