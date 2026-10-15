# HdU10 — Memoria de técnicas efectivas del asistente IA

> Diseño acordado el 2026-10-13. Rama `feature/HU-10-memoria-asistente-matias-barraza`.

## Historia

> Como paciente, quiero que el asistente virtual conserve el historial de mis conversaciones,
> para que recuerde las técnicas que me ayudaron en momentos de crisis.

1. Dado que el paciente tiene al menos dos sesiones cerradas con una técnica registrada, cuando
   inicia una conversación por un detonante parecido, entonces el asistente le sugiere primero la
   técnica que le funcionó antes, en vez de una genérica.
2. Dado que el paciente no tiene sesiones previas, cuando inicia su primera conversación de crisis,
   entonces el asistente aplica una técnica general sin fallar por falta de historial.
3. Dado que el historial del paciente no se puede recuperar (por ejemplo, un error de base de
   datos), cuando inicia una nueva sesión, entonces el chat continúa sin contexto en vez de
   bloquearse y el fallo queda registrado.
4. Dado que el paciente quiere revisar sesiones anteriores, cuando toca «Ver historial» en el chat,
   entonces ve un resumen de cada sesión, sin que compañero de viaje ni familiar puedan verlo.

El psicólogo **sí** puede ver el historial de sus pacientes (decisión del 2026-10-13: se quitó «ni
otros roles» del CA4).

## Las tres definiciones que el texto de la historia deja abiertas

### «Detonante parecido» = misma categoría de un catálogo fijo

El detonante que hoy guarda el resumen es texto libre del LLM («sueldo», «finiquito»): no se puede
comparar. Se clasifica en un catálogo cerrado, con palabras clave y sin tildes ni mayúsculas:

| Clave | Categoría | Ejemplos de palabras clave |
|---|---|---|
| `money` | Dinero | sueldo, plata, deuda, pago, finiquito, me pagaron |
| `temptation` | Publicidad o tentación | anuncio, publicidad, casino, bono, app de apuestas |
| `sports` | Deporte | partido, fútbol, apuesta deportiva, liga |
| `emotions` | Emociones difíciles | ansiedad, estrés, angustia, rabia |
| `loneliness` | Soledad o aburrimiento | solo, sola, aburrido, nadie |
| `family` | Conflicto familiar o de pareja | pareja, pelea, discusión, mi señora, mi familia |
| `work` | Trabajo | trabajo, pega, jefe, despido |
| `other` | Otro | — |

Si un texto calza con varias categorías, gana la que tiene más coincidencias. Si hay empate, gana
la primera de la tabla.

### «Técnica que le funcionó» = regla fija sobre tres señales

Por sesión cerrada se calcula un puntaje, en este orden de prioridad:

1. **Veto por pánico.** Si el paciente creó una alerta de pánico dentro de la ventana
   **[inicio de la conversación, fin + 2 horas]**, el puntaje es 0 sin importar lo demás. El fin es
   la **última actividad** de la sesión, no el momento en que se guardó el resumen (una sesión
   cerrada por inactividad se resume horas después). Se calcula al consultar, cruzando
   `panic_alerts` con `ai_sessions`: no hace falta un cron.
2. **Respuesta del paciente.** «Sí» = 1, «Un poco» = 0,5, «No» = 0.
3. **Si el paciente no respondió**, lo que dedujo el LLM al resumir: «pareció servirle» = 0,5; si no, 0.

La técnica sugerida para una categoría es la que suma **más puntaje** en las sesiones de esa
categoría. Si hay empate, gana la usada más recientemente. Un puntaje total de 0 no sugiere nada.
Se consideran las **últimas 10 sesiones cerradas**, y la memoria se activa recién con **al menos 2
sesiones cerradas con técnica registrada** (CA1).

### «Técnica general» (CA2) = el comportamiento actual

Sin historial suficiente, el asistente sigue las reglas del prompt base: respiración 4-7-8 ante
impulso o ansiedad, grounding 5-4-3-2-1 ante soledad y postergar 30 minutos.

## Datos

