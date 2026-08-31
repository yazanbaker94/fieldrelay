param(
  [switch]$ForceClean
)

$ErrorActionPreference = 'Stop'

function Assert-LastExitCode([string]$Message) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Message (exit code $LASTEXITCODE)"
  }
}

function Replace-LastOccurrence(
  [string]$Value,
  [string]$Needle,
  [string]$Replacement
) {
  $index = $Value.LastIndexOf($Needle, [System.StringComparison]::Ordinal)
  if ($index -lt 0) {
    throw "Generated Android template did not contain the expected text: $Needle"
  }

  return $Value.Remove($index, $Needle.Length).Insert($index, $Replacement)
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$expoCli = Join-Path $projectRoot 'node_modules\.bin\expo.cmd'
if (-not (Test-Path -LiteralPath $expoCli)) {
  throw 'Expo CLI is not installed. Run npm ci before building Android.'
}

$prebuildArguments = @('prebuild', '--platform', 'android', '--no-install')
if (-not $ForceClean) {
  # This still creates android/ in a clean clone, while retaining Gradle caches on later builds.
  $prebuildArguments += '--no-clean'
}

Write-Host 'Generating the Android project from the checked-in Expo configuration.'
Push-Location $projectRoot
try {
  & $expoCli @prebuildArguments
  Assert-LastExitCode 'Expo prebuild failed'
} finally {
  Pop-Location
}

$buildGradlePath = Join-Path $projectRoot 'android\app\build.gradle'
if (-not (Test-Path -LiteralPath $buildGradlePath)) {
  throw "Expo prebuild did not create $buildGradlePath"
}

$buildGradle = [System.IO.File]::ReadAllText($buildGradlePath)
$nativeNewline = if ($buildGradle.Contains("`r`n")) { "`r`n" } else { "`n" }
$patchMarker = '// FIELDRELAY_STANDALONE_BUILD_PATCH_V1'

if (-not $buildGradle.Contains($patchMarker)) {
  $projectRootDeclaration = 'def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()'
  if (-not $buildGradle.Contains($projectRootDeclaration)) {
    throw 'Generated Android template has changed: projectRoot declaration was not found.'
  }

  $moduleResolutionDeclarations = @'
def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()
// FIELDRELAY_STANDALONE_BUILD_PATCH_V1
// A short subst path avoids Windows path-with-spaces failures during Metro/Gradle resolution.
def moduleResolutionRoot = System.getenv('FIELDRELAY_CANONICAL_PROJECT_ROOT') ?: projectRoot
def moduleResolutionDir = new File(moduleResolutionRoot)

def fieldRelayReleaseStoreFile = System.getenv('FIELDRELAY_RELEASE_STORE_FILE')
def fieldRelayReleaseStorePassword = System.getenv('FIELDRELAY_RELEASE_STORE_PASSWORD')
def fieldRelayReleaseKeyAlias = System.getenv('FIELDRELAY_RELEASE_KEY_ALIAS')
def fieldRelayReleaseKeyPassword = System.getenv('FIELDRELAY_RELEASE_KEY_PASSWORD')
def fieldRelayReleaseSigningConfigured = [
    fieldRelayReleaseStoreFile,
    fieldRelayReleaseStorePassword,
    fieldRelayReleaseKeyAlias,
    fieldRelayReleaseKeyPassword,
].every { it != null && !it.isBlank() }
def fieldRelayRequireReleaseSigning = (System.getenv('FIELDRELAY_REQUIRE_RELEASE_SIGNING') ?: 'false').toBoolean()
'@
  $moduleResolutionPatch = $moduleResolutionDeclarations.TrimEnd().Replace("`r`n", "`n").Replace("`n", $nativeNewline)
  $buildGradle = $buildGradle.Replace($projectRootDeclaration, $moduleResolutionPatch)

  $reactBlockStart = 'react {'
  $reactPatch = @'
react {
    root = file(moduleResolutionRoot)
    if ((System.getenv('FIELDRELAY_EMBED_DEBUG_BUNDLE') ?: 'false').toBoolean()) {
        // A standalone debug fallback must launch without Metro.
        debuggableVariants = []
    }
'@
  if (-not $buildGradle.Contains($reactBlockStart)) {
    throw 'Generated Android template has changed: React configuration block was not found.'
  }
  $reactPatchText = $reactPatch.TrimEnd().Replace("`r`n", "`n").Replace("`n", $nativeNewline)
  $buildGradle = $buildGradle.Replace($reactBlockStart, $reactPatchText)
  $buildGradle = $buildGradle.Replace(
    'projectRoot, "android", "absolute"].execute(null, rootDir)',
    'moduleResolutionRoot, "android", "absolute"].execute(null, moduleResolutionDir)'
  )
  $buildGradle = $buildGradle.Replace('execute(null, rootDir)', 'execute(null, moduleResolutionDir)')

  $debugSigningTail = @'
            keyPassword 'android'
        }
    }
'@
  $releaseSigningTail = @'
            keyPassword 'android'
        }
        release {
            if (fieldRelayReleaseSigningConfigured) {
                storeFile file(fieldRelayReleaseStoreFile)
                storePassword fieldRelayReleaseStorePassword
                keyAlias fieldRelayReleaseKeyAlias
                keyPassword fieldRelayReleaseKeyPassword
            }
        }
    }
