# Avisos al equipo

Bitácora de cambios que **obligan a hacer algo distinto después de pullear**, o que cambian
un comportamiento visible lo bastante como para que alguien lo confunda con un bug.

**Esto no es el manual de setup.** Cómo se levanta el proyecto está en `README.md`, en
"Comandos frecuentes" de `CLAUDE.md` y en `apps/mobile/README.md`. Acá va solo lo que
cambió y a quién le pega, para que nadie pierda una tarde buscando el problema donde no
está.

## Cómo se usa

- Entradas **nuevas arriba**, con fecha y el PR que las trae.
- Si un cambio no le pide nada a nadie, **no va**. Esto sirve mientras se pueda leer entero
  en un minuto.
- Cuando una entrada deja de aplicar (el paso se automatizó, el flujo se revirtió), muévela
  a "Histórico" al final con una línea de qué la cerró. No la borres: alguien que pullea
  después de dos semanas necesita entender por qué su repo estaba raro.
- El archivo es de todos. Editarlo no necesita permiso de nadie.

---

## 2026-09-01 — La skill de diseño web estaba en el tema viejo: si tu Claude escribía naranja, era esto (commit directo en `main`)

### Reinicia tu sesión de Claude Code si trabajas en `apps/web`

**A quién le pega:** a quien use Claude Code para construir componentes o páginas en `apps/web`.

**Qué hacer:** nada que instalar. Solo **reiniciar la sesión de Claude Code** después de pullear:
las skills se cargan al arrancar y quedan en caché, así que una sesión ya abierta sigue con la
versión vieja.

**Por qué:** `.claude/skills/stopbet-web-design/SKILL.md` seguía documentando el tema AJUTER
naranja que se reemplazó el 31-08 por el azul StopBet. Estaba equivocada en casi todo: `bg-primary`
como `#E8883A` en vez de `#396fb6`, las fuentes como Nunito/Inter en vez de Chillax/Satoshi, y una
lista de ~70 íconos que no existen. **Si le pediste un componente nuevo y te salió naranja dentro
del panel azul, no era invento del modelo: era la skill.** Ya está corregida contra el CSS real.

**De paso quedaron documentadas dos trampas** que no estaban en ningún lado:

- Los nombres de las variables crudas **ya no describen su color**. `stopbet-theme.css` redefine
  la paleta de `colors_and_type.css` conservando los nombres: `--teal-700` es azul `#396fb6`,
  `--amber-500` es azul claro. No te guíes por el nombre. Igual que `--ajuter-gradient`, que
  conserva el nombre y hoy es azul.
- **`WIcon` con un nombre que no está en su `ICON_MAP` no falla: renderiza un hueco vacío**, sin
  error ni warning en consola. Si un ícono "no aparece", revisa primero que el nombre esté en la
  lista (son 41, están en la skill) antes de buscar el problema en otro lado.

---

## 2026-09-01 — La demo en la nube ya está lista, y cómo compilar el APK de release en Windows (rama `docs/demo-nube-y-apk-release-alex-dominguez`)

### Para mostrar la app ya no hace falta levantar nada local

**A quién le pega:** a cualquiera que tenga que mostrar el producto (reunión, avance, demo).

**Qué hacer:** mandar el link y entrar. Nada de backend, Metro ni túneles `adb`.

- Dashboard web: <https://stopbet-lemon.vercel.app> (ya apunta al backend de Railway)
- Clave de todas las cuentas de prueba: `Stopbet2026!`

**Por qué:** `CLAUDE.md` decía que la base de Railway estaba vacía y que no había con qué
entrar. Eso quedó desactualizado: alguien ya corrió `pnpm run seed` y `seed:family` contra
ella. Verificado el 2026-09-01, `POST /auth/login` devuelve token para las cuentas del seed,
incluidas las del portal del familiar. Ya lo corregí en `CLAUDE.md`.

### Para compilar el APK de release en Windows, copia el repo a una ruta corta

**A quién le pega:** a quien necesite un APK instalable, para probar sin cable o para pasarle
la app a alguien. Solo en Windows, y **solo para release**: el debug no cambia en nada.

