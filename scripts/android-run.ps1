# scripts/android-run.ps1
# Instala y lanza StopBet en un dispositivo Android físico conectado por USB.
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

$ErrorActionPreference = 'Stop'
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$MobileDir  = Join-Path $RepoRoot "apps\mobile"

function Write-Step ([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   ([string]$msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn ([string]$msg) { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Exit-Error ([string]$msg) { Write-Host "`n  [ERROR] $msg`n" -ForegroundColor Red; exit 1 }

Write-Host "`n  StopBet - Android Device Runner" -ForegroundColor White
Write-Host "  ================================`n" -ForegroundColor DarkGray

# ── 1. Verificar ADB y dispositivo conectado ─────────────────────────────────
Write-Step "Verificando dispositivo Android..."

if (-not (Get-Command "adb" -ErrorAction SilentlyContinue)) {
    Exit-Error @"
ADB no encontrado en PATH.
  1) Instala Android Studio: https://developer.android.com/studio
  2) Agrega al PATH: C:\Users\<tu-usuario>\AppData\Local\Android\Sdk\platform-tools
"@
}

$adbLines   = adb devices 2>&1 | Where-Object { $_ -match "`tdevice$" }
if (-not $adbLines) {
    Exit-Error @"
No hay ningun dispositivo Android conectado.
  1) Conecta tu celular con cable USB
  2) En el celular: Ajustes > Opciones de desarrollador > Depuracion USB (ON)
  3) Acepta la ventana de autorizacion que aparece en el celular
  4) Vuelve a ejecutar este script
"@
}
$deviceId = ($adbLines | Select-Object -First 1) -replace "`tdevice", ""
Write-OK "Dispositivo: $deviceId"

# ── 2. Detectar o instalar Java 17+ ─────────────────────────────────────────
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
        $dirs = Get-ChildItem $pattern -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending
        foreach ($dir in $dirs) {
            $javaExe = Join-Path $dir.FullName "bin\java.exe"
            if (-not (Test-Path $javaExe)) { continue }
            # java -version writes to stderr; suppress NativeCommandError in PS5.1
            $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
            $versionOut = & $javaExe -version 2>&1 | Out-String
            $ErrorActionPreference = $prev
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
        Exit-Error @"
No se pudo instalar Java 17 automaticamente.
Instalalo manualmente desde: https://learn.microsoft.com/java/openjdk/download
"@
    }
}

$env:JAVA_HOME = $javaHome
$env:PATH      = "$javaHome\bin;" + $env:PATH
Write-OK "JAVA_HOME: $javaHome"

# ── 3. Verificar dependencias pnpm ───────────────────────────────────────────
Write-Step "Verificando dependencias pnpm..."
if (-not (Test-Path (Join-Path $MobileDir "node_modules"))) {
    Write-Warn "node_modules ausente. Ejecutando pnpm install..."
    Set-Location $RepoRoot
    pnpm install
    Set-Location $RepoRoot
}
Write-OK "Dependencias OK"

# ── 4. Configurar ADB reverse ────────────────────────────────────────────────
Write-Step "Configurando puertos ADB reverse..."
adb reverse tcp:8081 tcp:8081 | Out-Null   # Metro bundler
adb reverse tcp:3000 tcp:3000 | Out-Null   # Backend NestJS
Write-OK "Puerto 8081 (Metro) y 3000 (Backend) -> PC"

# ── 5. Iniciar Metro en ventana CMD separada ─────────────────────────────────
Write-Step "Iniciando Metro bundler..."

$metroFlags  = if ($ResetCache) { "--port 8081 --reset-cache" } else { "--port 8081" }
$metroScript = "cd /d `"$MobileDir`" && npx react-native start $metroFlags"

Start-Process "cmd.exe" -ArgumentList "/k title Metro - StopBet && $metroScript" -WindowStyle Normal
Write-OK "Metro abierto en ventana separada (mantenerla abierta mientras usas la app)"
Start-Sleep -Seconds 4

# ── 6. Compilar e instalar el APK ────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Step "Compilando e instalando APK debug (primera vez: ~5-15 min)..."
    Set-Location (Join-Path $MobileDir "android")
    .\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
    Set-Location $RepoRoot
} else {
    Write-Warn "SkipBuild activo: omitiendo compilacion del APK"
}

# ── 7. Restablecer ADB reverse (puede perderse durante el build) ─────────────
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:3000 tcp:3000 | Out-Null

# ── 8. Lanzar la app en el dispositivo ───────────────────────────────────────
Write-Step "Lanzando StopBet en el dispositivo..."
adb shell am force-stop com.stopbet
Start-Sleep -Seconds 1
adb shell am start -n com.stopbet/.MainActivity

Write-Host @"

  =====================================================
  StopBet esta corriendo en $deviceId
  =====================================================

  Metro: ventana CMD separada (no cerrarla)
  Backend: ejecutar 'pnpm run backend' para datos reales
  Recargar app: sacudir el celular > Reload

  Proximas veces (sin recompilar APK):
    powershell -ExecutionPolicy Bypass -File scripts\android-run.ps1 -SkipBuild

"@ -ForegroundColor Green
