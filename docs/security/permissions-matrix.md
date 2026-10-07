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
| `GET /registration/pending` | `coordinator` | ✅ Protegido |
| `GET /registration/rejected` | `coordinator` | ✅ Protegido |
| `PATCH /registration/:requestId/approve` | `coordinator` | ✅ Protegido |
| `PATCH /registration/:requestId/reject` | `coordinator` | ✅ Protegido |
| `PATCH /registration/:requestId/reopen` | `coordinator` | ✅ Protegido |

Con la HdU19 v2 solo coordinación decide sobre las solicitudes de ingreso; es un supuesto sin confirmar, ver [`docs/hdu19-solicitudes-ingreso-v2.md`](../hdu19-solicitudes-ingreso-v2.md).

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
| `POST /community/announcements` | `psychologist`, `coordinator` | ✅ Protegido + 403 si la sede no es suya (nuevo 22-09) |
| `POST /community/announcements/:id/attend` | `patient`, `family` | ✅ Autenticado |
| `GET /community/posts` | `patient`, `sponsor` (de la sede) | ✅ Autenticado |
| `POST /community/posts` | `patient`, `sponsor` | ✅ Protegido — nuevo 22-09: `@Roles('patient','sponsor')`; la sede sale del token, no del cuerpo |
| `POST /community/posts/:id/reactions` | `patient`, `sponsor` | ✅ Autenticado |
| `DELETE /community/posts/:id/reactions/:emoji` | `patient`, `sponsor` (propia reacción) | ✅ Autenticado |
| `GET /community/posts/:id/replies` | `patient`, `sponsor` | ✅ Autenticado |
| `POST /community/posts/:id/replies` | `patient`, `sponsor`, `psychologist` (sus sedes) | ✅ Autenticado + 403 si la publicación es de otra sede (nuevo 22-09) |
| `POST /community/posts/:id/report` | `patient`, `sponsor` | ✅ Autenticado |
| `GET /community/moderation/flagged` | `psychologist` | ✅ Autenticado |
| `DELETE /community/posts/:id` | `psychologist`, o el autor sobre su propia publicación | ✅ Autenticado |
| `POST /community/moderation/posts/:id/dismiss` | `psychologist` | ✅ Autenticado + `assertPsychologist` — nuevo 22-09: descarta los reportes y deja la publicación |

> **Los tres se cerraron el 16-09-2026** (vista del psicólogo en mobile). Antes,
> `POST /announcements` **no verificaba nada**: con el `x-user-id` de un psicólogo y sin
> ninguna credencial se publicaba un anuncio firmado con su nombre a toda la sede. Ahora el
> autor sale del token.
>
> Los otros dos llevan `JwtAuthGuard` **sin `@Roles()`** a propósito: `community.service.ts`
> ya distingue autor de psicólogo (`assertPsychologist`), y un guard de rol le quitaría al
> paciente el borrado de sus propias publicaciones. La identidad ya no es falsificable
> —viene del token—, que era el problema real.

## `direct-messages` — `/messages`