Cuatro columnas **nullable** en `ai_session_summaries`, sin tabla nueva. Los resúmenes antiguos
siguen siendo válidos y no aportan a la memoria:

| Columna | Tipo | Origen |
|---|---|---|
| `triggerCategory` | enum del catálogo | catálogo sobre los mensajes del paciente; el LLM solo si sale `other` |
| `technique` | `breathing` · `grounding` · `postponement` | técnica más detectada en la sesión (mensajes del paciente y del asistente); si no hay, el texto `techniqueUsed` del LLM normalizado |
| `patientFeedback` | `yes` · `somewhat` · `no` | respuesta del paciente al cerrar |
| `llmThoughtHelpful` | boolean | campo nuevo del prompt de resumen |

## Componentes (backend, todo en `ai-assistant/`)

- **`trigger-catalog.ts`**: el catálogo y `classifyTrigger(texto): TriggerCategory`. Es puro, sin
  dependencias, y se prueba solo.
- **`technique-memory.ts`**: `effectivenessScore(...)` y `pickTechnique(sesiones, categoría)`.
  También es puro: recibe los resúmenes y las horas de las alertas.
- **`ai-assistant.service.ts`**:
  - `loadMemory(userId)`: trae las últimas 10 sesiones y las alertas de pánico del período. Va en
    `try/catch`: si falla, devuelve `null` y el chat sigue sin contexto (CA3).
  - **En cada mensaje**:
    - Clasifica los mensajes del paciente en esta sesión.
    - Si la categoría tiene una técnica efectiva, el system prompt de **esa misma llamada** agrega
      «propón primero X, que le sirvió cuando el motivo fue Y».
    - Si la categoría es `other`, agrega la lista corta «técnica — situación» de lo que le ha
      servido, y el LLM decide si se parece.
    - No hay llamadas extra al LLM, así que la espera no cambia.
  - **Al cerrar** se guardan `triggerCategory`, `technique` y `llmThoughtHelpful`.
  - **Arreglo:** `startSession` cerraba la sesión activa previa **sin generar resumen**. Ahora la
    cierra con `closeSession`, en `try/catch` para que abrir un chat nuevo nunca falle.
  - **`PATCH /ai/sessions/:sessionId/feedback`** con `{ feedback: 'yes' | 'somewhat' | 'no' }`.
    Busca el resumen por `sessionId` **y** `userId` del token y responde 404 si no es suyo. Se
    puede sobrescribir.
- **`GET /ai/patients/:patientId/summaries`** para el equipo clínico.
  - Usa `@Roles('psychologist', 'coordinator')` y `PatientAccessGuard`: el psicólogo ve solo a sus
    asignados y la coordinación ve a todos. Al compañero de viaje, al familiar y a otro paciente les
    responde 403.
  - A diferencia de la vista del paciente, incluye el nivel de riesgo.
- **Prompts**:
  - `SUMMARY_EXTRACTION_PROMPT` agrega `triggerCategory`, restringido al catálogo, y `helpful`.
    - Una categoría fuera del catálogo se descarta y queda `other`.
    - Recibe el **comienzo y el final** de lo que escribió el paciente, no solo los primeros 600
      caracteres como hoy, porque si la técnica sirvió se nota al cierre.
  - `buildSystemPrompt` agrega un bloque opcional de memoria, saneado con `sanitizePii`, igual que
    los detonantes clínicos.
  - **El texto base del prompt no cambia.**

## App (mobile)

- **`AssistantScreen.tsx`**:
  - Al terminar la conversación ya aparece el modal «Sesión guardada» (`SessionSummaryModal`).
    Ahí mismo se agrega «¿Te ayudó lo que hicimos?» con **Sí / Un poco / No**. «Continuar» hace
    de «Ahora no». Así no se apila un segundo diálogo encima del resumen.
  - La nota del modal decía «tu psicólogo no la lee». Pasa a «Tu psicólogo puede ver este resumen,
    pero no la conversación», porque ahora el psicólogo sí ve el historial (CA4).
  - Un botón **«Ver historial»** abre una **hoja inferior** dentro de la misma pantalla. No es una
    pantalla nueva, para no tocar la navegación, que es de otro integrante.
