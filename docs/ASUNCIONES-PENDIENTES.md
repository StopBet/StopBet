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

**2-bis. Los detonantes de la ficha todavía pueden arrastrar el nombre de un tercero que
nadie registró.** _(HdU13 CA6, 19-09-2026 · acotado el 20-09-2026)_

El CA6 pide que los detonantes que el psicólogo anota en la ficha personalicen la conversación
del asistente «sin enviar nombre, RUT ni datos de contacto al modelo». Los detonantes pasan por
`sanitizePii`, que hoy omite:

- el **nombre del paciente** y cualquier **RUT**;
- **teléfonos y correos** escritos dentro del texto (eso cierra los «datos de contacto» del CA,
  que antes no estaban cubiertos);
- los **nombres de quienes el sistema ya tiene registrados alrededor del paciente**: familiares
  vinculados y su compañero de viaje.

**Lo que sigue pasando:** un tercero que no está registrado en la plataforma. Si el psicólogo
escribe *«discusiones con su jefe Nelson»*, ese nombre llega al modelo. No se resolvió
inventando un detector de nombres propios: sobre texto clínico en español daría falsos
positivos («Santiago» es una sede, «Fonasa» no es nadie) y rompería justamente el detonante que
hay que entender.

**Las dos salidas que quedan:**

1. **Ya está pedido en la UI:** el campo de detonantes avisa que se escriban sin nombres de
   terceros, porque el detonante es la situación y no quién la protagoniza. Es la mitigación
   vigente.
2. **Aceptarlo explícitamente**, si AJUTER considera que el nombre de un tercero dentro de un
   detonante no es dato sensible en este contexto.

El comportamiento está **documentado en un test** que lo afirma tal cual («todavía deja pasar el
nombre de un tercero que no está registrado»), para que el día que se arregle el test falle y
obligue a actualizarlo.

**2-ter. ✅ Decidido: la ficha clínica llama «motivo de ingreso» y «objetivos del tratamiento».**
_(decisión del PO, 19-09-2026 · confirmada el 20-09-2026)_

El CA1 de la HdU13 lista los campos obligatorios como «motivo de **consulta**» y «objetivos
**terapéuticos**». En la app dicen **«Motivo de ingreso»** y **«Objetivos del tratamiento»**, y
las claves de la API son `admissionReason` y `treatmentGoals`. **Se quedan así.**

**Por qué:** AJUTER no hace consultas individuales, hace **terapia grupal**. «Motivo de
consulta» describe un modelo de atención que no es el del programa, y el psicólogo que escribe
la ficha iba a leer un término que no usa.

