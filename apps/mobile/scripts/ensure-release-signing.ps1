param(
  [string]$SigningDirectory = (Join-Path $env:USERPROFILE '.fieldrelay-release')
)

$ErrorActionPreference = 'Stop'

function New-RandomHexSecret([int]$ByteCount = 32) {
  $bytes = New-Object byte[] $ByteCount
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

$keytool = (Get-Command keytool.exe -ErrorAction SilentlyContinue).Source
if (-not $keytool) {
  throw 'keytool.exe was not found. Install or select a JDK before creating release signing material.'
}

$signingDirectoryFull = [System.IO.Path]::GetFullPath($SigningDirectory)
$keystorePath = Join-Path $signingDirectoryFull 'fieldrelay-portfolio.jks'
$propertiesPath = Join-Path $signingDirectoryFull 'signing.properties'
$keyAlias = 'fieldrelay-portfolio'

$keystoreExists = Test-Path -LiteralPath $keystorePath
$propertiesExist = Test-Path -LiteralPath $propertiesPath
if ($keystoreExists -xor $propertiesExist) {
  throw "Incomplete FieldRelay signing state under $signingDirectoryFull. Preserve or restore the matching keystore and properties file."
}

if (-not $keystoreExists) {
  New-Item -ItemType Directory -Force -Path $signingDirectoryFull | Out-Null
  $password = New-RandomHexSecret

  & $keytool -genkeypair -noprompt `
    -keystore $keystorePath `
    -storetype JKS `
    -storepass $password `
    -keypass $password `
    -alias $keyAlias `
    -keyalg RSA `
    -keysize 3072 `
    -validity 10000 `
    -dname 'CN=FieldRelay Portfolio, OU=Software Portfolio, O=Yazan Baker, C=JO' *> $null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $keystorePath)) {
    throw 'keytool could not create the FieldRelay portfolio keystore.'
  }

  $portableKeystorePath = $keystorePath.Replace('\', '/')
  $properties = @(
    "storeFile=$portableKeystorePath"
    "storePassword=$password"
    "keyAlias=$keyAlias"
    "keyPassword=$password"
  ) -join [Environment]::NewLine
  [System.IO.File]::WriteAllText(
    $propertiesPath,
    "$properties$([Environment]::NewLine)",
    [System.Text.UTF8Encoding]::new($false)
  )

  $currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $signingDirectoryFull /inheritance:r /grant:r "${currentIdentity}:(OI)(CI)F" *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'Signing files were created, but their Windows ACL could not be restricted to the current user.'
  }

  Write-Host "Created dedicated FieldRelay signing material outside the repository at $signingDirectoryFull"
} else {
  Write-Host "Using the existing FieldRelay signing material at $signingDirectoryFull"
}

Write-Output $propertiesPath
