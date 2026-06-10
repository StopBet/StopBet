# CLAUDE.md — Reglas del proyecto StopBet

Plataforma clínica para tratamiento de ludopatía. Datos de pacientes son **sensibles**; cualquier decisión de arquitectura que afecte privacidad o seguridad debe ser explícita.

## Estado actual

> _Actualizado 2026-06-10. Mantener al día tras cambios significativos (ver [Trabajando con Claude Code](#trabajando-con-claude-code))._

- **Mobile** (React Native CLI 0.86): compila y corre en Android físico. Flujo y *gotchas* del monorepo en `apps/mobile/README.md`.
- **Sin autenticación todavía**: las 5 pantallas usan un usuario demo hardcodeado (UUID `11111111-1111-1111-1111-111111111111`) que debe existir en la tabla `users`. El backend lee la identidad del header `x-user-id` **sin verificarla**. Próxima épica grande: módulo `auth` real (login + JWT + guards).
- **Backend** (NestJS): módulos `achievements`, `ai-assistant`, `billing`, `check-ins`, `community`, `notifications`, `panic`, `registration`, `sedes`, `subscriptions`, `users`. Falta `auth`.
- **Web dashboard**: design system configurado en `main` (tokens AJUTER + fuentes self-hosted); el desarrollo de vistas va en ramas `feature/HU-04-web-*` (sin mergear aún).
- **Deudas técnicas**: borrar `apps/mobile/package-lock.json` (residuo de npm en repo pnpm); convertir el usuario demo en un seeder del backend; `GEMINI_API_KEY` sin valor real → chatbot IA off.

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
