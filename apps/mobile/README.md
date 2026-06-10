# StopBet Mobile

App del paciente — **React Native CLI 0.86** (sin Expo). Prioridad **Android** en el MVP; iOS pendiente.

> **Estado:** la app **compila y corre en dispositivo Android físico** (probada en Samsung A31, Android 12) conectada al backend local. Mientras no exista módulo de autenticación, usa un **usuario demo fijo** (ver más abajo).

## Requisitos

- Node.js >= 20 y **pnpm** (el monorepo usa pnpm, no npm)
- JDK 17 (Gradle lo exige)
- Android Studio con SDK + al menos una plataforma Android instalada
- `adb` en el PATH
- En el celular: Opciones de desarrollador → **Depuración USB** activada

## Cómo correr

La app le pega al backend en `http://localhost:3000`. En un dispositivo/emulador eso funciona gracias a `adb reverse`, así que **el backend debe estar corriendo** antes de abrir la app.

### Windows (script automático)

El script `scripts/android-run.ps1` hace todo: detecta el celular, configura `adb reverse`, abre Metro y compila.

```bash
pnpm run android:device         # primera vez o tras cambios nativos (~5-15 min, Gradle compila)
pnpm run android:reload         # veces siguientes (solo recarga JS, segundos)
pnpm run android:device:fresh   # si Metro se comporta raro (resetea caché)
```

### Linux / macOS (manual)

El script de arriba es **PowerShell, solo Windows**. En Linux/Mac los pasos son manuales, en terminales separadas:

```bash
# Terminal 1 — backend (desde la raíz del monorepo)
pnpm run backend

# Terminal 2 — Metro bundler (desde apps/mobile/)
npx react-native start

# Terminal 3 — puentes para que el dispositivo alcance el localhost del PC
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:3000 tcp:3000   # Backend

# Terminal 3 — compilar e instalar el APK (primera vez / cambios nativos)
npx react-native run-android
```

Tras la primera compilación, para recargar solo JS basta apretar **`r`** en la terminal de Metro.

## Gotchas del monorepo pnpm (importante)

Esto ya está resuelto en el repo, pero conviene entenderlo porque es la causa de los errores típicos:

- **Metro y los symlinks de pnpm.** pnpm guarda los paquetes en un store y los symlinkea. Metro no sigue esos symlinks por defecto, por eso `metro.config.js` agrega el `node_modules` **raíz** a `watchFolders` (si no, falla resolviendo `@babel/runtime`, etc.).
- **Gradle y las rutas hoisteadas.** Los `build.gradle` / `settings.gradle` apuntan a `../../../node_modules` (raíz del monorepo) para encontrar `@react-native/gradle-plugin` y el codegen. El `.npmrc` raíz tiene `public-hoist-pattern[]=*react-native*` por lo mismo.
- **RAM ajustada.** `metro.config.js` fija `maxWorkers: 2`. En máquinas con ~8 GB, los 8 workers por defecto saturan la RAM en la serialización final del bundle y el SO mata procesos. Además: **levantar el backend después** de que Metro termine el bundle pesado, no antes.
- **`adb reverse` se cae.** Si el daemon de `adb` se reinicia (o tras un crash/OOM), se pierden los puentes y la app queda en gris sin poder alcanzar Metro. Solución: volver a correr los dos `adb reverse`.

## Usuario demo (sin autenticación todavía)

No hay login aún. Las 5 pantallas que consultan el backend (`HomeScreen`, `AchievementsScreen`, `PanicScreen`, `CommunityScreen`, `SuspendedAccountScreen`) tienen hardcodeado:

```ts
const TEMP_USER_ID = '11111111-1111-1111-1111-111111111111';
```

Ese usuario (Carlos, racha de 45 días) **debe existir en la tabla `users`** de la base `stopbet`. Si los endpoints devuelven **500**, lo más probable es que el usuario demo no esté en la BD (hoy se crea con SQL manual; aún no hay seeder). El backend espera un UUID válido en `users.id`: un string que no sea UUID da 500, no 404.

## Estructura

```
apps/mobile/
├── android/          # Código nativo Android (versionado; aquí irá el VPNService)
├── src/
│   ├── screens/      # Pantallas
│   ├── components/   # Componentes reutilizables
│   ├── navigation/   # React Navigation v7
│   ├── services/     # api.ts (BASE_URL = http://localhost:3000), FCM, VPN
│   ├── store/        # Estado global (Zustand)
│   └── constants/    # Colores, etc.
├── metro.config.js   # watchFolders + maxWorkers (ver gotchas)
└── App.tsx
```

## Notas de arquitectura

- **VPNService de Android:** el filtrado DNS on-device se implementará como módulo nativo en `android/`. Requiere permiso `BIND_VPN_SERVICE`. Por esto `android/` **se versiona** y no se ignora.
- **FCM:** notificaciones JITAI vía `@react-native-firebase/messaging`.
- **MVP prioriza Android** (~77% de market share en Chile, Statcounter marzo 2026).
