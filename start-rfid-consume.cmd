@echo off
setlocal

cd /d "%~dp0"
if not "%~1"=="" set "SERIAL_PORT=%~1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-rfid-consume.ps1"
set "RFID_EXIT_CODE=%ERRORLEVEL%"

echo.
echo Le bridge RFID s'est arrete avec le code %RFID_EXIT_CODE%.
echo Lis le message ci-dessus pour connaitre la cause.
pause

endlocal
