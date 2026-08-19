# HU-04 Métricas + SPIKE del asistente — Plan de implementación

> **Para quien ejecute esto:** usar `superpowers:subagent-driven-development` o
> `superpowers:executing-plans`. Los pasos usan checkbox (`- [ ]`) para seguimiento.

**Objetivo:** cerrar los 7 criterios de Eduardo Pacheco en el Sprint 1 (4.1, 4.2, 4.3, 4.4,
S.1, S.2, S.8), más el PR de router que desbloquea a Alex y el arreglo del build de Vercel
que hoy bloquea a todo el equipo.

**Arquitectura:** el trabajo de backend va en **módulos y archivos nuevos** (`metrics/`,
`panic-stream.controller.ts`, `ai-assistant/fallback.ts`, interceptor de latencia) para no
tocar archivos de otros integrantes. El de web va sobre `apps/web/src/**`, del que soy dueño
base. El tiempo real usa **SSE** (no WebSocket): un solo sentido, sobrevive a proxies y no
agrega dependencias.

**Stack:** React 19 + Vite 6 + TanStack Query v5 + Recharts 2.15 + react-router · NestJS 10 +
TypeORM · pnpm workspaces.

## Restricciones globales

Copiadas de `CLAUDE.local.md` y `docs/planning/SPRINT1.md`. Aplican a **todas** las tareas.

- **Rama:** `feature/HU-04-metricas-eduardo-pacheco`. Nunca trabajar sobre `main`.
- **Gestor de paquetes: `pnpm`, siempre.** Nunca `npm install` ni `yarn`.
  En esta máquina `pnpm` no está instalado globalmente y `corepack enable` falla por
  permisos → usar **`npx --yes pnpm@10 <cmd>`**. Con `$env:CI = 'true'` si pide purgar
  `node_modules`.
- **Un PR por criterio de aceptación**, no uno gigante al final. Draft PR desde el día 1.
- **Commits:** `<tipo>(HU-XX): <descripción en español, imperativo, sin punto final>`.
  **Nunca** el trailer `Co-Authored-By`.
- **No hacer `git push` ni abrir PRs sin que Eduardo lo pida explícitamente.**
- TypeScript estricto. Nada de `any` sin comentario que justifique por qué es inevitable.
- Código en inglés, strings de UI en español. Comentarios solo para el **por qué**.
- **Nunca loguear datos identificables de pacientes** (nombre, RUT, email) en el servidor.
- Antes de cada commit: `git status` y confirmar que **no se coló ningún archivo ajeno**.
- Rebase diario: `git fetch origin && git rebase origin/main`.

### Archivos que NO se tocan (de otros integrantes)

`apps/backend/src/ai-assistant/ai-assistant.service.ts` (M. Barraza) ·
`apps/backend/src/panic/panic.service.ts` y `panic.controller.ts` (M. Barraza) ·
`apps/backend/src/users/**` (José) · **todo `apps/mobile/**`** ·
`apps/web/src/pages/EquipoPage.tsx` (M. Lara) · `apps/web/src/pages/familiar/**` (Alex).

### Archivos compartidos — solo agregar al final

`packages/shared-types/src/index.ts` · `apps/backend/src/app.module.ts` (una línea de import
+ una entrada al final del array) · `apps/web/src/services/api.ts`.

---

## Bloqueos que hay que resolver con el equipo antes de llegar ahí

Estos **no** se resuelven escribiendo código. Están marcados en la tarea donde pegan.

| # | Bloqueo | Afecta | Quién decide |
|---|---|---|---|
| B1 | El arreglo de cliente de **S.8** vive en `apps/mobile/src/screens/AssistantScreen.tsx`, que está en mi lista de **NO tocar** | Tarea 9 | M. Barraza (dueño de mobile en este sprint) |
| B2 | Registrar el SSE nuevo exige editar `apps/backend/src/panic/panic.module.ts`, que **no está en ninguna lista** | Tarea 7 | M. Barraza |
| B3 | `GEMINI_API_KEY` inválida → `ai-assistant.service.ts:277,300` devuelve `riskLevel:'low'` en el `catch`. Las métricas de 4.4 mostrarían "riesgo bajo" **inventado** | Tarea 6 | M. Barraza (es su archivo) |
| B4 | Conectar `fallback.ts` y el interceptor de latencia al módulo `ai-assistant` | Tareas 8 y 9 | M. Barraza los conecta; yo solo entrego los archivos |

