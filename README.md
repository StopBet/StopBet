# StopBet — Mitigación Digital de la Ludopatía

Proyecto de la **Feria de Software UTFSM 2026** desarrollado en colaboración con [AJUTER](https://ajuter.org) (Agrupación de Jugadores en Terapia).

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
ENCRYPTION_KEY=genérala_con_el_comando_de_abajo
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
```

> ⚠️ **`ENCRYPTION_KEY` es obligatoria.** Cifra el RUT del paciente en reposo (AES-256-GCM).
> Si falta, **`pnpm run seed` falla** y el backend no puede guardar ningún RUT. Tiene que ser
> una cadena **hexadecimal de 64 caracteres** (32 bytes) — otro largo se rechaza al arrancar.
> Genera la tuya con:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
>
> Es personal y local: cada quien genera la suya y no se comparte ni se sube al repo.

> Obtén tu `GEMINI_API_KEY` gratis en [Google AI Studio](https://aistudio.google.com). Es **opcional**: si la dejas vacía el backend levanta igual y el chatbot responde con mensajes de fallback.

> **El correo es opcional.** Solo se usa para enviarle las credenciales a un psicólogo recién
> creado (CA24.1). Sin configurar nada el backend arranca igual, no envía, y la pantalla de
> Equipo avisa que hay que entregar la contraseña a mano.
>
> Hay **dos transportes** y se elige solo según qué variable exista (si están las dos, gana Brevo):
>
> | Variable | Cómo envía | Cuándo usarlo |
> |---|---|---|
> | `BREVO_API_KEY` | HTTPS | **Producción.** Es el único que funciona en Railway: ahí los puertos SMTP salientes están bloqueados en los planes Free, Trial y Hobby, y el proyecto corre en Hobby. |
> | `SMTP_HOST` + `SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` | SMTP | **Local.** Cualquier proveedor, o un buzón falso. |
>
> Comunes a los dos: `MAIL_FROM` y `WEB_APP_URL`.
>
> Para probarlo en local sin cuenta de ningún proveedor, levanta un buzón falso:
>
> ```bash
> docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
> # SMTP_HOST=localhost  SMTP_PORT=1025  (sin usuario ni clave)
> # los correos se leen en http://localhost:8025
> ```
>
> Ver todas las variables comentadas en [`apps/backend/.env.example`](apps/backend/.env.example).

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

### 5. Poblar la base de datos con datos de prueba

```bash
pnpm run seed
```

Crea las tablas (si no existen) y el **usuario demo** que usa la app mobile mientras no hay autenticación real. Es idempotente: si los datos ya existen, no hace nada.

Los 9 usuarios de prueba (paciente, padrino, psicólogo, coordinador, etc.) quedan con la misma **clave de desarrollo: `Stopbet2026!`**, para hacer login vía `POST /auth/login` con cualquiera de los correos que imprime el seed al terminar.

Para probar el **portal del familiar** hace falta además:

```bash
pnpm run seed:family
```

Crea los tres estados de vínculo (activo con sesiones, pendiente, y activo sin sesiones
próximas). Sin esto no hay ninguna cuenta de familiar con la que entrar.

---

### 6. Levantar los servicios

Abre **dos terminales** en la raíz del proyecto:

**Terminal 1 — Backend API:**

```bash
pnpm run backend
```

Disponible en: `http://localhost:3000`  
Swagger (documentación de la API): `http://localhost:3000/api/docs`

**Terminal 2 — Dashboard Web:**

```bash
pnpm run web
```

Disponible en: `http://localhost:5173`

---

### Mobile

> Setup nativo, flujo completo y *gotchas* del monorepo en **[apps/mobile/README.md](apps/mobile/README.md)**. Acá va solo el resumen.

#### ¿Qué es Metro y por qué lo usamos?

**Metro** es el bundler de JavaScript que viene incluido con React Native. Su trabajo es servir el código JS al dispositivo en tiempo real: cuando la app arranca en el celular, le pide el bundle a Metro (que corre en tu PC en el puerto 8081). Cuando cambias código, Metro lo detecta y recarga la app automáticamente sin recompilar el APK.

Es parte del framework — no es opcional ni reemplazable con React Native CLI.

> **En Windows** el script `android-run.ps1` abre Metro automáticamente en una ventana separada. Solo debes **no cerrarla** mientras usas la app.  
> **En Linux/macOS** hay que levantarlo manualmente (ver comandos abajo).

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
# Terminal 1 (raíz): backend — de paso compila shared-types
pnpm run backend
# Terminal 2 (apps/mobile): Metro
#   Si NO levantas el backend, antes corre desde la raíz:
#   pnpm --filter @stopbet/shared-types build
npx react-native start
# Terminal 3: puentes para que el dispositivo alcance el localhost del PC
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:3000 tcp:3000
# Terminal 3: compilar e instalar (luego basta apretar "r" en Metro)
npx react-native run-android
```

---

## Despliegue en producción

| Servicio | Plataforma | URL |
|---------|-----------|-----|
| Dashboard web | Vercel | https://stopbet-lemon.vercel.app |
| Backend + DB | Railway | https://stopbetbackend-production.up.railway.app (`/health`, `/api/docs`) |
| Archivos (PDF, fotos) | Cloudflare R2 | API compatible S3 |

Railway y Vercel se conectan automáticamente con GitHub y hacen deploy en cada push a `main`.
Las variables de entorno de producción se configuran en los dashboards de cada plataforma,
**nunca en el repo**.

> ⚠️ En Railway hay dos proyectos llamados **StopBet**. El de la tabla de arriba es el real,
> en la cuenta de José Meza. Si aparece otro en el workspace personal de Matías Barraza, es
> un intento anterior, muerto desde mayo — ignóralo.

### Variables de entorno en Railway (`@stopbet/backend`)

Las mismas de `apps/backend/.env.example`, con dos diferencias respecto a local:

- `CORS_ORIGIN` acepta una lista separada por comas, útil para tener a la vez el dominio de
  Vercel y `http://localhost:5173` (desarrollo local contra el backend de la nube).
- **No configurar `NODE_ENV=production`.** El repo no tiene migraciones: con esa variable el
  `synchronize` de TypeORM se apaga y las tablas nunca se crean. Se deja sin definir a
  propósito — detalle en `CLAUDE.md` → Deudas técnicas.

### Poblar la base de datos de producción

La base de Railway no trae datos por defecto. Desde tu máquina, con un `apps/backend/.env`
que apunte al `DATABASE_URL` **público** del Postgres de Railway (no el `.railway.internal`,
que solo resuelve dentro de la red de Railway) y la **misma** `ENCRYPTION_KEY` que tiene el
servicio (si no coincide, los RUT quedan cifrados con una clave que el backend no puede
descifrar):

```bash
pnpm run seed
pnpm run seed:family
```

---

## Flujo de trabajo del equipo

- Sprints gestionados en **Jira** — vincular historias antes de iniciar cada sprint
- Ramas: `feature/HU-XXX-descripcion-corta` / `fix/HU-XXX-descripcion-corta`
- Pull Requests requieren al menos **1 reviewer** antes de mergear a `main`
- `main` siempre debe estar en estado desplegable
- **Estado del proyecto:** el estado actual (qué corre, qué está en curso, deudas) vive en [`CLAUDE.md`](CLAUDE.md). Tras un cambio significativo, actualízalo ahí para que cualquiera —y cualquier sesión de Claude— entienda el estado sin reconstruirlo.
- **Evidencia del SPIKE 1** (seguridad, disponibilidad e IA): [`docs/planning/evidencia-spike-sprint1.md`](docs/planning/evidencia-spike-sprint1.md) — los 12 criterios, con comando o video para demostrar cada uno.

### Atribución de Claude Code

Si usas **Claude Code**, por defecto agrega un trailer `Co-Authored-By: Claude` a cada commit, y Claude figura como co-autor en GitHub (commit y PR). Si prefieres que tu trabajo aparezca **solo a tu nombre**, pídeselo explícitamente: *"no te agregues como co-autor"*. El commit queda firmado únicamente con tu identidad de git. (En este repo, el `CLAUDE.md` ya pide omitir ese trailer por defecto.)

---

## Roles del sistema

| Rol | Descripción |
|-----|-----------|
| `patient` | Paciente en tratamiento |
| `psychologist` | Terapeuta / psicólogo tratante |
| `coordinator` | Rol administrativo: crea cuentas de psicólogo y revisa solicitudes de cualquier sede |
| `sponsor` | Padrino de apoyo |
| `family` | Familiar del paciente |
