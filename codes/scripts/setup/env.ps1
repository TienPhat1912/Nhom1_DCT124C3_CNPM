# Shared parser for the root .env. Values are data, never executable PowerShell.
function Get-DemoSettings {
  param([Parameter(Mandatory=$true)][string]$Root)
  $path = Join-Path $Root '.env'
  if (-not (Test-Path -LiteralPath $path)) { throw 'Run scripts/setup/bootstrap.ps1 first.' }
  $settings = @{ SQL_PORT='14339'; API_PORT='5280'; WEB_PORT='5180'; DATABASE_NAME='HospitalGuidance' }
  foreach ($line in [IO.File]::ReadAllLines($path)) {
    if ($line -match '^\s*(#.*)?$') { continue }
    if ($line -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { throw 'Use KEY=value without quotes or spaces around = in .env.' }
    $settings[$matches[1]] = $matches[2]
  }
  foreach ($key in @('SQL_PASSWORD', 'DEMO_PASSWORD')) {
    $value = $settings[$key]
    if (-not $value -or $value.StartsWith('REPLACE_') -or $value -notmatch '^[A-Za-z0-9!@%_+=.\-]{8,128}$') {
      throw "$key must be set in .env (8-128 characters: letters, numbers, ! @ % _ + = . -; no quotes). Use bootstrap to generate a new configuration."
    }
  }
  foreach ($key in @('SQL_PORT', 'API_PORT', 'WEB_PORT')) {
    if ($settings[$key] -notmatch '^[1-9][0-9]{0,4}$' -or [int]$settings[$key] -gt 65535) { throw "Invalid $key in .env." }
  }
  if (@($settings.SQL_PORT, $settings.API_PORT, $settings.WEB_PORT | Select-Object -Unique).Count -ne 3) { throw 'SQL_PORT, API_PORT and WEB_PORT must be different.' }
  if ($settings.DATABASE_NAME -notmatch '^[A-Za-z][A-Za-z0-9_]{0,100}$') { throw 'Invalid DATABASE_NAME in .env.' }
  return $settings
}