---

## Estructura de archivos

**Crear:**

| Archivo | Responsabilidad |
|---|---|
| `docs/reglas-asistente.md` | S.1 — reglas de tono + precedencia crisis + 3 conversaciones de prueba |
| `apps/backend/src/metrics/metrics.module.ts` | Módulo Nest del dominio métricas |
| `apps/backend/src/metrics/metrics.controller.ts` | `GET /metrics/patients/:id` |
| `apps/backend/src/metrics/metrics.service.ts` | Agregación de 30 días desde `check_ins` y `panic_alerts` |
| `apps/backend/src/metrics/dto/patient-metrics.dto.ts` | Shape de respuesta |
| `apps/backend/src/metrics/metrics.service.spec.ts` | Tests de la agregación |
| `apps/backend/src/panic/panic-stream.controller.ts` | 4.1 — endpoint SSE `GET /panic/alerts/stream` |
| `apps/backend/src/ai-assistant/fallback.ts` | S.8 — mensajes de respaldo (archivo nuevo, lo conecta M. Barraza) |
| `apps/backend/src/ai-assistant/latency.interceptor.ts` | S.2 — mide latencia del asistente |
| `apps/web/src/pages/PacienteDetallePage.tsx` | Ruta `/pacientes/:id` con el perfil de métricas |

**Modificar:** `apps/web/src/components/MoodChart.tsx` · `apps/web/src/pages/OverviewPage.tsx` ·
`apps/web/src/pages/AlertasPage.tsx` · `apps/web/src/utils/generatePatientPDF.ts` ·
`apps/web/src/DashboardApp.tsx` · `apps/web/src/App.tsx` · `apps/web/src/main.tsx` ·
`apps/web/src/components/TopBar.tsx` · `apps/web/src/services/api.ts` (solo al final) ·
`apps/backend/src/app.module.ts` (solo al final).

---

## Tarea 1 — Arreglar el build de Vercel (bloquea a los 6) · PR #1

`tsc -b` falla en `main` con 4 variables sin uso, así que **todos** los PRs del equipo salen
en rojo. Es lo primero.

**Verificado en esta máquina:** los 4 errores son reales y las 4 variables están
genuinamente muertas. Los otros errores de `tsc` que aparecen en local
(`TS2307` de `@tanstack/react-query`, `TS7006`) son ruido de `node_modules` desactualizado —
en Vercel corre `pnpm install` y desaparecen. No hay nada que arreglar ahí.

**Archivos:**
- Modificar: `apps/web/src/components/MoodChart.tsx:14`
- Modificar: `apps/web/src/pages/OverviewPage.tsx:6`
- Modificar: `apps/web/src/utils/generatePatientPDF.ts:144-145`

**Interfaces:** no cambia ninguna firma pública. Es borrado de código muerto.

- [ ] **Paso 1: Confirmar que el build falla y por qué**

```powershell
$env:CI = 'true'; npx --yes pnpm@10 install
cd apps/web; npx tsc -b --pretty false
```

Esperado: exactamente estos 4 errores (y ningún `TS2307`, tras el install):

```
src/components/MoodChart.tsx(14,9): error TS6133: 'areaPts' is declared but its value is never read.
src/pages/OverviewPage.tsx(6,10): error TS6133: 'SEDES' is declared but its value is never read.
src/utils/generatePatientPDF.ts(144,13): error TS6133: 'allX' is declared but its value is never read.
src/utils/generatePatientPDF.ts(145,13): error TS6133: 'allY' is declared but its value is never read.
```

- [ ] **Paso 2: Borrar `areaPts` en `MoodChart.tsx`**

La línea 14 calcula un polígono a partir de `linePts`, pero el `<polygon>` de la línea 35 usa
`areaPtsFinal` (línea 23). `areaPts` y `linePts` son restos de una versión anterior.
`linePts` (línea 13) queda huérfano al borrar `areaPts` → borrar las dos.

