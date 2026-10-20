param([switch]$ConfigOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $PSScriptRoot 'env.ps1')
Push-Location -LiteralPath $root
try {
if (-not (Test-Path -LiteralPath '.env')) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $bytes = New-Object byte[] 18
  $rng.GetBytes($bytes)
  $sqlSecret = 'Sql!' + [BitConverter]::ToString($bytes).Replace('-', '') + 'a7'
  $rng.GetBytes($bytes)
  $demoSecret = 'Demo!' + [BitConverter]::ToString($bytes).Replace('-', '').Substring(0,18) + 'z8'
  $rng.Dispose()
  $template = [IO.File]::ReadAllText((Join-Path $root '.env.example'))
  $content = $template.Replace('REPLACE_WITH_A_RANDOM_STRONG_PASSWORD', $sqlSecret).Replace('REPLACE_WITH_A_RANDOM_DEMO_PASSWORD', $demoSecret)
  [IO.File]::WriteAllText((Join-Path $root '.env'), $content, (New-Object Text.UTF8Encoding($false)))
}
$settings = Get-DemoSettings -Root $root
New-Item -ItemType Directory -Force -Path '.local' | Out-Null
[IO.File]::WriteAllText((Join-Path $root '.local/demo-access.txt'), "Demo password: $($settings.DEMO_PASSWORD)`nUsers: patient@demo.local, reception@demo.local, doctor@demo.local, service@demo.local, cashier@demo.local, admin@demo.local, otherdoctor@demo.local`n")
Write-Output 'Local configuration ready. Demo credentials: .local/demo-access.txt'
if ($ConfigOnly) { return }
docker compose up -d --wait --wait-timeout 180 sql
if ($LASTEXITCODE -ne 0) { throw 'SQL container startup failed.' }
} finally { Pop-Location }