**Qué hacer:** no corras `assembleRelease` sobre el repo que tienes en OneDrive, ni con el
`subst S:`. Copia el repo a una ruta corta, instala ahí y compila ahí:

```bash
robocopy <tu-repo> C:\sb /E /XD node_modules .git build .cxx .gradle dist
cd C:\sb && pnpm install --frozen-lockfile
pnpm --filter @stopbet/shared-types build
cd C:\sb\apps\mobile\android && ./gradlew assembleRelease
```

El APK sale en `C:\sb\apps\mobile\android\app\build\outputs\apk\release\app-release.apk`.
Verificado el 2026-09-01: `BUILD SUCCESSFUL` en 10m 36s, instalado y funcionando en un
Galaxy S21 sin cable. Alternativa sin tocar tu máquina: lanzar
`.github/workflows/mobile-preview.yml` desde Actions > Mobile Preview > Run workflow, que
corre en Linux y publica el APK en Firebase App Distribution.

**Por qué la ruta corta:** el build necesita dos cosas que en el layout actual se estorban, y
ninguna de las dos configuraciones habituales sirve:

- **Desde `C:\Users\...\OneDrive\Escritorio\...` falla el C++.** Ese prefijo son 56
  caracteres, la ruta de objetos de CMake llega a unos 265 y revienta el límite MAX_PATH de
  260 de Windows.
- **Desde el `subst S:` que crea `scripts/android-run.ps1` falla Metro.** Los junctions de
  pnpm apuntan todos a `C:`, así que Metro mezcla dos unidades. Con `STOPBET_REAL_ROOT`
  definida arma rutas imposibles como `S:\C:\Users\...\metro-runtime\...`; sin ella, corta
  con `Failed to get the SHA-1`.

`C:\sb` cumple las dos: ruta corta **y** una sola unidad, sin `subst` de por medio.

**Callejones sin salida, para que nadie los repita:** separar las etapas no sirve
(pre-generar el bundle y correr `gradlew -x createBundleReleaseJsAndAssets` falla porque AGP
consulta el provider de esa tarea igual), y tampoco reemplazar el junction de
`@stopbet/shared-types` por una copia real (destapa que el problema es de todos los junctions
de pnpm, no de ese paquete).

**Ojo con el síntoma:** el primer error es
`ninja: error: mkdir(...): No such file or directory`, que no se parece en nada a un problema
de largo de ruta. Son 8 a 10 minutos por intento.

---

## 2026-08-31 — El dashboard web pasó del naranja AJUTER al azul StopBet (rama `fix/dashboard-responsive-completo-alex-dominguez`)

### El panel se ve azul después de pullear. No está roto.

**A quién le pega:** a cualquiera que levante el dashboard web o trabaje en `apps/web`.

**Qué hacer:** nada. No hay comando ni variable nueva. Solo no asustarse.

**Por qué:** el shell clínico usaba el tema AJUTER (naranja `#E8883A`) y el login la marca
StopBet (azul `#396fb6`). La misma sesión cambiaba de identidad al entrar. Ahora todo el
panel va con la marca del producto. El logo de AJUTER **no desapareció**: bajó al pie del
sidebar, porque el panel sigue identificando a la institución que lo usa.

**Lo que sí cambia si tocas estilos:**

- **`src/styles/ajuter-theme.css` ya no existe.** Lo reemplaza `stopbet-theme.css`, con la
  misma mecánica: redefine los tokens semánticos y las páginas no se tocan una por una. Si
  tu rama lo modificó, ese cambio hay que rehacerlo en el archivo nuevo.
- **Las fuentes cambiaron**: Chillax para títulos y Satoshi para body, con Nunito e Inter de
  respaldo. Si algo se ve con otra métrica de texto, es esto.
- **`--ajuter-gradient` conserva el nombre pero ahora es azul.** Se dejó así para no tocar
  las páginas que ya lo consumen.
- Si escribiste un color a mano en vez de usar un token semántico, tu vista quedó naranja en
  medio de un panel azul. Esa es la señal para cambiarlo por el token.

**Ojo con los conflictos:** el PR toca 12 archivos compartidos de `apps/web` (`Sidebar`,
`TopBar`, `MetricCard`, `index.css` y 7 páginas). Si tu rama toca alguno, rebasea temprano.

