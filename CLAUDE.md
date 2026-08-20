# CLAUDE.md — Reglas del proyecto StopBet

Plataforma clínica para tratamiento de ludopatía. Datos de pacientes son **sensibles**; cualquier decisión de arquitectura que afecte privacidad o seguridad debe ser explícita.

## Estado actual

> _Actualizado 2026-08-19. Mantener al día tras cambios significativos (ver [Trabajando con Claude Code](#trabajando-con-claude-code))._

- **Mobile** (React Native CLI 0.86): compila y corre en Android físico y en emulador. Flujo y *gotchas* del monorepo en `apps/mobile/README.md`. El check-in se encola en `AsyncStorage` si no hay red y se reintenta al reconectar; el asistente muestra una tarjeta de crisis (pánico / padrino / `*4141`) ante riesgo alto, y un mensaje de respaldo dentro del hilo si el envío falla.
  - ⚠️ **`BASE_URL` está hardcodeado a `http://localhost:3000`** (`src/services/api.ts`). La app **solo** llega al backend por el túnel `adb reverse` desde el computador de cada uno: **en un celular real, contra la nube, no se conecta a nada.** Arreglo: `__DEV__ ? localhost : <url-railway>` — falta la URL pública de Railway. React Native no lee `.env` sin una librería extra, así que va en el código.
- **Auth real implementada, pero opt-in todavía**: módulo `auth` con JWT (`POST /auth/login`, `/auth/refresh` con rotación, `/auth/logout`), `JwtAuthGuard` + `RolesGuard` + `@Roles()` + `@CurrentUser()` en `common/`. Rol `coordinator` agregado. Solo 2 endpoints la exigen hoy (`GET /users/patients`, `GET /users/:id/progress`) — el resto del backend **sigue leyendo `x-user-id` sin verificar**, y **ni el dashboard web ni la app mobile fueron migrados** a mandar `Authorization: Bearer` (siguen con `TEMP_USER_ID` / el header viejo). Registrar el guard como global (con `@Public()` en lo que deba quedar abierto) y migrar los clientes es el siguiente paso grande — ver `docs/security/permissions-matrix.md` para el detalle endpoint por endpoint.
- **Backend** (NestJS): módulos `achievements`, `ai-assistant`, `auth`, `billing`, `check-ins`, `community`, `health`, `notifications`, `panic`, `registration`, `sedes`, `subscriptions`, `users`. `GET /health` verifica la conexión real a la BD (antes era un `{status:'ok'}` fijo) y alerta a un webhook de Discord ante caída — inactivo hasta que el equipo configure `DISCORD_ALERT_WEBHOOK_URL`. El RUT (`User.rut`) se cifra en reposo (AES-256-GCM). Nuevos endpoints para el dashboard web: `GET /users/patients`, `GET /registration/pending`, `GET /panic/alerts/history`.
- **Web dashboard**: vistas del terapeuta (login, Overview, Alertas, Finanzas, Solicitudes, Configuración) conectadas a la API real con TanStack Query (`@tanstack/react-query`). Overview y Alertas muestran datos de la DB local. `Finanzas` y `Configuración` siguen con datos mock. El cliente HTTP vive en `apps/web/src/services/api.ts` y **todavía manda `x-user-id`**, no `Authorization: Bearer`.
- **CI**: `.github/workflows/backend-ci.yml` corre type-check, tests unitarios (con cobertura) y e2e en cada push/PR a `main` con un Postgres de servicio. `apps/backend/test/` tiene el primer e2e (`roles.e2e-spec.ts`).
- **DB local**: datos de prueba en PostgreSQL (usuario `postgres`, pass `password`, db `stopbet`) creados con `pnpm run seed` — 9 usuarios (patient/sponsor/psychologist/coordinator), todos con la misma clave de desarrollo `Stopbet2026!`. El script viejo `python scripts/populate_db.py` sigue existiendo pero `pnpm run seed` es la vía actual.
- **Asistente IA**: modelo `gemini-3.5-flash-lite` (el anterior, `gemini-2.5-flash-lite`, empezó a devolver 404 para cuentas nuevas y el asistente caía al mensaje de respaldo en cada mensaje **sin que nada lo delatara**). Requiere una `GEMINI_API_KEY` válida: sin ella todo cae al respaldo y los resúmenes clínicos quedan sin evaluar. El `riskLevel` del resumen ahora es `RiskLevel | null` — **`null` significa "no se pudo evaluar", distinto de `'low'`, que significa "evaluado y sin riesgo"**. Las reglas de tono y las 3 conversaciones de prueba están en `docs/reglas-asistente.md`. Ojo: el tono depende del LLM y **no es determinista** — en un muestreo de 3 corridas, una se pasó del límite de 2-4 frases del documento.
- **CI**: `.github/workflows/mobile-preview.yml` quedó **solo en manual** (`workflow_dispatch`). Fallaba en `Build APK` desde junio y mandaba un correo de fallo en cada merge. La causa está documentada en el propio archivo: `react-native@0.86.0` ya no publica `sdks/hermesc` en npm (verificado también en 0.85.0 y 0.86.2), así que **no se arregla cambiando la versión**. No lo cubre ningún criterio del Sprint 1.
- **Deudas técnicas**: borrar `apps/mobile/package-lock.json` (residuo de npm en repo pnpm); conectar `FinanzasPage` y `ConfiguracionPage` a la API; migrar `apps/web` y `apps/mobile` de `x-user-id` a `Authorization: Bearer`; registrar `JwtAuthGuard` como guard global; **arreglar el `BASE_URL` de mobile** (ver arriba — bloquea mostrar la app contra la nube); **FCM sigue sin implementar** (HdU07 CA7.4): el cron de las 20:00 ya existe y crea la notificación en la tabla, pero el backend **no puede enviar push** — falta `firebase-admin`, una tabla de tokens de dispositivo y el `google-services.json` + service account del proyecto Firebase. _Resueltas:_ seed del usuario demo con `pnpm run seed`; `GEMINI_API_KEY` es opcional; dashboard web conectado a API real; módulo `auth` implementado (login JWT real, ver arriba).

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

## Flujo de sprints

1. Historias de usuario vinculadas en **Jira** antes de iniciar el sprint.
2. Rama por historia: `feature/HU-XXX-descripcion-corta`.
3. PR a `main` con al menos 1 reviewer.
4. Criterios de aceptación de la historia deben estar cubiertos en el PR.
5. `main` siempre deployable.

## Comandos frecuentes

```bash
# Instalar todo
npm install

# Levantar web local
npm run web                    # http://localhost:5173

# Levantar backend local
npm run backend                # http://localhost:3000
                               # Swagger: http://localhost:3000/api/docs

# Build web para producción
npm run build:web
```

## App Mobile en dispositivo Android físico

### Prerrequisitos (una vez por máquina)
1. **Android Studio** instalado → [developer.android.com/studio](https://developer.android.com/studio)
2. **`adb` en el PATH**: agregar `C:\Users\<usuario>\AppData\Local\Android\Sdk\platform-tools`
3. **Node.js 20+** en el PATH
4. **En el celular**: Ajustes → Opciones de desarrollador → Depuración USB (ON)

> Java 17+ se instala automáticamente si no está presente.

### Comandos

```bash
# Primera vez o después de cambios nativos (demora ~5–15 min, Gradle compila)
npm run android:device

# Veces posteriores (solo recarga JS, segundos)
npm run android:reload

# Si hay errores raros de Metro
npm run android:device:fresh
```

### Qué hace el script automáticamente
1. Verifica que el celular esté conectado por USB
2. Detecta Java 17+ o lo instala con `winget`
3. Configura `adb reverse` para puertos 8081 (Metro) y 3000 (Backend)
4. Abre Metro bundler en una ventana CMD separada
5. Compila el APK con Gradle e instala en el dispositivo
6. Lanza la app automáticamente

### Flujo de trabajo diario
```
Terminal A: npm run backend          # API en localhost:3000
Terminal B: (abre automáticamente)   # Metro bundler (ventana CMD)
Celular:    app StopBet              # conectado por USB
```
Para ver datos reales, el backend debe estar corriendo antes de abrir la app.

## Variables de entorno requeridas

### Backend (`apps/backend/.env`)
```
PORT=3000
DATABASE_URL=postgresql://...
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=...
GEMINI_API_KEY=...
```

### Web (`apps/web/.env`)
```
VITE_API_URL=http://localhost:3000
```
