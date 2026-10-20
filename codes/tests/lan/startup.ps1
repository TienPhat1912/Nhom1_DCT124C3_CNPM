$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'scripts\lan\lan-common.ps1')
function Assert-Lan([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}
$candidates = @(
  [pscustomobject]@{ IpAddress='192.168.242.1'; InterfaceAlias='VMware'; InterfaceIndex=1; Metric=1; Physical=$false; Connected=$true; HasGateway=$true },
  [pscustomobject]@{ IpAddress='10.8.0.2'; InterfaceAlias='VPN'; InterfaceIndex=2; Metric=1; Physical=$false; Connected=$true; HasGateway=$true },
  [pscustomobject]@{ IpAddress='192.168.2.3'; InterfaceAlias='Ethernet'; InterfaceIndex=3; Metric=5; Physical=$true; Connected=$false; HasGateway=$true },
  [pscustomobject]@{ IpAddress='192.168.1.3'; InterfaceAlias='Wi-Fi'; InterfaceIndex=4; Metric=25; Physical=$true; Connected=$true; HasGateway=$true },
  [pscustomobject]@{ IpAddress='172.16.0.2'; InterfaceAlias='Ethernet LAN'; InterfaceIndex=5; Metric=1; Physical=$true; Connected=$true; HasGateway=$false }
)
$selected = Select-LanNetwork -Candidates $candidates
Assert-Lan ($selected.IpAddress -eq '192.168.1.3') 'Automatic selection must ignore VPN/VMware/disconnected adapters and prefer a LAN gateway.'
$selected = Select-LanNetwork -Candidates $candidates -InterfaceAlias 'Ethernet LAN'
Assert-Lan ($selected.IpAddress -eq '172.16.0.2') 'An explicit physical LAN without an Internet gateway must be supported.'
$candidates[3].IpAddress = '192.168.31.7'
Assert-Lan ((Select-LanNetwork -Candidates $candidates).IpAddress -eq '192.168.31.7') 'The next startup must use the new DHCP address.'
$failed = $false
try { $null = Select-LanNetwork -Candidates $candidates -InterfaceAlias 'VPN' } catch { $failed = $true }
Assert-Lan $failed 'A VPN-only selection must fail rather than publish the wrong address.'
foreach ($invalid in @('127.0.0.1', '169.254.1.2', '8.8.8.8', '172.32.0.1', '::1', 'not-an-ip')) {
  Assert-Lan (-not (Test-PrivateIPv4 $invalid)) "Invalid LAN address accepted: $invalid"
}
foreach ($valid in @('10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.1.3')) {
  Assert-Lan (Test-PrivateIPv4 $valid) "Valid private address rejected: $valid"
}
$original = "# Keep settings`r`nSQL_PASSWORD=example-only`r`nDATABASE_NAME=ExistingDemo`r`nLAN_IP=192.168.31.7`r`nWEB_PORT=5199`r`n"
$updated = Get-LanEnvContent -Content $original -IpAddress '192.168.1.3'
Assert-Lan ($updated.Contains("SQL_PASSWORD=example-only`r`nDATABASE_NAME=ExistingDemo`r`n")) 'Secrets/database settings must be preserved.'
Assert-Lan ($updated.Contains("WEB_PORT=5199`r`n")) 'Custom web port must be preserved.'
Assert-Lan ($updated.EndsWith("LAN_IP=192.168.1.3`r`n")) 'The LAN address must be updated.'
Assert-Lan ((Get-LanEnvContent -Content $updated -IpAddress '192.168.1.3') -ceq $updated) 'Repeated startup must not keep changing .env.'
Assert-Lan ((Get-LanEnvContent -Content "WEB_PORT=5180" -IpAddress '10.0.0.5') -ceq "WEB_PORT=5180`nLAN_IP=10.0.0.5`n") 'Files without a final newline must remain valid.'
Write-Output 'PASS: LAN selection, network changes, address validation and environment preservation.'