---

## 2026-08-31 — Despliegue a producción: backend en Railway, web en Vercel (rama `chore/despliegue-nube-jose-meza`)

### El backend y la web ya están desplegados de verdad — no son solo config sin probar

**A quién le pega:** a todo el equipo, para cualquier cosa que se pruebe contra la nube en vez
de local (demo, QA, mostrarle el avance a alguien).

**Qué hay ahora:**
- Backend: `https://stopbetbackend-production.up.railway.app` (`/health`, `/api/docs`). Base de
  datos sembrada con `pnpm run seed` + `pnpm run seed:family` — las mismas cuentas que en local,
  misma clave `Stopbet2026!`.
- Web: `https://stopbet-lemon.vercel.app`, ya apuntando a ese backend.
- `CORS_ORIGIN` ahora acepta una **lista separada por comas** (`apps/backend/src/main.ts`); antes
  aceptaba un solo origen y con dos se rompía uno de los dos.
- La app mobile ya no tiene `BASE_URL` fijo a `localhost` (`apps/mobile/src/services/api.ts`):
  usa `__DEV__` para elegir entre local (desarrollo) y Railway (release). Cualquier APK de
  release que compilen ustedes o el CI (`mobile-preview.yml`) ahora funciona en un teléfono sin
  el `adb reverse` ni el computador prendido.

**Qué hacer:** nada obligatorio — no hay dependencias nuevas ni pasos de `pnpm install`. Si van
a probar contra la nube, usen las URLs de arriba (también quedaron en el README, sección
"Despliegue en producción").

**Ojo con esto, no es un bug:** en Railway aparecen **dos** proyectos llamados "StopBet". El real
es el de arriba, en la cuenta de José. El otro, en el workspace personal de Matías Barraza, es
un intento viejo muerto desde mayo (deploy `FAILED`, dominio 404) — no hay nada ahí, ignórenlo.

---

## 2026-08-31 — Cierre de acceso a cuentas suspendidas (rama `fix/cuenta-suspendida-cierra-acceso-matias-lara`)

### Suspender un psicólogo ahora sí le cierra el acceso — y toca archivos de `auth/**` (José)

**A quién le pega:** a todo el equipo que pruebe login o cuentas suspendidas; a José, dueño de
`apps/backend/src/auth/**`, aunque no haya podido revisarlo antes de este commit.

