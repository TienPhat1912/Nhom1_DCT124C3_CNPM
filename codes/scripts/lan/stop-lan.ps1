$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lan-common.ps1')
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -or -not (Test-DockerReady)) {
  Write-Host 'Docker is not running. The Docker project is already stopped.'
  return
}
$containers = @(& docker ps -q --filter 'label=com.docker.compose.project=cnpm-guidance')
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect project containers.' }
if ($containers.Count -eq 0) {
  Write-Host 'The project is already stopped.'
  return
}
& docker stop --timeout 20 @containers
if ($LASTEXITCODE -ne 0) { throw 'Some project containers could not be stopped.' }
$remaining = @(& docker ps -q --filter 'label=com.docker.compose.project=cnpm-guidance')
if ($LASTEXITCODE -ne 0 -or $remaining.Count -gt 0) { throw 'Could not confirm that all project containers stopped.' }
Write-Host 'Project stopped. Database and QR keys are kept. Docker Desktop can remain open.'
