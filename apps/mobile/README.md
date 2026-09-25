# StopBet Mobile

App móvil de StopBet - **React Native CLI 0.86** (sin Expo). Prioridad **Android** en el MVP; iOS pendiente.

> **Estado:** la app **compila y corre en dispositivo Android físico y en emulador**. Un mismo binario sirve a dos perfiles: el **paciente** y el **equipo clínico** (psicólogo), cada uno con su propia navegación tras el login (ver [Cuentas de prueba](#cuentas-de-prueba)).

## Requisitos

- Node.js >= 20 y **pnpm** (el monorepo usa pnpm, no npm)
- JDK 17 (Gradle lo exige)
- Android Studio con SDK + al menos una plataforma Android instalada
- `adb` en el PATH
- En el celular: Opciones de desarrollador → **Depuración USB** activada
- **`android/app/google-services.json`** (configuración de Firebase) - **no viene en el repo**, ver abajo

### `google-services.json` (obligatorio para compilar)

El archivo está en `.gitignore` porque identifica el proyecto de Firebase del equipo, pero
`android/app/build.gradle` aplica el plugin `com.google.gms.google-services` siempre. Sin el
archivo, la compilación se detiene con:

```
Execution failed for task ':app:processDebugGoogleServices'.
> File google-services.json is missing.
  The Google Services Plugin cannot function without it.
```

Hay dos formas de conseguirlo y dejarlo en `apps/mobile/android/app/google-services.json`:

1. **Pedírselo al equipo** por un canal privado. No se sube nunca al repo.
2. **Generar uno propio:** en la [consola de Firebase](https://console.firebase.google.com),
   crear un proyecto, agregarle una app Android con el nombre de paquete **`com.stopbet`** y
   descargar el `google-services.json`. La app compila y corre igual; lo único que cambia es
   que las notificaciones push enviadas por el backend del equipo no llegarán, porque ese
   backend usa las credenciales de otro proyecto de Firebase.

En CI no hace falta el archivo: `mobile-preview.yml` lo arma desde el secret `GOOGLE_SERVICES_JSON`.

## Cómo correr

La app le pega al backend en `http://localhost:3000`. En un dispositivo/emulador eso funciona gracias a `adb reverse`, así que **el backend debe estar corriendo** antes de abrir la app.

> ⚠️ **`shared-types` hay que compilarlo.** La app importa funciones de
> `@stopbet/shared-types` (validador de RUT y de fechas), y esas viven en `dist/`, que está
> en `.gitignore` y **no viene en el pull**. `pnpm run backend` lo compila solo, así que si
> partes por ahí no tienes que hacer nada. Si levantas **solo Metro**, antes corre desde la
> raíz:
>
> ```bash
> pnpm --filter @stopbet/shared-types build
> ```
>
> Sin esto: con un `dist/` viejo la app arranca y revienta con `formatRut is not a function`
> al escribir el RUT en el registro; sin `dist/` Metro no resuelve el módulo y falla el
> bundle entero.

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
# Terminal 1 - backend (desde la raíz del monorepo)
pnpm run backend

# Terminal 2 - Metro bundler (desde apps/mobile/)
npx react-native start

# Terminal 3 - puentes para que el dispositivo alcance el localhost del PC
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:3000 tcp:3000   # Backend

# Terminal 3 - compilar e instalar el APK (primera vez / cambios nativos)
npx react-native run-android
```

Tras la primera compilación, para recargar solo JS basta apretar **`r`** en la terminal de Metro.

## Gotchas del monorepo pnpm (importante)

Esto ya está resuelto en el repo, pero conviene entenderlo porque es la causa de los errores típicos:

- **Metro y los symlinks de pnpm.** pnpm guarda los paquetes en un store y los symlinkea. Metro no sigue esos symlinks por defecto, por eso `metro.config.js` agrega el `node_modules` **raíz** a `watchFolders` (si no, falla resolviendo `@babel/runtime`, etc.).
- **Gradle y las rutas hoisteadas.** Los `build.gradle` / `settings.gradle` apuntan a `../../../node_modules` (raíz del monorepo) para encontrar `@react-native/gradle-plugin` y el codegen. El `.npmrc` raíz tiene `public-hoist-pattern[]=*react-native*` por lo mismo.
- **RAM ajustada.** `metro.config.js` fija `maxWorkers: 2`. En máquinas con ~8 GB, los 8 workers por defecto saturan la RAM en la serialización final del bundle y el SO mata procesos. Además: **levantar el backend después** de que Metro termine el bundle pesado, no antes.
- **`adb reverse` se cae.** Si el daemon de `adb` se reinicia (o tras un crash/OOM), se pierden los puentes y la app queda en gris sin poder alcanzar Metro. Solución: volver a correr los dos `adb reverse`.
- **Un campo que se reformatea solo (RUT, tarjeta, etc.) puede duplicar lo tecleado en Android.** Si `onChangeText` reescribe el `value` completo (puntos, guiones), un teclado con texto predictivo activado pierde su región de composición y vuelve a soltar el buffer entero: tecleando `123` el campo termina en `123123123...`. Pasó en el RUT del registro (HU-06, PR #86); con predicción apagada, con teclado físico, o con `adb shell input text` (que no pasa por el teclado) **no se reproduce**. Para probarlo hay que tocar las teclas en pantalla con texto predictivo encendido. `autoCorrect={false}` no basta en todos los teclados (el de Samsung lo ignora); `keyboardType="visible-password"` sí corta la composición porque Android trata cualquier campo de contraseña como no editable por el predictivo.

## Cuentas de prueba

La app tiene **login real**: `LoginScreen` valida contra `POST /auth/login`, la sesión (access
y refresh token) se guarda en `AsyncStorage` y sobrevive a cerrar la app, y el token se renueva
solo cuando el backend responde 401. Cada pantalla toma el usuario de la sesión, no de un id
fijo.

Para tener cuentas con qué entrar, pobla la base desde la raíz del monorepo:

```bash
pnpm run seed
```

Es idempotente: puedes correrlo cuantas veces quieras sin duplicar datos. Todas las cuentas
quedan con la misma **clave de desarrollo: `Stopbet2026!`**.

| Correo | Rol | Qué ve en la app |
|---|---|---|
| `demo@stopbet.cl` | Paciente | Inicio, pánico, check-in, asistente, logros, comunidad y perfil |
| `miguel.lara@ajuter.cl` | Psicólogo | Resumen de su sede (solo lectura), comunidad con anuncios y moderación, perfil |

**Quién entra y a dónde.** `/auth/login` no filtra por rol; lo decide `App.tsx`:

- `patient` → app del paciente.
- `psychologist` → vista del equipo clínico (Resumen · Comunidad · Perfil), sin pánico,
  asistente ni check-in.
- `coordinator`, `sponsor` y `family` → la app rechaza el acceso. La coordinación y los
  familiares usan el dashboard web.

Una cuenta suspendida recibe 403 y ve un mensaje propio, no "credenciales incorrectas".

**Contra qué backend.** En modo desarrollo (`__DEV__`) la app le pega a
`http://localhost:3000` a través de `adb reverse`; en un build de release usa el backend
desplegado en Railway (`src/services/api.ts`). Si el login dice que no hay conexión con el
backend local corriendo, revisa primero `adb reverse --list`.

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
