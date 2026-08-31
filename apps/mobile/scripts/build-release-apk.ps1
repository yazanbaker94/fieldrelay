param(
  [string]$ApiBaseUrl = 'https://fieldrelay.swoop.video',
  [string]$SigningDirectory = (Join-Path $env:USERPROFILE '.fieldrelay-release'),
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

function Read-SigningProperties([string]$Path) {
  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
      continue
    }
    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) {
      throw "Invalid signing properties line in $Path"
    }
    $values[$parts[0].Trim()] = $parts[1]
  }
  return $values
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$portableRoot = (Resolve-Path (Join-Path $projectRoot '..\..')).Path
$artifactDirectory = Join-Path $projectRoot 'artifacts'
$artifactName = 'fieldrelay-android.apk'
$artifactPath = Join-Path $artifactDirectory $artifactName
$pendingArtifactPath = "$artifactPath.pending"
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

if ($ApiBaseUrl -notmatch '^https://') {
  throw 'Release ApiBaseUrl must be an absolute HTTPS URL.'
}
$normalizedApiBaseUrl = $ApiBaseUrl.TrimEnd('/')

$prepareAndroid = Join-Path $PSScriptRoot 'prepare-android.ps1'
& $prepareAndroid
Assert-LastExitCode 'Android project preparation failed'

$signingPropertiesPath = (& (Join-Path $PSScriptRoot 'ensure-release-signing.ps1') -SigningDirectory $SigningDirectory | Select-Object -Last 1)
if (-not $signingPropertiesPath -or -not (Test-Path -LiteralPath $signingPropertiesPath)) {
  throw 'The local FieldRelay signing properties file was not created.'
}
$signing = Read-SigningProperties $signingPropertiesPath
foreach ($requiredKey in @('storeFile', 'storePassword', 'keyAlias', 'keyPassword')) {
  if (-not $signing.ContainsKey($requiredKey) -or [string]::IsNullOrWhiteSpace($signing[$requiredKey])) {
    throw "Signing properties are missing $requiredKey."
  }
}
if (-not (Test-Path -LiteralPath $signing.storeFile)) {
  throw 'The FieldRelay release keystore referenced by the local signing properties does not exist.'
}

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
$zipAlign = Join-Path $buildToolsDirectory.FullName 'zipalign.exe'
$adb = Join-Path $androidSdk 'platform-tools\adb.exe'
foreach ($tool in @($aapt, $apkSigner, $zipAlign)) {
  if (-not (Test-Path -LiteralPath $tool)) {
    throw "Required Android verification tool was not found: $tool"
  }
}

$driveName = "$driveLetter`:"
$driveRoot = "$driveLetter`:\"
$env:FIELDRELAY_CANONICAL_PROJECT_ROOT = "$driveLetter`:\apps\mobile"
$env:FIELDRELAY_PHYSICAL_PROJECT_ROOT = $projectRoot
$env:FIELDRELAY_EMBED_DEBUG_BUNDLE = 'false'
$env:FIELDRELAY_REQUIRE_RELEASE_SIGNING = 'true'
$env:FIELDRELAY_RELEASE_STORE_FILE = $signing.storeFile
$env:FIELDRELAY_RELEASE_STORE_PASSWORD = $signing.storePassword
$env:FIELDRELAY_RELEASE_KEY_ALIAS = $signing.keyAlias
$env:FIELDRELAY_RELEASE_KEY_PASSWORD = $signing.keyPassword
$env:EXPO_PUBLIC_API_URL = $normalizedApiBaseUrl
$env:NODE_ENV = 'production'

Write-Host "Building the signed FieldRelay release through temporary path $driveRoot"
Write-Host "Embedding public API endpoint $normalizedApiBaseUrl"
& subst $driveName $portableRoot
Assert-LastExitCode "Could not map $driveName to $portableRoot"

try {
  Push-Location (Join-Path $driveRoot 'apps\mobile\android')
  try {
    & .\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --stacktrace
    Assert-LastExitCode 'Gradle failed to assemble the signed release APK'
  } finally {
    Pop-Location
  }
} finally {
  & subst $driveName /D
  Remove-Item Env:FIELDRELAY_RELEASE_STORE_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:FIELDRELAY_RELEASE_KEY_PASSWORD -ErrorAction SilentlyContinue
}

$builtApk = Join-Path $projectRoot 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $builtApk)) {
  throw "Build completed without the expected APK at $builtApk"
}

