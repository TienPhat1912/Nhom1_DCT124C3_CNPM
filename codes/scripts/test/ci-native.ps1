param(
    [string]$SqlServer,
    [ValidateRange(1024, 65535)][int]$ApiPort = 5280
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'localdb.ps1')
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$publish = Join-Path $root 'artifacts/azure-release'
$dll = Join-Path $publish 'Hospital.Api.dll'
if (-not (Test-Path -LiteralPath $dll)) { throw 'Run scripts/deploy/publish-azure.ps1 first.' }
if ($SqlServer -and $SqlServer -notmatch '^(localhost|\.|\(localdb\)\\[\w-]+|\.\\[\w-]+)$') { throw 'Tests require a local SQL instance.' }

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
    'Providers__FailureMode', 'Providers__TimeoutSeconds', 'PROVIDER_FAILURE', 'EXPECTED_COMMIT', 'PB004_SQL_SERVER', 'PB004_SQL_CONNECTION',
    'PB006_SQL_CONNECTION', 'PB007_SQL_CONNECTION', 'PB010_SQL_CONNECTION', 'PB011_SQL_CONNECTION', 'PB013_SQL_CONNECTION', 'PB028_SQL_CONNECTION', 'Workflow__PrdV2Enabled')
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
        Initialize-CiLocalDb -Tool $localDb -SqlCmd $env:SQLCMD_PATH -Instance $instance -Artifacts (Join-Path $root 'artifacts')
        $SqlServer = "(localdb)\$instance"
    }
    $env:SQL_TEST_SERVER = $SqlServer
    $env:PB004_SQL_SERVER = $SqlServer
    $env:PB004_SQL_CONNECTION = $null
    $env:Workflow__PrdV2Enabled = 'false'
    $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
    $env:PB006_SQL_CONNECTION = $env:ConnectionStrings__Hospital
    $env:PB007_SQL_CONNECTION = $env:ConnectionStrings__Hospital
    $env:PB010_SQL_CONNECTION = $env:ConnectionStrings__Hospital
    $env:PB011_SQL_CONNECTION = $env:ConnectionStrings__Hospital
    $env:PB013_SQL_CONNECTION = $env:ConnectionStrings__Hospital
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
    Invoke-Checked 'node' @('--test', 'tests/api/languages-v2.test.mjs')
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/translation/Translation.Tests.csproj', '--', '--migration')
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/core-schema/CoreSchema.Tests.csproj', '--configuration', 'Release')
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/registration/Registration.Tests.csproj', '--configuration', 'Release')
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/ticket-number/TicketNumber.Tests.csproj', '--configuration', 'Release')
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/doctor-accept/DoctorAccept.Tests.csproj', '--configuration', 'Release')
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/single-order/SingleOrder.Tests.csproj', '--configuration', 'Release')
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/clinical-catalog/ClinicalCatalog.Tests.csproj', '--configuration', 'Release')
    Invoke-Checked 'node' @('tests/api/performance.mjs')
    $env:PB028_SQL_CONNECTION = $env:ConnectionStrings__Hospital
    Invoke-Checked 'dotnet' @('run', '--project', 'tests/presence/Presence.Tests.csproj', '--configuration', 'Release')
    Invoke-Checked 'node' @('tests/presence/run.mjs')
    # API/load checks and browsers share the loopback IP's 120/minute auth quota.
    # Give browsers a fresh limiter while retaining the same release and database;
    # otherwise fast CI runs can return 429 on logout or the following login.
    Stop-TestApi
    Invoke-Checked 'node' @('--experimental-strip-types', '--test', 'tests/unit/presence.test.mjs')
    # Online counts require a clean fixture: earlier API suites retain active sessions.
    $beforePresenceDatabase = $env:ACCEPTANCE_DB
    $beforePresenceConnection = $env:ConnectionStrings__Hospital
    try {
        $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
        Push-Location -LiteralPath $publish
        try { Invoke-Checked 'dotnet' @($dll, '--migrate-only') } finally { Pop-Location }
        Invoke-Checked 'node' @('tests/presence/run-clients.mjs')
    } finally {
        $env:ACCEPTANCE_DB = $beforePresenceDatabase
        $env:ConnectionStrings__Hospital = $beforePresenceConnection
    }
    $apiProcess = Start-TestApi 'native-browser-api'
    Invoke-Checked 'npx.cmd' @('playwright', 'test')
    Stop-TestApi
    $apiProcess = Start-TestApi 'native-registration-disabled'
    Invoke-Checked 'node' @('--test', '--test-name-pattern=disabled', 'tests/api/registration-v2.test.mjs')
    Stop-TestApi
    $env:Workflow__PrdV2Enabled = 'true'
    $apiProcess = Start-TestApi 'native-registration-enabled'
    Invoke-Checked 'node' @('--test', '--test-skip-pattern=disabled', 'tests/api/registration-v2.test.mjs')
    Invoke-Checked 'node' @('--test', 'tests/api/confirm-reception.test.mjs')
    Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.registration.config.ts')
    Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.reception.config.ts')
    Stop-TestApi
    # PB-008 intentionally leaves an occupied clinic. PB-010 needs its own fixture,
    # not cleanup or mutation of another suite's consultation history.
    $beforeDoctorDatabase = $env:ACCEPTANCE_DB
    $beforeDoctorConnection = $env:ConnectionStrings__Hospital
    try {
        $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
        Push-Location -LiteralPath $publish
        try { Invoke-Checked 'dotnet' @($dll, '--migrate-only') } finally { Pop-Location }
        $apiProcess = Start-TestApi 'native-doctor-api'
        Invoke-Checked 'node' @('--test', 'tests/api/doctor-accept.test.mjs')
        Stop-TestApi
        $apiProcess = Start-TestApi 'native-doctor-browser'
        Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.doctor.config.ts')
        Stop-TestApi
        $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
        Push-Location -LiteralPath $publish
        try { Invoke-Checked 'dotnet' @($dll, '--migrate-only') } finally { Pop-Location }
        $apiProcess = Start-TestApi 'native-order-api'
        Invoke-Checked 'node' @('--test', 'tests/api/single-order.test.mjs')
        Stop-TestApi
        $apiProcess = Start-TestApi 'native-order-browser'
        Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.order.config.ts')
          Stop-TestApi
          $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
          $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
          Push-Location -LiteralPath $publish
          try { Invoke-Checked 'dotnet' @($dll, '--migrate-only') } finally { Pop-Location }
          $apiProcess = Start-TestApi 'native-service-api'
          Invoke-Checked 'node' @('--test', 'tests/api/service-return.test.mjs')
          Stop-TestApi
          $apiProcess = Start-TestApi 'native-service-browser'
          Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.service.config.ts')
        Stop-TestApi
        $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
        Push-Location -LiteralPath $publish
        try { Invoke-Checked 'dotnet' @($dll, '--migrate-only') } finally { Pop-Location }
        $apiProcess = Start-TestApi 'native-clinical-api'
        Invoke-Checked 'node' @('--test', 'tests/api/clinical-catalog.test.mjs')
        Stop-TestApi
        $apiProcess = Start-TestApi 'native-clinical-browser'
        Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.clinical.config.ts')
        Stop-TestApi
        $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
        Push-Location -LiteralPath $publish
        try { Invoke-Checked 'dotnet' @($dll, '--migrate-only') } finally { Pop-Location }
        $apiProcess = Start-TestApi 'native-examination-api'
        Invoke-Checked 'node' @('--test', 'tests/api/complete-examination.test.mjs')
        Stop-TestApi
        $apiProcess = Start-TestApi 'native-examination-browser'
        Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.examination.config.ts')
        Stop-TestApi
        $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
        Push-Location -LiteralPath $publish
        try { Invoke-Checked 'dotnet' @($dll, '--migrate-only') } finally { Pop-Location }
        $apiProcess = Start-TestApi 'native-settlement-api'
        Invoke-Checked 'node' @('--test', 'tests/api/final-settlement.test.mjs')
        Stop-TestApi
        $apiProcess = Start-TestApi 'native-settlement-browser'
        Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.settlement.config.ts')
        Stop-TestApi
        $env:ACCEPTANCE_DB = 'HospitalAcceptance_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $env:ConnectionStrings__Hospital = "Server=$SqlServer;Database=$($env:ACCEPTANCE_DB);Integrated Security=true;TrustServerCertificate=true"
        Push-Location -LiteralPath $publish
        try { Invoke-Checked 'dotnet' @($dll, '--migrate-only') } finally { Pop-Location }
        $apiProcess = Start-TestApi 'native-results-api'
        Invoke-Checked 'node' @('--test', 'tests/unit/native-results.test.mjs')
        Invoke-Checked 'node' @('--test', 'tests/api/patient-results.test.mjs')
        Stop-TestApi
        $apiProcess = Start-TestApi 'native-results-browser'
        Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.results.config.ts')
    } finally {
        Stop-TestApi
        $env:ACCEPTANCE_DB = $beforeDoctorDatabase
        $env:ConnectionStrings__Hospital = $beforeDoctorConnection
    }
    Invoke-Checked 'node' @('tests/translation/run-request.mjs')
    Invoke-Checked 'node' @('--test', 'tests/unit/native-assistance.test.mjs')
    Invoke-Checked 'node' @('tests/translation/run-assistance.mjs')
    Invoke-Checked 'node' @('tests/recovery/run.mjs')
    # Recovery owns and stops its API process. WEB_URL still targets this
    # runner's port, so the Journey browser suite needs its own live server.
    $apiProcess = Start-TestApi 'native-journey-browser'
    Invoke-Checked 'npx.cmd' @('playwright', 'test', '--config', 'playwright.journey.config.ts')
    Stop-TestApi
    $env:Workflow__PrdV2Enabled = 'false'
    Invoke-Checked 'powershell' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'tests/catalog/pb005.ps1', '-SqlServer', $SqlServer, '-Port', '5295')
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
