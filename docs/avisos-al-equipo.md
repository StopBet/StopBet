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
