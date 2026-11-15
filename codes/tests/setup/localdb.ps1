$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../scripts/test/localdb.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('hospital-localdb-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$savedLocalAppData = $env:LOCALAPPDATA
try {
    $env:LOCALAPPDATA = $testRoot
    function Mock-LocalDb { param($Action, $Instance)
        if ($Action -eq 'create') { $script:creates++; return '[simulated LocalDB] Created' }
        $script:starts++
        # Reproduce the supplied CI log: a utility can print failure with exit 0.
        $global:LASTEXITCODE = 0
        return '[simulated LocalDB failure] SQL Server process failed to start.'
    }
    function Mock-SqlCmd {
        $script:probes++
        if ($script:nativeStderr -and $script:probes -lt $script:readyAt) {
            & $env:ComSpec /d /c 'echo simulated-native-stderr 1>&2 & exit /b 1'
        }
        $global:LASTEXITCODE = if ($script:probes -ge $script:readyAt) { 0 } else { 1 }
        return 'probe'
    }
    foreach ($nativeStderr in @($false, $true)) {
    $script:nativeStderr = $nativeStderr
    foreach ($readyAt in @(1, 2, 99)) {
        $script:readyAt = $readyAt
        $script:creates = 0; $script:starts = 0; $script:probes = 0
        $instance = 'HospitalCI_test'
        $engineDirectory = Join-Path $testRoot "Microsoft/Microsoft SQL Server Local DB/Instances/$instance"
        New-Item -ItemType Directory -Force -Path $engineDirectory | Out-Null
        Set-Content -LiteralPath (Join-Path $engineDirectory 'error.log') -Value 'engine failure evidence'
        $output = Join-Path $testRoot "artifacts-$nativeStderr-$readyAt"
        $failure = $null
        try { Initialize-CiLocalDb -Tool Mock-LocalDb -SqlCmd Mock-SqlCmd -Instance $instance -Artifacts $output -RetryDelaySeconds 0 }
        catch { $failure = $_ }
        $expected = [Math]::Min($readyAt, 3)
        if ($script:creates -ne 1 -or $script:starts -ne $expected -or $script:probes -ne $expected) { throw 'Incorrect bounded startup/probe count' }
        if (($readyAt -eq 99) -ne ($null -ne $failure)) { throw 'Readiness failure was not propagated correctly' }
        if ($readyAt -eq 99 -and $failure.Exception.Message -notmatch 'did not become SQL-ready after 3 attempts') { throw 'Unexpected failure instead of readiness timeout' }
        if ($readyAt -gt 1 -and (Get-Content -Raw -LiteralPath (Join-Path $output 'localdb-engine-1.log')) -notmatch 'engine failure evidence') { throw 'Engine diagnostics lost' }
        if ($nativeStderr -and $readyAt -gt 1 -and (Get-Content -Raw -LiteralPath (Join-Path $output 'localdb-startup.log')) -notmatch 'simulated-native-stderr') { throw 'Native stderr diagnostics lost' }
        if ($ErrorActionPreference -ne 'Stop') { throw 'Native command handling changed caller error policy' }
    }
    }
} finally {
    $env:LOCALAPPDATA = $savedLocalAppData
    # This randomly named directory was created exclusively by this test.
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($resolved) -notmatch '^hospital-localdb-test-[a-f0-9]{32}$') { throw 'Unsafe test cleanup path' }
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
# The final scenario deliberately leaves LASTEXITCODE=1. GitHub's PowerShell
# wrapper exits with that value even when all assertions passed. Reset only
# after assertions AND cleanup succeed; a real test exception still fails CI.
$global:LASTEXITCODE = 0
Write-Output 'PASS: immediate readiness, transient retry, false-zero failure, bounded stop and engine diagnostics.'