'@
  $normalizedDebugSigningTail = $debugSigningTail.TrimEnd().Replace("`r`n", "`n").Replace("`n", $nativeNewline)
  $normalizedReleaseSigningTail = $releaseSigningTail.TrimEnd().Replace("`r`n", "`n").Replace("`n", $nativeNewline)
  if (-not $buildGradle.Contains($normalizedDebugSigningTail)) {
    throw 'Generated Android template has changed: debug signing configuration was not found.'
  }
  $buildGradle = $buildGradle.Replace($normalizedDebugSigningTail, $normalizedReleaseSigningTail)

  $releaseSigningFallback = '            signingConfig signingConfigs.debug'
  $releaseSigningRequirement = @'
            if (fieldRelayRequireReleaseSigning) {
                if (!fieldRelayReleaseSigningConfigured) {
                    throw new GradleException('FieldRelay release signing variables are required for assembleRelease.')
                }
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
            }
            debuggable false
'@
  $releaseSigningReplacement = $releaseSigningRequirement.TrimEnd().Replace("`r`n", "`n").Replace("`n", $nativeNewline)
  $buildGradle = Replace-LastOccurrence -Value $buildGradle -Needle $releaseSigningFallback -Replacement $releaseSigningReplacement

  [System.IO.File]::WriteAllText(
    $buildGradlePath,
    $buildGradle,
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-Host 'Applied deterministic standalone-build and release-signing configuration.'
} else {
  Write-Host 'Android standalone-build configuration is already current.'
}

$settingsGradlePath = Join-Path $projectRoot 'android\settings.gradle'
$settingsGradle = [System.IO.File]::ReadAllText($settingsGradlePath)
$settingsPatchMarker = '// FIELDRELAY_WINDOWS_AUTOLINK_PATCH_V1'
if (-not $settingsGradle.Contains($settingsPatchMarker)) {
  $settingsNewline = if ($settingsGradle.Contains("`r`n")) { "`r`n" } else { "`n" }
  $defaultAutolinkBlock = @'
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  if (System.getenv('EXPO_USE_COMMUNITY_AUTOLINKING') == '1') {
    ex.autolinkLibrariesFromCommand()
  } else {
    ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)
  }
}
'@
  $portableAutolinkBlock = @'
