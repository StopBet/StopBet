# CLAUDE.md — Reglas del proyecto StopBet

Plataforma clínica para tratamiento de ludopatía. Datos de pacientes son **sensibles**; cualquier decisión de arquitectura que afecte privacidad o seguridad debe ser explícita.

## Estado actual

> _Actualizado 2026-08-26. Mantener al día tras cambios significativos (ver [Trabajando con Claude Code](#trabajando-con-claude-code))._

- **Mobile** (React Native CLI 0.86): compila y corre en Android físico y en emulador. Flujo y *gotchas* del monorepo en `apps/mobile/README.md`. El check-in se encola en `AsyncStorage` si no hay red y se reintenta al reconectar; el asistente muestra una tarjeta de crisis (pánico / padrino / `*4141`) ante riesgo alto, y un mensaje de respaldo dentro del hilo si el envío falla.
  - ⚠️ **`BASE_URL` está hardcodeado a `http://localhost:3000`** (`src/services/api.ts`). La app **solo** llega al backend por el túnel `adb reverse` desde el computador de cada uno: **en un celular real, contra la nube, no se conecta a nada.** Arreglo: `__DEV__ ? localhost : <url-railway>` — falta la URL pública de Railway. React Native no lee `.env` sin una librería extra, así que va en el código.
- **Auth real, con el dashboard web ya migrado**: módulo `auth` con JWT (`POST /auth/login`, `/auth/refresh` con rotación, `/auth/logout`), `JwtAuthGuard` + `RolesGuard` + `@Roles()` + `@CurrentUser()` en `common/`. Rol `coordinator` agregado. `POST /users/login` **fue eliminado** — no verificaba la contraseña. `/auth/login` **no filtra por rol**: quién entra a la web se decide en `LoginPage.tsx` (psicólogo, coordinador y familiar).
  - ⚠️ **Solo 3 controladores de 17 tienen guard**: `family`, `metrics` y `users`. El resto **sigue leyendo `x-user-id` sin verificar**. `GET /registration/pending` y `GET /panic/alerts/history` se cerraron por método porque devolvían nombres y correos de pacientes sin pedir token; los demás siguen abiertos. Registrar `JwtAuthGuard` como guard global (con `@Public()` donde corresponda) sigue pendiente — ver `docs/security/permissions-matrix.md`.
  - **`apps/mobile` sigue sin migrar** a `Authorization: Bearer`.
- **Backend** (NestJS): módulos `achievements`, `ai-assistant`, `auth`, `billing`, `check-ins`, `community`, `family`, `health`, `notifications`, `panic`, `push`, `registration`, `sedes`, `subscriptions`, `users`. `GET /health` verifica la conexión real a la BD (antes era un `{status:'ok'}` fijo) y alerta a un webhook de Discord ante caída — inactivo hasta que el equipo configure `DISCORD_ALERT_WEBHOOK_URL`. El RUT (`User.rut`) se cifra en reposo (AES-256-GCM). Nuevos endpoints para el dashboard web: `GET /users/patients`, `GET /registration/pending`, `GET /panic/alerts/history`.
- **Web dashboard**: vistas del terapeuta (login, Overview, Alertas, Finanzas, Solicitudes, Sesiones de familiares, Configuración) conectadas a la API real con TanStack Query (`@tanstack/react-query`). `Finanzas` y `Configuración` siguen con datos mock. El cliente HTTP (`apps/web/src/services/api.ts`) manda `Authorization: Bearer` con refresh automático; quedan algunas llamadas con `x-user-id` para endpoints que aún no tienen guard.
  - **Portal del familiar** (`src/pages/familiar/`): app aparte del shell clínico, no rutas dentro de `DashboardApp`. `App.tsx` bifurca por `user.role === 'family'` antes del gate de psicólogo.
  - Las páginas usan **estilos en línea con las variables del tema** y el componente `WIcon`, no las clases de Tailwind que describe la sección de Design System más abajo.
- **CI**: `.github/workflows/backend-ci.yml` corre type-check, tests unitarios (con cobertura) y e2e en cada push/PR a `main` con un Postgres de servicio. `apps/backend/test/` tiene el primer e2e (`roles.e2e-spec.ts`).
- **DB local**: datos de prueba en PostgreSQL (usuario `postgres`, pass `password`, db `stopbet`) creados con `pnpm run seed` — 9 usuarios (patient/sponsor/psychologist/coordinator), todos con la misma clave de desarrollo `Stopbet2026!`. El script viejo `python scripts/populate_db.py` sigue existiendo pero `pnpm run seed` es la vía actual.
- **Asistente IA**: modelo `gemini-3.5-flash-lite` (el anterior, `gemini-2.5-flash-lite`, empezó a devolver 404 para cuentas nuevas y el asistente caía al mensaje de respaldo en cada mensaje **sin que nada lo delatara**). Requiere una `GEMINI_API_KEY` válida: sin ella todo cae al respaldo y los resúmenes clínicos quedan sin evaluar. El `riskLevel` del resumen ahora es `RiskLevel | null` — **`null` significa "no se pudo evaluar", distinto de `'low'`, que significa "evaluado y sin riesgo"**. Las reglas de tono y las 3 conversaciones de prueba están en `docs/reglas-asistente.md`. Ojo: el tono depende del LLM y **no es determinista** — en un muestreo de 3 corridas, una se pasó del límite de 2-4 frases del documento.
- **CI mobile**: `.github/workflows/mobile-preview.yml` **volvió a dispararse solo** en push a `main`. El diagnóstico anterior ("`react-native@0.86` ya no publica `hermesc`, no tiene arreglo") era falso: el binario se movió a un paquete propio, `hermes-compiler`, que ya estaba en el lockfile. El workflow apuntaba con `chmod` a la ruta vieja y se tragaba el fallo con `|| true`. Corregido en `bbbec9d`.
- **Portal del familiar (HdU11)**: módulo `family` con vínculo familiar↔paciente, sesiones grupales por sede y confirmación de asistencia. Es el **único módulo del backend con guard en todos sus endpoints**. Dos avisos:
  - ⚠️ **Nadie aprueba los vínculos.** `requestLink` los crea en `pending` y no existe endpoint ni pantalla que los pase a `active`: solo lo hace `src/family/family.seed.ts`. En producción un familiar quedaría en "pendiente de vinculación" para siempre.
  - Datos de prueba, después de `pnpm run seed`: `pnpm run seed:family` desde la raíz. Sin correrlo, la demo no tiene cuentas de familiar. Crea los tres estados (vínculo activo con sesiones, pendiente, y activo sin sesiones próximas).
- **Deudas técnicas**:
  - ⚠️ **No hay ninguna migración en el repo, y por eso el backend de Railway corre con `NODE_ENV=development`** — se dejó así a propósito para que TypeORM cree el esquema con `synchronize`. Es decir: las tablas nuevas **sí** se crean en producción, pero al precio de violar la regla del propio proyecto ("nunca `synchronize: true` en producción"). Hay que resolverlo con migraciones reales **antes de manejar datos de pacientes de verdad**.
  - El servicio **`@stopbet/web` de Railway falla el deploy desde el 19/08**: healthcheck a `/health`, que no existe en un frontend estático. La web ya vive en Vercel, así que ese servicio probablemente sobra.
  - Borrar `apps/mobile/package-lock.json` (residuo de npm en repo pnpm); conectar `FinanzasPage` y `ConfiguracionPage` a la API; migrar `apps/mobile` de `x-user-id` a `Authorization: Bearer`; registrar `JwtAuthGuard` como guard global; **arreglar el `BASE_URL` de mobile** (ver arriba — bloquea mostrar la app contra la nube).
  - _Resueltas:_ seed del usuario demo; `GEMINI_API_KEY` opcional; dashboard web conectado a la API real y migrado a Bearer; módulo `auth`; los dos endpoints que respondían sin login (`/panic/alerts/history`, `/registration/pending`); **FCM implementado** (módulo `push` con `firebase-admin`, tabla `device_tokens`; requiere `FIREBASE_SERVICE_ACCOUNT_PATH` o `..._JSON`, y sin eso el backend arranca igual con los push desactivados).

## Estructura del monorepo

```
apps/web/        → Dashboard terapeuta: React 19 + Vite 6 + Tailwind v4 + Recharts
apps/backend/    → API: NestJS 10 + TypeORM + LangChain.js + PostgreSQL
apps/mobile/     → App paciente: React Native CLI 0.86 (corre en Android físico)
packages/shared-types/ → Tipos TS compartidos entre backend y web
```

## Convenciones de código

### General
- TypeScript estricto en todos los workspaces. No usar `any`; si es inevitable, comentar por qué.
- Nombres en inglés para código (variables, funciones, clases). Strings de UI en español.
- Sin comentarios que expliquen qué hace el código; solo comentar el **por qué** cuando no es obvio.

### Backend (NestJS)
- Un módulo NestJS por dominio: `auth`, `users`, `sessions`, `jitai`, `ai-assistant`.
- Guards para control de acceso por rol (`@Roles('psychologist')`, etc.). Nunca validar roles dentro de la lógica de servicio.
- DTOs con `class-validator` para toda entrada de datos. No confiar en datos del cliente.
- Entidades TypeORM en `src/<modulo>/entities/`. Migraciones explícitas, nunca `synchronize: true` en producción.
- Variables de entorno vía `ConfigService` de `@nestjs/config`. Nunca hardcodear secrets.
- Todos los endpoints documentados con decoradores `@ApiOperation`, `@ApiResponse` de Swagger.

### Web Dashboard (React + Vite)
- Componentes en `src/components/`, páginas en `src/pages/`.
- Estado servidor con TanStack Query (agregar cuando se conecte la API). Estado local con `useState`/`useReducer`.
- Tailwind v4: usar clases utilitarias directamente. No crear CSS custom salvo para animaciones complejas.
- Recharts para todas las visualizaciones de métricas JITAI.

#### Design System (paleta AJUTER)
El dashboard usa el tema AJUTER — naranja cálido institucional, no el teal verde base de StopBet.

> **Excepción: el login.** `LoginPage.tsx` va con la marca StopBet (azul `#396fb6`, Chillax y
> Satoshi) porque es la puerta común al panel clínico y al portal del familiar, y el familiar
> llega desde la app, no desde AJUTER. Sus tokens viven aparte en
> `src/styles/stopbet-brand.css` (prefijo `--sb-`) y **no** tocan el tema del shell. La paleta
> completa está en [`docs/manual-marca.md`](docs/manual-marca.md).

**Archivos:**
```
apps/web/src/styles/
├── fonts/               ← Fuentes self-hosted (woff2, ya en el repo)
│   ├── Inter-{400,600,700}.woff2
│   └── Nunito-{400,600,700}.woff2
├── colors_and_type.css  ← Tokens base + @font-face
└── ajuter-theme.css     ← Override de paleta para vistas AJUTER
```

**Regla:** usar siempre tokens semánticos de Tailwind, nunca colores genéricos.
```tsx
// ✅ correcto
<div className="bg-bg text-fg1">
<button className="bg-primary text-fg-on-primary">

// ❌ evitar
<div className="bg-orange-100 text-gray-900">
```

**Tokens principales:**
| Clase Tailwind | Hex | Uso |
|---|---|---|
| `bg-primary` / `text-primary` | `#E8883A` | Naranja AJUTER — acciones, headers |
| `bg-accent` / `text-accent` | `#F0B040` | Oro — CTAs, highlights |
| `bg-bg` | `#FAF7F4` | Fondo crema cálido |
| `bg-surface` | `#FFFFFF` | Tarjetas, modales |
| `text-fg1` | `#2A2624` | Texto principal |
| `text-fg2` | `#574F4A` | Texto secundario |
| `bg-danger` / `text-danger` | `#B83232` | Solo botón de pánico |

**Tipografía:**
- Headings: **Nunito** — `font-heading` o `style={{ fontFamily: 'var(--font-heading)' }}`
- Body/UI: **Inter** — `font-body` (aplicado globalmente en `body`)

### Mobile (React Native CLI)
- Navegación con React Navigation v7.
- Estado global con Zustand.
- Módulo nativo VPNService en `android/` para filtrado DNS on-device.
- FCM via `@react-native-firebase/messaging` para notificaciones JITAI.
- Prioridad Android en el MVP.

### Shared Types
- Todo tipo compartido entre backend y web vive en `packages/shared-types/src/index.ts`.
- Los tipos no deben importar dependencias externas.

## Seguridad clínica

- **Nunca loguear** datos identificables de pacientes (nombre, RUT, email) en logs del servidor.
- El asistente IA debe operar únicamente con el system prompt validado por AJUTER. No modificar sin revisión clínica.
- El botón de pánico debe tener ruta de escalada siempre disponible, incluso sin conexión.
- JWT con expiración corta (access: 15min, refresh: 7 días). Rotar refresh tokens en cada uso.

## Infraestructura

| Servicio | Plataforma | Configuración |
|---------|-----------|--------------|
| Dashboard web | Vercel | `vercel.json` en raíz |
| Backend + DB | Railway | `apps/backend/railway.toml` |
| Archivos (PDF, fotos) | Cloudflare R2 | API compatible S3 |

- Railway conecta automáticamente con GitHub para deploys en push a `main`.
- Vercel detecta `apps/web` via `vercel.json`.
- Variables de entorno de producción se configuran en los dashboards de Railway y Vercel, **nunca en el repo**.

## Formato de commits

Seguimos **Conventional Commits** con referencia a ticket Jira:

```
<tipo>(HU-XXX): <descripción en imperativo, español, máx 72 chars>

[cuerpo opcional — explica el POR QUÉ, no el qué]

[footer opcional: BREAKING CHANGE: ..., Closes HU-XXX]
```

### Tipos permitidos

| Tipo | Cuándo usarlo |
|------|--------------|
| `feat` | Nueva funcionalidad visible para el usuario |
| `fix` | Corrección de un bug |
| `docs` | Solo cambios en documentación |
| `style` | Formato, espacios, sin cambios de lógica |
| `refactor` | Restructuración de código sin feat ni fix |
| `test` | Agregar o corregir tests |
| `chore` | Mantenimiento: dependencias, configuración, build |
| `ci` | Cambios en pipelines CI/CD (Railway, Vercel, GitHub Actions) |
| `perf` | Mejoras de rendimiento |

### Reglas

- El ticket Jira **es obligatorio** en todo commit de feature/fix: `feat(HU-42): ...`
- Para commits que no corresponden a una historia (setup, hotfix urgente): omitir el ticket: `chore: actualizar dependencias`
- Descripción en **español**, en imperativo: "agregar" no "agregado", "corregir" no "corrige"
- Sin punto final en la descripción
- Si hay breaking change, indicarlo en el footer: `BREAKING CHANGE: <explicación>`

### Ejemplos válidos

```bash
feat(HU-12): agregar pantalla de login con autenticación JWT
fix(HU-34): corregir cálculo de riesgo en motor JITAI
docs: agregar instrucciones de setup mobile en README
chore: actualizar dependencias de seguridad en backend
refactor(HU-56): extraer lógica de notificaciones a módulo propio
test(HU-78): agregar tests unitarios para AppService
ci: configurar deploy automático en Railway
```

### Ejemplos inválidos

```bash
fix: arregle el bug           # ❌ no imperativo
feat: added login screen      # ❌ en inglés
feat: nueva pantalla.         # ❌ punto final
update stuff                  # ❌ sin tipo ni descripción clara
```

## Trabajando con Claude Code

- **No agregar el trailer `Co-Authored-By: Claude`** en los commits. El trabajo se atribuye únicamente al autor humano. (Cualquier integrante puede pedírselo explícitamente en la conversación; esta regla lo hace por defecto para todos.)
- **Mantener al día la sección "Estado actual"** de este archivo: tras un commit grande, mover muchos directorios, o cambios importantes en la estructura o el README, actualizar ese resumen. Así cualquier sesión nueva de Claude —de cualquier integrante— entiende el estado del proyecto al instante, sin reconstruirlo.
- **Anotar en `docs/avisos-al-equipo.md`** todo cambio que obligue a un compañero a hacer algo distinto después de pullear —un comando nuevo, una variable de entorno, un paso de build, un flujo que se movió de lugar— o que cambie un comportamiento visible lo bastante como para que alguien lo confunda con un bug. Va una entrada nueva **arriba del todo**, con fecha y PR, diciendo a quién le pega y qué tiene que correr. Si el cambio no le pide nada a nadie, **no va**: ese archivo sirve mientras se pueda leer entero en un minuto. Trabajamos 6 personas en ramas paralelas y nadie lee los diffs ajenos; esto es lo único que evita que alguien pierda una tarde buscando el problema donde no está.

## Flujo de sprints

1. Historias de usuario vinculadas en **Jira** antes de iniciar el sprint.
2. Rama por historia: `feature/HU-XXX-descripcion-corta`.
3. PR a `main` con al menos 1 reviewer.
4. Criterios de aceptación de la historia deben estar cubiertos en el PR.
5. `main` siempre deployable.

## Comandos frecuentes

> **Siempre `pnpm`.** `npm install` genera un `package-lock.json` que rompe el monorepo.

```bash
# Instalar todo
pnpm install

# Levantar web local
pnpm run web                   # http://localhost:5173

# Levantar backend local
pnpm run backend               # http://localhost:3000
                               # Swagger: http://localhost:3000/api/docs
                               # compila shared-types antes de arrancar

# Datos de prueba
pnpm run seed                  # 9 usuarios, clave Stopbet2026!
pnpm run seed:family           # cuentas del portal del familiar (correr después del seed)

# Compilar shared-types a mano (solo hace falta si levantas Metro sin el backend)
pnpm --filter @stopbet/shared-types build

# Build web para producción
pnpm run build:web
```

Setup completo, requisitos y variables de entorno: [`README.md`](README.md).

## App Mobile en dispositivo Android físico

Requisitos, script de Windows, ruta manual para Linux/macOS y *gotchas* del monorepo pnpm:
**[`apps/mobile/README.md`](apps/mobile/README.md)**. No dupliques esos pasos acá.

Lo único que se repite en este archivo es el aviso de abajo, porque es la causa número uno
de horas perdidas y conviene que toda sesión lo tenga cargado de entrada.

### ⚠️ Los túneles `adb reverse` se caen solos — revísalos primero

El teléfono no tiene red propia hacia tu computador: **todo pasa por `adb reverse`**. Y
esos túneles **se borran** cuando se reinicia el daemon de adb, cuando se desconecta y
reconecta el cable, o al forzar el cierre de la app. No avisan.

Cuando eso pasa, **los síntomas mienten**: la app muestra datos vacíos como si no
hubiera nada, y el login del portal web decía "correo o contraseña incorrectos" cuando
en realidad la petición nunca salía del teléfono. Se pierde mucho rato buscando el
problema donde no está.

**Antes de dar por roto cualquier cosa en el celular:**

```bash
adb reverse --list        # si sale vacío, ese es el problema
```

Restaurarlos:

```bash
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:3000 tcp:3000   # Backend
adb reverse tcp:5173 tcp:5173   # Web, solo si vas a abrir el dashboard o el
                                # portal del familiar en el navegador del teléfono
```

El script `pnpm run android:device` configura 8081 y 3000, pero **no 5173**: ese hay que
agregarlo a mano. Y ojo con Vite: por omisión escucha solo en IPv6 (`::1`) y `adb
reverse` conecta por IPv4, así que para el teléfono hay que levantarlo con
`pnpm --filter @stopbet/web dev -- --host 0.0.0.0` o dará `ERR_EMPTY_RESPONSE`.

## Variables de entorno requeridas

### Backend (`apps/backend/.env`)
```
PORT=3000
DATABASE_URL=postgresql://...
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=...
GEMINI_API_KEY=...
ENCRYPTION_KEY=...
```

> **`ENCRYPTION_KEY` es obligatoria** — cifra el RUT en reposo (AES-256-GCM). Sin ella
> `pnpm run seed` **se cae** y el backend no puede escribir ningún RUT. Debe ser una
> cadena **hexadecimal de 64 caracteres** (32 bytes); cualquier otro largo se rechaza
> al arrancar. Genera la tuya con:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> Es local y personal: no la compartas ni la subas. En producción va configurada en
> Railway. `GEMINI_API_KEY` sí es opcional (sin ella el asistente usa mensajes de respaldo).

### Web (`apps/web/.env`)
```
VITE_API_URL=http://localhost:3000
```
