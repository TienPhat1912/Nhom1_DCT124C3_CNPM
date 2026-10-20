$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $root
New-Item -ItemType Directory -Force -Path '.local' | Out-Null
. (Join-Path $root 'scripts/setup/env.ps1')
$settings = Get-DemoSettings -Root $root
$database = $settings.DATABASE_NAME
foreach ($port in @($settings.API_PORT, $settings.WEB_PORT)) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is in use. Stop the previous source demo or Compose api/web before starting." }
}
$saved = @{}
foreach ($name in @('ConnectionStrings__Hospital', 'Demo__Enabled', 'Demo__Password', 'ASPNETCORE_ENVIRONMENT', 'ASPNETCORE_URLS', 'Web__Origin')) {
  $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
  dotnet build backend/Hospital.Api --no-restore
  if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
  $env:ConnectionStrings__Hospital = "Server=127.0.0.1,$($settings.SQL_PORT);Database=$database;User Id=sa;Password=$($settings.SQL_PASSWORD);TrustServerCertificate=true"
  $env:Demo__Enabled = 'true'
  $env:Demo__Password = $settings.DEMO_PASSWORD
  $env:ASPNETCORE_ENVIRONMENT = 'Development'
  $env:ASPNETCORE_URLS = "http://127.0.0.1:$($settings.API_PORT)"
  $env:Web__Origin = "http://localhost:$($settings.WEB_PORT)"
  $dll = Join-Path $root 'backend/Hospital.Api/bin/Debug/net10.0/Hospital.Api.dll'
  $p = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + $dll + '"') -WorkingDirectory (Join-Path $root 'backend/Hospital.Api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.local/api.stdout.log') -RedirectStandardError (Join-Path $root '.local/api.stderr.log') -PassThru
  $p.Id | Set-Content -LiteralPath '.local/api.pid'
} finally {
  foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
try {
  $vite = Join-Path $root 'node_modules/vite/bin/vite.js'
  $p = Start-Process -FilePath 'node' -ArgumentList @('"' + $vite + '"', '--host', '127.0.0.1', '--port', $settings.WEB_PORT) -WorkingDirectory (Join-Path $root 'apps/web') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.local/web.stdout.log') -RedirectStandardError (Join-Path $root '.local/web.stderr.log') -PassThru
  $p.Id | Set-Content -LiteralPath '.local/web.pid'
  $healthy = $false
  for ($i = 0; $i -lt 60; $i++) {
    try {
      # Match Vite's IPv4 bind; localhost may try IPv6 until the timeout on Windows.
      $null = Invoke-RestMethod "http://127.0.0.1:$($settings.WEB_PORT)/health" -TimeoutSec 2
      $healthy = $true
      break
    } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $healthy) { throw 'Development startup failed. Inspect .local/api.stderr.log and .local/web.stderr.log.' }
} catch {
  & (Join-Path $PSScriptRoot 'stop-dev.ps1')
  throw
}
Write-Output "Development URLs: http://localhost:$($settings.WEB_PORT) and http://127.0.0.1:$($settings.API_PORT)/health"
