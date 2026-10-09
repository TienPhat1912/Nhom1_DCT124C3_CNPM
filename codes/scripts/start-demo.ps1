param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $repoRoot '.artifacts/demo'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$pidFile = Join-Path $stateDir 'processes.json'
foreach ($port in @(5047,5173)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is already occupied. Stop the existing demo with scripts/stop-demo.ps1, or inspect that process."
    }
}
if (!$SkipBuild) {
    & dotnet build (Join-Path $repoRoot 'services/api') -p:RestoreLockedMode=true
    if ($LASTEXITCODE -ne 0) { throw 'API build failed' }
    Push-Location (Join-Path $repoRoot 'apps/web')
    try {
        if (!(Test-Path 'node_modules/vite/bin/vite.js')) {
            & npm.cmd ci
            if ($LASTEXITCODE -ne 0) { throw 'Web install failed' }
        }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
    } finally { Pop-Location }
}
$secretFile = Join-Path $stateDir 'jwt-secret.txt'
if (!(Test-Path $secretFile)) {
    $secretBytes = New-Object byte[] 48
    $randomSource = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $randomSource.GetBytes($secretBytes) } finally { $randomSource.Dispose() }
    [Convert]::ToBase64String($secretBytes) | Set-Content -LiteralPath $secretFile -Encoding ASCII
}
$savedEnvironment = @{}
foreach ($key in @('Jwt__Secret','ASPNETCORE_ENVIRONMENT','ASPNETCORE_URLS','SeedDemo','ConnectionStrings__DefaultConnection','VITE_API_BASE_URL')) {
    $savedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
}
$started = @()
try {
    $env:Jwt__Secret = (Get-Content -LiteralPath $secretFile -Raw).Trim()
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = 'http://127.0.0.1:5047'
    $env:SeedDemo = 'true'
    $env:ConnectionStrings__DefaultConnection = 'Data Source=hospital_visit.db'
    $env:VITE_API_BASE_URL = ''
    $dllPath = Join-Path $repoRoot 'services/api/bin/Debug/net9.0/HospitalVisitApi.dll'
    $apiProcess = Start-Process -FilePath (Get-Command dotnet).Source -ArgumentList @(('"'+$dllPath+'"')) -WorkingDirectory (Join-Path $repoRoot 'services/api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir 'api.log') -RedirectStandardError (Join-Path $stateDir 'api-error.log')
    $started += $apiProcess
    $vitePath = Join-Path $repoRoot 'apps/web/node_modules/vite/bin/vite.js'
    $webProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(('"'+$vitePath+'"'),'--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory (Join-Path $repoRoot 'apps/web') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir 'web.log') -RedirectStandardError (Join-Path $stateDir 'web-error.log')
    $started += $webProcess
    $started | ForEach-Object { @{ Id=$_.Id; Started=$_.StartTime.ToUniversalTime().ToString('o') } } | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (@($started | Where-Object { $_.HasExited }).Count) { throw 'Demo process exited. Inspect .artifacts/demo logs.' }
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:5047/health' -TimeoutSec 2
            $web = Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2
            if ($web.StatusCode -eq 200 -and $health.status -eq 'healthy') { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (!$ready) { throw 'Demo startup timed out. Inspect .artifacts/demo logs.' }
    Write-Output 'Demo ready: http://127.0.0.1:5173 | API: http://127.0.0.1:5047/health'
} catch {
    foreach ($process in $started) { if (!$process.HasExited) { Stop-Process -Id $process.Id } }
    throw
} finally {
    foreach ($key in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key,$savedEnvironment[$key],'Process') }
}
