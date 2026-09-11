$ErrorActionPreference = "Stop"

$rfidProcesses = @(
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object {
      $_.CommandLine -match 'serial-to-http\.js' -or
      $_.CommandLine -match 'serial-diagnostic\.js'
    }
)

if ($rfidProcesses.Count -eq 0) {
  Write-Host "Aucun bridge RFID Node actif n'a ete trouve."
  Write-Host "Ferme aussi le moniteur serie et le traceur serie dans Arduino IDE."
  exit 0
}

foreach ($rfidProcess in $rfidProcesses) {
  Write-Host "Arret du processus RFID PID $($rfidProcess.ProcessId)..."
  Stop-Process -Id $rfidProcess.ProcessId -Force
}

Write-Host "Bridge RFID arrete. COM5 devrait maintenant etre libre."
