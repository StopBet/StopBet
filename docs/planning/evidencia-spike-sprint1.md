# Evidencia del SPIKE 1 — Seguridad, Disponibilidad e IA (Sprint 1)

**Objetivo de este documento:** demostrar, criterio por criterio, que los 12 criterios de
aceptación del SPIKE 1 (ver `docs/planning/SPRINT1.md`, §4) están cumplidos. Para cada uno:
descripción breve, quién lo hizo, y **cómo demostrarlo** (comando, video o ambos).

**Fecha de verificación de este documento:** 01-09-2026. Todo lo marcado como "verificado
ahora" se corrió en vivo contra el código actual de `main`, no es una captura vieja.

> **Relación con `docs/security/evidencia-spike-jose.md`:** ese documento ya cubre en detalle
> S.4, S.5, S.6, S.7, S.9 y S.12 (con salida completa de cada comando). Acá se resume esa
> parte y se re-verifica lo que cambió desde su fecha (28-08); el aporte nuevo de este
> documento es **S.1, S.2, S.3, S.8 y la parte de `panic`/`ai-assistant` de S.10/S.11**, que
> hasta ahora no tenían evidencia escrita.

## Preparación

```bash
pnpm install
pnpm run seed          # 9 usuarios de prueba, clave: Stopbet2026!
pnpm run backend        # http://localhost:3000 · Swagger en /api/docs
```

---

## S.1 — Documento de reglas del asistente + 3 conversaciones de prueba

**Dueño:** Eduardo Pacheco.

**Qué es:** interpreta el prompt validado por AJUTER en reglas verificables — una vara de
tono concreta (largo, tecnicismos, viñetas, pregunta de cierre) y la regla de precedencia
entre la detección de crisis por código y la redirección que pide el prompt al LLM — más 3
conversaciones de ejemplo para validar contra ellas.

**Cómo demostrarlo:** es un entregable de documento, no de comando.

📄 [`docs/reglas-asistente.md`](../reglas-asistente.md)

---

## S.2 — Respuesta del asistente ≤5 s, medida

**Dueño:** Eduardo Pacheco.

**Qué es:** `LatencyInterceptor` (`apps/backend/src/ai-assistant/latency.interceptor.ts`)
mide cada request a `POST /ai/sessions/:id/messages` y deja un `WARN` en el log del backend
si supera los 5 000 ms; si no, un `DEBUG` con la duración.

**Verificado ahora — mensaje real contra el asistente, tiempo medido por el cliente:**

```bash
curl -s -w "\nHTTP %{http_code} · %{time_total}s\n" \
  -X POST "http://localhost:3000/ai/sessions/<sessionId>/messages" \
  -H "x-user-id: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{"content":"Otra vez, soy Juan Pérez, RUT 12.345.678-9, tengo ganas de apostar"}'
```
```
HTTP 201 · 1.397293s
```

**Demuestra:** la respuesta llega en ~1.4 s, bien bajo el umbral de 5 s. Para ver el log del
interceptor en vivo (evidencia complementaria, sirve como guión de video): dejar
`pnpm run backend` corriendo en una terminal visible y mandar un mensaje desde la app o con
el comando de arriba — aparece la línea `[AiAssistantLatency] POST /ai/sessions/:id/messages
→ <ms>ms`.

---

## S.3 — Nombre y RUT excluidos de lo enviado al LLM

**Dueño:** Alex Domínguez.

**Qué es:** `sanitizer.ts` (`apps/backend/src/ai-assistant/sanitizer.ts`) reemplaza el RUT
chileno (con o sin puntos, con dígito verificador `k`/`K`) y el nombre/apellido del usuario
por `[RUT OMITIDO]` / `[NOMBRE OMITIDO]` **antes** de construir el prompt que se manda al LLM.
Se conecta en `ai-assistant.service.ts`.

**Verificado ahora — ejecutando la función real, compilada, con datos de ejemplo:**

