param([switch]$Performance)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $root
. (Join-Path $root 'scripts/setup/env.ps1')
$settings = Get-DemoSettings -Root $root
$database = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$env:ConnectionStrings__Hospital = "Server=127.0.0.1,$($settings.SQL_PORT);Database=$database;User Id=sa;Password=$($settings.SQL_PASSWORD);TrustServerCertificate=true"
$env:Demo__Enabled = 'true'
$env:Demo__Password = $settings.DEMO_PASSWORD
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5281'
$env:Web__Origin = 'http://localhost:5180'
$env:API_URL = 'http://127.0.0.1:5281'
$env:ACCEPTANCE_DB = $database
New-Item -ItemType Directory -Force -Path '.local' | Out-Null
dotnet build backend/Hospital.Api --no-restore -c Release
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
$dll = Join-Path $root 'backend/Hospital.Api/bin/Release/net10.0/Hospital.Api.dll'
if ($Performance) {
  Push-Location (Join-Path $root 'backend/Hospital.Api')
  try { dotnet $dll --seed-performance; if ($LASTEXITCODE -ne 0) { throw 'Performance fixture creation failed.' } } finally { Pop-Location }
}
$process = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + $dll + '"') -WorkingDirectory (Join-Path $root 'backend/Hospital.Api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.local/test-api.stdout.log') -RedirectStandardError (Join-Path $root '.local/test-api.stderr.log') -PassThru
try {
  $healthy = $false
  for ($i = 0; $i -lt 45; $i++) {
    try { $null = Invoke-RestMethod ($env:API_URL + '/health') -TimeoutSec 2; $healthy = $true; break } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $healthy) { throw 'Acceptance API did not start. Inspect .local/test-api.stderr.log.' }
  Write-Output "Isolated acceptance database: $database"
  node --test --test-concurrency=1 tests/api/api.test.mjs
  $result = $LASTEXITCODE
  if ($Performance -and $result -eq 0) { node tests/api/performance.mjs; $result = $LASTEXITCODE }
  if ($result -ne 0) { throw 'Acceptance tests failed.' }
  Stop-Process -Id $process.Id
  foreach ($failure in @('Timeout', 'Unavailable')) {
    $env:Providers__FailureMode = $failure
    $env:Providers__TimeoutSeconds = '1'
    $env:PROVIDER_FAILURE = $failure
    $process = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + $dll + '"', '--no-migrate') -WorkingDirectory (Join-Path $root 'backend/Hospital.Api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.local/test-provider.stdout.log') -RedirectStandardError (Join-Path $root '.local/test-provider.stderr.log') -PassThru
    $healthy = $false
    for ($i = 0; $i -lt 30; $i++) {
      try { $null = Invoke-RestMethod ($env:API_URL + '/health') -TimeoutSec 2; $healthy = $true; break } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $healthy) { throw 'Provider test API did not start.' }
    node tests/api/provider-failure.mjs
    if ($LASTEXITCODE -ne 0) { throw "Provider failure tests failed: $failure" }
    Stop-Process -Id $process.Id
    $process.WaitForExit()
  }
} finally {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id }
  Remove-Item Env:ConnectionStrings__Hospital -ErrorAction SilentlyContinue
  Remove-Item Env:Demo__Password -ErrorAction SilentlyContinue
  Remove-Item Env:API_URL -ErrorAction SilentlyContinue
  Remove-Item Env:ACCEPTANCE_DB -ErrorAction SilentlyContinue
  Remove-Item Env:Providers__FailureMode -ErrorAction SilentlyContinue
  Remove-Item Env:Providers__TimeoutSeconds -ErrorAction SilentlyContinue
  Remove-Item Env:PROVIDER_FAILURE -ErrorAction SilentlyContinue
}