Nuevo el 30-09 (mensajes directos de Comunidad). Todo el controlador lleva
`@Roles('patient', 'sponsor')`: el equipo clínico **no** entra, ni siquiera a leer. Lo único de
una conversación privada que le llega es un mensaje reportado, por la cola de moderación de
`community` (con `type: 'direct_message'`).

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /messages/stream` | `patient`, `sponsor` (solo lo suyo) | ✅ Protegido — SSE filtrado por el usuario del token |
| `GET /messages/conversations` | `patient`, `sponsor` (solo las suyas) | ✅ Protegido |
| `GET /messages/contacts` | `patient`, `sponsor` (de su sede) | ✅ Protegido — solo cuentas activas de la misma sede, sin bloqueos |
| `GET /messages/with/:userId` | `patient`, `sponsor` | ✅ Protegido — 404 si el otro no es de su sede y no hay conversación previa |
| `POST /messages/with/:userId` | `patient`, `sponsor` | ✅ Protegido — misma sede y sin bloqueo en ninguna dirección (403) |
| `POST /messages/with/:userId/read` | `patient`, `sponsor` | ✅ Protegido |
| `POST /messages/:id/report` | `patient`, `sponsor` (quien lo recibió) | ✅ Protegido — 404 si no es de una conversación propia |
| `DELETE /messages/:id` | `patient`, `sponsor` (el autor) | ✅ Protegido — 403 si no es propio |
| `POST /messages/blocks/:userId` | `patient`, `sponsor` | ✅ Protegido |
| `DELETE /messages/blocks/:userId` | `patient`, `sponsor` | ✅ Protegido |

> La moderación de mensajes directos reusa `GET /community/moderation/flagged`,
> `POST /community/moderation/posts/:id/dismiss` y `DELETE /community/posts/:id`: si el id no es
> de una publicación del foro, prueban con un mensaje directo. El borrado por moderación exige
> que el mensaje **tenga un reporte**; sin reporte da 403.

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

## `payments` — `/payments/oneclick`  _(SPIKE 2, 07-10-2026)_

Sandbox de Webpay Oneclick. Ver [`docs/planning/spike2-pasarela-pago.md`](../planning/spike2-pasarela-pago.md).

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /payments/oneclick/inscriptions` | `patient` | ✅ Protegido |
| `GET /payments/oneclick/inscriptions/return` y `POST` | Público | 🔓 Público — Transbank devuelve al **navegador** del paciente sin token. **No cierra la inscripción**: solo lee `TBK_TOKEN`, `TBK_ORDEN_COMPRA` y `TBK_ID_SESION` y los reenvía a la página, `@Throttle` de 20 por minuto, y siempre responde con una redirección, nunca con un error |
| `POST /payments/oneclick/inscriptions/finish` | `patient` (dueño) | ✅ Protegido — cierra la inscripción **solo si es de quien llama**; una ajena responde `error`, igual que una inexistente. Es lo que evita que alguien deje la tarjeta de otra persona atada a su cuenta |
| `GET /payments/oneclick/inscription` y `DELETE` | `patient` (dueño) | ✅ Protegido — solo la tarjeta propia; devuelve tipo y últimos 4 dígitos, nunca el `tbk_user` |
| `POST /payments/oneclick/charges` y `GET` | `patient` (dueño) | ✅ Protegido — solo cuotas propias |
| `POST /payments/oneclick/charges/run-due` | `coordinator` | ✅ Protegido + `ENABLE_DEV_TOOLS` (404 si no está) — cobra la cuota vencida de **todos** los pacientes que tengan una tarjeta inscrita y la cuenta activa (omite las suspendidas) |
| `GET /payments/oneclick/charges/:id/transbank-status` | `coordinator` | ✅ Protegido + `ENABLE_DEV_TOOLS` |
| `GET /payments/oneclick/test-page` | Público | 🔓 Público, **solo con `ENABLE_DEV_TOOLS`** (404 si no). Es HTML estático sin datos: no hay nada que filtrar |

**Pendiente antes de producción:** `run-due` hoy es una herramienta de desarrollo. El cobro real lo
dispara el cron (`TBK_AUTO_CHARGE_CRON`, apagado por defecto), que no es un endpoint. Quién paga
(`family`) todavía no tiene ruta: ver `ASUNCIONES-PENDIENTES.md`, punto 4.

