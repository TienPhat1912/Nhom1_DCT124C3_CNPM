$ErrorActionPreference = 'Stop'
$pidFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.artifacts/demo/processes.json'
if (!(Test-Path -LiteralPath $pidFile)) { Write-Output 'No recorded demo processes.'; exit 0 }
$records = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
foreach ($record in $records) {
    $process = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $record.Started) {
        Stop-Process -Id $process.Id
    }
}
Remove-Item -LiteralPath $pidFile
Write-Output 'Recorded demo processes stopped. Database preserved.'
