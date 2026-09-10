$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serialDir = Join-Path $scriptDir "serial"

Set-Location $serialDir

if (-not (Test-Path "node_modules")) {
  Write-Host "Installation des dependances serial..."
  npm install
}

$env:SERIAL_PORT = if ($env:SERIAL_PORT) { $env:SERIAL_PORT } else { "COM5" }
$env:API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3000/api/beerbu/consume-current" }
$env:KIOSK_SESSION_URL = if ($env:KIOSK_SESSION_URL) { $env:KIOSK_SESSION_URL } else { "http://localhost:3000/api/kiosk-session/current" }

Write-Host "Bridge RFID consommation"
Write-Host "Port serie: $env:SERIAL_PORT"
Write-Host "API: $env:API_URL"
Write-Host "Session borne: $env:KIOSK_SESSION_URL"
Write-Host ""

npm run consume
