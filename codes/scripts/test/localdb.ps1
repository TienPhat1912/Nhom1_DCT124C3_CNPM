function Invoke-CiSqlTool {
    param([string]$File, [string[]]$Arguments)
    # Resolve before relaxing native error handling: a missing tool must fail.
    $command = Get-Command $File -ErrorAction Stop
    # Windows PowerShell turns redirected native stderr into an exception with
    # Stop; newer pwsh can also throw on nonzero exits via this preference.
    # Scope these settings to this invocation so the caller remains fail-fast.
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $output = & $command @Arguments 2>&1
    return @{ Output = $output; ExitCode = $LASTEXITCODE }
}

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
    $output = (Invoke-CiSqlTool $Tool @('create', $Instance)).Output
    $output | Out-File -LiteralPath $log -Encoding utf8
    $output | Write-Host
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        "Startup attempt $attempt/3" | Out-File -LiteralPath $log -Append -Encoding utf8
        $output = (Invoke-CiSqlTool $Tool @('start', $Instance)).Output
        $output | Out-File -LiteralPath $log -Append -Encoding utf8
        $output | Write-Host
        $probe = Invoke-CiSqlTool $SqlCmd @('-S', "(localdb)\$Instance", '-E', '-C', '-b', '-l', '5', '-t', '5', '-Q', 'SET NOCOUNT ON; SELECT 1')
        $probe.Output | Out-File -LiteralPath $log -Append -Encoding utf8
        if ($probe.ExitCode -eq 0) { return }
        # Preserve the engine diagnostics before finally removes our instance.
        $engineLog = Join-Path $env:LOCALAPPDATA "Microsoft/Microsoft SQL Server Local DB/Instances/$Instance/error.log"
        if (Test-Path -LiteralPath $engineLog) {
            Copy-Item -LiteralPath $engineLog -Destination (Join-Path $Artifacts "localdb-engine-$attempt.log") -Force
        }
        if ($attempt -lt 3) { Start-Sleep -Seconds $RetryDelaySeconds }
    }
    throw "LocalDB '$Instance' did not become SQL-ready after 3 attempts. See artifacts/localdb-startup.log and localdb-engine-*.log. Acceptance tests were not started."
}
