param([switch]$MigrateOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $root
. (Join-Path $root 'scripts/setup/env.ps1')
$settings = Get-DemoSettings -Root $root
$database = $settings.DATABASE_NAME
$saved = @{}
foreach ($name in @('Translation__Provider', 'Translation__Key', 'Translation__Region', 'Translation__Endpoint', 'ConnectionStrings__Hospital', 'Demo__Enabled', 'Demo__Password', 'ASPNETCORE_ENVIRONMENT', 'ASPNETCORE_URLS', 'Web__Origin', 'Web__AdditionalOrigins__0')) {
  $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
$env:ConnectionStrings__Hospital = "Server=127.0.0.1,$($settings.SQL_PORT);Database=$database;User Id=sa;Password=$($settings.SQL_PASSWORD);TrustServerCertificate=true"
foreach ($item in @{ Provider='TRANSLATION_PROVIDER'; Key='TRANSLATION_KEY'; Region='TRANSLATION_REGION'; Endpoint='TRANSLATION_ENDPOINT' }.GetEnumerator()) {
    if ($settings.ContainsKey($item.Value)) { [Environment]::SetEnvironmentVariable('Translation__' + $item.Key, $settings[$item.Value], 'Process') }
  }
  $env:Demo__Enabled = 'true'
$env:Demo__Password = $settings.DEMO_PASSWORD
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = "http://127.0.0.1:$($settings.API_PORT)"
$env:Web__Origin = "http://localhost:$($settings.WEB_PORT)"
$env:Web__AdditionalOrigins__0 = "http://127.0.0.1:$($settings.WEB_PORT)"
if ($MigrateOnly) { dotnet run --project backend/Hospital.Api --no-launch-profile -- --migrate-only }
else { dotnet run --project backend/Hospital.Api --no-launch-profile }
if ($LASTEXITCODE -ne 0) { throw 'Backend failed. See process output.' }
} finally {
  foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
