@echo off
setlocal

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-rfid-bridge.ps1"

echo.
pause
endlocal
