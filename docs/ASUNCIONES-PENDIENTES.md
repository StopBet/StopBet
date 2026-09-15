# Asunciones pendientes de revisión

**Fecha:** 2026-06-09
**Contexto:** Durante la implementación de la pantalla de Comunidad (HdU05) y el cierre de criterios de aceptación del MVP (HdU01, HdU03, HdU05) se tomaron varias decisiones por defecto que **no fueron consultadas con el equipo**. Este documento las registra para revisión posterior. Nada de esto está "validado": son decisiones provisionales.

> El dashboard web (HdU04) sigue **sin implementar** — sus 3 CA no son alcanzables hasta construir `apps/web`. No es una asunción, es un bloque pendiente conocido.

---

## 2026-09-15 · Lo que quedó esperando una decisión del PO o de AJUTER

Todo lo de abajo salió de las auditorías UX de mobile y web y del trabajo posterior. **No es
código pendiente: es una pregunta que alguien tiene que responder.** Están en orden de qué
tan caro sale equivocarse.

### 🔴 Para AJUTER — vocabulario y textos clínicos

**1. «Compañero de viaje» asume género masculino.**
Se renombró «padrino» por el término del programa (PR #101), pero para una mujer sería
«compañera de viaje» y **el código no conoce el género de quien acompaña**. Hoy se usa la
forma masculina como nombre del rol y, donde se puede, se dice el nombre de la persona
(«Llamar a Daniela») para esquivarlo. Es el mismo problema que ya apareció con «Daniela está
siendo notificado». **Qué se necesita:** la fórmula que AJUTER quiere usar. Si hay que
distinguir, habría que guardar el género o el tratamiento en el perfil de quien acompaña —
eso sí es cambio de estructura.

**2. El texto de privacidad del asistente.**
Se reescribió para que diga la verdad —el psicólogo no lee la conversación, los mensajes
quedan guardados mientras exista la cuenta, pasan por la IA de Google sin nombre ni RUT—
pero **nadie de AJUTER lo ha validado**. Es lo que el paciente lee antes de contarle lo más
íntimo de su proceso. Va en `PrivacyCard.tsx` y `SessionSummaryModal.tsx`.

**3. El tono de la cuenta suspendida.**
Se sacó el tono de cobranza («Llevas 3 meses sin pagar», «3 meses de mora»), porque el estrés
por deudas es un gatillo de recaída. El texto actual es una propuesta del PO, **no una
validación clínica**.

### 🔴 Para el PO y el cliente — la pasarela de pago

**4. ¿Quién paga: el paciente o el familiar que asignó?**
No es una pregunta de proveedor, **son dos productos distintos**. Si paga el familiar hay que
generar un enlace a nombre del paciente para que lo abra otra persona — eso ya existe a
medias (`GET /billing/family-link`). Perfil anuncia «Portal de pago» en *Próximamente*, sin
acción, hasta que se decida.

**5. Un paciente suspendido no puede entrar a pagar.**
El backend rechaza el login de cuentas suspendidas (403) y corta las sesiones ya abiertas.
Eso deja `SuspendedAccountScreen` —con su «Pagar ahora y reactivar»— **sin forma de
alcanzarse**. Hoy el login le dice que escriba a `contacto@ajuter.cl`. Hay que decidir si el
backend le da una sesión limitada para pagar, o si el cobro se resuelve fuera de la app.

**6. `POST /billing/pay` no cobra nada.** Marca las facturas como pagadas y reactiva la
cuenta. La app ya no afirma lo contrario, pero mientras no exista Webpay el cobro se coordina
fuera del sistema. Los costos están en `presupuesto-stack-2026-09.md`.

### 🟡 Para el PO — producto y marca

**7. `contacto@ajuter.cl` está escrito en el código.**
AJUTER es el primer cliente y puede haber más. Cuando llegue el segundo, ese correo tiene que
venir de la sede, no del código. Lo mismo vale para cualquier otro dato del cliente que
todavía esté fijo.

**8. Vercel Hobby prohíbe el uso comercial.**
Hoy funciona porque el repo está público, pero la cláusula sigue ahí y StopBet va a cobrar
$30.000 mensuales. Las salidas son Pro ($20/usuario/mes) o Cloudflare Pages (gratis, permite
repos privados y uso comercial).

### 🟡 Para el equipo — deuda que ya está anotada pero conviene no perder

**9. 14 de 17 controladores leen `x-user-id` sin verificarlo.** Mobile ya manda
`Authorization: Bearer` con el id real, así que el header se puede sacar en cuanto se
registre `JwtAuthGuard` como guard global. Con el repo público esto pesa más.

**10. No hay migraciones y producción corre con `NODE_ENV=development`** para que TypeORM
cree el esquema con `synchronize`. Hay que resolverlo **antes de manejar datos de pacientes
reales**.

**11. Falta probar en un teléfono físico.** Toda la auditoría de mobile se verificó en
emulador. Es el hueco de verificación más grande que queda.

---

## 🔴 Importantes (requieren decisión del equipo)

### 1. Contenido clínico inventado (sin validación de AJUTER)
El `CLAUDE.md` indica que el contenido clínico debe estar validado por AJUTER y no modificarse sin revisión. Se inventó texto que **debe validar el equipo clínico**:

- **Mensajes de contención de recaída** (HdU03 CA3) — 5 mensajes sembrados en
  `apps/backend/src/achievements/achievements.service.ts` (`SEED_VALIDATED_MESSAGES`).
- **Texto de la notificación de pánico al padrino** (HdU01 CA1) — en
  `apps/backend/src/panic/panic.service.ts`:
  *"Alerta: El paciente [Nombre] requiere contención inmediata por riesgo de recaída"*.
  (Este sí calca el texto del CA, pero conviene confirmarlo.)
- **Texto del anuncio de felicitación al compartir insignia** (HdU03 CA1) — en
  `achievements.service.ts` (`shareBadge`): *"🎉 [Nombre] alcanzó N días sin apostar…"*.

**Acción sugerida:** AJUTER / PO entrega los textos oficiales y se reemplazan.

### 2. Cambio de contrato de la API `reportRelapse`
Se cambió la respuesta de `POST /achievements/relapse` de `AbstinencePeriod` a
`{ period, message }` (nuevo tipo `RelapseResponse` en `packages/shared-types`).
Esto era necesario para devolver el mensaje aleatorio del CA3, pero **el backend de
HdU03 lo trabaja Alex Domínguez** (según SPRINT0). Se cambió sin coordinar.

**Archivos:** `apps/backend/src/achievements/achievements.service.ts`,
`apps/backend/src/achievements/achievements.controller.ts`,
`packages/shared-types/src/index.ts`, `apps/mobile/src/services/api.ts`,
`apps/mobile/src/screens/AchievementsScreen.tsx`.

**Acción sugerida:** coordinar con Alex; confirmar o ajustar el contrato.

### 3. Reestructura del build (afecta a todo el equipo)
El backend no compilaba. Para destrabarlo se cambió la arquitectura de build, lo que
**modifica el flujo de trabajo de todos los integrantes**:

- `packages/shared-types` ahora es un paquete con build propio
  (`main`/`types` → `dist/`); requiere compilarse antes del backend.
- Se quitó el `path mapping` de `apps/backend/tsconfig.json`.
- Los scripts del backend (`build`, `start:dev`) ahora compilan shared-types primero.
- Se agregaron dependencias que faltaban: `class-validator`, `class-transformer`,
  `@langchain/core`, y `@stopbet/shared-types` como dependencia del backend.

**Acción sugerida:** que el Tech Leader (Matías Lara) revise el cambio de arquitectura.
Ya está commiteado en la rama `feature/HU-05-comunidad` (commit `fix:`).

### 4. Co-autoría incorrecta en los commits de la rama
Todos los commits de la rama `feature/HU-05-comunidad` tienen
`Co-Authored-By: Claude Opus 4.8`, pero el modelo real es **Sonnet 4.6** y los commits
previos del repo usan "Claude Sonnet 4.6".

**Acción sugerida:** reescribir los commits de la rama con el co-autor correcto antes de mergear
(p. ej. `git rebase --exec` o reescritura interactiva).

---

## 🟡 Menores (informativas)

| # | Asunción | Dónde | Nota |
|---|----------|-------|------|
| 5 | `TEMP_SEDE = 'Santiago'` hardcodeado | `apps/mobile/src/screens/CommunityScreen.tsx` | La sede real debe venir de la auth, igual que `TEMP_USER_ID` en otras pantallas. |
| 6 | Rama `feature/HU-05-comunidad` | git | El equipo viene commiteando directo a `main`; se asumió ramificar. |
| 7 | `apps/backend/.env` local | (gitignored) | Postgres local sin password + `GEMINI_API_KEY=dummy`. El asistente IA real no responde hasta poner la key. |
| 8 | Rol moderador = `psychologist` | `apps/backend/src/community/community.service.ts` | El CA dice "moderador (psicólogo)"; se interpretó literal. Sin guard de auth real (solo `x-user-id`). |
| 9 | Umbral de moderación = 5 reportes | `community.service.ts` (`REPORT_THRESHOLD`) | Tomado textual del CA3 de HdU05. |
| 10 | Caché offline en memoria (no persistente) | `CommunityScreen.tsx` | HdU05 CA4 cumplido en sesión; persistencia entre reinicios requeriría `AsyncStorage` (no instalado). |
| 11 | Seed duplicado de mensajes (10 en vez de 5) | `validated_messages` | Ocurrió por reinicio con dos instancias solapadas; en arranque normal de una instancia siembra 5. Cosmético. |

---

## Endpoints de moderación agregados (HdU05 CA3) — backend listo, UI pendiente
- `GET /community/moderation/flagged?sede=` → publicaciones con 5+ reportes (rol psicólogo).
- `DELETE /community/posts/:id` → eliminar publicación (rol psicólogo).

El **borrado desde el dashboard** (parte del CA) depende del web app de HdU04, aún inexistente.
