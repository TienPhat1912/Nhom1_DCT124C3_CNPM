param(
    [string]$SqlServer,
    [ValidateRange(1024, 65535)][int]$ApiPort = 5280
)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$publish = Join-Path $root 'artifacts/azure-release'
$dll = Join-Path $publish 'Hospital.Api.dll'
if (-not (Test-Path -LiteralPath $dll)) { throw 'Run scripts/deploy/publish-azure.ps1 first.' }
if ($SqlServer -and $SqlServer -notmatch '^(\(localdb\)\\[\w-]+|\.\\[\w-]+)$') { throw 'Tests require a local SQL instance.' }

function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File failed with exit code $LASTEXITCODE" }
}
function Find-SqlTool([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $file = Get-ChildItem -Path "$env:ProgramFiles/Microsoft SQL Server/*/Tools/Binn/$Name", "$env:ProgramFiles/Microsoft SQL Server/Client SDK/ODBC/*/Tools/Binn/$Name" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $file) { throw "Install SQL Server LocalDB and command-line tools: missing $Name" }
    return $file.FullName
}
$names = @('ACCEPTANCE_DB', 'ConnectionStrings__Hospital', 'DEMO_PASSWORD', 'Demo__Enabled', 'Demo__Password',
    'ASPNETCORE_ENVIRONMENT', 'ASPNETCORE_URLS', 'Web__Origin', 'API_URL', 'WEB_URL', 'SQL_TEST_SERVER', 'SQLCMD_PATH',
    'Providers__FailureMode', 'Providers__TimeoutSeconds', 'PROVIDER_FAILURE', 'EXPECTED_COMMIT')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$apiProcess = $null
$localDb = $null
$instance = 'HospitalCI_' + [Guid]::NewGuid().ToString('N')
Push-Location -LiteralPath $root
try {
    $env:SQLCMD_PATH = Find-SqlTool 'sqlcmd.exe'
    if (-not $SqlServer) {
        $localDb = Find-SqlTool 'SqlLocalDB.exe'
        Invoke-Checked $localDb @('create', $instance, '-s')
        $SqlServer = "(localdb)\$instance"
    }
    $env:SQL_TEST_SERVER = $SqlServer
    $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
    $env:DEMO_PASSWORD = 'Demo' + [Guid]::NewGuid().ToString('N') + 'A1'
    $env:Demo__Enabled = 'true'
    $env:Demo__Password = $env:DEMO_PASSWORD
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = "http://127.0.0.1:$ApiPort"
    $env:API_URL = $env:ASPNETCORE_URLS
    $env:WEB_URL = $env:API_URL
    $env:Web__Origin = $env:WEB_URL
    $env:Providers__FailureMode = 'None'
    $env:Providers__TimeoutSeconds = '5'
    $env:PROVIDER_FAILURE = $null
    $env:EXPECTED_COMMIT = (Get-Content -Raw -LiteralPath (Join-Path $publish 'release.json') | ConvertFrom-Json).Release.Commit
    if ($env:GITHUB_ACTIONS -eq 'true') { Write-Output "::add-mask::$($env:DEMO_PASSWORD)" }

    function Start-TestApi([string]$LogName) {
        $running = Start-Process -FilePath 'dotnet' -ArgumentList @('"' + $dll + '"', '--no-migrate') -WorkingDirectory $publish -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $root "artifacts/$LogName.stdout.log") -RedirectStandardError (Join-Path $root "artifacts/$LogName.stderr.log")
        for ($i = 0; $i -lt 60; $i++) {
            if ($running.HasExited) { throw "API exited; see artifacts/$LogName.stderr.log" }
            try {
                $health = Invoke-RestMethod ($env:API_URL + '/health') -TimeoutSec 2
                if ($health.status -eq 'ok' -and $health.version -eq $env:EXPECTED_COMMIT) { return $running }
            } catch { }
            Start-Sleep -Seconds 1
        }
        if (-not $running.HasExited) { Stop-Process -Id $running.Id; $running.WaitForExit() }
        throw "API did not become ready; see artifacts/$LogName.stderr.log"
    }
    function Stop-TestApi {
        if ($script:apiProcess -and -not $script:apiProcess.HasExited) {
            Stop-Process -Id $script:apiProcess.Id
            $script:apiProcess.WaitForExit()
        }
        $script:apiProcess = $null
    }

    Push-Location -LiteralPath $publish
    try { Invoke-Checked 'dotnet' @($dll, '--seed-performance') } finally { Pop-Location }
    $apiProcess = Start-TestApi 'native-api'
    Invoke-Checked 'node' @('scripts/deploy/smoke.mjs')
    Invoke-Checked 'node' @('--test', '--test-concurrency=1', 'tests/api/api.test.mjs')
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/translation/Translation.Tests.csproj', '--', '--migration')
    Invoke-Checked 'node' @('tests/api/performance.mjs')
    # API/load checks and browsers share the loopback IP's 120/minute auth quota.
    # Give browsers a fresh limiter while retaining the same release and database;
    # otherwise fast CI runs can return 429 on logout or the following login.
    Stop-TestApi
    $apiProcess = Start-TestApi 'native-browser-api'
    Invoke-Checked 'npx.cmd' @('playwright', 'test')
    Stop-TestApi
    foreach ($mode in @('Timeout', 'Unavailable')) {
        $env:Providers__FailureMode = $mode
        $env:Providers__TimeoutSeconds = '1'
        $env:PROVIDER_FAILURE = $mode
        $apiProcess = Start-TestApi "native-provider-$mode"
        Invoke-Checked 'node' @('tests/api/provider-failure.mjs')
        Stop-TestApi
    }
    Write-Output "PASS native SQL, migration, API, browser and provider checks ($($env:ACCEPTANCE_DB))."
} finally {
    if ($apiProcess -and -not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id; $apiProcess.WaitForExit() }
    if ($localDb) { & $localDb stop $instance -k | Out-Null; & $localDb delete $instance | Out-Null }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    Pop-Location
}