New-Item -ItemType Directory -Force -Path $artifactDirectory | Out-Null
Copy-Item -LiteralPath $builtApk -Destination $pendingArtifactPath -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($pendingArtifactPath)
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

  $bundleStream = $bundle.Open()
  try {
    $bundleMemory = New-Object System.IO.MemoryStream
    $bundleStream.CopyTo($bundleMemory)
    $bundleText = [System.Text.Encoding]::UTF8.GetString($bundleMemory.ToArray())
    if (-not $bundleText.Contains($normalizedApiBaseUrl)) {
      throw 'APK verification failed: the configured public API URL was not found in the embedded JavaScript bundle.'
    }
  } finally {
    if ($bundleMemory) { $bundleMemory.Dispose() }
    $bundleStream.Dispose()
  }
} finally {
  $archive.Dispose()
}

$badging = & $aapt dump badging $pendingArtifactPath
Assert-LastExitCode 'aapt could not inspect the release APK'
$badgingText = $badging -join "`n"
if ($badgingText -notmatch "package: name='video\.swoop\.fieldrelay'") {
  throw 'APK verification failed: package id is not video.swoop.fieldrelay.'
}
if ($badgingText -notmatch "sdkVersion:'24'") {
  throw 'APK verification failed: expected minimum Android API 24.'
}
if ($badgingText -match 'application-debuggable') {
  throw 'APK verification failed: the release application is marked debuggable.'
}

$permissionOutput = & $aapt dump permissions $pendingArtifactPath
Assert-LastExitCode 'aapt could not inspect release permissions'
$permissionText = $permissionOutput -join "`n"
foreach ($forbiddenPermission in @(
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE'
)) {
  if ($permissionText.Contains($forbiddenPermission)) {
    throw "APK verification failed: forbidden release permission $forbiddenPermission is present."
  }
}

$manifestTree = & $aapt dump xmltree $pendingArtifactPath AndroidManifest.xml
Assert-LastExitCode 'aapt could not inspect the compiled release manifest'
$manifestText = $manifestTree -join "`n"
if ($manifestText -match 'usesCleartextTraffic.*0xffffffff') {
  throw 'APK verification failed: cleartext network traffic is enabled in the release manifest.'
}

& $zipAlign -c -P 16 -v 4 $pendingArtifactPath *> $null
Assert-LastExitCode 'zipalign rejected the release APK'

$signerOutput = & $apkSigner verify --verbose --print-certs $pendingArtifactPath 2>&1
Assert-LastExitCode 'apksigner rejected the release APK'
$signerText = $signerOutput -join "`n"
if ($signerText -match 'Android Debug' -or $signerText -notmatch 'CN=FieldRelay Portfolio') {
  throw 'APK verification failed: release is not signed by the dedicated FieldRelay portfolio certificate.'
}
if ($signerText -notmatch 'Verified using v2 scheme \(APK Signature Scheme v2\): true') {
  throw 'APK verification failed: APK Signature Scheme v2 was not verified.'
}

Move-Item -LiteralPath $pendingArtifactPath -Destination $artifactPath -Force
$checksum = Get-Sha256 $artifactPath
[System.IO.File]::WriteAllText(
  $checksumPath,
  "$checksum  $artifactName$([Environment]::NewLine)",
  [System.Text.Encoding]::ASCII
)

if ($InstallIfDeviceAvailable -and (Test-Path -LiteralPath $adb)) {
  $deviceLines = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" })
  if ($deviceLines.Count -gt 0) {
    $serial = ($deviceLines[0] -split "\t")[0]
    $deviceAbis = (& $adb -s $serial shell getprop ro.product.cpu.abilist) -join ','
    if ($deviceAbis -match 'arm64-v8a') {
      & $adb -s $serial install -r $artifactPath
      Assert-LastExitCode 'adb could not install the release APK on the connected arm64 device'
      & $adb -s $serial shell monkey -p video.swoop.fieldrelay -c android.intent.category.LAUNCHER 1 | Out-Host
      Assert-LastExitCode 'adb could not launch FieldRelay after installation'
      Write-Host 'Install and launch verification passed on the connected arm64 device.'
    } else {
      Write-Warning "Connected device $serial does not support arm64-v8a; install/launch verification was skipped."
    }
  } else {
    Write-Warning 'No authorized Android device/emulator was connected; install/launch verification was skipped.'
  }
}

Write-Host "Release APK ready: $artifactPath"
Write-Host "SHA-256: $checksum"
Write-Host 'Verified: embedded JS/API URL, arm64-v8a only, package id, API 24 minimum, non-debuggable manifest, production permission profile, zip alignment, and dedicated release signature.'
