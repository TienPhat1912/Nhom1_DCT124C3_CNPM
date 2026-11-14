param([string]$SqlServer = 'localhost', [ValidateRange(1024,65535)][int]$Port = 5297, [switch]$Regression, [switch]$Capture)
$ErrorActionPreference = 'Stop'
if ($SqlServer -notmatch '^(localhost|\.|\(localdb\)\\[\w-]+|\.\\[\w-]+)$') { throw 'Only local SQL fixtures are allowed.' }
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$names = @('ACCEPTANCE_DB','ConnectionStrings__Hospital','DEMO_PASSWORD','Demo__Enabled','Demo__Password','Workflow__PrdV2Enabled','ASPNETCORE_ENVIRONMENT','ASPNETCORE_URLS','API_URL','WEB_URL','Web__Origin','SQL_TEST_SERVER','Logging__LogLevel__Default','PB012_CAPTURE')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$running = $null
function Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File failed ($LASTEXITCODE)" }
}
Push-Location -LiteralPath $root
try {
    $publish = Join-Path $root ('artifacts/pb012-' + [Guid]::NewGuid().ToString('N'))
    Checked 'npm.cmd' @('run','build')
    Checked 'dotnet' @('publish','backend/Hospital.Api/Hospital.Api.csproj','-c','Release','--no-restore','-o',$publish)
    New-Item -ItemType Directory -Path (Join-Path $publish 'wwwroot') -Force | Out-Null
    Copy-Item -Path (Join-Path $root 'apps/web/dist/*') -Destination (Join-Path $publish 'wwwroot') -Recurse -Force
    $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
    $env:SQL_TEST_SERVER = $SqlServer
    $env:DEMO_PASSWORD = 'Fixture-' + [Guid]::NewGuid().ToString('N')
    $env:Demo__Password = $env:DEMO_PASSWORD
    $env:Demo__Enabled = 'true'
    $env:Workflow__PrdV2Enabled = 'true'
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"
    $env:API_URL = $env:ASPNETCORE_URLS
    $env:WEB_URL = $env:API_URL
    $env:Web__Origin = $env:API_URL
    $env:Logging__LogLevel__Default = 'Warning'
    if ($Capture) { $env:PB012_CAPTURE = '1' }
    $running = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + (Join-Path $publish 'Hospital.Api.dll') + '"') -WorkingDirectory $publish -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $publish 'api.stdout.log') -RedirectStandardError (Join-Path $publish 'api.stderr.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($running.HasExited) { throw "API exited: $publish/api.stderr.log" }
        try { if ((Invoke-RestMethod ($env:API_URL + '/health') -TimeoutSec 2).status -eq 'ok') { $ready = $true; break } } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw "API not ready: $publish/api.stderr.log" }
    Write-Output "Isolated database retained: $($env:ACCEPTANCE_DB)"
    Checked 'node' @('--test','tests/api/service-return.test.mjs')
    Checked 'npx.cmd' @('playwright','test','--config','playwright.service.config.ts')
    if ($Regression) {
        foreach ($suite in @('single-order','doctor-accept','confirm-reception')) {
            Stop-Process -Id $running.Id
            $running.WaitForExit()
            $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
            $running = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + (Join-Path $publish 'Hospital.Api.dll') + '"') -WorkingDirectory $publish -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $publish "$suite.stdout.log") -RedirectStandardError (Join-Path $publish "$suite.stderr.log")
            $ready = $false
            for ($attempt = 0; $attempt -lt 60; $attempt++) {
                if ($running.HasExited) { throw "Regression API exited: $publish/$suite.stderr.log" }
                try { if ((Invoke-RestMethod ($env:API_URL + '/health') -TimeoutSec 2).status -eq 'ok') { $ready = $true; break } } catch { }
                Start-Sleep -Seconds 1
            }
            if (-not $ready) { throw "Regression API not ready: $publish/$suite.stderr.log" }
            Write-Output "Regression $suite database retained: $($env:ACCEPTANCE_DB)"
            Checked 'node' @('--test',"tests/api/$suite.test.mjs")
        }
    }
    Write-Output 'PASS PB-012 API/browser acceptance and requested regressions.'
} finally {
    if ($running -and -not $running.HasExited) { Stop-Process -Id $running.Id; $running.WaitForExit() }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    Pop-Location
}
