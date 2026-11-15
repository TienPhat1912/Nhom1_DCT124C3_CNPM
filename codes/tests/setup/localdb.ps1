$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../scripts/test/localdb.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('hospital-localdb-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$savedLocalAppData = $env:LOCALAPPDATA
try {
    $env:LOCALAPPDATA = $testRoot
    function Mock-LocalDb { param($Action, $Instance)
        if ($Action -eq 'create') { $script:creates++; return 'Created' }
        $script:starts++
        # Reproduce the supplied CI log: a utility can print failure with exit 0.
        $global:LASTEXITCODE = 0
        return 'SQL Server process failed to start.'
    }
    function Mock-SqlCmd {
        $script:probes++
        $global:LASTEXITCODE = if ($script:probes -ge $script:readyAt) { 0 } else { 1 }
        return 'probe'
    }
    foreach ($readyAt in @(1, 2, 99)) {
        $script:readyAt = $readyAt
        $script:creates = 0; $script:starts = 0; $script:probes = 0
        $instance = 'HospitalCI_test'
        $engineDirectory = Join-Path $testRoot "Microsoft/Microsoft SQL Server Local DB/Instances/$instance"
        New-Item -ItemType Directory -Force -Path $engineDirectory | Out-Null
        Set-Content -LiteralPath (Join-Path $engineDirectory 'error.log') -Value 'engine failure evidence'
        $output = Join-Path $testRoot "artifacts-$readyAt"
        $failure = $null
        try { Initialize-CiLocalDb -Tool Mock-LocalDb -SqlCmd Mock-SqlCmd -Instance $instance -Artifacts $output -RetryDelaySeconds 0 }
        catch { $failure = $_ }
        $expected = [Math]::Min($readyAt, 3)
        if ($script:creates -ne 1 -or $script:starts -ne $expected -or $script:probes -ne $expected) { throw 'Incorrect bounded startup/probe count' }
        if (($readyAt -eq 99) -ne ($null -ne $failure)) { throw 'Readiness failure was not propagated correctly' }
        if ($readyAt -gt 1 -and (Get-Content -Raw -LiteralPath (Join-Path $output 'localdb-engine-1.log')) -notmatch 'engine failure evidence') { throw 'Engine diagnostics lost' }
    }
    Write-Output 'PASS: immediate readiness, transient retry, false-zero failure, bounded stop and engine diagnostics.'
} finally {
    $env:LOCALAPPDATA = $savedLocalAppData
    # This randomly named directory was created exclusively by this test.
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($resolved) -notmatch '^hospital-localdb-test-[a-f0-9]{32}$') { throw 'Unsafe test cleanup path' }
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