## `family` — `/family`  _(HdU11, 22 y 23; actualizado 29-09-2026)_

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /family/register` | **público** | 🔓 Público — quien se registra todavía no tiene cuenta. **5 por minuto**: el 409 por RUT repetido que exige HDU 22 CA3 permite sondear si un RUT existe, y el límite lo encarece. Misma respuesta exista o no el paciente declarado |
| `POST /family/link` | `family` | ✅ Protegido — 5 por minuto. Responde igual exista o no el paciente (antes daba 404 y servía para averiguar quién es paciente) |
| `GET /family/link-status` | `family` | ✅ Protegido — solo el vínculo propio |
| `GET /family/sessions` | `family` | ✅ Protegido — solo con vínculo `active`, sesiones de la sede del paciente |
| `POST /family/sessions/:id/attendance` | `family` | ✅ Protegido — exige vínculo `active` y que la sesión sea de la sede del paciente (otra sede responde igual que una inexistente) |
| `GET /family/billing` | `family` | ✅ Protegido — solo con vínculo `active`, solo lectura |
| `GET /family/pending`, `GET /family/active` | `psychologist`, `coordinator` | ✅ Protegido — un psicólogo solo ve los de sus sedes; la coordinación, todos. Los intentos con un paciente inexistente no aparecen nunca |
| `PATCH /family/links/:id/confirm` \| `reject` \| `revoke` | `psychologist`, `coordinator` | ✅ Protegido — misma regla de sede (403 fuera de ella). Confirmar exige cómo se verificó y respeta el «no» del paciente |
| `GET /family/revoked` | `psychologist`, `coordinator` | ✅ Protegido — misma regla de sede que pendientes y vinculados (06-10) |
| `GET /family/rejected` | `psychologist`, `coordinator` | ✅ Protegido — misma regla de sede; solo lectura (HDU 23 CA6, 07-10) |
| `GET /family/links/:id/history` | `psychologist`, `coordinator` | ✅ Protegido — autor, fecha y veredicto de cada decisión (HDU 23 CA6, 07-10). 403 si el paciente es de una sede que no atiende, 404 si no existe; el id se valida con `ParseDbUuidPipe` |
| `PATCH /family/links/:id/reopen` | `psychologist`, `coordinator` | ✅ Protegido — misma regla de sede; solo desde `revoked`, y vuelve a `pending` (no restaura el acceso) |
| `GET /family/patient-requests` | `patient` | ✅ Protegido — solo las solicitudes pendientes dirigidas a él |
| `PATCH /family/patient-requests/:id` | `patient` | ✅ Protegido — solo las propias y pendientes (404 si no) |
| `GET /family/sede/sessions` | `psychologist`, `coordinator` | ✅ Protegido — la sede sale del token |
| `GET /family/sessions/:id/attendance` | `psychologist`, `coordinator` | ✅ Protegido — solo sesiones de sus sedes; una ajena responde 404, igual que una inexistente (cerrado el 29-09) |
| `POST /family/sessions` | `psychologist`, `coordinator` | ✅ Protegido — solo en sus sedes, 403 fuera de ellas (cerrado el 29-09) |

---

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

> _Cerrado el 29-09-2026_: `GET /family/sessions/:id/attendance` y `POST /family/sessions` no
> revisaban la sede del psicólogo (código de la HU-11): se veía quién asiste a una sesión de
> cualquier sede con solo su id. Ahora usan la misma regla que `/family/pending`.

1. **Restringir por rol los endpoints «✅ Autenticado».** El token ya no se puede falsificar,
   pero cualquier rol autenticado puede llamarlos. Ejemplo que queda: un psicólogo puede crear
   una alerta de pánico a su propio nombre (`POST /panic/alerts`), y un familiar puede pedir
   `/ai/sessions`. No expone datos ajenos —el servicio usa el id del token—, pero crea filas
   que no deberían existir. Es agregar `@Roles()` endpoint por endpoint.
   - _Cerrado en `community` el 22-09_: abrir una publicación en el foro es de `patient` y
     `sponsor`; el equipo clínico responde y publica anuncios, que van firmados con el rol.
2. **Las lecturas por sede siguen recibiéndola como parámetro** (`GET /community/announcements`,
   `GET /community/posts`): un token de una sede puede listar el foro de otra. Es a propósito
   mientras el equipo clínico use el selector de sede, pero **para un paciente no debería**.
   - _Cerrado el 22-09 en la escritura_: `POST /community/posts` guarda la sede de la cuenta e
     ignora la del cuerpo, y responder en una publicación de otra sede da 403. Antes cualquier
     sesión publicaba en el foro de cualquier sede mandándola en el JSON.
   - Las tres lecturas aceptan el **nombre o el UUID** de la sede y devuelven las dos formas
     (`formasDeSede`), porque `users.sedeId` guarda una u otra según de dónde venga la cuenta.
     Sin eso el foro de una sede quedaba partido en dos mitades que no se veían entre sí.
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
