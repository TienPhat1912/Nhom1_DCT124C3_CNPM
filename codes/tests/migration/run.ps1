param(
    [Parameter(Mandatory)][string]$SqlServer,
    [string]$Report = 'artifacts/pb030-rehearsal.json'
)
$ErrorActionPreference = 'Stop'
if ($SqlServer -notmatch '^(localhost|127\.0\.0\.1|\.)(,\d+)?$|^(\(localdb\)|\.|localhost)\\[\w-]+$') {
    throw 'PB-030 requires a local SQL Server fixture instance.'
}
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$previousConnection = $env:PB030_SQL_CONNECTION
$previousReport = $env:PB030_REPORT
Push-Location -LiteralPath $root
try {
    $env:PB030_SQL_CONNECTION = "Server=$SqlServer;Database=master;Integrated Security=true;TrustServerCertificate=true"
    $env:PB030_REPORT = $Report
    dotnet run --project tests/migration/Migration.Tests.csproj --configuration Release
    if ($LASTEXITCODE -ne 0) { throw 'PB-030 rehearsal failed. Do not enable cutover; inspect the report.' }
} finally {
    $env:PB030_SQL_CONNECTION = $previousConnection
    $env:PB030_REPORT = $previousReport
    Pop-Location
}
