@echo off
setlocal

echo ===============================================================================
echo [GPU Fast Cinematic Renderer]
echo ===============================================================================

set "BLENDER_EXE=C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"

if not exist "%BLENDER_EXE%" (
    echo [ERROR] Blender 5.2 not found at: %BLENDER_EXE%
    pause
    exit /b 1
)

echo [*] Blender Path: %BLENDER_EXE%
echo.

set "SCRIPT_PATH=%~dp0blender_workspace\generate_mosaic_scene.py"
set "BLEND_PATH=%~dp0blender_workspace\mosaic_cinematic.blend"
set "OUTPUT_FILE=%USERPROFILE%\Desktop\mosaic_cinematic_v1.mp4"

echo [*] Step 1/2: Building scene and GPU optimization...
"%BLENDER_EXE%" -b --python "%SCRIPT_PATH%"
if %errorlevel% neq 0 (
    echo [ERROR] Scene build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [*] Step 2/2: Rendering 21s (1260 frames) video animation...
echo [*] Estimated time: ~3-4 minutes
"%BLENDER_EXE%" -b "%BLEND_PATH%" -a
if %errorlevel% neq 0 (
    echo [ERROR] Render failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ===============================================================================
echo [SUCCESS] Video Render Completed!
echo Output: %OUTPUT_FILE%
echo ===============================================================================
pause