Se deja anotado acá, y no se borra, porque quien lea el CA1 y la pantalla va a ver dos palabras
distintas y necesita saber que es deliberado. Si AJUTER pidiera los términos del CA, el cambio
es el mismo renombre al revés, **pero conviene hacerlo antes de que `clinical_records` llegue a
producción**: sin migraciones en el repo (deuda #10), renombrar una columna con `synchronize`
deja la vieja colgando y la nueva vacía.

**2-quater. Las cuatro preguntas del formulario de ingreso, y si son obligatorias.**
_(HdU13, 19-09-2026)_

El registro móvil tiene un paso nuevo donde el paciente declara **qué lo trae**, **a qué
juega**, **hace cuánto** y **en qué momentos le dan ganas**. Las alternativas las propuso Claude
y las aprobó el PO; **AJUTER no las ha visto**. Son las primeras preguntas que recibe alguien
que está pidiendo ayuda, así que la redacción importa tanto como el contenido.

**Dos decisiones abiertas:**

1. **Las alternativas mismas.** Están en `packages/shared-types/src/index.ts`
   (`INTAKE_MOTIVES`, `INTAKE_GAMBLING_TYPES`, `INTAKE_DURATIONS`, `INTAKE_TRIGGERS`). Se
   dejaron fuera a propósito: objetivos del tratamiento (se acuerdan con el psicólogo, no se
   autodeclaran), antecedentes de salud mental (no corresponde pedirlos en un formulario
   público antes de que exista relación terapéutica) y monto de deuda (invita a mentir por
   vergüenza, y el estrés por deudas es gatillo de recaída).

2. **Si responder es obligatorio para entrar.** El PO planteó que «todos los pacientes deben
   tener ficha, si no no pueden entrar a AJUTER». **Hoy el paso es saltable**, porque ningún CA
   de la HdU13 exige lo contrario y porque una pregunta obligatoria de más, en ese momento, es
   alguien que abandona el registro. Hacerlo obligatorio además toca las reglas de la HdU19
   (Matías Lara). Queda para decidir con AJUTER, con las dos variantes sobre la mesa:
   obligatorio para **postular**, u obligatorio para que la coordinación pueda **aprobar**.

**Lo que sí quedó cerrado** (PO, 19-09-2026): la ficha clínica y lo declarado por el paciente
son **dos cosas distintas y no se fusionan**. Lo declarado es inmutable y se muestra tal cual;
la ficha es la lectura del psicólogo y se edita y versiona (CA1-CA4); las anotaciones son la
cronología del seguimiento. Tres capas, cada una con su dueño.

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

**5-bis. Dos reglas de cobro del cliente que el código no conoce.** _(traídas por el PO el
16-09-2026)_

1. **La cuenta se suspende al cumplir el tercer mes de no pago**, no antes: con una o dos
   cuotas vencidas el paciente sigue entrando con normalidad.
2. **Existe «congelar suscripción»**: la mensualidad se congela y, según el cliente, el
   paciente tampoco entra a la app mientras dure.

**Ninguna de las dos está implementada, y la distancia es mayor de lo que parece:**

- **Nada suspende por mora.** El único lugar que escribe `accountStatus: 'suspended'` fuera de
  los seeds es desactivar un *psicólogo* (`psychologists.service.ts`). Un paciente moroso hoy
  **no se suspende nunca solo**: habría que hacerlo a mano en la base. La regla de los 3 meses
  no existe en ninguna parte del código.
- **No existe el estado congelado.** `AccountStatus` es `'active' | 'suspended'`
  (`packages/shared-types/src/index.ts`); cero ocurrencias de frozen/congelar/freeze/pause en
  backend, web, mobile y shared-types. Agregarlo es cambio de modelo, y sin migraciones en el
  repo eso arrastra la deuda #10.

**Qué hay que decidir, además de programarlo:**

- **Qué conserva un paciente congelado o suspendido.** `CLAUDE.md` exige que la ruta de
  escalada del pánico esté *siempre* disponible, incluso sin conexión. Si perder la
  mensualidad apaga el botón de pánico y el `*4141`, eso choca de frente con la regla clínica
  del proyecto. Es la pregunta más importante de las dos.
- **Quién congela y desde dónde.** No hay pantalla ni endpoint: ¿lo hace la coordinación
  desde el panel, o se coordina fuera del sistema como el resto del cobro?
- **Si congelar detiene la facturación**, hay que dejar de generar la factura mensual
  (`billing.service.ts` la crea en `pay()`), o el paciente acumula deuda mientras está
  congelado.

**Ya aplicado, mientras tanto:**

- El reporte PDF del paciente usa **3 meses** como umbral de gravedad
  (`MESES_PARA_PERDER_ACCESO` en `generatePatientPDF.ts`). Con 1 o 2 cuotas muestra la deuda
  en tono neutro y dice cuánto margen queda; recién al tercer mes la marca en rojo. Antes
  pintaba de rojo desde la primera.
- **El seed de demo quedó coherente con la regla:** Lucía Vega pasó de 1 cuota vencida a
  **3** ($90.000). Estar suspendida con una sola cuota era un estado que, con esta regla, el
  sistema no puede producir.

**6. `POST /billing/pay` no cobra nada.** Marca las facturas como pagadas y reactiva la
cuenta. La app ya no afirma lo contrario, pero mientras no exista Webpay el cobro se coordina
fuera del sistema. Los costos están en `presupuesto-stack-2026-09.md`.

### 🟡 Para el PO — producto y marca

**7. El nombre del cliente está escrito en el código.**
AJUTER es el primer cliente y puede haber más. Cuando llegue el segundo, `contacto@ajuter.cl`
tiene que venir de la sede, no del código. Lo mismo vale para cualquier otro dato del cliente
que todavía esté fijo.

> **Actualizado el 16-09-2026.** El PO pidió sacar AJUTER de las vistas previas a entrar, y en
> el login ya no aparece. Al hacerlo salió el bloqueo de fondo: **`institutionId` existe en
> `registration_requests` pero no en `users`**, así que al aprobar un registro el usuario se
> crea sin institución y **después del login el sistema no sabe a cuál pertenece**. Por eso el
> portal del familiar y el reporte PDF siguen diciendo «AJUTER» a mano: no hay de dónde sacar
> el nombre verdadero. **La decisión es cuál de las dos:** escribir esos textos en neutro («tu
> equipo clínico»), que es barato y sirve para siempre, o agregar la institución al modelo de
> datos, que es lo que hace falta si algún día el panel tiene que mostrar la marca de cada
> cliente.

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

### 4. ~~Co-autoría incorrecta en los commits de la rama~~ · cerrado el 16-09-2026, sin acción

Decía que los commits de `feature/HU-05-comunidad` llevaban `Co-Authored-By: Claude Opus 4.8`
cuando el modelo real era Sonnet 4.6, y proponía reescribirlos **antes de mergear**.

**Ya no aplica, por dos razones:**

1. **La rama se mergeó hace meses.** En `main` conviven hoy 19 commits con `Sonnet 4.6`, 11
   con `Opus 4.8` y algunos con `Opus 5` y `Sonnet 5`. Reescribir historia ya compartida por
   seis personas, por un trailer, cuesta mucho más de lo que arregla: obliga a todos a
   rebasear sus ramas vivas.
2. **La regla vigente es no poner el trailer.** `CLAUDE.md` → "Trabajando con Claude Code"
   dice que el trabajo se atribuye únicamente al autor humano. Los commits nuevos no lo
   llevan; los viejos quedan como testimonio de cuándo se escribieron.

**Acción:** ninguna. Se deja el registro para que nadie vuelva a proponer el rebase.

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
