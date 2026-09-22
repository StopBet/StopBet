# Matriz de permisos — StopBet API

**Entregable del SPIKE 1, criterio S.4.** Inventario completo de los 59 endpoints del
backend (14 controllers) con el rol que debería poder acceder a cada uno, y el estado real
de protección hoy.

> Roles del sistema: `patient`, `psychologist`, `coordinator`, `sponsor`, `family`, y
> **público** (sin autenticación). `coordinator` se agregó en el PR de contrato (#19).

## Cómo leer la columna "Estado actual"

> **Actualizado el 16-09-2026: `JwtAuthGuard` está registrado global.** Todo endpoint exige
> un token firmado salvo los marcados con `@Public()`, y la identidad sale del token
> (`@UserId()`), no del header `x-user-id`, que el backend ya no lee. Las categorías
> «⚠️ Scoped por dueño» y «❌ Abierto» de las versiones anteriores dejaron de existir.

| Símbolo | Significa |
|---|---|
| ✅ Protegido | Token firmado + `@Roles()`: solo entran los roles listados |
| ✅ Protegido + asignación | Además de rol, `PatientAccessGuard`: un psicólogo solo alcanza a sus pacientes asignados; la coordinación, a todos |
| ✅ Autenticado | Token firmado, sin `@Roles()`. La identidad sale del token, así que el servicio solo toca las filas de quien pregunta, pero **cualquier rol autenticado puede llamarlo** |
| 🔓 Público | `@Public()`, con la justificación escrita en el endpoint |

**Resumen (16-09-2026):** 0 endpoints abiertos sin justificación. **8 públicos** (login,
refresh, logout, health, sedes, envío y consulta de una solicitud de registro, y el stream de
alertas). Todo lo demás exige token. Lo que queda por endurecer está en
[Lo que sigue pendiente](#lo-que-sigue-pendiente): sobre todo, que varios endpoints
autenticados todavía no restringen **qué rol** puede llamarlos.

---

## `auth` — `/auth`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /auth/login` | Público | 🔓 Público |
| `POST /auth/refresh` | Público (requiere refresh token válido) | 🔓 Público |
| `POST /auth/logout` | Público (requiere refresh token válido) | 🔓 Público |

## `users` — `/users`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /users/patients` | `psychologist` (los suyos), `coordinator` (todos) | ✅ Protegido |
| `GET /users/:id/progress` | `psychologist` (sus asignados), `coordinator` | ✅ Protegido + asignación |

> **Alcance por rol (16-09-2026):** `GET /users/patients` ya no devuelve la lista completa a
> cualquiera de los dos roles. Un **psicólogo** recibe solo los pacientes con una asignación
> activa en `patient_assignments`; un **coordinador** los recibe todos, porque es un rol
> administrativo y si también filtrara, una sede sin psicólogos no tendría quién la mire.
> Antes, el panel le mostraba a cada psicólogo el correo y el historial de los pacientes de
> sus colegas.

> `POST /users/login` existía acá — se **eliminó** en el PR #44 (nunca comparaba la
> contraseña; el dashboard web ya usa `/auth/login`, que sí es role-agnostic y verifica bcrypt).

## `health` — raíz

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /health` | Público (lo usa el healthcheck de Railway) | 🔓 Público |

## `sedes` — `/sedes`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /sedes` | Público (catálogo, sin dato sensible) | 🔓 Público |

## `registration` — `/registration`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /registration/submit` | Público (onboarding del paciente) | 🔓 Público |
| `GET /registration/:requestId` | Público (el UUID de la solicitud actúa como secreto) | 🔓 Público |
| `GET /registration/pending` | `psychologist`, `coordinator` | ✅ Protegido |
| `PATCH /registration/:requestId/approve` | `psychologist`, `coordinator` | ✅ Protegido |
| `PATCH /registration/:requestId/reject` | `psychologist`, `coordinator` | ✅ Protegido |

## `panic` — `/panic`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /panic/sponsor` | `patient` (dueño) | ✅ Autenticado |
| `POST /panic/assign` | `psychologist`, `coordinator` | ✅ Protegido |
| `POST /panic/alerts` | `patient` (dueño) | ✅ Autenticado |
| `GET /panic/alerts/history` | `psychologist`, `coordinator` | ✅ Protegido |
| `GET /panic/alerts/stream` (SSE) | `psychologist`, `coordinator` | 🔓 Público: `EventSource` no puede mandar `Authorization`. Solo emite conteos, sin datos de pacientes |
| `GET /panic/alerts/active` | `patient` o `sponsor` (dueño) | ✅ Autenticado |
| `GET /panic/pending` | `sponsor` (dueño) | ✅ Autenticado |
| `POST /panic/alerts/:id/respond` | `sponsor` (dueño) | ✅ Autenticado |
| `DELETE /panic/alerts/active` | `patient` (dueño) — ruta de demo | ✅ Autenticado |
| `POST /panic/alerts/:id/cancel` | `patient` (dueño) | ✅ Autenticado |
| `POST /panic/alerts/:id/escalate` | `patient` (dueño) o sistema (automático) | ✅ Autenticado |
| `POST /panic/alerts/:id/community` | `patient` (dueño) | ✅ Autenticado |

## `community` — `/community`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /community/announcements` | `patient`, `sponsor` (de la sede) | ✅ Autenticado (sin filtro de sede) |
| `POST /community/announcements` | `psychologist`, `coordinator` | ✅ Protegido |
| `POST /community/announcements/:id/attend` | `patient`, `family` | ✅ Autenticado |
| `GET /community/posts` | `patient`, `sponsor` (de la sede) | ✅ Autenticado |
| `POST /community/posts` | `patient`, `sponsor` | ✅ Autenticado |
| `POST /community/posts/:id/reactions` | `patient`, `sponsor` | ✅ Autenticado |
| `DELETE /community/posts/:id/reactions/:emoji` | `patient`, `sponsor` (propia reacción) | ✅ Autenticado |
| `GET /community/posts/:id/replies` | `patient`, `sponsor` | ✅ Autenticado |
| `POST /community/posts/:id/replies` | `patient`, `sponsor` | ✅ Autenticado |
| `POST /community/posts/:id/report` | `patient`, `sponsor` | ✅ Autenticado |
| `GET /community/moderation/flagged` | `psychologist` | ✅ Autenticado |
| `DELETE /community/posts/:id` | `psychologist`, o el autor sobre su propia publicación | ✅ Autenticado |

> **Los tres se cerraron el 16-09-2026** (vista del psicólogo en mobile). Antes,
> `POST /announcements` **no verificaba nada**: con el `x-user-id` de un psicólogo y sin
> ninguna credencial se publicaba un anuncio firmado con su nombre a toda la sede. Ahora el
> autor sale del token.
>
> Los otros dos llevan `JwtAuthGuard` **sin `@Roles()`** a propósito: `community.service.ts`
> ya distingue autor de psicólogo (`assertPsychologist`), y un guard de rol le quitaría al
> paciente el borrado de sus propias publicaciones. La identidad ya no es falsificable
> —viene del token—, que era el problema real.

## `ai-assistant` — `/ai`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /ai/sessions` | `patient` (dueño) | ✅ Autenticado |
| `GET /ai/sessions/active` | `patient` (dueño) | ✅ Autenticado |
| `POST /ai/sessions/:sessionId/messages` | `patient` (dueño) | ✅ Autenticado |
| `POST /ai/sessions/:sessionId/close` | `patient` (dueño) | ✅ Autenticado |
| `GET /ai/sessions/summaries` | `patient` (dueño); `psychologist` de sus pacientes (no implementado) | ✅ Autenticado |

## `clinical-records` — `/clinical-records`  _(HdU13, 19-09-2026)_

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /clinical-records/patients/:patientId` | `psychologist` (sus asignados), `coordinator` | ✅ Protegido + asignación |
| `PUT /clinical-records/patients/:patientId` | `psychologist` (sus asignados), `coordinator` | ✅ Protegido + asignación |
| `GET /clinical-records/patients/:patientId/history` | `psychologist` (sus asignados), `coordinator` | ✅ Protegido + asignación |

> **El paciente no accede a su propia ficha, y es a propósito.** `@Roles('psychologist',
> 'coordinator')` lo deja fuera con 403. Es material clínico que el psicólogo escribe *sobre* el
> paciente —motivo de consulta, antecedentes de salud, objetivos terapéuticos—, no un dato del
> perfil. Abrirlo al paciente es una decisión clínica de AJUTER, no un permiso que se agregue de
> pasada.
>
> El CA5 de la HdU13 habla de «una sede distinta a la suya», pero acá el filtro es la
> **asignación** (`PatientAccessGuard`), que es más estricta: un psicólogo de la misma sede sin
> asignación tampoco entra. Se prefirió a comparar sedes porque `users.sedeId` guarda a veces el
> nombre y a veces el UUID (ver `CLAUDE.md`), y un filtro por sede fallaría en silencio.

## `check-ins` — `/check-ins`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /check-ins/today` | `patient` (dueño) | ✅ Autenticado |
| `DELETE /check-ins/today` | `patient` (dueño) — ruta de demo, evaluar removerla en producción | ✅ Autenticado |
| `POST /check-ins` | `patient` (dueño) | ✅ Autenticado |

## `achievements` — `/achievements`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /achievements` | `patient` (dueño) | ✅ Autenticado |
| `POST /achievements/relapse` | `patient` (dueño) | ✅ Autenticado |
| `POST /achievements/dev-set-days` | Ninguno — es una puerta trasera de desarrollo | ✅ Autenticado + 404 salvo `ENABLE_DEV_TOOLS=true` |
| `POST /achievements/badges/:milestone/share` | `patient` (dueño) | ✅ Autenticado |
| `POST /achievements/patients/:patientId/relapse` | `psychologist` (sus asignados), `coordinator` | ✅ Protegido + asignación — nuevo 16-09: la ficha registraba la recaída mandando el id del paciente en `x-user-id` |

## `notifications` — `/notifications`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /notifications` | Cualquier rol autenticado (dueño) | ✅ Autenticado |
| `PATCH /notifications/:id/read` | Cualquier rol autenticado (dueño) | ✅ Autenticado |
| `PATCH /notifications/read-all` | Cualquier rol autenticado (dueño) | ✅ Autenticado |

## `billing` — `/billing`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /billing/status` | `patient`, `family` (del paciente vinculado) | ✅ Autenticado |
| `POST /billing/pay` | `patient`, `family` | ✅ Autenticado |
| `GET /billing/family-link` | `patient` (dueño) | ✅ Autenticado |
| `GET /billing/patients/:patientId/status` | `psychologist` (sus asignados), `coordinator` | ✅ Protegido + asignación — nuevo 16-09, para el reporte PDF |
| `GET /family/billing` | `family` (solo con vínculo `active`) | ✅ Protegido — nuevo 22-09, solo lectura: cuotas del paciente vinculado para la pantalla de pago del portal |

## `subscriptions` — `/subscriptions`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /subscriptions` | `patient` (dueño) | ✅ Autenticado (el paciente sale del token; el `userId` del cuerpo se ignora) |
| `GET /subscriptions/me` | `patient` (dueño) | ✅ Autenticado |

---

## Huecos cerrados el 16-09-2026

| Endpoint | Qué permitía | Cómo se cerró |
|---|---|---|
| `POST /panic/assign` | Cambiarle el compañero de viaje a cualquier paciente, sin credencial | Token + `@Roles('psychologist', 'coordinator')` |
| `POST /subscriptions` | Activar la suscripción de cualquier paciente escribiendo su id en el cuerpo | El paciente sale del token |
| `GET /community/posts/:id/replies` | Leer el foro clínico sin identidad | Guard global |
| Los 40 usos de `x-user-id` en 9 controladores | Leer o escribir como cualquier paciente sabiendo su UUID (check-ins, conversaciones con el asistente, pánico, comunidad, cobros) | `@UserId()` desde el token |
| `GET /metrics/patients/:id`, `GET /users/:id/progress` | Un psicólogo leía los datos de cualquier paciente cambiando el id en la URL | `PatientAccessGuard` |

Todo con tests: `test/auth-global.e2e-spec.ts` (15 casos), `test/roles.e2e-spec.ts` y
`common/guards/patient-access.guard.spec.ts`.

---

## Lo que sigue pendiente

1. **Restringir por rol los endpoints «✅ Autenticado».** El token ya no se puede falsificar,
   pero cualquier rol autenticado puede llamarlos. Ejemplos: un psicólogo puede crear una
   alerta de pánico a su propio nombre (`POST /panic/alerts`) o escribir en el foro, y un
   familiar puede pedir `/ai/sessions`. No expone datos ajenos —el servicio usa el id del
   token—, pero crea filas que no deberían existir. Es agregar `@Roles()` endpoint por
   endpoint, con cuidado de no romper la vista del psicólogo en mobile, que sí usa comunidad.
2. **`GET /community/announcements` y `GET /community/posts` no filtran por sede** del usuario:
   la sede llega como parámetro.
3. **Rutas de demo en producción:** `DELETE /check-ins/today` y `DELETE /panic/alerts/active`
   siguen disponibles para cualquier paciente autenticado. Deberían ir detrás de
   `ENABLE_DEV_TOOLS`, como `dev-set-days`.
4. **Moderación para la coordinación:** `GET /community/moderation/flagged` le responde 403 a
   la coordinación, y la página de Solicitudes lo pide igual. No es un hueco (falla cerrado),
   pero ensucia la consola.

## HTTPS (parte de S.6)

Todas las conexiones de producción van sobre HTTPS por el proxy de Railway, que termina TLS
por defecto en los dominios que asigna (`*.up.railway.app` y dominios custom conectados).
No requiere configuración adicional en el código del backend — Railway maneja el certificado
y el redirect. En desarrollo local, HTTP simple es aceptable (no hay tráfico real ni el dominio
público de Railway).

## Cifrado en reposo (parte de S.6)

El RUT (`User.rut`) es el **único campo `rut` de todo el backend** — verificado: no hay una
segunda columna en `RegistrationRequest` ni en ninguna otra entidad. `registration.service.ts`
escribe directo en `User.rut`, así que el RUT del registro de un paciente queda cifrado desde
el primer guardado, sin ninguna ruta alternativa en texto plano. Cifrado con AES-256-GCM vía
column transformer de TypeORM — ver
`apps/backend/src/common/crypto/encrypted-column.transformer.ts`.

---
