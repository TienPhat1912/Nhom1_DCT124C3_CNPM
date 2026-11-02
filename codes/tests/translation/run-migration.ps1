$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $root 'scripts/setup/env.ps1')
$settings = Get-DemoSettings -Root $root
$previous = $env:ConnectionStrings__Hospital
try {
  $env:ConnectionStrings__Hospital = "Server=127.0.0.1,$($settings.SQL_PORT);Database=HospitalAcceptance;User Id=sa;Password=$($settings.SQL_PASSWORD);TrustServerCertificate=true"
  dotnet run --project (Join-Path $PSScriptRoot 'Translation.Tests.csproj') --no-restore -- --migration
  if ($LASTEXITCODE -ne 0) { throw 'Translation migration tests failed.' }
} finally { $env:ConnectionStrings__Hospital = $previous }
