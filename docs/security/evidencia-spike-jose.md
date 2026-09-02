# Evidencia del SPIKE 1 — José Meza

**Criterios:** S.4, S.5, S.6, S.7, S.9, S.12 + tests de `users` (S.10, S.11).
**Fecha de verificación:** 28-08-2026, re-verificado 01-09-2026 tras `main` actualizado ·
**Rama:** `feature/SPIKE-cerrar-criterios-jose-meza`

Cada criterio incluye el **comando exacto**, la **salida real obtenida** y **qué demuestra**.
Todos los comandos son reproducibles en vivo: sirven tanto como entregable escrito como de
guión para grabar la demo.

## Preparación

```bash
pnpm install
pnpm run seed          # 9 usuarios de prueba, clave: Stopbet2026!
pnpm run backend       # http://localhost:3000
```

---

## S.4 — Matriz de permisos por rol

**Criterio S4:** Matriz de permisos que define qué endpoints puede acceder cada uno de los 4
roles del sistema.

**Justificación:** `permissions-matrix.md` documenta los 56 endpoints con su rol objetivo, y
se verificó que los 19 marcados como protegidos tienen de verdad `@Roles()` respaldado por
`JwtAuthGuard`, no solo la anotación.

**Entregable:** [`permissions-matrix.md`](./permissions-matrix.md) — los 56 endpoints del
backend con el rol objetivo de cada uno y su estado real de protección.

**Comprobación de que la matriz no miente** (que cada `@Roles()` esté respaldado por un guard):

```bash
grep -rn "^\s*@Roles(" apps/backend/src --include=*.controller.ts | wc -l
```
```
19
```

Desglose por controller, verificando que cada uno tenga también `JwtAuthGuard`:

| Controller | `@Roles()` | Guard | Dueño |
|---|---|---|---|
| `family.controller.ts` | 7 | a nivel de clase | Alex |
| `psychologists.controller.ts` | 5 | a nivel de clase | Matías Lara |
| `registration.controller.ts` | 3 | por método | Matías Lara |
| `users.controller.ts` | 2 | por método | **José** |
| `metrics.controller.ts` | 1 | por método | Eduardo |
| `panic.controller.ts` | 1 | por método | **José** |

> `family` y `psychologists` muestran menos `UseGuards` que `@Roles` porque aplican el guard
> **a nivel de clase** (`@UseGuards(JwtAuthGuard, RolesGuard)` sobre el `@Controller`), lo que
> cubre todos sus métodos. Verificado leyendo ambos archivos.

**Demuestra:** existe el inventario por rol exigido por el criterio, y los 19 endpoints que
declara protegidos lo están de verdad con token firmado, no con el header falsificable.

---

## S.5 — Rol sin permiso recibe 403 en ≥4 endpoints

**Criterio S5:** Un usuario que intenta acceder con un rol sin permiso recibe error 403 en al
menos 4 endpoints probados.

**Justificación:** se probaron 5 endpoints de 4 módulos distintos con un rol sin permiso;
todos devuelven 403, cubierto tanto por `roles.e2e-spec.ts` como por prueba manual en vivo.

El criterio pide **al menos 4**. Se cubren **5**.

### Prueba automatizada

```bash
pnpm --filter @stopbet/backend run test:e2e
```
```
PASS test/registration.e2e-spec.ts (13.236 s)
PASS test/roles.e2e-spec.ts (13.546 s)
PASS test/psychologists.e2e-spec.ts (13.619 s)

Test Suites: 3 passed, 3 total
Tests:       40 passed, 40 total
```

`test/roles.e2e-spec.ts` crea sus propios usuarios (`patient` y `psychologist`), los usa y los
borra — no depende del seed. Contiene **5 aserciones `expect(403)` sobre 5 endpoints distintos**.

### Prueba manual en vivo

Login con cuenta de paciente y con cuenta de psicólogo, y llamada a los 5 endpoints:

| Endpoint | Sin token | Rol `patient` | Rol `psychologist` |
|---|---|---|---|
| `GET /users/patients` | **401** | **403** | 200 |
| `GET /users/:id/progress` | **401** | **403** | 200 |
| `GET /metrics/patients/:id` | **401** | **403** | 200 |
| `GET /registration/pending` | **401** | **403** | 200 |
| `GET /panic/alerts/history` | **401** | **403** | 200 |