- **Tarjeta del historial**:
  - Fecha y duración.
  - Motivo, en el texto de la categoría.
  - Técnica.
  - «Te ayudó / Un poco / No te ayudó», o nada si no respondió.
  - **No** muestra la conversación ni el nivel de riesgo.
  - Si está vacía, dice «Todavía no tienes conversaciones guardadas».
- **Nada se guarda en el teléfono.**

## Archivos

| Archivo | Cambio |
|---|---|
| `apps/backend/src/ai-assistant/**` | catálogo, memoria, servicio, controlador, DTO, entidad, prompts y tests |
| `apps/mobile/src/screens/AssistantScreen.tsx` | botón «Ver historial» y envío de la respuesta |
| `apps/mobile/src/components/SessionSummaryModal.tsx` | pregunta «¿Te ayudó?» y nota de privacidad corregida |
| `apps/mobile/src/components/AssistantHistorySheet.tsx` | **nuevo**: hoja inferior del historial |
| `packages/shared-types/src/index.ts` | **solo al final**: `TriggerCategory`, `PatientFeedback`, `AiSessionHistoryItem` (extiende `AiSessionSummary` sin modificarlo) |
| `apps/mobile/src/services/api.ts` | **solo al final**: `sendAiFeedback`, `getAiHistory` |
| `apps/web/src/components/AssistantHistorySection.tsx` | **nuevo**: historial del paciente para el equipo clínico |
| `apps/web/src/services/api.ts` | **solo al final**: `getPatientAssistantHistory` |
| `apps/web/src/components/PatientDrawer.tsx` | ⚠️ **de Alex**: la pestaña «Sesiones» reemplaza su contenido de relleno por `<AssistantHistorySection patientId={patient.id} />` (un `import` y unas 13 líneas). Coordinado por el grupo antes del merge. |

## Web (equipo clínico)

- La pestaña **«Sesiones»** del panel «Seguimiento» («Mis pacientes») ya existe y hoy siempre dice
  «Todavía no disponible». Pasa a mostrar el historial real:
  - Una tarjeta por sesión con fecha, duración, motivo, técnica, si le ayudó y nivel de riesgo.
  - Si no hay sesiones: «Este paciente todavía no ha conversado con el asistente».
- Usa TanStack Query, estilos en línea con las variables del tema y `WIcon`, como el resto del
  panel. El riesgo va con `--danger-text` y no con `--danger`, para el modo oscuro.

## Privacidad

- `GET /ai/sessions/summaries` filtra por el `userId` del token: el paciente ve solo lo suyo.
- `GET /ai/patients/:patientId/summaries` lo ve solo el equipo clínico con acceso a ese paciente.
  El compañero de viaje y el familiar no tienen ningún endpoint que lea esos resúmenes (CA4).
- Lo que va al LLM pasa por `sanitizePii`.
- El registro del fallo del CA3 no lleva nombre, RUT ni correo.

## Pruebas

- **Tests unitarios:**
  - Catálogo: categorías, empates, tildes y mayúsculas, `other`.
  - Regla de efectividad: veto del pánico, prioridad paciente > LLM, puntaje «Un poco», mínimo de 2
    sesiones, desempate por recencia, total 0.
  - Armado del prompt: con técnica sugerida, con lista para `other`, sin historial.
  - `loadMemory` que falla → el chat responde igual y queda registrado (CA3).
  - `feedback` de otra persona → 404.
  - Historial del equipo clínico: el psicólogo asignado lo ve; el compañero de viaje, el familiar
    y un psicólogo no asignado reciben 403.
  - `startSession` con una sesión abierta → genera el resumen.
- **Prueba de punta a punta en el emulador contra el backend local:** dos conversaciones por dinero
  con «Sí», y una tercera por «me llegó el finiquito», que debe proponer primero la técnica.

## Fuera de alcance

- Borrar el historial.
- Una pantalla de navegación propia para el historial.
