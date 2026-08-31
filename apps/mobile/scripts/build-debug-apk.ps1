param(
  [string]$ApiBaseUrl = 'https://fieldrelay.swoop.video',
  [switch]$InstallIfDeviceAvailable
)

$ErrorActionPreference = 'Stop'

function Assert-LastExitCode([string]$Message) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Message (exit code $LASTEXITCODE)"
  }
}

function Get-Sha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha256.ComputeHash($stream)
    return -join ($bytes | ForEach-Object { $_.ToString('X2') })
  } finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$portableRoot = (Resolve-Path (Join-Path $projectRoot '..\..')).Path
$artifactDirectory = Join-Path $projectRoot 'artifacts'
$artifactName = 'fieldrelay-demo-arm64-debug.apk'
$artifactPath = Join-Path $artifactDirectory $artifactName
$checksumPath = "$artifactPath.sha256"
$candidateLetters = @('R', 'Q', 'P', 'M', 'N')
$driveLetter = $null

foreach ($candidate in $candidateLetters) {
  if (-not (Test-Path "$candidate`:\")) {
    $driveLetter = $candidate
    break
  }
}

if (-not $driveLetter) {
  throw 'No unused temporary drive letter is available for the Windows-safe Android build.'
}

if ($ApiBaseUrl -notmatch '^https?://') {
  throw 'ApiBaseUrl must be an absolute HTTP(S) URL.'
}

& (Join-Path $PSScriptRoot 'prepare-android.ps1')
Assert-LastExitCode 'Android project preparation failed'

$androidSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
if (-not $androidSdk -or -not (Test-Path -LiteralPath $androidSdk)) {
  throw 'ANDROID_HOME or ANDROID_SDK_ROOT must point to an installed Android SDK.'
}

$buildToolsDirectory = Get-ChildItem (Join-Path $androidSdk 'build-tools') -Directory |
  Sort-Object { [version]$_.Name } -Descending |
  Select-Object -First 1
if (-not $buildToolsDirectory) {
  throw 'No Android build-tools installation was found.'
}

$aapt = Join-Path $buildToolsDirectory.FullName 'aapt.exe'
$apkSigner = Join-Path $buildToolsDirectory.FullName 'apksigner.bat'
$adb = Join-Path $androidSdk 'platform-tools\adb.exe'
foreach ($tool in @($aapt, $apkSigner)) {
  if (-not (Test-Path -LiteralPath $tool)) {
    throw "Required Android verification tool was not found: $tool"
  }
}

$driveName = "$driveLetter`:"
$driveRoot = "$driveLetter`:\"
$env:FIELDRELAY_CANONICAL_PROJECT_ROOT = "$driveLetter`:\apps\mobile"
$env:FIELDRELAY_PHYSICAL_PROJECT_ROOT = $projectRoot
$env:FIELDRELAY_EMBED_DEBUG_BUNDLE = 'true'
$env:FIELDRELAY_REQUIRE_RELEASE_SIGNING = 'false'
$env:EXPO_PUBLIC_API_URL = $ApiBaseUrl.TrimEnd('/')
$env:NODE_ENV = 'production'

Write-Host "Building FieldRelay through temporary path $driveRoot"
Write-Host "Embedding public API endpoint $($env:EXPO_PUBLIC_API_URL)"
& subst $driveName $portableRoot
Assert-LastExitCode "Could not map $driveName to $portableRoot"

try {
  Push-Location (Join-Path $driveRoot 'apps\mobile\android')
  try {
    & .\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --no-daemon --stacktrace
    Assert-LastExitCode 'Gradle failed to assemble the standalone debug APK'
  } finally {
    Pop-Location
  }
} finally {
  & subst $driveName /D
}

$builtApk = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path -LiteralPath $builtApk)) {
  throw "Build completed without the expected APK at $builtApk"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($builtApk)
try {
  $entryNames = @($archive.Entries | ForEach-Object FullName)
  $bundle = $archive.Entries | Where-Object FullName -eq 'assets/index.android.bundle' | Select-Object -First 1
  if (-not $bundle -or $bundle.Length -lt 1024) {
    throw 'APK verification failed: assets/index.android.bundle is missing or unexpectedly empty.'
  }
  if (-not ($entryNames | Where-Object { $_ -like 'lib/arm64-v8a/*' })) {
    throw 'APK verification failed: arm64-v8a native libraries are missing.'
  }
  foreach ($unexpectedAbi in @('armeabi-v7a', 'x86', 'x86_64')) {
    if ($entryNames | Where-Object { $_ -like "lib/$unexpectedAbi/*" }) {
      throw "APK verification failed: unexpected $unexpectedAbi native libraries were packaged."
    }
  }
} finally {
  $archive.Dispose()
}

$badging = & $aapt dump badging $builtApk
Assert-LastExitCode 'aapt could not inspect the APK'
if (($badging -join "`n") -notmatch "package: name='video\.swoop\.fieldrelay'") {
  throw 'APK verification failed: package id is not video.swoop.fieldrelay.'
}
if (($badging -join "`n") -notmatch "sdkVersion:'24'") {
  throw 'APK verification failed: expected minimum Android API 24.'
}

$signerOutput = & $apkSigner verify --verbose --print-certs $builtApk 2>&1
Assert-LastExitCode 'apksigner rejected the debug-signed APK'

New-Item -ItemType Directory -Force -Path $artifactDirectory | Out-Null
Copy-Item -LiteralPath $builtApk -Destination $artifactPath -Force
$checksum = Get-Sha256 $artifactPath
Set-Content -LiteralPath $checksumPath -Value "$checksum  $artifactName" -Encoding ascii

if ($InstallIfDeviceAvailable -and (Test-Path -LiteralPath $adb)) {
  $devices = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" })
  if ($devices.Count -gt 0) {
    & $adb install -r $artifactPath
    Assert-LastExitCode 'adb could not install the APK on the connected Android device'
    & $adb shell monkey -p video.swoop.fieldrelay -c android.intent.category.LAUNCHER 1 | Out-Host
    Assert-LastExitCode 'adb could not launch FieldRelay after installation'
    Write-Host 'Install and launch verification passed on the connected device.'
  } else {
    Write-Warning 'No authorized Android device/emulator was connected; install/launch verification was skipped.'
  }
}

Write-Host "APK ready: $artifactPath"
Write-Host "SHA-256: $checksum"
Write-Host 'Verified: embedded JS bundle, arm64-v8a only, package id, minimum API, and APK signature.'
Write-Host 'This is a debug-signed portfolio artifact. It is not a production release.'