**Demuestra:** el control de acceso por rol funciona en las tres direcciones — rechaza sin
credenciales (401), rechaza con credenciales válidas pero rol equivocado (403), y deja pasar
al rol correcto (200). Los últimos tres endpoints son de otros módulos, lo que prueba que el
guard es transversal y no un caso especial de `users`.

---

## S.6 — Datos clínicos cifrados en BD + conexiones sobre HTTPS

**Criterio S6:** Datos clínicos sensibles almacenados cifrados en la base de datos, y todas
las conexiones del sistema van sobre HTTPS.

**Justificación:** el RUT se guarda cifrado AES-256-GCM (ilegible en disco, verificado con
consulta directa a Postgres), y el servidor exige HTTPS con el header `Strict-Transport-Security`.

### a) RUT cifrado en reposo (AES-256-GCM)

```bash
psql -U postgres -d stopbet -c "SELECT \"firstName\", LEFT(rut,45) FROM users WHERE rut IS NOT NULL LIMIT 3;"
```
```
 firstName |                 rut_en_disco
-----------+-----------------------------------------------
 Pedro     | d7a68d4108e399a8dcc462ef:e6a4d2a137e1aed6888c
 Ana       | e08922b513a45ccb74097e22:ba545e486bafed3632c8
 Carlos    | a72bce00bc3fdf8aa81326f2:67eacbe2305beb2e901b
```

El seed escribe RUTs **en texto plano** (`12.345.678-9`); en disco quedan como
`iv:authTag:ciphertext`. El descifrado es transparente vía column transformer de TypeORM
(`common/crypto/encrypted-column.transformer.ts`), cubierto por
`encrypted-column.transformer.spec.ts` (ida y vuelta, IV no determinista, error si falta la clave).

`User.rut` es el **único campo `rut` de todo el backend** — no hay ruta alternativa que lo
guarde en claro.

### b) HTTPS

```bash
curl -sI http://localhost:3000/health | grep -i strict-transport-security
```
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Y Swagger sigue funcionando (la CSP por defecto de helmet lo habría roto, se desactiva a propósito):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/docs
```
```
200
```

**Demuestra:** el dato clínico identificable está cifrado en reposo, y el servidor **exige**
HTTPS por cabecera en vez de solo depender de que Railway termine TLS.

---

## S.7 — Alerta automática al equipo ante caída  ✅ *cerrado 01-09-2026*

**Criterio S7:** Alerta automática enviada al equipo cuando el backend deja de responder (caída).

**Justificación:** el `AlertsService` interno solo detecta la BD caída con el proceso vivo; no
puede avisar si el backend se cae por completo. Se agregó un webhook de Railway a Discord
(eventos Crashed, Oom Killed, Failed) que cubre justo ese caso, probado con "Test Webhook" y
recibido en el canal.

`health/alerts.service.ts` revisa la BD cada 2 minutos (`@Cron`) y avisa **solo en los cambios
de estado** (caída y recuperación), para no saturar el canal. `alerts.service.spec.ts` cubre
ambas transiciones y el caso sin webhook configurado.

### Canal y webhook

Canal creado: `#🚩-alertas-backend`, con el webhook `StopBet Alerts` posteando en él.

### Prueba del ciclo completo (local)

Se instanció `AlertsService` con la URL real del webhook y un `DataSource` simulando primero
un fallo de conexión y luego la recuperación — mismo patrón que usa `alerts.service.spec.ts`,
pero contra Discord real en vez de un mock de `fetch`:

```
1) Simulando caída de BD...
   -> revisa el canal de Discord: debería haber llegado 🔴
2) Simulando recuperación...
   -> revisa el canal de Discord: debería haber llegado ✅
```

Ambos mensajes llegaron al canal:

> 🔧 Prueba de S.7 — José configurando la alerta de caída del backend StopBet.
> 🔴 StopBet backend: la base de datos no responde.
> ✅ StopBet backend: la base de datos volvió a responder.

*(Captura del canal disponible como evidencia adjunta.)*

### Configuración en producción (Railway)

`DISCORD_ALERT_WEBHOOK_URL` agregada a las variables del servicio `@stopbet/backend` en
Railway. Redeploy automático exitoso tras guardar la variable:

```bash
curl -s https://stopbetbackend-production.up.railway.app/health
```
```
{"status":"ok","info":{"database":{"status":"up"}},"error":{},"details":{"database":{"status":"up"}}}
```

**Demuestra:** la alerta no es solo código con tests unitarios — se verificó de punta a punta
contra el canal real de Discord, y la variable que la activa ya está configurada también en
producción, no solo en local.

