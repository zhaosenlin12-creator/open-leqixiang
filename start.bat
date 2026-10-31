@echo off
REM ============================================================
REM  Le Qi Xiang Display System - One-click launcher
REM  Double-click this file. It will:
REM    1. Install dependencies (first run only)
REM    2. Start the Vite dev server on http://127.0.0.1:5180/
REM    3. Open the default browser to that URL
REM
REM  Set the environment variable LEQX_NO_BROWSER=1 to skip the
REM  browser auto-open (useful for headless smoke tests).
REM ============================================================
setlocal
title Le Qi Xiang Display System

REM Use the directory of this .bat file as the working dir so the
REM launcher works no matter how it is invoked (double-click, cmd, etc.).
pushd "%~dp0"

if not exist start.ps1 (
    echo [ERROR] start.ps1 not found next to start.bat.
    echo         The launcher expects both files in the project root.
    pause
    popd
    endlocal
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
set "RC=%ERRORLEVEL%"

popd
endlocal
exit /b %RC%