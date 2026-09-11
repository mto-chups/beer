@echo off
setlocal

cd /d "%~dp0"

set "RFID_PORT=%~1"
if "%RFID_PORT%"=="" set "RFID_PORT=COM5"

if not exist "%~dp0serial\node_modules" (
  echo Installation des dependances serial...
  cd /d "%~dp0serial"
  call npm install
  if errorlevel 1 goto :error
)

cd /d "%~dp0serial"
call npm run diagnostic -- %RFID_PORT%
if errorlevel 1 goto :error
goto :end

:error
echo.
echo Le diagnostic a echoue. Lis le message ci-dessus.

:end
echo.
pause
endlocal
