<#
.SYNOPSIS
  Builds the Windows installer for the Siriso PDF desktop app (Siriso-PDF-Setup-<version>.exe).

.DESCRIPTION
  1. Packages the CEF launcher with Gradle (installDist) around a core backend JAR that has the web UI.
  2. Links a Java runtime with jlink. It keeps bin\java.exe, which the launcher uses to start the backend.
  3. Builds the app image with jpackage ("Siriso PDF.exe", no console window).
  4. Compiles siriso-pdf.iss with Inno Setup 6.

  Build the backend first (from the repository root):
    gradlew.bat :stirling-pdf:bootJar -PbuildWithFrontend=true -PbuildWithPortal=false -PfrontendMode=core

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File desktop\cef\installer\build-installer.ps1 -Version 1.0.0
#>
param(
    [string]$Version = '1.0.0',
    [string]$BackendJar = '',
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$InnoSetup = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
)
$ErrorActionPreference = 'Stop'

$installerDir = $PSScriptRoot
$cefDir = Split-Path $installerDir -Parent
$repo = (Resolve-Path (Join-Path $cefDir '..\..')).Path
$work = Join-Path $cefDir 'build\installer'

if (-not $JavaHome -or -not (Test-Path (Join-Path $JavaHome 'bin\jpackage.exe'))) {
    throw 'Set -JavaHome (or JAVA_HOME) to a JDK 25 that includes jlink and jpackage.'
}
if (-not (Test-Path $InnoSetup)) { throw "Inno Setup compiler not found: $InnoSetup" }
if (-not $BackendJar) {
    $BackendJar = Get-ChildItem (Join-Path $repo 'app\core\build\libs') -Filter 'stirling-pdf-*.jar' |
        Where-Object { $_.Name -notlike '*-plain.jar' } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $BackendJar -or -not (Test-Path $BackendJar)) { throw 'Backend JAR not found; build it first or pass -BackendJar.' }
$BackendJar = (Resolve-Path $BackendJar).Path
$env:JAVA_HOME = $JavaHome

function Invoke-Checked([string]$what, [scriptblock]$command) {
    Write-Host "== $what"
    & $command
    if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" }
}

if (Test-Path $work) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Force $work | Out-Null

# 1. Launcher distribution: lib\ holds the launcher, JCEF and the CEF natives; backend\ holds the server.
[Environment]::CurrentDirectory = $repo
Invoke-Checked 'Gradle installDist' {
    & (Join-Path $repo 'gradlew.bat') -p $cefDir installDist "-PbackendJar=$BackendJar" --no-daemon
}
$dist = Join-Path $cefDir 'build\install\siriso-pdf-cef'
$launcherJar = 'siriso-pdf-cef.jar'
if (-not (Test-Path (Join-Path $dist "lib\$launcherJar"))) { throw "Launcher JAR missing in $dist\lib" }

# 2. Runtime. Development-only modules are left out; everything an application may load stays.
$skip = '^(jdk\.(compiler|javadoc|jshell|jlink|jpackage|jdi|jdwp\.agent|hotspot\.agent|jconsole|jartool|jstatd|jcmd|editpad|jsobject|random|graal\.compiler|incubator\..*|internal\..*))$'
$modules = & (Join-Path $JavaHome 'bin\java.exe') --list-modules |
    ForEach-Object { ($_ -split '@')[0] } | Where-Object { $_ -notmatch $skip }
$runtime = Join-Path $work 'runtime'
Invoke-Checked 'jlink runtime' {
    & (Join-Path $JavaHome 'bin\jlink.exe') --add-modules ($modules -join ',') --strip-debug `
        --no-header-files --no-man-pages --compress=zip-6 --output $runtime
}

# 3. App image. Launcher.java resolves backend\ and launcher.properties two levels above its JAR
#    (image\app\siriso-pdf-cef.jar -> image\), so the backend is copied next to app\ and runtime\.
$imageRoot = Join-Path $work 'image'
Invoke-Checked 'jpackage app-image' {
    & (Join-Path $JavaHome 'bin\jpackage.exe') --type app-image --dest $imageRoot `
        --name 'Siriso PDF' --app-version $Version --vendor 'Siriso Lab' `
        --description 'Siriso PDF desktop' --icon (Join-Path $installerDir 'siriso.ico') `
        --input (Join-Path $dist 'lib') --main-jar $launcherJar --main-class stirling.cef.Launcher `
        --runtime-image $runtime --java-options '--enable-native-access=ALL-UNNAMED'
}
$image = Join-Path $imageRoot 'Siriso PDF'
Copy-Item -Recurse (Join-Path $dist 'backend') (Join-Path $image 'backend')
Copy-Item -Recurse (Join-Path $dist 'licenses') (Join-Path $image 'licenses')
Copy-Item (Join-Path $dist 'launcher.properties.example') $image

# 4. Installer.
$out = Join-Path $work 'output'
Invoke-Checked 'Inno Setup' {
    & $InnoSetup /Q "/DAppImage=$image" "/DAppVersion=$Version" "/DOutputDir=$out" (Join-Path $installerDir 'siriso-pdf.iss')
}
$setup = Join-Path $out "Siriso-PDF-Setup-$Version.exe"
$hash = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()
Write-Host ("Installer: {0} ({1:N1} MB)" -f $setup, ((Get-Item $setup).Length / 1MB))
Write-Host "SHA-256:   $hash"
