# scripts/android-run.ps1
# Instala y lanza StopBet en un dispositivo Android físico o emulador.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\android-run.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\android-run.ps1 -ResetCache
#   powershell -ExecutionPolicy Bypass -File scripts\android-run.ps1 -SkipBuild
#
# Flags:
#   -ResetCache   Limpia la caché de Metro antes de arrancar (útil si hay errores raros)
#   -SkipBuild    Solo recarga la app sin recompilar el APK (builds posteriores)

param(
    [switch]$ResetCache,
    [switch]$SkipBuild
)

# 'Continue' en vez de 'Stop': los ejecutables nativos escriben a stderr normalmente
# y no deben hacer crashear el script (adb, java, gradle, etc.)
$ErrorActionPreference = 'Continue'
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$MobileDir  = Join-Path $RepoRoot "apps\mobile"

# Workaround: el path largo de OneDrive supera los 260 chars de ninja.
# Creamos un drive virtual S: con un path corto y compilamos desde ahi.
if ($RepoRoot -notmatch '^S:\\') {
    subst S: $RepoRoot 2>$null
    $ScriptInS = "S:\scripts\android-run.ps1"
    if (Test-Path $ScriptInS) {
        # Pasar el path real (C:\...) para que metro.config.js lo agregue a watchFolders.
        # pnpm usa junctions en Windows: Node sigue el junction y __dirname queda en C:\...
        # aunque Metro arranque desde S:\. Sin esto Metro no puede calcular el SHA-1.
        $env:STOPBET_REAL_ROOT = $RepoRoot
        $forwardArgs = @()
        if ($ResetCache) { $forwardArgs += '-ResetCache' }
        if ($SkipBuild)  { $forwardArgs += '-SkipBuild' }
        & powershell -ExecutionPolicy Bypass -File $ScriptInS @forwardArgs
        exit $LASTEXITCODE
    }
}

