$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$portableRoot = (Resolve-Path (Join-Path $projectRoot '..\..')).Path
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

$driveName = "$driveLetter`:"
$driveRoot = "$driveLetter`:\"
$env:FIELDRELAY_CANONICAL_PROJECT_ROOT = $projectRoot
$env:NODE_ENV = 'development'

Write-Host "Building FieldRelay through temporary path $driveRoot"
& subst $driveName $portableRoot
if ($LASTEXITCODE -ne 0) {
  throw "Could not map $driveName to $portableRoot"
}

try {
  Push-Location (Join-Path $driveRoot 'apps\mobile\android')
  try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
} finally {
  & subst $driveName /D
}

$apk = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path -LiteralPath $apk)) {
  throw "Build completed without the expected APK at $apk"
}

Write-Host "APK ready: $apk"
