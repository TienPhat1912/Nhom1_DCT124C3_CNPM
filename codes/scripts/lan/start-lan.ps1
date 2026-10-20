param(
  [string]$InterfaceAlias,
  [switch]$CheckOnly,
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $PSScriptRoot 'lan-common.ps1')
Push-Location -LiteralPath $root
$previousLanIp = $env:LAN_IP
try {
  $network = Get-LanNetwork -InterfaceAlias $InterfaceAlias
  Write-Host "LAN adapter: $($network.InterfaceAlias) | IP: $($network.IpAddress)"
  if ($CheckOnly) {
    Write-Host 'Check only: no containers, firewall rules or configuration files were changed.'
    return
  }
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop with Linux containers first.' }
  if (-not (Test-DockerReady)) {
    $dockerCommand = (Get-Command docker).Source
    $installRoot = Split-Path (Split-Path (Split-Path $dockerCommand -Parent) -Parent) -Parent
    $desktop = @(
      (Join-Path $installRoot 'Docker Desktop.exe'),
      (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
      (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe')
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $desktop) { throw 'Open Docker Desktop, select Linux containers, then retry.' }
    Write-Host 'Starting Docker Desktop. Waiting for the engine...'
    Start-Process -FilePath $desktop -WindowStyle Hidden | Out-Null
    $deadline = (Get-Date).AddMinutes(3)
    while (-not (Test-DockerReady)) {
      if ((Get-Date) -gt $deadline) { throw 'Docker did not become ready in 3 minutes. Check Docker Desktop and retry.' }
      Start-Sleep -Seconds 3
    }
  }
  $osType = & docker info --format '{{.OSType}}'
  if ($LASTEXITCODE -ne 0 -or $osType -ne 'linux') { throw 'Switch Docker Desktop to Linux containers and retry.' }

  & (Join-Path $root 'scripts/setup/bootstrap.ps1') -ConfigOnly
  $envPath = Join-Path $root '.env'
  $content = [IO.File]::ReadAllText($envPath)
  $updated = Get-LanEnvContent -Content $content -IpAddress $network.IpAddress
  if ($content -cne $updated) { [IO.File]::WriteAllText($envPath, $updated, (New-Object Text.UTF8Encoding($false))) }
  # An inherited environment variable must not override the newly detected address.
  $env:LAN_IP = $network.IpAddress
  $compose = @('compose', '-p', 'cnpm-guidance', '-f', 'compose.yaml', '-f', 'compose.lan.yaml')
  $configJson = & docker @compose config --format json
  if ($LASTEXITCODE -ne 0) { throw 'Compose configuration is invalid. Check .env.' }
  $config = ($configJson -join "`n") | ConvertFrom-Json
  $binding = @($config.services.web.ports | Where-Object { $_.host_ip -eq $network.IpAddress -and $_.target -eq 80 })
  if ($binding.Count -ne 1) { throw 'Expected exactly one LAN web binding.' }
  $port = [int]$binding[0].published
  $lanUrl = "http://$($network.IpAddress):$port"
  $localUrl = "http://localhost:$port"

  Write-Host 'Building and starting the project (existing data is kept)...'
  & docker @compose up -d --build --wait --wait-timeout 180
  if ($LASTEXITCODE -ne 0) { throw 'Project startup failed. See the Docker output above; existing data was retained.' }
  # Verify both the web proxy and API before opening access or reporting success.
  $deadline = (Get-Date).AddSeconds(90)
  while ($true) {
    try {
      foreach ($url in @($localUrl, $lanUrl)) {
        $null = Invoke-RestMethod -Uri "$url/api/config" -TimeoutSec 5
        $null = Invoke-WebRequest -UseBasicParsing -Uri "$url/entry" -TimeoutSec 5
      }
      break
    } catch {
      if ((Get-Date) -gt $deadline) { throw 'The web/API did not become ready. Check docker compose logs api web.' }
      Start-Sleep -Seconds 2
    }
  }

  if (-not (Test-LanFirewall -InterfaceAlias $network.InterfaceAlias -Port $port)) {
    Write-Host 'Windows needs Administrator approval to configure LAN access on this adapter.'
    $firewallScript = Join-Path $PSScriptRoot 'enable-lan-firewall.ps1'
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
      & $firewallScript -IpAddress $network.IpAddress -Port $port -FollowInterfaceAddress
    } else {
      $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $firewallScript + '"'),
        '-IpAddress', $network.IpAddress, '-Port', [string]$port, '-FollowInterfaceAddress')
      try {
        $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -ArgumentList $arguments -Wait -PassThru
      } catch { throw "LAN firewall setup was not approved. The project is running at $localUrl; rerun Start-LAN to finish LAN setup." }
      if ($process.ExitCode -ne 0) { throw "Firewall setup failed. The project is running at $localUrl; rerun Start-LAN to retry." }
    }
    if (-not (Test-LanFirewall -InterfaceAlias $network.InterfaceAlias -Port $port)) { throw 'Could not verify the LAN firewall rule.' }
  }
  $information = "LAN: $lanUrl`r`nEntry/QR: $lanUrl/entry`r`nLocal: $localUrl`r`nAdapter: $($network.InterfaceAlias)`r`n"
  $null = New-Item -ItemType Directory -Force -Path (Join-Path $root '.local')
  [IO.File]::WriteAllText((Join-Path $root '.local\lan-access.txt'), $information)
  Write-Host "`nProject ready.`n$information"
  Write-Host 'Devices must share the LAN; guest Wi-Fi/client isolation can block access.'
  Write-Host 'After changing networks, run Start-LAN again. To stop, run Stop-LAN.cmd.'
  if (-not $NoBrowser) { Start-Process -FilePath $lanUrl }
} finally {
  $env:LAN_IP = $previousLanIp
  Pop-Location
}
