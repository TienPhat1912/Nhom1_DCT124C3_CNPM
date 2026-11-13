param(
    [string]$SqlServer = 'localhost',
    [ValidateRange(1024,65535)][int]$Port = 5295
)
$ErrorActionPreference = 'Stop'
if ($SqlServer -notmatch '^(localhost|\.|\(localdb\)\\[\w-]+|\.\\[\w-]+)$') { throw 'Only a local SQL Server is allowed.' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Test port $Port is already in use." }
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$names = @('ConnectionStrings__Hospital','Demo__Enabled','Demo__Password','DEMO_PASSWORD','Workflow__PrdV2Enabled','Catalog__Enabled','ASPNETCORE_ENVIRONMENT','ASPNETCORE_URLS','Web__Origin','API_URL','WEB_URL','SQL_TEST_SERVER','ACCEPTANCE_DB','Logging__LogLevel__Default','PB005_SNAPSHOT')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$script:running = $null
function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File failed ($LASTEXITCODE)." }
}
function Start-Fixture {
    $script:running = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + (Join-Path $publish 'Hospital.Api.dll') + '"') -WorkingDirectory $publish -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $publish 'api.stdout.log') -RedirectStandardError (Join-Path $publish 'api.stderr.log')
    for ($attempt=0; $attempt -lt 60; $attempt++) {
        if ($script:running.HasExited) { throw "Fixture API exited; see $publish/api.stderr.log" }
        try { $response = Invoke-RestMethod ($env:API_URL + '/health') -TimeoutSec 2; if ($response.status -eq 'ok') { return } } catch { }
        Start-Sleep -Seconds 1
    }
    throw 'Fixture API did not become ready.'
}
function Stop-Fixture {
    if ($script:running -and -not $script:running.HasExited) { Stop-Process -Id $script:running.Id; $script:running.WaitForExit() }
}
Push-Location -LiteralPath $root
try {
    $publish = Join-Path $root ('artifacts/pb005-' + [Guid]::NewGuid().ToString('N'))
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
    $env:Workflow__PrdV2Enabled = 'true'
    $env:Catalog__Enabled = 'true'
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"
    $env:API_URL = $env:ASPNETCORE_URLS
    $env:WEB_URL = $env:API_URL
    $env:Web__Origin = $env:API_URL
    $env:Logging__LogLevel__Default = 'Warning'
    $env:PB005_SNAPSHOT = Join-Path $publish 'restart-snapshot.json'
    Start-Fixture
    Write-Output "Isolated database retained: $($env:ACCEPTANCE_DB)"
    Invoke-Checked 'node' @('--test','tests/catalog/assignments.test.mjs')
    Invoke-Checked 'npx.cmd' @('playwright','test','--config','playwright.assignment.config.ts')
    Invoke-Checked 'node' @('tests/catalog/restart.mjs','capture')
    Stop-Fixture
    Start-Fixture
    Invoke-Checked 'node' @('tests/catalog/restart.mjs','verify')
    Invoke-Checked 'node' @('tests/catalog/restart.mjs','reimport')
    Stop-Fixture
    Start-Fixture
    Invoke-Checked 'node' @('tests/catalog/restart.mjs','verify')
} finally {
    Stop-Fixture
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    Pop-Location
}