function Write-Step ([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   ([string]$msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn ([string]$msg) { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Exit-Error ([string]$msg) { Write-Host "`n  [ERROR] $msg`n" -ForegroundColor Red; exit 1 }

Write-Host "`n  StopBet - Android Runner" -ForegroundColor White
Write-Host "  ==========================`n" -ForegroundColor DarkGray

# ── 0. Configurar ANDROID_HOME y PATH ────────────────────────────────────────
if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = "$env:USERPROFILE\AppData\Local\Android\Sdk"
}
$platformTools = Join-Path $env:ANDROID_HOME "platform-tools"
$emulatorDir   = Join-Path $env:ANDROID_HOME "emulator"
if ($env:PATH -notlike "*platform-tools*") {
    $env:PATH = "$platformTools;$emulatorDir;" + $env:PATH
}

# ── 1. Verificar ADB ─────────────────────────────────────────────────────────
Write-Step "Verificando ADB..."
if (-not (Get-Command "adb" -ErrorAction SilentlyContinue)) {
    Exit-Error "ADB no encontrado. Instala Android Studio y agrega platform-tools al PATH."
}

# ── 2. Detectar dispositivo o arrancar emulador ───────────────────────────────
Write-Step "Buscando dispositivo Android..."

$adbOut   = adb devices 2>&1
$adbLines = $adbOut | Where-Object { $_ -match "`tdevice$" }

if (-not $adbLines) {
    Write-Warn "No hay dispositivo conectado. Buscando emulador AVD..."

    $avdList = & (Join-Path $env:ANDROID_HOME "emulator\emulator.exe") -list-avds 2>&1 |
               Where-Object { $_ -match '\S' }

    if (-not $avdList) {
        Exit-Error "No hay dispositivo USB ni AVD creado. Crea un emulador en Android Studio > Device Manager."
    }

    $avdName = $avdList | Select-Object -First 1
    Write-Warn "Arrancando emulador '$avdName' (puede tardar ~30s)..."
    Start-Process -FilePath (Join-Path $env:ANDROID_HOME "emulator\emulator.exe") `
                  -ArgumentList "-avd", $avdName, "-no-snapshot-load" `
                  -WindowStyle Normal

    Write-Host "  Esperando que el emulador quede listo..." -ForegroundColor DarkGray
    $timeout = 120
    $elapsed = 0
    do {
        Start-Sleep -Seconds 5
        $elapsed += 5
        $adbOut   = adb devices 2>&1
        $adbLines = $adbOut | Where-Object { $_ -match "`tdevice$" }
    } while ((-not $adbLines) -and ($elapsed -lt $timeout))

    if (-not $adbLines) {
        Exit-Error "El emulador no respondio en $timeout segundos. Abrir Android Studio > Device Manager y arrancarlo manualmente."
    }
}

$deviceId = ($adbLines | Select-Object -First 1) -replace "`tdevice", ""
Write-OK "Dispositivo: $deviceId"

# ── 3. Detectar o instalar Java 17+ ──────────────────────────────────────────
Write-Step "Buscando Java 17+..."

function Get-ValidJavaHome {
    $patterns = @(
        "C:\Program Files\Android\Android Studio\jbr*",
        "C:\Program Files\Microsoft\jdk-17*",
        "C:\Program Files\Microsoft\jdk-21*",
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Eclipse Adoptium\jdk-21*",
        "C:\Program Files\Java\jdk-17*",
        "C:\Program Files\Java\jdk-21*",
        "C:\Program Files\OpenJDK\jdk-17*",
        "C:\Program Files\OpenJDK\jdk-21*"
    )
    foreach ($pattern in $patterns) {
        $dirs = Get-ChildItem $pattern -ErrorAction SilentlyContinue | Sort-Object Name -Descending
        foreach ($dir in $dirs) {
            $javaExe = Join-Path $dir.FullName "bin\java.exe"
            if (-not (Test-Path $javaExe)) { continue }
            $versionOut = & $javaExe -version 2>&1 | Out-String
            if ($versionOut -match '"(\d+)') {
                if ([int]$Matches[1] -ge 17) { return $dir.FullName }
            }
        }
    }
    return $null
}

$javaHome = Get-ValidJavaHome
if (-not $javaHome) {
    Write-Warn "Java 17+ no encontrado. Instalando Microsoft OpenJDK 17 via winget..."
    winget install Microsoft.OpenJDK.17 --accept-source-agreements --accept-package-agreements
    $javaHome = Get-ValidJavaHome
    if (-not $javaHome) {
        Exit-Error "No se pudo instalar Java 17. Instalalo desde: https://learn.microsoft.com/java/openjdk/download"
    }
}

$env:JAVA_HOME = $javaHome
$env:PATH      = "$javaHome\bin;" + $env:PATH
Write-OK "JAVA_HOME: $javaHome"

# ── 4. Verificar dependencias pnpm ────────────────────────────────────────────
Write-Step "Verificando dependencias pnpm..."
if (-not (Test-Path (Join-Path $MobileDir "node_modules"))) {
    Write-Warn "node_modules ausente. Ejecutando pnpm install..."
    Set-Location $RepoRoot
    pnpm install
    Set-Location $RepoRoot
}
Write-OK "Dependencias OK"

# ── 5. Configurar ADB reverse ─────────────────────────────────────────────────
Write-Step "Configurando puertos ADB reverse..."
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:3000 tcp:3000 | Out-Null
Write-OK "Puerto 8081 (Metro) y 3000 (Backend) -> PC"

# ── 6. Iniciar Metro en ventana CMD separada ──────────────────────────────────
Write-Step "Iniciando Metro bundler..."

$metroFlags  = if ($ResetCache) { "--port 8081 --reset-cache" } else { "--port 8081" }

# Metro debe correr desde el path REAL (C:\...), no desde S:\.
# pnpm usa junctions: Node los sigue y __dirname queda en C:\... aunque corra desde S:\.
# Si Metro vigila S:\ pero los archivos se resuelven a C:\... el SHA-1 falla.
# Gradle sí necesita S:\ (ninja tiene limite de 260 chars), pero Metro no.
$metroDir = if ($env:STOPBET_REAL_ROOT) { Join-Path $env:STOPBET_REAL_ROOT "apps\mobile" } else { $MobileDir }
$metroScript = "cd /d `"$metroDir`" && npx react-native start $metroFlags"

Start-Process "cmd.exe" -ArgumentList "/k title Metro - StopBet && $metroScript" -WindowStyle Normal
Write-OK "Metro abierto en ventana separada (no cerrarla mientras usas la app)"
Start-Sleep -Seconds 4

# ── 7. Compilar e instalar el APK ─────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Step "Compilando e instalando APK debug (primera vez: ~5-15 min)..."
    Set-Location (Join-Path $MobileDir "android")
    .\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
    if ($LASTEXITCODE -ne 0) {
        Set-Location $RepoRoot
        Exit-Error "Gradle fallo (exit $LASTEXITCODE). Revisa el output de arriba."
    }
    Set-Location $RepoRoot
} else {
    Write-Warn "SkipBuild activo: omitiendo compilacion del APK"
}

# ── 8. Restablecer ADB reverse (puede perderse durante el build) ──────────────
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:3000 tcp:3000 | Out-Null

# ── 9. Lanzar la app en el dispositivo ────────────────────────────────────────
Write-Step "Lanzando StopBet en el dispositivo..."
adb shell am force-stop com.stopbet
Start-Sleep -Seconds 1
adb shell am start -n com.stopbet/.MainActivity

Write-Host @"

  =====================================================
  StopBet esta corriendo en $deviceId
  =====================================================

  Metro: ventana CMD separada (no cerrarla)
  Backend: pnpm run backend (para datos reales)
  Recargar app: sacudir el dispositivo > Reload

  Proximas veces (sin recompilar APK):
    powershell -ExecutionPolicy Bypass -File scripts\android-run.ps1 -SkipBuild

"@ -ForegroundColor Green
