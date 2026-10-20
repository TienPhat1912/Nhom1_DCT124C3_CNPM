param(
  [string]$SdkPath,
  [string]$JavaPath,
  [string]$BuildDirectory,
  [string]$ApiUrl = $env:EXPO_PUBLIC_API_URL,
  [string]$WebUrl = $env:EXPO_PUBLIC_WEB_URL,
  [string]$Architectures = 'arm64-v8a,x86_64'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$root = & node -e "process.stdout.write(require('node:fs').realpathSync.native(process.argv[1]))" $root
if ($LASTEXITCODE -ne 0) { throw 'Node could not resolve the workspace path.' }
if (-not $SdkPath) {
  $SdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $root '.local/android-sdk' }
}
if (-not $JavaPath) {
  $JavaPath = if (Test-Path -LiteralPath 'C:\Program Files\Java\jdk-17') { 'C:\Program Files\Java\jdk-17' } else { $env:JAVA_HOME }
}
if (-not $JavaPath -or -not (Test-Path -LiteralPath (Join-Path $JavaPath 'bin/java.exe'))) { throw 'Set -JavaPath to a JDK 17 installation.' }
if (-not (Test-Path -LiteralPath (Join-Path $SdkPath 'platforms/android-36/android.jar'))) { throw 'Android SDK platform 36 is required. See docs/guides/ANDROID.md.' }
if ($Architectures -notmatch '^(arm64-v8a|x86_64|armeabi-v7a|x86)(,(arm64-v8a|x86_64|armeabi-v7a|x86))*$') { throw 'Invalid Android architectures.' }

# Expo resolves SUBST drives back to their original path in autolinking, while
# Gradle retains the drive alias. Use a real, short build copy to keep one root.
$sourceRoot = $root
if ($root.Length -gt 25 -or $root.Contains(' ')) {
  if (-not $BuildDirectory) { $BuildDirectory = Join-Path ([IO.Path]::GetPathRoot($root)) 'cnpm-android' }
  $buildRoot = [IO.Path]::GetFullPath($BuildDirectory).TrimEnd('\')
  if ($buildRoot.Length -gt 25 -or $buildRoot.Contains(' ')) { throw 'Choose a short -BuildDirectory without spaces, such as D:\cnpm-android.' }
  $marker = Join-Path $buildRoot '.cnpm-workspace'
  if (Test-Path -LiteralPath $buildRoot) {
    if (-not (Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw).Trim() -ne $sourceRoot) { throw 'Build directory is not owned by this workspace. Choose another -BuildDirectory.' }
  } else {
    New-Item -ItemType Directory -Path $buildRoot | Out-Null
    Set-Content -LiteralPath $marker -Value $sourceRoot -Encoding UTF8
  }
  foreach ($relative in @('node_modules', 'apps/mobile', 'packages/shared')) {
    $destination = [IO.Path]::GetFullPath((Join-Path $buildRoot $relative))
    if (-not $destination.StartsWith($buildRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Build copy escaped its owned directory.' }
    $cachedLock = Join-Path $buildRoot 'package-lock.json'
    if ($relative -eq 'node_modules' -and (Test-Path -LiteralPath $destination) -and (Test-Path -LiteralPath $cachedLock) -and
        (Get-FileHash -LiteralPath $cachedLock).Hash -eq (Get-FileHash -LiteralPath (Join-Path $sourceRoot 'package-lock.json')).Hash) { continue }
    # All mirror targets are verified children of our marked build directory.
    # Do not mirror generated native projects or local credentials.
    $copyArgs = @((Join-Path $sourceRoot $relative), $destination, '/MIR', '/MT:8', '/R:1', '/W:1', '/NP', '/NFL', '/NDL', '/NJH', '/NJS', '/XF', '.env')
    if ($relative -eq 'apps/mobile') { $copyArgs += @('/XD', 'android', 'ios', '.expo', 'dist') }
    # Ninja dependency databases contain absolute paths and cannot be moved.
    if ($relative -eq 'node_modules') { $copyArgs += @('/XD', '.cxx') }
    & robocopy.exe @copyArgs
    if ($LASTEXITCODE -ge 8) { throw "Build copy failed: $relative" }
  }
  # Robocopy materializes workspace junctions. Keep the shared source copy in
  # node_modules current even when the dependency lockfile has not changed.
  $sharedDestination = [IO.Path]::GetFullPath((Join-Path $buildRoot 'node_modules/@hospital/shared'))
  if (-not $sharedDestination.StartsWith($buildRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Shared build copy escaped its owned directory.' }
  & robocopy.exe (Join-Path $sourceRoot 'packages/shared') $sharedDestination /MIR /R:1 /W:1 /NP /NFL /NDL /NJH /NJS /XF .env
  if ($LASTEXITCODE -ge 8) { throw 'Shared workspace copy failed.' }
  Copy-Item -LiteralPath (Join-Path $sourceRoot 'package.json'), (Join-Path $sourceRoot 'package-lock.json') -Destination $buildRoot -Force
  $root = $buildRoot
}

$saved = @{}
foreach ($name in @('JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'GRADLE_USER_HOME', 'CI', 'NODE_ENV', 'EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_WEB_URL')) {
  $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
Push-Location -LiteralPath $root
try {
  $env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaPath).Path
  $env:ANDROID_HOME = (Resolve-Path -LiteralPath $SdkPath).Path
  $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
  $env:GRADLE_USER_HOME = Join-Path $root '.gradle-cache'
  $env:CI = '1'
  $env:NODE_ENV = 'production'
  if ($ApiUrl) { $env:EXPO_PUBLIC_API_URL = $ApiUrl }
  if ($WebUrl) { $env:EXPO_PUBLIC_WEB_URL = $WebUrl }
  Push-Location -LiteralPath (Join-Path $root 'apps/mobile')
  try {
    $ErrorActionPreference = 'Continue'
    npx expo prebuild --platform android --no-install
    $nativeExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($nativeExit -ne 0) { throw 'Expo Android prebuild failed.' }
  } finally { Pop-Location }
  Push-Location -LiteralPath (Join-Path $root 'apps/mobile/android')
  try {
    # Windows PowerShell treats Java warnings on stderr as ErrorRecords. Use
    # the actual process exit code so a warning does not abort a valid build.
    $ErrorActionPreference = 'Continue'
    & './gradlew.bat' assembleRelease --no-daemon --max-workers=2 "-PreactNativeArchitectures=$Architectures" --console=plain
    $nativeExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($nativeExit -ne 0) { throw 'Android release build failed.' }
  } finally { Pop-Location }
  $output = Join-Path $sourceRoot 'artifacts/android'
  New-Item -ItemType Directory -Force -Path $output | Out-Null
  $apk = Join-Path $output 'an-tam-demo.apk'
  Copy-Item -LiteralPath (Join-Path $root 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk') -Destination $apk -Force
  $sha = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath (Join-Path $output 'an-tam-demo.apk.sha256') -Value "$sha  an-tam-demo.apk" -Encoding ASCII
  Write-Output "Demo APK: $apk"
  Write-Output "SHA256: $sha"
} finally {
  Pop-Location
  foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
