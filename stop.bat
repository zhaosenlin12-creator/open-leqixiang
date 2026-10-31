@echo off
setlocal EnableExtensions
title Le Qi Xiang Display System - Stop

pushd "%~dp0"
set "PORT=5180"

echo.
echo ============================================================
echo   Le Qi Xiang Display System - Stop
echo ============================================================
echo.

set "FOUND=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% " ^| findstr /R /C:"LISTENING"') do (
    echo [INFO] Port %PORT% is held by PID %%P, killing...
    taskkill /F /PID %%P >nul 2>nul
    set "FOUND=1"
)

REM Also close the minimized vite window if it still exists
taskkill /FI "WINDOWTITLE eq leqixiang-vite*" /T /F >nul 2>nul

if "%FOUND%"=="1" (
    echo.
    echo [INFO] Stopped.
) else (
    echo [INFO] Port %PORT% is free, no instance is running.
)
echo.
pause
popd
endlocal
exit /b 0