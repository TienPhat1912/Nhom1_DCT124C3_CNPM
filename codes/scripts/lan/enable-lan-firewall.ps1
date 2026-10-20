param(
  [Parameter(Mandatory = $true)]
  [string]$IpAddress,
  [ValidateRange(1, 65535)]
  [int]$Port = 5180,
  [switch]$FollowInterfaceAddress
)
$ErrorActionPreference = 'Stop'
$address = [System.Net.IPAddress]::Parse($IpAddress)
if ($address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
  throw 'An IPv4 LAN address is required.'
}
$bytes = $address.GetAddressBytes()
if (-not ($bytes[0] -eq 10 -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168))) {
  throw 'Use a private LAN address.'
}
$interface = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $address.ToString() -ErrorAction Stop
if (@($interface).Count -ne 1) { throw 'The address must belong to one local network interface.' }
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script in PowerShell as Administrator.'
}
$ruleName = 'AnTamDemo-LAN-Web'
$parameters = @{
  Direction = 'Inbound'
  Action = 'Allow'
  Enabled = 'True'
  Protocol = 'TCP'
  LocalPort = $Port
  LocalAddress = $(if ($FollowInterfaceAddress) { 'Any' } else { $address.ToString() })
  RemoteAddress = 'LocalSubnet'
  InterfaceAlias = $interface.InterfaceAlias
  Profile = 'Any'
}
if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
  Set-NetFirewallRule -Name $ruleName @parameters | Out-Null
} else {
  New-NetFirewallRule -Name $ruleName -DisplayName 'An Tam Demo LAN Web' @parameters | Out-Null
}
Write-Output "LAN web access enabled: http://$($address):$Port (local subnet only)."