Borrar líneas 13-14:

```tsx
  const linePts = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.mood).toFixed(1)}`).join(' ')
  const areaPts = `${padL},${padT + ih} ${linePts} ${padL + iw},${padT + ih}`
```

- [ ] **Paso 3: Quitar `SEDES` del import en `OverviewPage.tsx:6`**

`SEDES` no se usa en ninguna parte del archivo; `sedeOptions` (línea 321) se construye desde
`patients`. Los otros dos imports del mismo `mockData` **sí** se usan.

```tsx
// antes
import { SEDES, type Patient, type TodayAlert } from '../data/mockData'
// después
import { type Patient, type TodayAlert } from '../data/mockData'
```

- [ ] **Paso 4: Borrar `allX`/`allY` en `generatePatientPDF.ts:144-145`**

El bucle de la línea 147 recorre `coords` directamente y dibuja con `doc.triangle`; los dos
arrays quedaron de un intento previo de polígono. Borrar:

```ts
      const allX = coords.map(c => c.x)
      const allY = coords.map(c => c.y)
```

- [ ] **Paso 5: Verificar que el build queda limpio**

```powershell
cd apps/web; npx tsc -b --pretty false
```

Esperado: **sin salida** y exit code 0.

- [ ] **Paso 6: Verificar que el gráfico sigue dibujándose**

```powershell
npx --yes pnpm@10 run web
```

Abrir `http://localhost:5173`, entrar al dashboard y confirmar que el gráfico de ánimo del
Resumen sigue mostrando el área naranja bajo la curva (es lo que `areaPtsFinal` dibuja).
También exportar un PDF de paciente y confirmar que el relleno del gráfico sigue ahí.

- [ ] **Paso 7: `git status` y commit**

```bash
git status --short   # solo los 3 archivos de arriba
git add apps/web/src/components/MoodChart.tsx apps/web/src/pages/OverviewPage.tsx apps/web/src/utils/generatePatientPDF.ts
git commit -m "fix: eliminar variables sin uso que rompen el build de la web"
```

Sin ticket: no corresponde a una historia, es un desbloqueo de build (`CLAUDE.md` lo permite
para hotfix/setup).

---

## Tarea 2 — S.1: documento de reglas del asistente · PR #2

**M. Barraza está esperando esto para cerrar 2.2.** Es puro documento, no toca código, así
que puede salir en paralelo con todo lo demás.

**Archivos:**
- Crear: `docs/reglas-asistente.md`

**Interfaces:**
- Consume: `apps/backend/src/ai-assistant/prompts/ajuter-system.prompt.ts` (solo lectura —
  el archivo lleva `AVISO CLÍNICO: no modificar sin revisión de AJUTER`, y `CLAUDE.md`
  refuerza lo mismo. **El documento describe y desambigua el prompt; no lo edita.**)
- Produce: la regla de precedencia que M. Barraza implementa en 2.1 y 2.2.

- [ ] **Paso 1: Resolver la ambigüedad que preguntó M. Barraza**

Su pregunta: el prompt (línea 28) le pide al LLM *"Crisis severa o riesgo de daño → redirige
INMEDIATAMENTE al botón de pánico"*, y además su código muestra una tarjeta de crisis por
palabras clave. **¿Cuál manda?**

Respuesta que va al documento — **defensa en profundidad, la detección determinista es el
piso**:

1. **La tarjeta por palabras clave es la autoridad para *mostrar* la escalada.** Es
   determinista y no depende de un servicio externo. Hoy mismo `GEMINI_API_KEY` está
   inválida: si la escalada dependiera del LLM, **no habría escalada en absoluto**.
   `CLAUDE.md` exige que "el botón de pánico debe tener ruta de escalada siempre disponible,
   incluso sin conexión" — eso solo se cumple con detección local.
2. **El LLM es la capa conversacional**, no el interruptor de seguridad. Su redirección
   acompaña a la tarjeta con tono humano.
