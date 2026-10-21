$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $root
if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) { throw 'Install OpenSSL, then retry. No certificate store changes are made by this script.' }
New-Item -ItemType Directory -Force -Path '.local/tls' | Out-Null
if (-not ((Test-Path -LiteralPath '.local/tls/localhost.key') -and (Test-Path -LiteralPath '.local/tls/localhost.crt'))) {
  [IO.File]::WriteAllText((Join-Path $root '.local/tls/openssl.cnf'), "[req]`ndistinguished_name=req_dn`nprompt=no`n[req_dn]`nCN=localhost`n")
  $p = Start-Process -FilePath 'openssl' -ArgumentList @('req', '-config', '.local/tls/openssl.cnf', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', '.local/tls/localhost.key', '-out', '.local/tls/localhost.crt', '-days', '30', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1') -WindowStyle Hidden -Wait -PassThru -RedirectStandardError '.local/tls/generate.log'
  if ($p.ExitCode -ne 0) { throw 'Certificate generation failed. Inspect .local/tls/generate.log.' }
}
docker compose -f compose.yaml -f compose.https.yaml up -d --build api web
if ($LASTEXITCODE -ne 0) { throw 'HTTPS startup failed.' }
Write-Output 'HTTPS demo: https://localhost:8443 (local self-signed certificate). Private key stays in .local/tls.'
