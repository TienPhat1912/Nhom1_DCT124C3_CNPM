function Test-PrivateIPv4 {
  param([string]$Address)
  $parsed = $null
  if (-not [Net.IPAddress]::TryParse($Address, [ref]$parsed) -or
      $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { return $false }
  $bytes = $parsed.GetAddressBytes()
  return ($bytes[0] -eq 10 -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
    ($bytes[0] -eq 192 -and $bytes[1] -eq 168))
}

function Select-LanNetwork {
  param([object[]]$Candidates, [string]$InterfaceAlias)
  $usable = @($Candidates | Where-Object {
    $_.Physical -and $_.Connected -and (Test-PrivateIPv4 $_.IpAddress) -and
      (-not $InterfaceAlias -or $_.InterfaceAlias -eq $InterfaceAlias)
  } | Sort-Object @{Expression = { -not $_.HasGateway }}, Metric, InterfaceIndex, IpAddress)
  if ($usable.Count -eq 0) {
    throw 'No private IPv4 address on a connected physical Wi-Fi/Ethernet adapter. Connect to the LAN and retry.'
  }
  return $usable[0]
}

function Get-LanNetwork {
  param([string]$InterfaceAlias)
  $adapters = @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object Status -eq 'Up')
  $candidates = @(foreach ($adapter in $adapters) {
    $configuration = Get-NetIPConfiguration -InterfaceIndex $adapter.InterfaceIndex -ErrorAction Stop
    $ipInterface = Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $adapter.InterfaceIndex -ErrorAction Stop
    foreach ($address in (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $adapter.InterfaceIndex -ErrorAction Stop)) {
      if ($address.AddressState -ne 'Preferred' -or $address.SkipAsSource) { continue }
      [pscustomobject]@{
        IpAddress = $address.IPAddress
        InterfaceAlias = $adapter.Name
        InterfaceIndex = $adapter.InterfaceIndex
        Physical = $true
        Connected = $true
        HasGateway = @($configuration.IPv4DefaultGateway).Count -gt 0 -and $null -ne $configuration.IPv4DefaultGateway
        Metric = $ipInterface.InterfaceMetric
      }
    }
  })
  return Select-LanNetwork -Candidates $candidates -InterfaceAlias $InterfaceAlias
}

function Get-LanEnvContent {
  param([string]$Content, [string]$IpAddress)
  if (-not (Test-PrivateIPv4 $IpAddress)) { throw 'Invalid private LAN address.' }
  $newline = if ($Content.Contains("`r`n")) { "`r`n" } else { "`n" }
  # Only LAN_IP changes; database selection and secrets remain byte-for-byte intact.
  $updated = [regex]::Replace($Content, '(?m)^[ \t]*LAN_IP[ \t]*=[^\r\n]*(?:\r?\n|$)', '')
  if ($updated.Length -gt 0 -and -not $updated.EndsWith("`n")) { $updated += $newline }
  return $updated + "LAN_IP=$IpAddress$newline"
}

function Test-LanFirewall {
  param([string]$InterfaceAlias, [int]$Port)
  $rule = Get-NetFirewallRule -PolicyStore ActiveStore -Name 'AnTamDemo-LAN-Web' -ErrorAction SilentlyContinue
  if (-not $rule -or $rule.Enabled -ne 'True' -or $rule.Action -ne 'Allow' -or
      $rule.Direction -ne 'Inbound' -or $rule.Profile -ne 'Any') { return $false }
  $ports = $rule | Get-NetFirewallPortFilter
  $addresses = $rule | Get-NetFirewallAddressFilter
  $interfaces = $rule | Get-NetFirewallInterfaceFilter
  return ([string]$ports.Protocol -in @('TCP', '6') -and
    (@($ports.LocalPort) -join ',') -eq [string]$Port -and
    (@($addresses.LocalAddress) -join ',') -eq 'Any' -and
    (@($addresses.RemoteAddress) -join ',') -eq 'LocalSubnet' -and
    (@($interfaces.InterfaceAlias) -join ',') -eq $InterfaceAlias)
}

function Test-DockerReady {
  # PowerShell 5 treats stderr from native programs as errors; a stopped daemon is expected here.
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $null = & docker info --format '{{.OSType}}' 2>$null
    return $LASTEXITCODE -eq 0
  } finally { $ErrorActionPreference = $previousPreference }
}