// FIELDRELAY_WINDOWS_AUTOLINK_PATCH_V1
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  def fieldRelayCanonicalRoot = System.getenv('FIELDRELAY_CANONICAL_PROJECT_ROOT')
  def fieldRelayPhysicalRoot = System.getenv('FIELDRELAY_PHYSICAL_PROJECT_ROOT')
  if (fieldRelayCanonicalRoot && fieldRelayPhysicalRoot) {
    // Expo intentionally realpaths dependencies. Rewrite the generated RN config so
    // Windows codegen never mixes the long physical path with the subst build path.
    def portableConfigFile = file('build/generated/autolinking/fieldrelay-autolinking.json')
    portableConfigFile.parentFile.mkdirs()
    def configText = providers.exec {
      workingDir(fieldRelayCanonicalRoot)
      commandLine(expoAutolinking.rnConfigCommand)
    }.standardOutput.asText.get()
    configText = configText.replace(
      fieldRelayPhysicalRoot.replace('\\', '\\\\'),
      fieldRelayCanonicalRoot.replace('\\', '\\\\')
    )
    configText = configText.replace(
      fieldRelayPhysicalRoot.replace('\\', '/'),
      fieldRelayCanonicalRoot.replace('\\', '/')
    )
    portableConfigFile.text = configText
    ex.autolinkLibrariesFromConfigFile(portableConfigFile)
  } else if (System.getenv('EXPO_USE_COMMUNITY_AUTOLINKING') == '1') {
    ex.autolinkLibrariesFromCommand()
  } else {
    ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)
  }
}
'@
  $expectedSettingsBlock = $defaultAutolinkBlock.TrimEnd().Replace("`r`n", "`n").Replace("`n", $settingsNewline)
  $portableSettingsBlock = $portableAutolinkBlock.TrimEnd().Replace("`r`n", "`n").Replace("`n", $settingsNewline)
  if (-not $settingsGradle.Contains($expectedSettingsBlock)) {
    throw 'Generated Android template has changed: React autolinking settings block was not found.'
  }
  $settingsGradle = $settingsGradle.Replace($expectedSettingsBlock, $portableSettingsBlock)
  [System.IO.File]::WriteAllText(
    $settingsGradlePath,
    $settingsGradle,
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-Host 'Applied deterministic Windows autolinking path normalization.'
} else {
  Write-Host 'Windows autolinking path normalization is already current.'
}

$settingsGradle = [System.IO.File]::ReadAllText($settingsGradlePath)
$expoProjectPatchMarker = '// FIELDRELAY_WINDOWS_EXPO_PROJECT_PATH_PATCH_V1'
if (-not $settingsGradle.Contains($expoProjectPatchMarker)) {
  $settingsNewline = if ($settingsGradle.Contains("`r`n")) { "`r`n" } else { "`n" }
  $expoModulesCall = 'expoAutolinking.useExpoModules()'
  $expoModulesPatch = @'
expoAutolinking.useExpoModules()

// FIELDRELAY_WINDOWS_EXPO_PROJECT_PATH_PATCH_V1
def fieldRelayCanonicalRoot = System.getenv('FIELDRELAY_CANONICAL_PROJECT_ROOT')
def fieldRelayPhysicalRoot = System.getenv('FIELDRELAY_PHYSICAL_PROJECT_ROOT')
if (fieldRelayCanonicalRoot && fieldRelayPhysicalRoot) {
  // Expo module discovery returns realpaths. Point each linked Gradle project back
  // through the same short build root used by React Native and CMake/Ninja.
  def normalizeFieldRelayProjectPath
  normalizeFieldRelayProjectPath = { descriptor ->
    def currentPath = descriptor.projectDir.absolutePath
    if (currentPath.toLowerCase().startsWith(fieldRelayPhysicalRoot.toLowerCase())) {
      descriptor.projectDir = new File(
        fieldRelayCanonicalRoot + currentPath.substring(fieldRelayPhysicalRoot.length())
      )
    }
    descriptor.children.each { normalizeFieldRelayProjectPath(it) }
  }
  rootProject.children.each { normalizeFieldRelayProjectPath(it) }
}
'@
  $expoModulesPatchText = $expoModulesPatch.TrimEnd().Replace("`r`n", "`n").Replace("`n", $settingsNewline)
  if (-not $settingsGradle.Contains($expoModulesCall)) {
    throw 'Generated Android template has changed: Expo module linking call was not found.'
  }
  $settingsGradle = $settingsGradle.Replace($expoModulesCall, $expoModulesPatchText)
  [System.IO.File]::WriteAllText(
    $settingsGradlePath,
    $settingsGradle,
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-Host 'Applied deterministic Expo module/CMake path normalization.'
} else {
  Write-Host 'Expo module/CMake path normalization is already current.'
}
