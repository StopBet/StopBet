# Matriz de permisos — StopBet API

**Entregable del SPIKE 1, criterio S.4.** Inventario completo de los 56 endpoints del
backend (13 controllers) con el rol que debería poder acceder a cada uno, y el estado real
de protección hoy.

> Roles del sistema: `patient`, `psychologist`, `coordinator`, `sponsor`, `family`, y
> **público** (sin autenticación). `coordinator` se agregó en el PR de contrato (#19).

## Cómo leer la columna "Estado actual"

| Símbolo | Significa |
|---|---|
| ✅ Protegido | Pasa por `JwtAuthGuard` + `RolesGuard` — el rol se verifica contra un token firmado |
| ✅ Autenticado | Pasa por `JwtAuthGuard` sin `@Roles()` — la identidad viene de un token firmado y el servicio decide qué puede hacer cada quien |
| ⚠️ Verificado sin guard | El servicio compara el rol, pero contra el header `x-user-id` — **falsificable**, cualquiera puede mandar el UUID que quiera |
| ⚠️ Scoped por dueño | No verifica rol, pero la query solo devuelve/modifica filas de ese `userId` — limita el daño, no es control de acceso real |
| ❌ Abierto | Sin identidad de ningún tipo. Cualquiera en internet puede llamarlo |
| 🔓 Público (correcto) | Diseñado para ser público (login, catálogo de sedes, registro de pacientes) |

**Resumen (actualizado 16-09-2026):** de los 56 endpoints originales, **20 están protegidos
de verdad** con `JwtAuthGuard` + `RolesGuard` — `family` (7, Alex), `psychologists` (5,
Matías Lara — módulo nuevo de HdU24), `registration` (3, Matías Lara), `users` (2, José),
`community` (1, anuncios), `metrics` (1, Eduardo), `panic` (1, José) — **más 2 con
`JwtAuthGuard` solo** (`moderation/flagged` y `DELETE /posts/:id`, donde el servicio ya
distingue autor de psicólogo). El resto sigue documentado como deuda cruzada (ver
[Huecos críticos](#huecos-críticos)), que ya se achicó tres veces: `registration/pending`,
`approve` y `reject` primero; `panic/alerts/history` después; y los tres de `community` el
16-09.

---

## `auth` — `/auth`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /auth/login` | Público | 🔓 Público (correcto) |
| `POST /auth/refresh` | Público (requiere refresh token válido) | 🔓 Público (correcto) |
| `POST /auth/logout` | Público (requiere refresh token válido) | 🔓 Público (correcto) |

## `users` — `/users`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /users/patients` | `psychologist` (los suyos), `coordinator` (todos) | ✅ Protegido |
| `GET /users/:id/progress` | `psychologist`, `coordinator` | ✅ Protegido |

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
| `GET /health` | Público (lo usa el healthcheck de Railway) | 🔓 Público (correcto) |

## `sedes` — `/sedes`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /sedes` | Público (catálogo, sin dato sensible) | 🔓 Público (correcto) |

## `registration` — `/registration`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /registration/submit` | Público (onboarding del paciente) | 🔓 Público (correcto) |
| `GET /registration/:requestId` | Público (el UUID de la solicitud actúa como secreto) | 🔓 Público (aceptable) |
| `GET /registration/pending` | `psychologist`, `coordinator` | ✅ Protegido |
| `PATCH /registration/:requestId/approve` | `psychologist`, `coordinator` | ✅ Protegido |
| `PATCH /registration/:requestId/reject` | `psychologist`, `coordinator` | ✅ Protegido |

## `panic` — `/panic`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /panic/sponsor` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `POST /panic/assign` | `psychologist`, `coordinator` | ❌ **Abierto — cualquiera reasigna el padrino de cualquier paciente** |
| `POST /panic/alerts` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `GET /panic/alerts/history` | `psychologist`, `coordinator` | ✅ Protegido |
| `GET /panic/alerts/active` | `patient` o `sponsor` (dueño) | ⚠️ Scoped por dueño |
| `GET /panic/pending` | `sponsor` (dueño) | ⚠️ Scoped por dueño |
| `POST /panic/alerts/:id/respond` | `sponsor` (dueño) | ⚠️ Scoped por dueño |
| `DELETE /panic/alerts/active` | `patient` (dueño) — ruta de demo | ⚠️ Scoped por dueño |
| `POST /panic/alerts/:id/cancel` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `POST /panic/alerts/:id/escalate` | `patient` (dueño) o sistema (automático) | ⚠️ Scoped por dueño |
| `POST /panic/alerts/:id/community` | `patient` (dueño) | ⚠️ Scoped por dueño |

## `community` — `/community`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /community/announcements` | `patient`, `sponsor` (de la sede) | ⚠️ Sin verificación de rol ni sede |
| `POST /community/announcements` | `psychologist`, `coordinator` | ✅ Protegido |
| `POST /community/announcements/:id/attend` | `patient`, `family` | ⚠️ Sin verificación |
| `GET /community/posts` | `patient`, `sponsor` (de la sede) | ⚠️ Sin verificación |
| `POST /community/posts` | `patient`, `sponsor` | ⚠️ Sin verificación |
| `POST /community/posts/:id/reactions` | `patient`, `sponsor` | ⚠️ Sin verificación |
| `DELETE /community/posts/:id/reactions/:emoji` | `patient`, `sponsor` (propia reacción) | ⚠️ Sin verificación |
| `GET /community/posts/:id/replies` | `patient`, `sponsor` | ❌ **Abierto — sin ninguna identidad** |
| `POST /community/posts/:id/replies` | `patient`, `sponsor` | ⚠️ Sin verificación |
| `POST /community/posts/:id/report` | `patient`, `sponsor` | ⚠️ Sin verificación |
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
| `POST /ai/sessions` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `GET /ai/sessions/active` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `POST /ai/sessions/:sessionId/messages` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `POST /ai/sessions/:sessionId/close` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `GET /ai/sessions/summaries` | `patient` (dueño); `psychologist` de sus pacientes (no implementado) | ⚠️ Scoped por dueño |

## `check-ins` — `/check-ins`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /check-ins/today` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `DELETE /check-ins/today` | `patient` (dueño) — ruta de demo, evaluar removerla en producción | ⚠️ Scoped por dueño |
| `POST /check-ins` | `patient` (dueño) | ⚠️ Scoped por dueño |

## `achievements` — `/achievements`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /achievements` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `POST /achievements/relapse` | `patient` (dueño) | ⚠️ Scoped por dueño |
| `POST /achievements/dev-set-days` | Ninguno — es una puerta trasera de desarrollo | ⚠️ Tras un flag: responde 404 salvo que `ENABLE_DEV_TOOLS=true` |
| `POST /achievements/badges/:milestone/share` | `patient` (dueño) | ⚠️ Scoped por dueño |

## `notifications` — `/notifications`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /notifications` | Cualquier rol autenticado (dueño) | ⚠️ Scoped por dueño |
| `PATCH /notifications/:id/read` | Cualquier rol autenticado (dueño) | ⚠️ Scoped por dueño |
| `PATCH /notifications/read-all` | Cualquier rol autenticado (dueño) | ⚠️ Scoped por dueño |

## `billing` — `/billing`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `GET /billing/status` | `patient`, `family` (del paciente vinculado) | ⚠️ Scoped por dueño |
| `POST /billing/pay` | `patient`, `family` | ⚠️ Scoped por dueño |
| `GET /billing/family-link` | `patient` (dueño) | ⚠️ Scoped por dueño |

## `subscriptions` — `/subscriptions`

| Método + Path | Rol objetivo | Estado actual |
|---|---|---|
| `POST /subscriptions` | `patient`, `family` | ❌ **Abierto — el `userId` viene del body, cualquiera activa la cuenta de cualquiera** |
| `GET /subscriptions/me` | `patient` (dueño) | ⚠️ Scoped por dueño |

---

## Huecos críticos

Los siguientes endpoints exponen datos clínicos o permiten acciones sensibles **sin ninguna
verificación de identidad**. Se documentan aquí como deuda de seguridad cruzada — arreglarlos
no es de José (son de otros módulos), pero deben quedar visibles para que cada dueño los
priorice:

| Endpoint | Qué expone/permite | Módulo / dueño en este sprint |
|---|---|---|
| `POST /panic/assign` | Reasignar el padrino de cualquier paciente | `panic` — Matías Barraza |
| `GET /community/posts/:id/replies` | Contenido del foro clínico, sin identidad | `community` — Catalina Yáñez |
| `POST /subscriptions` | Activar la cuenta de cualquier paciente (`userId` en el body) | `subscriptions` — sin dueño asignado este sprint |

**De los propios de José:** `GET /users/patients`, `GET /users/:id/progress` y
`GET /panic/alerts/history` estaban en esta lista — los tres protegidos, y probados con 403
real en `test/roles.e2e-spec.ts` (S.5).

**Cerrados después de la primera versión de esta matriz:** `POST /community/announcements`
(16-09, ahora con guard y rol) y `POST /achievements/dev-set-days` (14-09, detrás de
`ENABLE_DEV_TOOLS`; no se usó `NODE_ENV` porque Railway corre con `development`).

---

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

## Próximos pasos (fuera de este sprint)

1. Registrar `JwtAuthGuard` como guard global (con `@Public()` en los endpoints que deben
   quedar abiertos) — hoy los guards son opt-in por endpoint para no romper a los otros 5
   integrantes a mitad de sprint. Es el paso que cierra la mayoría de los ⚠️ de esta tabla.
2. Migrar los endpoints ⚠️ "Scoped por dueño" a leer el `userId` desde `request.user` (el JWT)
   en vez de aceptar un `userId`/`patientId`/`sponsorId` explícito del cliente.
3. Cerrar los huecos ❌ listados arriba, cada uno por su dueño de módulo.
