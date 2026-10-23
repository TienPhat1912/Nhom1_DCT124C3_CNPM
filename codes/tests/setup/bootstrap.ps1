$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$scratch = [IO.Path]::GetFullPath((Join-Path $root ('.local/bootstrap-check-' + [Guid]::NewGuid().ToString('N'))))
$allowed = [IO.Path]::GetFullPath((Join-Path $root '.local')) + [IO.Path]::DirectorySeparatorChar
if (-not $scratch.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase)) { throw 'Test path escaped .local.' }
function Assert-Setup([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
try {
  $bash = if ($env:OS -eq 'Windows_NT') { Join-Path $env:ProgramFiles 'Git/bin/bash.exe' } else { (Get-Command bash -ErrorAction Stop).Source }
  foreach ($kind in @('powershell', 'bash')) {
    $copy = Join-Path $scratch "$kind clone with spaces"
    $setup = Join-Path $copy 'scripts/setup'
    New-Item -ItemType Directory -Force -Path $setup | Out-Null
    foreach ($file in @('bootstrap.ps1', 'bootstrap.sh', 'env.ps1')) {
      Copy-Item -LiteralPath (Join-Path $root "scripts/setup/$file") -Destination $setup
    }
    Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $copy
    Push-Location -LiteralPath $copy
    try {
      function Invoke-Bootstrap {
        if ($kind -eq 'powershell') { & (Join-Path $setup 'bootstrap.ps1') -ConfigOnly }
        else { & $bash 'scripts/setup/bootstrap.sh' --config-only; if ($LASTEXITCODE -ne 0) { throw 'Bash bootstrap failed.' } }
      }
      Invoke-Bootstrap
      . (Join-Path $setup 'env.ps1')
      $settings = Get-DemoSettings -Root $copy
      Assert-Setup ($settings.DATABASE_NAME -eq 'HospitalGuidance') 'Fresh clone database default is missing.'
      Assert-Setup ($settings.SQL_PASSWORD -ne $settings.DEMO_PASSWORD) 'Database and demo passwords must differ.'
      $envPath = Join-Path $copy '.env'
      $custom = [IO.File]::ReadAllText($envPath).Replace('SQL_PORT=14339', 'SQL_PORT=15339').Replace('API_PORT=5280', 'API_PORT=5380').Replace('WEB_PORT=5180', 'WEB_PORT=5388').Replace('DATABASE_NAME=HospitalGuidance', 'DATABASE_NAME=TeamDemo')
      [IO.File]::WriteAllText($envPath, $custom, (New-Object Text.UTF8Encoding($false)))
      $before = (Get-FileHash -LiteralPath $envPath).Hash
      Remove-Item -LiteralPath (Join-Path $copy '.local/demo-access.txt')
      Invoke-Bootstrap
      Assert-Setup ((Get-FileHash -LiteralPath $envPath).Hash -eq $before) 'Bootstrap overwrote existing credentials/settings.'
      $access = [IO.File]::ReadAllText((Join-Path $copy '.local/demo-access.txt'))
      Assert-Setup ($access.Contains($settings.DEMO_PASSWORD) -and $access.Contains('otherdoctor@demo.local')) 'Credential note was not rebuilt.'
      $settings = Get-DemoSettings -Root $copy
      Assert-Setup ($settings.API_PORT -eq '5380' -and $settings.WEB_PORT -eq '5388' -and $settings.DATABASE_NAME -eq 'TeamDemo') 'Custom ports/database were lost.'
      Copy-Item -LiteralPath (Join-Path $copy '.env.example') -Destination $envPath -Force
      $rejected = $false
      if ($kind -eq 'powershell') {
        try { Invoke-Bootstrap } catch { $rejected = $true }
      } else {
        $ErrorActionPreference = 'Continue'
        & $bash 'scripts/setup/bootstrap.sh' --config-only 2>$null | Out-Null
        $rejected = $LASTEXITCODE -ne 0
        $ErrorActionPreference = 'Stop'
      }
      Assert-Setup $rejected 'Unconfigured template passwords must be rejected.'
      Write-Output "PASS $kind bootstrap: fresh clone, spaces, repeatability, custom settings, credential note and invalid template."
    } finally { Pop-Location }
  }
} finally {
  if ($scratch.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $scratch)) { Remove-Item -LiteralPath $scratch -Recurse -Force }
}
<<<<<<< HEAD
# The rejected Bash configuration intentionally leaves LASTEXITCODE nonzero.
# Report success only after every assertion and cleanup has completed.
exit 0
=======
>>>>>>> AnhBao
