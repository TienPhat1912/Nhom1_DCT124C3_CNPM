function Initialize-CiLocalDb {
    param(
        [Parameter(Mandatory)][string]$Tool,
        [Parameter(Mandatory)][string]$SqlCmd,
        [Parameter(Mandatory)][string]$Instance,
        [Parameter(Mandatory)][string]$Artifacts,
        [int]$RetryDelaySeconds = 2
    )
    # Some LocalDB failures print an error but return zero. Readiness is a SQL
    # query, not the utility's exit code or its localized console message.
    New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
    $log = Join-Path $Artifacts 'localdb-startup.log'
    $output = & $Tool create $Instance 2>&1
    $output | Out-File -LiteralPath $log -Encoding utf8
    $output | Write-Host
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        "Startup attempt $attempt/3" | Out-File -LiteralPath $log -Append -Encoding utf8
        $output = & $Tool start $Instance 2>&1
        $output | Out-File -LiteralPath $log -Append -Encoding utf8
        $output | Write-Host
        $probe = & $SqlCmd -S "(localdb)\$Instance" -E -C -b -l 5 -t 5 -Q 'SET NOCOUNT ON; SELECT 1' 2>&1
        $probeExit = $LASTEXITCODE
        $probe | Out-File -LiteralPath $log -Append -Encoding utf8
        if ($probeExit -eq 0) { return }
        # Preserve the engine diagnostics before finally removes our instance.
        $engineLog = Join-Path $env:LOCALAPPDATA "Microsoft/Microsoft SQL Server Local DB/Instances/$Instance/error.log"
        if (Test-Path -LiteralPath $engineLog) {
            Copy-Item -LiteralPath $engineLog -Destination (Join-Path $Artifacts "localdb-engine-$attempt.log") -Force
        }
        if ($attempt -lt 3) { Start-Sleep -Seconds $RetryDelaySeconds }
    }
    throw "LocalDB '$Instance' did not become SQL-ready after 3 attempts. See artifacts/localdb-startup.log and localdb-engine-*.log. Acceptance tests were not started."
}
