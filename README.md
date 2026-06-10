# StopBet — Mitigación Digital de la Ludopatía

Proyecto de la **Feria de Software UTFSM 2026** desarrollado por el Grupo 4 en colaboración con [AJUTER](https://ajuter.cl) (Asociación de Jugadores en Rehabilitación).

StopBet es una plataforma clínica digital que acompaña a pacientes con ludopatía durante todo su proceso de rehabilitación. A diferencia de los bloqueadores restrictivos, combina un motor de **Intervenciones Adaptativas Justo a Tiempo (JITAI)**, un **asistente virtual con IA** con límites clínicos validados por AJUTER, y un **dashboard clínico** que centraliza la gestión terapéutica, reduciendo la carga administrativa de los psicólogos y garantizando contención 24/7 al paciente.

**Líderes:** Alex Domínguez (Product Owner) · José Meza (Scrum Master)  
**Equipo:** Matías Lara · Catalina Yañez · Eduardo Pacheco · Matias Barraza  
**Campus:** Casa Central, Universidad Técnica Federico Santa María

---

## Estructura del monorepo

```
StopBet/
├── apps/
│   ├── web/          → Dashboard web del terapeuta (React + Vite + Tailwind)
│   ├── backend/      → API REST clínica (NestJS + PostgreSQL + LangChain.js)
│   └── mobile/       → App del paciente Android/iOS (React Native CLI)
└── packages/
    └── shared-types/ → Tipos TypeScript compartidos entre backend y web
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend Mobile | React Native CLI |
| Backend | Node.js + NestJS + LangChain.js |
| Base de datos | PostgreSQL con JSONB |
| IA | Gemini Flash / GPT-4o mini + LangChain.js |
| Notificaciones Push | Firebase Cloud Messaging (FCM) |
| Dashboard Web | React + Vite + TypeScript + Tailwind CSS + Recharts |
| Infraestructura | Railway + Vercel + Cloudflare R2 |

---

## Levantamiento local

### Requisitos previos

Asegúrate de tener instalado lo siguiente antes de comenzar:

| Herramienta | Versión mínima | Verificar con |
|-------------|---------------|---------------|
| Node.js | 20.x | `node -v` |
| pnpm | 10.x | `pnpm -v` |
| Git | cualquiera | `git --version` |
| PostgreSQL | 15.x | `psql --version` |

> Para el desarrollo **mobile** se necesita además Android Studio con SDK configurado. Ver sección [Mobile](#mobile).

---

### 1. Clonar el repositorio

```bash
git clone https://github.com/StopBet/StopBet.git
cd StopBet
```

---

### 2. Instalar dependencias

Desde la **raíz** del monorepo instala todos los workspaces de una sola vez:

```bash
pnpm install
```

> ⚠️ **Usa `pnpm`, no `npm`.** Este es un monorepo **pnpm**. Correr `npm install` genera un `package-lock.json` que rompe la consistencia de dependencias del equipo. Si no tienes pnpm: `npm install -g pnpm` o `corepack enable`.

---

### 3. Configurar variables de entorno

Copia los archivos de ejemplo y edítalos con tus valores locales:

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env

# Web
cp apps/web/.env.example apps/web/.env
```

#### `apps/backend/.env`

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stopbet
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=cualquier_string_largo_para_desarrollo
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
```

> Obtén tu `GEMINI_API_KEY` gratis en [Google AI Studio](https://aistudio.google.com).

#### `apps/web/.env`

```env
VITE_API_URL=http://localhost:3000
```

---

### 4. Crear la base de datos

Conéctate a PostgreSQL y crea la base de datos local:

```bash
psql -U postgres -c "CREATE DATABASE stopbet;"
```

> Si usas Docker puedes levantarla con:
> ```bash
> docker run --name stopbet-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=stopbet -p 5432:5432 -d postgres:15
> ```

---

### 5. Levantar los servicios

Abre **dos terminales** en la raíz del proyecto:

**Terminal 1 — Backend API:**

```bash
npm run backend
```

Disponible en: `http://localhost:3000`  
Swagger (documentación de la API): `http://localhost:3000/api/docs`

**Terminal 2 — Dashboard Web:**

```bash
npm run web
```

Disponible en: `http://localhost:5173`

---

### Mobile

> Setup nativo, flujo completo y *gotchas* del monorepo en **[apps/mobile/README.md](apps/mobile/README.md)**. Acá va solo el resumen.

**Requisitos adicionales:**

| Herramienta | Uso |
|-------------|-----|
| JDK 17 | Compilación Android (Gradle lo exige) |
| Android Studio | SDK Manager + AVD (emulador) |
| `adb` en el PATH | Conexión con el dispositivo/emulador |
| Variable `ANDROID_HOME` | Apunta al SDK de Android |
| Variable `JAVA_HOME` | Apunta al JDK 17 |

En el MVP la app corre en **dispositivo Android físico** (depuración USB) o emulador. Le pega al backend en `http://localhost:3000`, así que necesita el backend corriendo y los puentes `adb reverse`.

**Windows** (script automático que hace todo):

```bash
pnpm run android:device      # primera vez / cambios nativos
pnpm run android:reload      # recargas posteriores (solo JS)
```

**Linux / macOS** (el script de arriba es PowerShell; acá es manual):

```bash
# Terminal 1 (raíz): backend
pnpm run backend
# Terminal 2 (apps/mobile): Metro
npx react-native start
# Terminal 3: puentes para que el dispositivo alcance el localhost del PC
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:3000 tcp:3000
# Terminal 3: compilar e instalar (luego basta apretar "r" en Metro)
npx react-native run-android
```

---

## Despliegue en producción

| Servicio | Plataforma | Configuración |
|---------|-----------|--------------|
| Dashboard web | Vercel | `vercel.json` en raíz |
| Backend + DB | Railway | `apps/backend/railway.toml` |
| Archivos (PDF, fotos) | Cloudflare R2 | API compatible S3 |

Railway y Vercel se conectan automáticamente con GitHub y hacen deploy en cada push a `main`.  
Las variables de entorno de producción se configuran en los dashboards de cada plataforma.

---

## Flujo de trabajo del equipo

- Sprints gestionados en **Jira** — vincular historias antes de iniciar cada sprint
- Ramas: `feature/HU-XXX-descripcion-corta` / `fix/HU-XXX-descripcion-corta`
- Pull Requests requieren al menos **1 reviewer** antes de mergear a `main`
- `main` siempre debe estar en estado desplegable
- **Estado del proyecto:** el estado actual (qué corre, qué está en curso, deudas) vive en [`CLAUDE.md`](CLAUDE.md). Tras un cambio significativo, actualízalo ahí para que cualquiera —y cualquier sesión de Claude— entienda el estado sin reconstruirlo.

### Atribución de Claude Code

Si usas **Claude Code**, por defecto agrega un trailer `Co-Authored-By: Claude` a cada commit, y Claude figura como co-autor en GitHub (commit y PR). Si prefieres que tu trabajo aparezca **solo a tu nombre**, pídeselo explícitamente: *"no te agregues como co-autor"*. El commit queda firmado únicamente con tu identidad de git. (En este repo, el `CLAUDE.md` ya pide omitir ese trailer por defecto.)

---

## Roles del sistema

| Rol | Descripción |
|-----|-----------|
| `patient` | Paciente en tratamiento |
| `psychologist` | Terapeuta / psicólogo tratante |
| `sponsor` | Padrino de apoyo |
| `family` | Familiar del paciente |
