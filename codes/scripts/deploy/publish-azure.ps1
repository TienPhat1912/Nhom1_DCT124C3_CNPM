param([string]$Commit = $env:GITHUB_SHA)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Push-Location -LiteralPath $root
try {
    if (-not $Commit) {
        $Commit = (& git rev-parse HEAD).Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Cannot determine the release commit.' }
    }
    if ($Commit -notmatch '^[a-f0-9]{40}$') { throw 'Commit must be a full Git SHA.' }

    $artifacts = [IO.Path]::GetFullPath((Join-Path $root 'artifacts'))
    $publish = [IO.Path]::GetFullPath((Join-Path $artifacts 'azure-release'))
    if ($publish -ne (Join-Path $artifacts 'azure-release') -or -not $publish.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Publish directory escaped the workspace.'
    }
    if (Test-Path -LiteralPath $publish) {
        if ((Get-Item -LiteralPath $publish).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Publish directory must not be a link.' }
        Remove-Item -LiteralPath $publish -Recurse -Force
    }
    New-Item -ItemType Directory -Path $publish -Force | Out-Null

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    & dotnet publish backend/Hospital.Api/Hospital.Api.csproj -c Release --no-restore -p:UseAppHost=false -o $publish
    if ($LASTEXITCODE -ne 0) { throw 'API publish failed.' }
    $webRoot = Join-Path $publish 'wwwroot'
    New-Item -ItemType Directory -Path $webRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $root 'apps/web/dist/*') -Destination $webRoot -Recurse -Force
    $metadata = @{ Release = @{ Commit = $Commit } } | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $publish 'release.json'), $metadata, (New-Object Text.UTF8Encoding($false)))
    foreach ($required in @('Hospital.Api.dll', 'web.config', 'wwwroot/index.html')) {
        if (-not (Test-Path -LiteralPath (Join-Path $publish $required))) { throw "Release is missing $required" }
    }
    Compress-Archive -Path (Join-Path $publish '*') -DestinationPath (Join-Path $artifacts 'azure-release.zip') -Force
    Write-Output "Release $Commit ready: artifacts/azure-release.zip"
} finally { Pop-Location }