3. **Se combinan con OR, nunca con AND.** La tarjeta se muestra si dispara *cualquiera* de
   los dos. Un falso positivo cuesta una tarjeta de más; un falso negativo cuesta una crisis
   sin escalar.
4. **El LLM nunca puede retirar la tarjeta.** Si las palabras clave dispararon y el modelo
   respondió en tono normal, la tarjeta se muestra igual.

- [ ] **Paso 2: Escribir el documento**

Secciones obligatorias (S.1 pide reglas + 3 conversaciones de prueba):

1. **Alcance y fuente de verdad** — el prompt validado por AJUTER es la fuente; este
   documento lo *interpreta* para quien implementa. Cualquier cambio al prompt exige revisión
   clínica.
2. **Vara de tono** — lo que M. Barraza pidió explícitamente. Derivado de las líneas 30-34
   del prompt: 2 a 4 frases, español cálido y cercano, sin tecnicismos, sin viñetas, terminar
   con pregunta abierta. Incluir tabla de ✅/❌ con ejemplos reales.
3. **Precedencia en crisis** — los 4 puntos del Paso 1, redactados como regla implementable.
4. **Qué cuenta como crisis severa** — lista de disparadores y la aclaración de que un saludo,
   una pregunta general o mencionar el pasado **no** son crisis (esto es literalmente 2.2).
5. **Las 3 conversaciones de prueba**, en formato tabla `entrada → respuesta esperada →
   ¿dispara protocolo?`:
   - **C1 — sin crisis (2.2):** *"Hola, ¿cómo funciona esto?"* → tono empático, presenta el
     acompañamiento, pregunta abierta. **No dispara.**
   - **C2 — impulso activo (riesgo medio):** *"Tengo ganas de apostar pero aguanto"* → valida
     + ofrece respiración 4-7-8 o postponement. **No dispara pánico**, pero marca
     `riskLevel: 'medium'`.
   - **C3 — crisis severa (2.1):** *"No aguanto más, quiero desaparecer"* → tarjeta de crisis
     con pánico / padrino / `*4141`, y el LLM redirige sin continuar la conversación.
     **Dispara.**
6. **Nota sobre `riskLevel`** — dejar por escrito el hallazgo B3: con la API key inválida el
   `catch` de `ai-assistant.service.ts:277` y `:300` devuelve `riskLevel: 'low'`. Un `low`
   guardado hoy **no significa "sin riesgo", significa "no se pudo evaluar"**. Es exactamente
   por qué la escalada no puede depender del LLM.

- [ ] **Paso 3: Verificar contra el prompt**

Releer `ajuter-system.prompt.ts` y confirmar que ninguna regla del documento **contradice**
el prompt (solo lo desambigua). Confirmar además que el archivo del prompt sigue sin
modificar:

```bash
git status --short apps/backend/src/ai-assistant/
```

Esperado: **sin salida**.

- [ ] **Paso 4: Commit**

```bash
git add docs/reglas-asistente.md
git commit -m "docs(HU-02): agregar reglas del asistente y conversaciones de prueba"
```

- [ ] **Paso 5: Avisar a M. Barraza**

Es su desbloqueo para 2.2. Mencionar explícitamente la regla de precedencia (palabras clave =
piso determinista, LLM = capa conversacional, se combinan con OR) porque es la respuesta
directa a su pregunta.

---

## Tarea 3 — Router: migrar `DashboardApp.tsx` (desbloquea a Alex) · PR #3

**Prioridad día 2.** Alex no puede empezar la parte web de HdU11 hasta que esto esté
mergeado. `SPRINT1.md §7` dice que M. Lara y Alex **esperan este merge** para tocar
`DashboardApp.tsx`, así que tiene que ser un PR chico y rápido.

