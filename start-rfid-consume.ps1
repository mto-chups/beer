$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serialDir = Join-Path $scriptDir "serial"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js n'est pas installe ou n'est pas disponible dans le PATH. Installe Node.js puis relance ce fichier."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm n'est pas disponible dans le PATH. Reinstalle Node.js en activant l'ajout au PATH."
}

Set-Location $serialDir

$env:SERIAL_PORT = if ($env:SERIAL_PORT) { $env:SERIAL_PORT } else { "COM5" }
$env:API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3000/api/beerbu/consume-current" }
$env:KIOSK_SESSION_URL = if ($env:KIOSK_SESSION_URL) { $env:KIOSK_SESSION_URL } else { "http://localhost:3000/api/kiosk-session/current" }

$availablePorts = [System.IO.Ports.SerialPort]::GetPortNames()
if ($availablePorts -notcontains $env:SERIAL_PORT) {
  $portsMessage = if ($availablePorts.Count -gt 0) { $availablePorts -join ", " } else { "aucun" }
  throw "Le port $env:SERIAL_PORT est introuvable. Ports detectes : $portsMessage"
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installation des dependances serial..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Write-Host "Bridge RFID consommation"
Write-Host "Port serie: $env:SERIAL_PORT"
Write-Host "API: $env:API_URL"
Write-Host "Session borne: $env:KIOSK_SESSION_URL"
Write-Host ""

npm run consume
exit $LASTEXITCODE