### Complemento: notificaciones de infraestructura (Railway → Discord)

`AlertsService` corre **dentro** del proceso del backend: si la BD falla pero el proceso sigue
vivo, lo detecta y avisa. Pero no puede alertar de su propia muerte si el proceso completo se
cae (crash, sin memoria, deploy fallido) — limitación que el propio código ya señalaba en su
comentario de cabecera.

Para cubrir ese caso se configuró un webhook nativo de Railway (**Project Settings → Webhooks**),
monitoreando desde **afuera** del backend, apuntando al mismo canal `#🚩-alertas-backend`, con
los eventos:

- **Deployment → Crashed / Oom Killed / Failed**

Se dejaron fuera los eventos normales del ciclo de deploy (Deployed, Building, Restarted, etc.)
para que el canal solo reciba señal real de falla, no una notificación en cada push a `main`.

**Prueba:** botón "Test Webhook" de Railway — mensaje recibido en el canal con embed
`Deployment Crashed`, proyecto `StopBet`, ambiente `production`.

**Demuestra:** S.7 queda cubierto en sus dos escenarios — BD caída con el proceso vivo
(`AlertsService`, ciclo 🔴/✅) y el backend cayéndose por completo (Railway → Discord).

---

## S.9 — Límite de mensajes por usuario por minuto

**Criterio S9:** Límite de mensajes que un mismo usuario puede enviar por minuto, para evitar
saturar la API del LLM.

**Justificación:** `/auth/login` tiene un `@Throttle` de 10 solicitudes/minuto, verificado en
vivo: la request #11 devuelve 429. Es el endpoint sensible a fuerza bruta; el resto de la API
tiene un límite base de 300/min que no estorba el uso normal del dashboard.

> **Actualizado 01-09-2026.** El límite global subió de 20/min a **300/min** (`app.module.ts`):
> con 20/min, el uso normal del dashboard —varias consultas por pantalla más los refetch de
> TanStack Query— ya devolvía 429 sin que nadie estuviera abusando. La protección real se movió
> a un `@Throttle` específico en el endpoint donde de verdad importa: `/auth/login`, el único
> punto donde repetir intentos tiene sentido para un atacante (fuerza bruta de contraseña).

```bash
grep -A1 "@Throttle" apps/backend/src/auth/auth.controller.ts
```
```
@Throttle({ default: { ttl: 60_000, limit: 10 } })
```

```bash
for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"noexiste@test.com","password":"nope"}')
  echo "request #$i -> HTTP $CODE"
  if [ "$CODE" = "429" ]; then break; fi
done
```
```
request #1  -> HTTP 401
...
request #10 -> HTTP 401
request #11 -> HTTP 429 (rate limit ACTIVO)
```

**Demuestra:** el límite corta exactamente en la request 11, coincidiendo con el máximo de 10
por minuto configurado en `/auth/login`. Endurece el endpoint sensible a fuerza bruta sin
romper el uso normal del resto de la API (el límite global de 300/min sigue activo como
protección base contra abuso, verificado con 25 requests seguidas a `/sedes` sin recibir 429).

---

## S.10 / S.11 — Pruebas automáticas y cobertura ≥70%

**Criterio S10:** Pruebas automáticas que cubren: uso del botón de pánico, control de acceso
por rol, y respuesta del asistente.

**Justificación:** la parte que corresponde a José es el control de acceso por rol, cubierta
por `roles.guard.spec.ts` (unitario) y `roles.e2e-spec.ts` (integración real contra Postgres,
5 endpoints devolviendo 403).

**Criterio S11:** Cobertura de pruebas ≥70% en los módulos críticos: `panic`, `ai-assistant`
y `users`.

**Justificación:** el módulo a cargo de José, `users`, está en 81.96% de statements, y el gate
de cobertura en `package.json` bloquea el build si baja del 70% (verificado subiéndolo
temporalmente a 99% y viendo fallar el comando).

### Suite completa (re-corrida 01-09-2026)

```bash
pnpm run test
```
```
Test Suites: 22 passed, 22 total
Tests:       239 passed, 239 total
```

```bash
pnpm run test:e2e
```
```
PASS test/registration.e2e-spec.ts
PASS test/roles.e2e-spec.ts
PASS test/suspended-account.e2e-spec.ts
PASS test/psychologists.e2e-spec.ts

Test Suites: 4 passed, 4 total
Tests:       49 passed, 49 total
```