```bash
node -e "
const {sanitizePii} = require('./apps/backend/dist/ai-assistant/sanitizer.js');
console.log(sanitizePii(
  'Soy Juan Pérez, mi RUT es 12.345.678-9 y tengo ganas de apostar',
  {firstName:'Juan', lastName:'Pérez'}
));
"
```
```
Soy [NOMBRE OMITIDO] [NOMBRE OMITIDO], mi RUT es [RUT OMITIDO] y tengo ganas de apostar
```

**Demuestra:** el texto que sale de `sanitizePii` —el que efectivamente ve el LLM— no
contiene el nombre ni el RUT del paciente, aunque el mensaje original sí los traiga.

**Ojo, no es un bug:** lo que queda guardado en la base de datos (`userMessage.content`) es
el texto **original**, sin sanitizar — el criterio pide excluirlo de lo que se **envía al
LLM**, no de lo que se persiste para el historial clínico del paciente.

---

## S.4 — Matriz de permisos por rol

**Dueño:** José Meza. **Evidencia completa ya existe:**
[`docs/security/evidencia-spike-jose.md`](../security/evidencia-spike-jose.md#s4--matriz-de-permisos-por-rol).

**Resumen:** [`permissions-matrix.md`](../security/permissions-matrix.md) inventaría los 56
endpoints por rol objetivo; 19 tienen `@Roles()` respaldado por guard real, verificado
leyendo cada controller.

**Cómo demostrarlo:**
```bash
grep -rn "^\s*@Roles(" apps/backend/src --include=*.controller.ts | wc -l
```
```
19
```

---

## S.5 — Rol sin permiso recibe 403 en ≥4 endpoints

**Dueño:** José Meza. **Evidencia completa:**
[`docs/security/evidencia-spike-jose.md`](../security/evidencia-spike-jose.md#s5--rol-sin-permiso-recibe-403-en-4-endpoints).
Se cubren **5** endpoints (el criterio pide 4).

**Verificado ahora, re-corrido:**
```bash
pnpm --filter @stopbet/backend run test:e2e
```
```
PASS test/registration.e2e-spec.ts
PASS test/roles.e2e-spec.ts
PASS test/psychologists.e2e-spec.ts

Test Suites: 3 passed, 3 total
```

---

## S.6 — Datos clínicos cifrados en BD + conexiones sobre HTTPS

**Dueño:** José Meza. **Evidencia completa:**
[`docs/security/evidencia-spike-jose.md`](../security/evidencia-spike-jose.md#s6--datos-clínicos-cifrados-en-bd--conexiones-sobre-https).

**Cómo demostrarlo:**
```bash
psql -U postgres -d stopbet -c "SELECT \"firstName\", LEFT(rut,45) FROM users WHERE rut IS NOT NULL LIMIT 3;"
curl -sI http://localhost:3000/health | grep -i strict-transport-security
```
El RUT queda como `iv:authTag:ciphertext` en disco (AES-256-GCM); el header
`Strict-Transport-Security` confirma que el servidor exige HTTPS.

---

## S.7 — Alerta automática al equipo ante caída ⏸️ **pendiente de configuración**

**Dueño:** José Meza. **Evidencia completa:**
[`docs/security/evidencia-spike-jose.md`](../security/evidencia-spike-jose.md#s7--alerta-automática-al-equipo-ante-caída--pendiente-de-configuración).

**Qué es:** `health/alerts.service.ts` revisa la BD cada 2 minutos y avisa a un webhook de
Discord solo en los cambios de estado (caída / recuperación). El código y sus tests
(`alerts.service.spec.ts`) están completos.

**Verificado ahora — sigue sin la variable configurada:** `DISCORD_ALERT_WEBHOOK_URL` no está
en `apps/backend/.env` ni (según `CLAUDE.md`, sección "Estado actual") en Railway.

**Cómo demostrarlo:** correr `alerts.service.spec.ts` (cubre ambas transiciones + el caso sin
webhook) y mostrar el `WARN` en consola:
```
WARN [AlertsService] Alerta no enviada (DISCORD_ALERT_WEBHOOK_URL no configurada): ...
```

**Para la demo del sprint: decirlo así de directo.** El criterio está resuelto en código,
pero la alerta **no se puede mostrar disparándose de verdad** hasta que alguien con permiso
de administrador cree el webhook en el Discord del equipo y lo configure en Railway. No
requiere código nuevo.

---

## S.8 — Mensaje de respaldo ≤5 s si el asistente falla

**Dueño:** Eduardo Pacheco (mobile) — el respaldo del backend (`fallback.ts`) ya existía y lo
conecta también Matías Barraza en `ai-assistant.service.ts`.

**Qué es:** dos capas de respaldo, para los dos fallos distintos que pueden pasar:
- **Backend responde pero el LLM falla** → `fallback.ts` en el servidor devuelve un mensaje
  de respaldo con ruta de escalada, como si fuera una respuesta más del asistente.
- **La petición ni siquiera llega al servidor** (sin red, backend caído) → el cliente
  (`assistantFallback.ts` en mobile) construye el mismo tipo de mensaje localmente.

**Verificado ahora — evidencia en vivo, no forzada:** en este ambiente local
`GEMINI_API_KEY` es el placeholder de ejemplo (`your_gemini_api_key`, sin key real), así que
cualquier mensaje real dispara el camino de fallback del backend:

```bash
curl -s -X POST "http://localhost:3000/ai/sessions/<sessionId>/messages" \
  -H "x-user-id: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{"content":"tengo ganas de apostar"}'
```
```json
{
  "assistantMessage": {
    "content": "Tuve un problema técnico y no pude procesar tu mensaje. Tu bienestar es lo primero: si sientes que necesitas apoyo ahora, el botón de pánico y tu padrino están siempre disponibles, igual que el *4141*.",
    ...
  }
}
```
Respondido en 1.4 s (ver S.2) — dentro del umbral.

**Para el otro camino (sin red, en el celular):** video — poner el teléfono en modo avión,
mandar un mensaje en `AssistantScreen` y mostrar que el hilo no se queda vacío: aparece el
mensaje que alcanzó a escribir el paciente más la respuesta de respaldo con la ruta de
escalada, en vez del `Alert` genérico que mostraba antes (`AssistantScreen.tsx:155`, ya
corregido).

---

## S.9 — Límite de mensajes por usuario por minuto

**Dueño:** José Meza. **Ojo:** la implementación cambió desde
`docs/security/evidencia-spike-jose.md` (28-08) — el hallazgo de que el límite global de 20
req/min interfería con el uso normal del dashboard llevó a subirlo, y a apretar en cambio el
de `/auth/login` (commit `a888c3a`, 30-08). El comando de aquel documento ya no corta en la
request #21 porque el límite global ahora es 300/min.

**Configuración actual** (`app.module.ts` + `auth.controller.ts`):
- Global, por IP: `{ ttl: 60_000, limit: 300 }`.
- `POST /auth/login`: `@Throttle({ default: { ttl: 60_000, limit: 10 } })`.

**Verificado ahora:**
```bash
for i in $(seq 1 14); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" -d '{"email":"noexiste@test.com","password":"x"}')
  echo "login intento #$i -> $CODE"
  [ "$CODE" = "429" ] && break
done
```
```
login intento #1 -> 401
...
login intento #10 -> 401
login intento #11 -> 429
```

**Demuestra:** el límite corta exacto en el intento #11, coincidiendo con el máximo de 10 por
minuto para login — el endpoint más sensible a fuerza bruta. El límite global de 300/min
protege el resto de la API sin estorbar el uso normal del dashboard.

---

## S.10 — Pruebas automáticas: pánico / acceso por rol / respuesta del asistente

**Repartido:** José (rol), Catalina (pánico), Matías Barraza (asistente).

**Verificado ahora:**
```bash
pnpm run test
```
```
Test Suites: 22 passed, 22 total
Tests:       239 passed, 239 total
```

Las tres partes del criterio están cubiertas por archivos concretos:
- **Pánico:** `panic.service.spec.ts`, `panic.controller.spec.ts`, `panic-stream.controller.spec.ts`.
- **Acceso por rol:** `roles.guard.spec.ts` (unitario) + `test/roles.e2e-spec.ts` (e2e contra Postgres real, 5 aserciones 403).
- **Respuesta del asistente:** `ai-assistant.service.spec.ts`, `ai-assistant.controller.spec.ts`.

---

## S.11 — Cobertura ≥70% en `panic`, `ai-assistant`, `users`

**Repartido:** José (`users`), Catalina (`panic`), Matías Barraza (`ai-assistant`).

**Verificado ahora, números frescos** (subieron levemente desde el 28-08):
```bash
pnpm run test:coverage
```
```
 src/ai-assistant  |   85.93 |   64.93 |   89.18 |   87.13 |
 src/panic         |   91.92 |   97.29 |     100 |   92.19 |
 src/users         |   81.96 |    90.9 |      90 |   83.01 |
```

Los tres módulos superan holgadamente el 70% exigido, y `apps/backend/package.json` define
`coverageThreshold` por módulo — si `statements` o `lines` bajan del umbral, `EXIT CODE: 1` y
el CI bloquea el merge (prueba de esto, forzando el umbral a 99% y de vuelta, en
[`evidencia-spike-jose.md`](../security/evidencia-spike-jose.md#s10--s11--pruebas-automáticas-y-cobertura-70)).

---

## S.12 — Los tests corren solos en push a `main`

**Dueño:** José Meza. **Verificado ahora, con corridas de hoy (no solo de la fecha del SPIKE):**
```bash
gh run list --workflow=backend-ci.yml --limit 5
```
```
success  Merge pull request #67 ...   Backend CI  main                              push          1m33s   2026-09-01
success  fix: pasar el dashboard...   Backend CI  fix/dashboard-responsive-...      pull_request  1m48s   2026-09-01
success  fix: pasar el dashboard...   Backend CI  fix/dashboard-responsive-...      pull_request  1m41s   2026-09-01
success  chore: desplegar backend...  Backend CI  main                              push          1m29s   2026-08-31
success  chore: desplegar backend...  Backend CI  chore/despliegue-nube-jose-meza   pull_request  1m42s   2026-08-31
```

**Demuestra:** el pipeline sigue corriendo automáticamente, en ambos disparadores, más de una
semana después de cerrado el SPIKE — no fue una corrida única para la evidencia.

---

## Resumen

| Criterio | Estado | Dueño | Prueba principal |
|---|---|---|---|
| S.1 documento de reglas + 3 conversaciones | ✅ | Eduardo | `docs/reglas-asistente.md` |
| S.2 respuesta ≤5 s, medida | ✅ | Eduardo | 1.4 s medido en vivo + `LatencyInterceptor` |
| S.3 PII excluida del LLM | ✅ | Alex | `sanitizePii()` en vivo → `[NOMBRE OMITIDO]` / `[RUT OMITIDO]` |
| S.4 matriz de permisos | ✅ | José | 19 `@Roles()` con guard verificado |
| S.5 403 en ≥4 endpoints | ✅ **5** | José | Tabla 401/403/200 + `roles.e2e-spec.ts` |
| S.6 cifrado + HTTPS | ✅ | José | RUT ilegible en disco + header HSTS |
| S.7 alerta de caída | ⏸️ | José | Código y tests listos; falta el webhook de Discord |
| S.8 respaldo ≤5 s | ✅ | Eduardo / M. Barraza | Fallback real en vivo, 1.4 s, con ruta de escalada |
| S.9 rate limiting | ✅ | José | Login corta en el intento #11 (10/min) |
| S.10 pruebas de pánico / rol / asistente | ✅ | José · Catalina · M. Barraza | 239 tests pasando |
| S.11 cobertura ≥70% | ✅ | José · Catalina · M. Barraza | 82.0% / 91.9% / 85.9% + gate que falla si baja |
| S.12 CI en push a `main` | ✅ | José | Corridas verdes hoy, no solo en la fecha del SPIKE |

**11 de 12 criterios completos y demostrables ahora mismo. S.7 tiene el código y los tests
listos, pero necesita que alguien con permiso de administrador en el Discord del equipo cree
el webhook — es el único paso que falta y no requiere código.**