**Qué cambió:**
1. Una cuenta con `accountStatus: 'suspended'` ya no puede hacer login (`403`, banner "Tu cuenta
   no tiene permisos para acceder") ni renovar su sesión con `/auth/refresh`.
2. Cualquier request autenticado de una cuenta que se suspendió **mientras tenía sesión abierta**
   se corta en el siguiente request (`401` → el dashboard expulsa al login solo).
3. Suspender ahora revoca en la misma transacción todos los refresh tokens vivos de esa cuenta.
4. `POST /auth/login` puede devolver `403` además de `401` — ojo si tienen scripts o colecciones
   de Postman que solo esperaban `200`/`401`.

**Qué hacer:** si en tu BD local tenías psicólogos de prueba ya suspendidos, dejarán de poder
entrar (era el bug). Correr `pnpm run seed` los devuelve a los estados de siempre.

**Por qué se tocó `auth/**` sin José:** el hallazgo es de seguridad clínica (una cuenta suspendida
podía seguir entrando y viendo pacientes) y él estaba ocupado con otras tareas. Quedó con tests
unitarios, e2e y verificación manual por API y por navegador — ver `claude_privado/pendientes.md`
para el detalle si hace falta.

**Fuera de esta rama a propósito:** no se tocó `docs/security/permissions-matrix.md` (es de José);
esto agrega una condición de estado de cuenta, no cambia permisos por endpoint.

---

## 2026-08-30 — HU-24 · Reasignación de pacientes por sede (rama `feature/HU-24-reasignacion-por-sede-matias-lara`)

### Hay que recompilar `shared-types` después de pullear

**A quién le pega:** a quien levante el backend o el dashboard web.

**Qué hacer**, una vez después de pullear, desde la raíz:

```bash
pnpm --filter @stopbet/shared-types build
```

**Por qué:** `PsychologistListItem` suma un campo obligatorio, `patientsBySede`. Si tu `dist/`
quedó viejo, el type-check falla al usar el tipo. `pnpm run backend` ya lo compila solo; hace
falta a mano si levantas solo la web o solo Metro.

### Desactivar un psicólogo ahora pide un destino **por cada sede**

**A quién le pega:** a quien pruebe la página Equipo o consuma
`PATCH /psychologists/:id/deactivate`.

Antes se mandaba un único `reassignTo` para todos los pacientes, y el backend exigía que ese
destino atendiera **todas** las sedes del psicólogo que se iba. Con pacientes repartidos en
dos sedes eso dejaba la baja **imposible de completar**: la UI ofrecía un destino que el
backend siempre rechazaba con "no atiende todas las sedes", y no había otra opción.

Ahora el cuerpo acepta un mapa `reassignments` de `sedeId → psychologistId`, igual que
`PATCH /psychologists/:id/sedes`:

```json
{ "reassignments": { "<sedeId-santiago>": "<psychId-A>", "<sedeId-vina>": "<psychId-B>" } }
```

**`reassignTo` sigue funcionando** como atajo cuando hay una sola sede: no rompe a nadie que
ya lo esté usando.

**Dos cambios visibles que podrías confundir con un bug:**

- El 409 de "tiene pacientes activos" ahora trae además un `bySede` con las sedes que quedaron
  sin destino. `patientIds` sigue estando donde estaba.
- En la página Equipo, el desplegable de reasignación **ya no lista a todos los psicólogos
  activos**: solo a los que atienden esa sede. Si no hay ninguno, en vez de un desplegable sale
  un mensaje diciendo a qué sede hay que asignarle a alguien primero, y el botón queda
  deshabilitado. **Eso es a propósito**, no es que la lista esté rota.

## 2026-08-30 — PR #58 · Cierre de criterios del SPIKE (S.4, S.5, S.6, S.11)

### Hay que correr `pnpm install` después de pullear

**A quién le pega:** a todos los que levanten el backend.

**Qué hacer**, una vez después de pullear, desde la raíz:

```bash
pnpm install
```

**Por qué:** el backend suma la dependencia `helmet`, que agrega cabeceras de seguridad
(HSTS, `X-Content-Type-Options`, `Cross-Origin-Resource-Policy`) en `main.ts`. Sin
instalarla el backend **no arranca**: revienta en el `import helmet from 'helmet'`.

**No rompe a los clientes.** Se verificó contra el dashboard web en un navegador real,
contra la app mobile en un Android físico y contra Swagger: todo responde igual. La CSP que
helmet trae por defecto viene desactivada a propósito, porque rompía la UI de `/api/docs`.

### El CI ahora **exige** 70% de cobertura en `users`, `panic` y `ai-assistant`

**A quién le pega:** a quien agregue código en esos tres módulos.

Antes la cobertura se medía y se ignoraba. Ahora hay un `coverageThreshold` en
`apps/backend/package.json`: si `statements` o `lines` bajan del 70% en cualquiera de los
tres, **el build falla y el PR no se puede mergear**.

Hoy los tres pasan con margen (`users` 87%, `panic` 92%, `ai-assistant` 86%), así que no
deberías notar nada **salvo que agregues código sin tests**.

**Si te falla**, mira dónde quedaste:

```bash
pnpm run test:coverage
```

El umbral aplica solo a `statements` y `lines`, **no a `branches`**: `ai-assistant` está en
65% de ramas y exigirlo ahí habría roto builds ajenos sin que el criterio lo pida.

### El e2e de roles ahora prueba endpoints que no son de José

**A quién le pega:** a Eduardo (`metrics`), a Matías Lara (`registration`) y a Matías
Barraza (`panic`).

`test/roles.e2e-spec.ts` ahora verifica 401 / 403 / 200 sobre `GET /metrics/patients/:id`,
`GET /registration/pending` y `GET /panic/alerts/history`, asumiendo
`@Roles('psychologist', 'coordinator')` en los tres.

**Si cambias los `@Roles()` de tu endpoint, ese test falla y te bloquea tu propio PR**, en un
archivo que no es tuyo y con un error que parece tuyo. No es un descuido: es deliberado,
porque esos tres devuelven datos identificables de pacientes y reabrirlos por accidente no
puede pasar en silencio. Avísale a José y lo actualiza, es una línea.

---

## 2026-08-28 — PR #56 · Registro de pacientes (HU-06) y cuentas de psicólogo (HU-24)

### Hay que compilar `shared-types` antes de levantar mobile

**A quién le pega:** a quien levante **solo Metro**, sin arrancar el backend.

**Qué hacer**, una vez después de pullear, desde la raíz:

```bash
pnpm --filter @stopbet/shared-types build
```

**Por qué:** `apps/mobile` ahora importa **funciones** de `@stopbet/shared-types` (el
validador de RUT y el de fechas), no solo tipos. Hasta este PR todos los imports del
paquete en mobile eran `import type` y babel los borraba al compilar, así que Metro nunca
necesitó el `dist/` — y `dist/` está en `.gitignore`, o sea que **no viene en el pull**.

**Si no lo haces:**
- Con un `dist/` viejo (lo normal si ya levantaste el backend alguna vez), la app arranca
  bien y revienta con `formatRut is not a function` **al primer carácter que escribas en el
  campo RUT** del registro. Buscar eso en el código de la pantalla no lleva a ninguna parte.
- Con un `dist/` ausente (clon nuevo, o borraste `node_modules`), Metro no resuelve el
  módulo y **falla el bundle entero**: pantalla roja al arrancar.

**Si siempre partes por `pnpm run backend`, no tienes que hacer nada**: ese script ya
compila `shared-types` antes de arrancar, igual que `pnpm run seed` y `build:backend`. En CI
ya está resuelto (`backend-ci.yml` y `mobile-preview.yml` lo compilan explícitamente).

**Pendiente:** `scripts/android-run.ps1` lanza Metro con `npx react-native start` directo
(línea 194), saltándose el script `start` de `apps/mobile/package.json`. Mientras no se le
agregue el build ahí, este paso es manual.

### La app mobile ahora arranca en Welcome, no en Home

**A quién le pega:** a todos los que iteren en pantallas de mobile.

Antes `App.tsx` forzaba `isSignedIn = true` y la app abría directo en Home. Eso dejaba el
stack de autenticación entero inalcanzable, y sin él no había forma de llegar al formulario
de registro (HU-06). Ahora arranca sin sesión: Welcome → Iniciar sesión → Home.

**Cualquier correo y clave no vacíos entran**, igual que antes: el login todavía no valida
contra `POST /auth/login`, sigue en modo demo con `TEMP_USER_ID`. Son dos toques más por
arranque, no un bloqueo.

### Solicitudes ahora filtra por sede

**A quién le pega:** a quien pruebe el flujo de aprobación en el dashboard.

`GET /registration/pending` devolvía **todas** las solicitudes a cualquiera. Ahora un
psicólogo ve solo las de sus sedes, y aprobar una de otra sede responde 403. El coordinador
sigue viendo todas — es un rol administrativo, y si filtrara también, una sede sin
psicólogos no tendría quién le apruebe nada.

**Ojo con el seed:** todos los psicólogos de `pnpm run seed` son de `'Santiago'`. Si
registras un paciente de prueba en Viña, Concepción u Online, **no le va a aparecer a ningún
psicólogo** — entra solo con la cuenta de coordinador. La lista vacía es el comportamiento
correcto, no un bug.

### `approve` / `reject` ya no aceptan `x-user-id`

**A quién le pega:** a quien tenga guardado un Postman o un script contra esos endpoints.

`PATCH /registration/:id/approve` y `/reject` ahora exigen `Authorization: Bearer` y rol
`psychologist` o `coordinator`. Antes cualquiera que supiera la URL podía aprobar una
solicitud inventando el `x-user-id` del revisor. El dashboard web ya va migrado en este
mismo PR; lo que se rompe son las llamadas hechas a mano.

`POST /registration/submit` y `GET /registration/status/:id` **siguen abiertos**, que es lo
que usa la app del paciente para registrarse sin cuenta.

---

## Histórico

_(Vacío por ahora. Acá van las entradas que dejaron de aplicar, con la línea de qué las cerró.)_