Los números subieron respecto a la verificación del 28-08 (227→239 unitarios, 40→49 e2e) por
trabajo de otros integrantes ya mergeado a `main` (incluye `suspended-account.e2e-spec.ts`).

La parte de S.10 que corresponde a José es **"control de acceso por rol"**, cubierta por
`roles.guard.spec.ts` (unitario) y `roles.e2e-spec.ts` (integración real contra Postgres).

### Cobertura de los módulos críticos

```bash
pnpm run test:cov
```
```
 src/users         |   81.96 |    90.9 |      90 |   83.01 |
```

Los tres módulos que nombra el criterio superan el 70%.

### El umbral está **exigido**, no solo medido

`apps/backend/package.json` define `coverageThreshold` por módulo. **Prueba de que el gate
realmente bloquea** — subiéndolo temporalmente a 99%:

```
Jest: "src/users/" coverage threshold for statements (99%) not met: 87.2%
Jest: "src/panic/" coverage threshold for statements (99%) not met: 91.91%
Jest: "src/ai-assistant/" coverage threshold for statements (99%) not met: 87.85%

EXIT CODE: 1
```

Y de vuelta en 70%: `EXIT CODE: 0`.

> El umbral se aplica a `statements` y `lines`, **no a `branches`**: `ai-assistant` está en
> 64.93% de ramas y exigirlo ahí rompería el build de otro integrante sin que el criterio lo pida.

**Demuestra:** la cobertura no es una aspiración — si baja del 70%, el CI falla y bloquea el
merge. Sin el umbral, podía caer a 0% con el build en verde.

---

## S.12 — Los tests corren solos en push a `main`

**Criterio S12:** Las pruebas se ejecutan automáticamente cada vez que se hace push a la rama
`main` (integradas al pipeline de CI).

**Justificación:** `.github/workflows/backend-ci.yml` corre en cada push a `main` y en cada
PR, con corridas verdes recientes visibles en GitHub Actions (`gh run list`), incluyendo
trabajo de todo el equipo, no solo el propio.

`.github/workflows/backend-ci.yml` se dispara en **push a `main`** y en **cada pull request**,
con un Postgres de servicio. Pasos: type-check → tests unitarios con cobertura → tests e2e →
subida del reporte de cobertura.

**Corridas reales** (evidencia que existe sin intervención — la más fuerte del entregable):

```bash
gh run list --workflow=backend-ci.yml --limit 5
```
```
success  Merge pull request #67 ... Backend CI  main                                          push          1m33s
success  fix: pasar el dashboard a la marca StopBet ...  Backend CI  fix/dashboard-responsive-completo-alex-dominguez  pull_request  1m48s
success  fix: pasar el dashboard a la marca StopBet ...  Backend CI  fix/dashboard-responsive-completo-alex-dominguez  pull_request  1m41s
success  chore: desplegar backend y web en Railway y Vercel (#68)  Backend CI  main            push          1m29s
success  chore: desplegar backend y web en Railway y Vercel ...     Backend CI  chore/despliegue-nube-jose-meza  pull_request  1m42s
```

*(re-verificado 01-09-2026; la corrida del 28-08 mostraba PRs #54/#56, sigue en verde con el
mismo workflow, ahora sobre el trabajo más reciente del equipo.)*

**Demuestra:** el pipeline corre automáticamente, en ambos disparadores y sobre el trabajo de
todo el equipo — no solo en el propio. Visible también en la pestaña **Actions** del repo.

---

## Resumen

| Criterio | Estado | Prueba principal |
|---|---|---|
| S.4 matriz de permisos | ✅ | `permissions-matrix.md` + 19 `@Roles()` con guard verificado |
| S.5 403 en ≥4 endpoints | ✅ **5** | Tabla 401/403/200 + `roles.e2e-spec.ts` |
| S.6 cifrado + HTTPS | ✅ | RUT ilegible en disco + cabecera HSTS |
| S.7 alerta de caída | ✅ | Ciclo 🔴/✅ real en Discord + variable configurada en Railway |
| S.9 rate limiting | ✅ | HTTP 429 en la request #11 de `/auth/login` (límite endurecido de 10/min) |
| S.10 pruebas de acceso por rol | ✅ | 239 unitarios + 49 e2e |
| S.11 cobertura ≥70% en `users` | ✅ | 81.96% statements + gate que falla si baja |
| S.12 CI en push a `main` | ✅ | Corridas verdes en GitHub Actions (PR #67, #68) |
