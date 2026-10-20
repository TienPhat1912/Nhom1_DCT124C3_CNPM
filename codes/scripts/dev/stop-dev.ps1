$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
foreach ($name in @('api', 'web')) {
  $pidFile = Join-Path $root ".local/$name.pid"
  if (Test-Path -LiteralPath $pidFile) {
    $processId = [int](Get-Content -LiteralPath $pidFile)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
    if ($process -and $process.CommandLine -and $process.CommandLine.Contains($root)) { Stop-Process -Id $processId; Write-Output "Stopped owned $name process." }
  }
}