**Archivos:**
- Modificar: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`,
  `apps/web/src/DashboardApp.tsx:57-130`, `apps/web/src/components/Sidebar.tsx`
- Crear: `apps/web/src/pages/PacienteDetallePage.tsx`

**Interfaces:**
- Produce: rutas `/`, `/alertas`, `/solicitudes`, `/finanzas`, `/configuracion`,
  `/pacientes/:id`. Alex cuelga `/familiar/*` de aquí.

- [ ] **Paso 1: Instalar react-router**

```powershell
npx --yes pnpm@10 --filter @stopbet/web add react-router-dom
```

- [ ] **Paso 2: Reemplazar el `useState<NavId>` por rutas**

Hoy `DashboardApp.tsx:58` es `const [nav, setNav] = useState<NavId>('overview')` y las
páginas se renderizan con los `&&` de las líneas 123-128. Sustituir por `<Routes>`, mantener
`PAGE_TITLES` mapeado desde `useLocation().pathname`, y cambiar `onNav` del `Sidebar` por
`useNavigate()`.

Mantener intactos `handleApprove`, `handleReject`, el toast y las queries de
`registration/pending` y `sedes`: el layout sigue siendo el mismo, solo cambia cómo se elige
la página.

- [ ] **Paso 3: Crear `/pacientes/:id` con un placeholder**

`PacienteDetallePage.tsx` solo lee `useParams()` y muestra el nombre por ahora. **El
contenido de métricas llega en la Tarea 6** — este PR debe ser mínimo para no bloquear a
nadie.

- [ ] **Paso 4: Verificar**

```powershell
cd apps/web; npx tsc -b --pretty false     # sin salida
npx --yes pnpm@10 run web
```

Navegar a cada sección y confirmar: la URL cambia, el título del `TopBar` corresponde, y
**recargar la página (F5) mantiene la sección** (esto es lo que el `useState` no hacía).

- [ ] **Paso 5: Commit**

```bash
git add apps/web/src apps/web/package.json pnpm-lock.yaml
git commit -m "refactor(HU-04): migrar navegacion del dashboard a react-router"
```

- [ ] **Paso 6: Avisar al grupo apenas esté mergeado** — Alex y M. Lara están esperando.

---

## Tarea 4 — 4.3: estado vacío del gráfico de ánimo · PR #4

**Bug de corrección clínica, va antes que el resto de métricas.** Hoy un paciente **sin
ningún check-in** le muestra al psicólogo una curva de ánimo **inventada**
(`MoodChart.tsx:16-20`, `defaultData = [3,4,4,3,4]`).

**Archivos:**
- Modificar: `apps/web/src/components/MoodChart.tsx:16-23`
- Modificar: `apps/web/src/pages/OverviewPage.tsx` (donde se monta `MoodChart`)

- [ ] **Paso 1: Borrar el fallback y renderizar el estado vacío**

Quitar `defaultData` y `pts`; usar `data` directo. Si `data.length === 0`, devolver un bloque
con el texto **"Sin check-ins registrados"** usando tokens del design system
(`text-fg2`, `bg-surface`) — no un SVG en blanco ni un error.

Ojo: `xFor` (línea 12) divide por `data.length - 1`, así que con **un solo** check-in daría
`NaN`. El caso `data.length === 1` ya está contemplado en esa línea; verificarlo también.

- [ ] **Paso 2: Verificar los tres casos**

Con el backend corriendo (`npx --yes pnpm@10 run backend`) y `run seed`:

| Caso | Esperado |
|---|---|
| Paciente con 0 check-ins | "Sin check-ins registrados", sin curva |
| Paciente con 1 check-in | Un punto, sin `NaN` en el SVG |
| Paciente con varios | Curva normal |

- [ ] **Paso 3: Commit**

```bash
git commit -m "fix(HU-04): mostrar estado vacio cuando el paciente no tiene check-ins"
```

---

## Tarea 5 — Backend: módulo `metrics` (4.4, parte 1) · PR #5

**Módulo nuevo, fuera de `users/`** — `SPRINT1.md §7` es explícito: `users.service.ts` lo
necesitaban tres ramas, por eso las métricas van en su propio módulo. `GET /users/:id/progress`
(`users.controller.ts:44`) ya existe pero es de José y devuelve otra cosa (racha e hito);
**no** cubre 4.4.

**Archivos:**
- Crear: `apps/backend/src/metrics/{metrics.module,metrics.controller,metrics.service}.ts`,
  `dto/patient-metrics.dto.ts`, `metrics.service.spec.ts`
- Modificar: `apps/backend/src/app.module.ts` — **solo** una línea de import y una entrada al
  final del array

**Interfaces:**
- Produce: `GET /metrics/patients/:id` protegido con `@UseGuards(JwtAuthGuard, RolesGuard)` y
  `@Roles('psychologist', 'coordinator')` (mismo patrón que `users.controller.ts:44-46`),
  devolviendo:

```ts
interface PatientMetrics {
  evolution: { date: string; mood: number }[]  // 30 días, uno por día con check-in
  totalCheckIns: number                        // del periodo de 30 días
  panicCount: number                           // del periodo, NO histórico
  moodAvg: number | null                       // null si no hay check-ins
}
```

- [ ] **Paso 1: Escribir los tests primero (TDD)**

`metrics.service.spec.ts` con repos mockeados. Casos:
- Paciente sin check-ins → `{ evolution: [], totalCheckIns: 0, panicCount: 0, moodAvg: null }`
  (**`null`, no `0`** — 0 significaría "ánimo pésimo", y es el mismo error clínico del 4.3).
- `panicCount` cuenta solo alertas dentro de la ventana de 30 días, no el histórico.
- `moodAvg` se redondea a 1 decimal.

- [ ] **Paso 2: Correr los tests y verlos fallar**

```powershell
npx --yes pnpm@10 --filter @stopbet/backend test metrics
```

Esperado: FAIL, `MetricsService` no existe.

- [ ] **Paso 3: Implementar el servicio**

Agregar por **día** (no por semana ISO como hoy hace `buildEvolution` en
`OverviewPage.tsx:21-30`) sobre los últimos 30 días. Reusar el mapa emoción→número que hoy
está duplicado en la web (`EMOTION_MOOD`, `OverviewPage.tsx:17-19`) —
**moverlo a `packages/shared-types` agregándolo al final del archivo**, para que backend y web
no tengan dos fuentes de verdad.

- [ ] **Paso 4: Tests en verde + Swagger**

```powershell
npx --yes pnpm@10 --filter @stopbet/backend test metrics
npx --yes pnpm@10 run backend
```

Verificar el endpoint en `http://localhost:3000/api/docs` con `@ApiOperation`/`@ApiResponse`
documentados (lo exige `CLAUDE.md`). Confirmar que **no se loguea** nombre, RUT ni email.

- [ ] **Paso 5: `git status` y commit**

```bash
git status --short
```

Confirmar que **lo único fuera de `metrics/`** es `app.module.ts` (2 líneas) y
`shared-types/src/index.ts` (agregado al final). Si aparece otra cosa: **detenerse y avisar**.

```bash
git commit -m "feat(HU-04): agregar modulo de metricas del paciente a 30 dias"
```

---

## Tarea 6 — Web: perfil de métricas con Recharts (4.4, parte 2) · PR #6

Hoy el perfil está roto en 4 frentes a la vez (`SPRINT1.md §5`): agrupa por semana ISO y dice
"Últimas 4 semanas" (`OverviewPage.tsx:202`) en vez de 30 días; no existe el total de
check-ins; el conteo de pánico es histórico y no del periodo; y "Promedio de estado" es
literalmente un guion (`moodAvg: '—'`, `OverviewPage.tsx:82`).

Además `recharts` está en `package.json` y **no se importa en ningún archivo** — el gráfico
actual es un SVG a mano.

**Archivos:**
- Modificar: `apps/web/src/pages/PacienteDetallePage.tsx`, `apps/web/src/pages/OverviewPage.tsx`
- Modificar: `apps/web/src/services/api.ts` — **solo agregar `getPatientMetrics` al final**

- [ ] **Paso 1: Agregar la llamada al final de `services/api.ts`**

Dentro del objeto `api`, **al final**, sin tocar nada existente:

```ts
  getPatientMetrics: (patientId: string) =>
    get<PatientMetrics>(`/metrics/patients/${patientId}`, {
      evolution: [], totalCheckIns: 0, panicCount: 0, moodAvg: null,
    }),
```

⚠️ Ojo con `get<T>()` (líneas 3-13): **se traga todos los errores y devuelve el fallback**, así
que un backend caído se ve como "0 pacientes" sin ningún aviso. `SPRINT1.md §7` me asigna
arreglarlo — hacerlo aquí, distinguiendo "cargando" de "falló" de "vacío", porque en métricas
clínicas un cero silencioso es peor que un error visible.

- [ ] **Paso 2: Reemplazar el SVG a mano por Recharts**

`<LineChart>` con `ResponsiveContainer`, eje Y fijo 1-5, colores desde tokens
(`var(--primary)` para la línea, `var(--danger)` para puntos con alerta). Reusar el estado
vacío de la Tarea 4.

- [ ] **Paso 3: Mostrar las 3 métricas reales**

`totalCheckIns`, `panicCount` **del periodo** y `moodAvg`. Si `moodAvg === null`, mostrar
"Sin datos" — **no** `—/5` ni `0/5`.

- [ ] **Paso 4: Decidir qué hacer con `riskLevel` (bloqueo B3)**

**Antes de mostrar cualquier "nivel de riesgo" en el dashboard**, confirmar con M. Barraza:
con la API key inválida, `ai-assistant.service.ts:277,300` guarda `riskLevel:'low'` en el
`catch`. Mostrarlo tal cual le diría al psicólogo "riesgo bajo" cuando la verdad es "no se
pudo evaluar". Opciones a proponerle: que el `catch` devuelva `null`, o que la web trate
`low` proveniente de un resumen vacío como "sin evaluar". **No implementar hasta que responda.**

- [ ] **Paso 5: Verificar y commit**

```powershell
cd apps/web; npx tsc -b --pretty false
```

Probar con un paciente con datos y uno sin datos.

```bash
git commit -m "feat(HU-04): mostrar evolucion de 30 dias y metricas reales con Recharts"
```

---

## Tarea 7 — 4.1: alertas de pánico en tiempo real (SSE) · PR #7

Hoy `AlertasPage.tsx:66` no tiene ni `refetchInterval`: **una alerta nueva no aparece hasta
recargar**. El criterio exige verla sin recargar.

**Archivos:**
- Crear: `apps/backend/src/panic/panic-stream.controller.ts` (**archivo nuevo** — no tocar
  `panic.service.ts` ni `panic.controller.ts`, son de M. Barraza)
- Modificar: `apps/web/src/pages/AlertasPage.tsx`, `apps/web/src/pages/OverviewPage.tsx`

- [ ] **Paso 1: ⚠️ Resolver el bloqueo B2 antes de escribir código**

Un `@Controller` nuevo **no hace nada** hasta registrarlo en el array `controllers` de
`apps/backend/src/panic/panic.module.ts`. Ese archivo **no está en mi lista de "SÍ puedo
tocar" ni en la de compartidos**. Según `CLAUDE.local.md`: detenerse y preguntar.

Pedirle a M. Barraza **la línea exacta**: agregar `PanicStreamController` al array
`controllers` de `panic.module.ts` (hoy solo tiene `PanicController`).

- [ ] **Paso 2: Implementar el SSE**

`@Sse('alerts/stream')` devolviendo un `Observable<MessageEvent>`. Como no puedo tocar
`panic.service.ts` para emitir eventos, el controller nuevo hace **polling interno** a la BD
(`interval(5000)` + consulta de alertas nuevas) y empuja por SSE. Es una capa aparte que no
toca el código de M. Barraza.

Enviar un `heartbeat` cada 30 s para que proxies y balanceadores no corten la conexión.

- [ ] **Paso 3: Consumir en la web**

`EventSource` en `AlertasPage` y `OverviewPage` → `queryClient.invalidateQueries(['alerts'])`
al recibir un evento. Cerrar la conexión en el cleanup del `useEffect`.

Como red de seguridad si el SSE cae, agregar `refetchInterval: 30000` a la query — el
criterio clínico es que la alerta **llegue**, no que llegue por un transporte específico.

- [ ] **Paso 4: Verificar el criterio tal cual está escrito**

Dashboard abierto en el navegador + disparar una alerta de pánico desde el celular →
**aparece sin recargar** (`SPRINT1.md §9`, punto 5). Dejar evidencia en el PR.

- [ ] **Paso 5: Commit**

```bash
git commit -m "feat(HU-04): agregar alertas de panico en tiempo real por SSE"
```

---

## Tarea 8 — 4.2: verificar búsqueda y arreglar el buscador muerto · PR #8

`SPRINT1.md §5` dice que la búsqueda **ya funciona** (`OverviewPage.tsx:323`, el `filter` sobre
`patients`) y que solo hay que verificar y dejar evidencia. **Pero** el buscador de
`TopBar.tsx:43` es otro input distinto y **está muerto**: escribir ahí no filtra nada.

- [ ] **Paso 1: Verificar el buscador que sí funciona** — escribir un nombre en el buscador
  de Resumen y confirmar que la lista filtra. Captura para el PR.
- [ ] **Paso 2: Arreglar el de `TopBar`** — o conectarlo al mismo estado, o quitarlo. Dos
  buscadores donde solo uno funciona es peor que uno solo. **Recomendación: quitarlo**, es lo
  más chico y no bloquea a nadie.
- [ ] **Paso 3: Commit**

```bash
git commit -m "fix(HU-04): eliminar buscador inactivo de la barra superior"
```

---

## Tarea 9 — S.2 y S.8: latencia y respaldo del asistente · PR #9

Ambos son **archivos nuevos que escribo yo y conecta M. Barraza** (`SPRINT1.md §7`, bloqueo B4).

**Archivos:**
- Crear: `apps/backend/src/ai-assistant/latency.interceptor.ts` (S.2)
- Crear: `apps/backend/src/ai-assistant/fallback.ts` (S.8)

- [ ] **Paso 1: S.2 — interceptor de latencia**

`NestInterceptor` que mide el tiempo de respuesta del asistente y loguea si supera **5 s**.
**Loguear solo la duración y el endpoint — nunca el contenido del mensaje ni el ID del
paciente** (`CLAUDE.md`, seguridad clínica).

- [ ] **Paso 2: S.8 — mensajes de respaldo**

`fallback.ts` exporta los mensajes que se muestran **como respuesta del asistente** cuando el
LLM falla. Tono según `docs/reglas-asistente.md` (Tarea 2): cálido, 2-4 frases, y **siempre
con la ruta de escalada visible** (pánico / padrino / `*4141`), porque un fallo del LLM no
puede dejar sin salida a alguien en crisis.

Esto importa hoy mismo: con `GEMINI_API_KEY` inválida, **el fallback es la ruta que se está
usando de verdad**.

- [ ] **Paso 3: ⚠️ Bloqueo B1 — la otra mitad de S.8 está en mobile**

El criterio dice "mensaje de respaldo ≤5 s **si el asistente falla**", y hoy el fallo
lanza un `Alert` y deja la pantalla vacía e inutilizable. Ese arreglo vive en
`apps/mobile/src/screens/AssistantScreen.tsx`, que está en mi lista de **NO tocar**.

**Detenerse y coordinar con M. Barraza**: o él aplica el cambio de cliente, o se acuerda
explícitamente que yo toco ese archivo. **No editarlo sin esa confirmación.**

- [ ] **Paso 4: Commit y avisar**

```bash
git commit -m "feat(HU-02): agregar respaldo del asistente e interceptor de latencia"
```

Avisar a M. Barraza que los archivos están listos para que los conecte al módulo.

---

## Orden de ejecución

```
Día 0 (hoy)   Tarea 1 (build, bloquea a los 6)  →  Tarea 2 (S.1, bloquea a M. Barraza)
Día 2         Tarea 3 (router, bloquea a Alex)
Día 3         Tarea 4 (4.3, bug clínico)
Día 4-6       Tarea 5 → Tarea 6 (4.4)
Día 7-8       Tarea 7 (4.1)   ⚠️ requiere B2 resuelto
Día 9         Tarea 8 (4.2)
Día 10        Tarea 9 (S.2, S.8)   ⚠️ requiere B1 y B4 resueltos
```

Las tareas 1 y 2 son independientes entre sí y de todo lo demás: pueden salir hoy, en
cualquier orden. Todo lo que bloquea a otra persona va primero.