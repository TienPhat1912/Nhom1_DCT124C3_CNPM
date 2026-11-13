param([int]$Port=5291, [string]$SqlServer, [ValidateSet('Debug','Release')][string]$Configuration='Debug')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Test port $Port is already in use." }
if ($SqlServer) {
  if ($SqlServer -notmatch '^(localhost|\.|\(localdb\)\\[\w-]+|\.\\[\w-]+)$') { throw 'Only a local SQL Server is allowed.' }
  $env:SQL_TEST_SERVER=$SqlServer
  $env:DEMO_PASSWORD='Fixture-'+[Guid]::NewGuid().ToString('N')
} else {
  . (Join-Path $root 'scripts/setup/env.ps1')
  $settings=Get-DemoSettings -Root $root
  $env:DEMO_PASSWORD=$settings.DEMO_PASSWORD
}
$database='HospitalAcceptance_'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$env:ACCEPTANCE_DB=$database
$env:API_URL="http://127.0.0.1:$Port"
$env:ConnectionStrings__Hospital=if ($SqlServer) { "Server=$SqlServer;Database=$database;Integrated Security=true;TrustServerCertificate=true" } else { "Server=127.0.0.1,$($settings.SQL_PORT);Database=$database;User Id=sa;Password=$($settings.SQL_PASSWORD);TrustServerCertificate=true;Encrypt=true" }
$env:Demo__Enabled='true'
$env:Demo__Password=$env:DEMO_PASSWORD
$env:Workflow__PrdV2Enabled='false'
$env:ASPNETCORE_ENVIRONMENT='Development'
$env:Catalog__Enabled='false'
New-Item -ItemType Directory -Path (Join-Path $root '.local') -Force | Out-Null
$assembly=Join-Path $root "backend/Hospital.Api/bin/$Configuration/net10.0/Hospital.Api.dll"
dotnet $assembly --contentRoot (Join-Path $root "backend/Hospital.Api") --migrate-only *> (Join-Path $root '.local/catalog-test-seed.log')
if ($LASTEXITCODE -ne 0) { throw 'Isolated seed failed. See .local/catalog-test-seed.log.' }
node tests/api/catalog-prepare.mjs
if ($LASTEXITCODE -ne 0) { throw 'Fixture failed.' }
$env:Catalog__Enabled='true'
$out=Join-Path $root '.local/catalog-test-api.log'
$err=Join-Path $root '.local/catalog-test-api.err'
$process=Start-Process dotnet -ArgumentList @('"' + $assembly + '"','--urls',$env:API_URL) -WorkingDirectory (Join-Path $root 'backend/Hospital.Api') -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
try {
  $ready=$false
  for ($i=0;$i -lt 60;$i++) {
    if ($process.HasExited) { throw 'Isolated API exited; inspect .local/catalog-test-api logs.' }
    try { $health=Invoke-RestMethod "$($env:API_URL)/health"; if($health.status -eq 'ok') { $ready=$true;break } } catch {}
    Start-Sleep -Milliseconds 500
  }
  if(!$ready) { throw 'Isolated API did not become ready.' }
  node tests/api/catalog.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Catalog acceptance failed.' }
  # A second import must be a no-op while the isolated API is still running.
  dotnet $assembly --contentRoot (Join-Path $root "backend/Hospital.Api") --migrate-only *> (Join-Path $root '.local/catalog-test-repeat.log')
  if ($LASTEXITCODE -ne 0) { throw 'Repeated catalog sync failed.' }
  node tests/api/catalog-idempotence.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Idempotence test failed.' }
  Write-Output "PASS isolated database $database (retained); API process will be stopped."
} finally {
  if (!$process.HasExited) { Stop-Process -Id $process.Id }
}
