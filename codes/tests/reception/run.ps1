param(
    [Parameter(Mandatory = $true)][string]$SqlServer,
    [ValidateRange(1024,65535)][int]$Port = 5298,
    [switch]$LegacyOnly
)
$ErrorActionPreference = 'Stop'
if ($SqlServer -notmatch '^(localhost|\.|\(localdb\)\\[\w-]+|\.\\[\w-]+)$') { throw 'Only a local SQL Server is allowed.' }
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$names = @('ConnectionStrings__Hospital','Demo__Enabled','Demo__Password','DEMO_PASSWORD','Workflow__PrdV2Enabled','ASPNETCORE_ENVIRONMENT','ASPNETCORE_URLS','Web__Origin','API_URL','WEB_URL','SQL_TEST_SERVER','ACCEPTANCE_DB','Logging__LogLevel__Default')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$running = $null
function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File failed ($LASTEXITCODE)." }
}
Push-Location -LiteralPath $root
try {
    $publish = Join-Path $root ('artifacts/pb008-' + [Guid]::NewGuid().ToString('N'))
    Invoke-Checked 'npm.cmd' @('run','build')
    Invoke-Checked 'dotnet' @('publish','backend/Hospital.Api/Hospital.Api.csproj','-c','Release','--no-restore','-o',$publish)
    New-Item -ItemType Directory -Path (Join-Path $publish 'wwwroot') -Force | Out-Null
    Copy-Item -Path (Join-Path $root 'apps/web/dist/*') -Destination (Join-Path $publish 'wwwroot') -Recurse -Force
    $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
    $env:SQL_TEST_SERVER = $SqlServer
    $env:Demo__Enabled = 'true'
    $env:DEMO_PASSWORD = 'Fixture-' + [Guid]::NewGuid().ToString('N')
    $env:Demo__Password = $env:DEMO_PASSWORD
    $env:Workflow__PrdV2Enabled = if ($LegacyOnly) { 'false' } else { 'true' }
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"
    $env:API_URL = $env:ASPNETCORE_URLS
    $env:WEB_URL = $env:API_URL
    $env:Web__Origin = $env:API_URL
    $env:Logging__LogLevel__Default = 'Warning'
    $running = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + (Join-Path $publish 'Hospital.Api.dll') + '"') -WorkingDirectory $publish -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $publish 'api.stdout.log') -RedirectStandardError (Join-Path $publish 'api.stderr.log')
    $ready = $false
    for ($attempt=0; $attempt -lt 60; $attempt++) {
        if ($running.HasExited) { throw "Fixture API exited; see $publish/api.stderr.log" }
        try { $response = Invoke-RestMethod ($env:API_URL + '/health') -TimeoutSec 2; if ($response.status -eq 'ok') { $ready = $true; break } } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Fixture API did not become ready.' }
    Write-Output "Isolated database retained: $($env:ACCEPTANCE_DB)"
    if ($LegacyOnly) {
        Invoke-Checked 'node' @('--test','--test-concurrency=1','tests/api/api.test.mjs')
        return
    }
    Invoke-Checked 'node' @('--test','tests/api/confirm-reception.test.mjs')
    Invoke-Checked 'node' @('--test','--test-skip-pattern=disabled','tests/api/registration-v2.test.mjs')
    Invoke-Checked 'npx.cmd' @('playwright','test','--config','playwright.reception.config.ts')
    Invoke-Checked 'npx.cmd' @('playwright','test','--config','playwright.registration.config.ts')
} finally {
    if ($running -and -not $running.HasExited) { Stop-Process -Id $running.Id; $running.WaitForExit() }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    Pop-Location
}
