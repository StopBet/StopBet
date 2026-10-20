# HdU10 — Memoria del asistente: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado)
> o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan
> casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que el asistente recuerde qué técnica le sirvió al paciente y se la proponga primero
ante un detonante de la misma categoría. El paciente y su equipo clínico ven el historial; el
compañero de viaje y el familiar, no.

**Arquitectura:** dos módulos puros y probables en `ai-assistant/`:
- `trigger-catalog.ts` clasifica el motivo.
- `technique-memory.ts` decide la técnica efectiva con una regla fija.

El servicio guarda cuatro columnas nuevas en `ai_session_summaries` y, en cada mensaje, agrega un
bloque de memoria al system prompt de la **misma** llamada al LLM. La app pregunta «¿Te ayudó?» en
el modal de resumen y muestra el historial en una hoja inferior. La web llena la pestaña
«Sesiones» del panel «Seguimiento».

**Tech stack:** NestJS 10 + TypeORM (`synchronize` crea las columnas), Jest, React Native 0.86,
React 19 + TanStack Query.

**Spec:** [`docs/planning/hdu10-memoria-asistente.md`](hdu10-memoria-asistente.md)

## Restricciones globales

- Siempre `pnpm`. Nada de `any` sin un comentario que diga por qué.
- Código en inglés, textos de UI en español. Comentarios solo para el **por qué**.
- **Nunca loguear** nombre, RUT ni correo del paciente: el log del CA3 lleva solo el tipo de error.
- Términos visibles: «compañero de viaje», nunca «padrino».
- Mobile:
  - Estilos con `makeStyles(c: Palette)` + `useStyles`.
  - `Touchable` y `useDialog`/`useToast`: nada de `Alert.alert` ni `TouchableOpacity`.
  - Nada de `console.*`.
  - Íconos solo de los que ya registra `components/Icon.tsx`.
- Web: estilos en línea con variables del tema. Texto de riesgo con `--danger-text`, no `--danger`.
- `packages/shared-types/src/index.ts`: **solo agregar al final**.
- Commits: `tipo(HU-10): descripción`, en español e imperativo, sin punto final y **sin
  `Co-Authored-By`**.
- No hacer `git push` ni abrir el PR sin que Matías lo pida.

## Foco de revisión

Los casos que ningún test cubre por sí solo y que más pueden doler en el uso real. Cada uno tiene
su test en la tarea que lo implementa:

1. **Un paciente con historial anterior a la HdU10.** Esas filas tienen las columnas nuevas en
   `null` y no deben romper ni sumar a la memoria (Tarea 2).
2. **Un mensaje que no es un motivo** («hola», «gracias»). Cae en `other` y no debe forzar una
   técnica, solo dar la lista para que el LLM juzgue (Tarea 2).
3. **Una alerta de pánico anterior a la sesión.** No debe vetarla: el veto mira solo las 2 horas
   **siguientes** al cierre (Tarea 2).
4. **Responder «¿Te ayudó?» dos veces.** La segunda respuesta reemplaza a la primera y no duplica
   nada (Tarea 5).
5. **Abrir el historial sin conexión** en la app. Muestra un mensaje de error y no queda cargando
   para siempre (Tarea 6).

---

### Tarea 1: Catálogo de detonantes

**Archivos:**
- Agregar al final: `packages/shared-types/src/index.ts`
- Crear: `apps/backend/src/ai-assistant/trigger-catalog.ts`
- Test: `apps/backend/src/ai-assistant/trigger-catalog.spec.ts`

**Interfaces:**
- Produce:
  - `type TriggerCategory`, `type PatientFeedback`, `interface AiSessionHistoryItem` y
    `interface AiSessionClinicalItem`, en shared-types.
  - `classifyTrigger(text: string): TriggerCategory`
  - `isTriggerCategory(value: unknown): value is TriggerCategory`
  - `TRIGGER_CATEGORIES: TriggerCategory[]`

- [ ] **Paso 1: agregar los tipos al final de shared-types**

```ts
// ── HdU10: memoria del asistente ──
export type TriggerCategory =
  | 'money' | 'temptation' | 'sports' | 'emotions'
  | 'loneliness' | 'family' | 'work' | 'other';

export type PatientFeedback = 'yes' | 'somewhat' | 'no';

// Lo que ve el paciente de cada conversación: sin el nivel de riesgo, que es un dato clínico.
export interface AiSessionHistoryItem {
  id: string;
  sessionId: string;
  createdAt: string;
  durationMinutes: number;
  triggerCategory: TriggerCategory | null;
  technique: TechniqueType | null;
  patientFeedback: PatientFeedback | null;
}

// Lo que ve el equipo clínico: lo mismo más el riesgo, el ánimo y el detonante en texto libre.
export interface AiSessionClinicalItem extends AiSessionHistoryItem {
  mood: string | null;
  trigger: string | null;
  riskLevel: RiskLevel | null;
}
```

- [ ] **Paso 2: escribir el test que falla**

```ts
import { classifyTrigger, isTriggerCategory } from './trigger-catalog';

describe('classifyTrigger', () => {
  it.each([
    ['me pagaron el sueldo y quiero apostarlo', 'money'],
    ['hoy me llegó el finiquito', 'money'],
    ['me salió un anuncio de un casino con un bono', 'temptation'],
    ['esta noche juega Chile el partido', 'sports'],
    ['tengo mucha ansiedad', 'emotions'],
    ['me siento sola y aburrida', 'loneliness'],
    ['pelee con mi pareja', 'family'],
    ['mi jefe me reto en la pega', 'work'],
  ])('«%s» → %s', (texto, categoria) => {
    expect(classifyTrigger(texto)).toBe(categoria);
  });

  it('no distingue tildes ni mayúsculas', () => {
    expect(classifyTrigger('DISCUSIÓN con mi FAMILIA')).toBe('family');
  });

  it('un saludo cae en other', () => {
    expect(classifyTrigger('hola, gracias')).toBe('other');
    expect(classifyTrigger('')).toBe('other');
  });

  it('gana la categoría con más coincidencias', () => {
    expect(classifyTrigger('el partido, la liga y el mundial, y algo de plata')).toBe('sports');
  });

  it('con empate gana la primera del catálogo', () => {
    // una coincidencia de dinero y una de trabajo: dinero va antes
    expect(classifyTrigger('plata del trabajo')).toBe('money');
  });
});

describe('isTriggerCategory', () => {
  it('acepta solo valores del catálogo', () => {
    expect(isTriggerCategory('money')).toBe(true);
    expect(isTriggerCategory('dinero')).toBe(false);
    expect(isTriggerCategory(null)).toBe(false);
  });
});
```

- [ ] **Paso 3: correrlo y ver que falla**

Correr: `pnpm --filter @stopbet/shared-types build && pnpm --filter @stopbet/backend test -- trigger-catalog`
Esperado: FAIL, «Cannot find module './trigger-catalog'».

- [ ] **Paso 4: implementar**

```ts
import type { TriggerCategory } from '@stopbet/shared-types';

// El orden importa: ante un empate de coincidencias gana la categoría que aparece primero.
const CATALOG: { category: Exclude<TriggerCategory, 'other'>; pattern: RegExp }[] = [
  { category: 'money', pattern: /\b(sueldo|plata|dinero|deudas?|pago|pagaron|finiquito|aguinaldo|prestamo|cobr\w*)\b/g },
  { category: 'temptation', pattern: /\b(anuncio\w*|publicidad|casino\w*|bono\w*|promo\w*|tragamonedas?|maquinita\w*|slots?|ruleta|poker|app de apuestas)\b/g },
  { category: 'sports', pattern: /\b(partido\w*|futbol|liga|mundial|clasico|champions|apuestas? deportivas?)\b/g },
  { category: 'emotions', pattern: /\b(ansiedad|ansios\w*|estres\w*|angustia\w*|rabia|enojad\w*|triste\w*|deprimid\w*|nervios\w*)\b/g },
  { category: 'loneliness', pattern: /\b(sol[oa]|soledad|aburrid\w*|aburrimiento|nadie|aislad\w*)\b/g },
  { category: 'family', pattern: /\b(pareja|pelea\w*|pelee|discusion\w*|discuti\w*|mi senora|mi esposa?|mi marido|mi familia|mis? hijos?|separacion|divorcio)\b/g },
  { category: 'work', pattern: /\b(trabajo|pega|jefe\w*|despid\w*|cesante|oficina|turno)\b/g },
];

export const TRIGGER_CATEGORIES: TriggerCategory[] = [...CATALOG.map((c) => c.category), 'other'];

// En el celular se escribe sin tildes, y `\b` de JS no trata las vocales acentuadas como letra.
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function classifyTrigger(text: string): TriggerCategory {
  const t = normalize(text);
  let best: TriggerCategory = 'other';
  let bestCount = 0;
  for (const { category, pattern } of CATALOG) {
    const count = t.match(pattern)?.length ?? 0;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

export function isTriggerCategory(value: unknown): value is TriggerCategory {
  return typeof value === 'string' && (TRIGGER_CATEGORIES as string[]).includes(value);
}
```

- [ ] **Paso 5: correrlo y ver que pasa**

Correr: `pnpm --filter @stopbet/backend test -- trigger-catalog`
Esperado: PASS (14 tests).

- [ ] **Paso 6: commit**

```bash
git add packages/shared-types/src/index.ts apps/backend/src/ai-assistant/trigger-catalog.ts apps/backend/src/ai-assistant/trigger-catalog.spec.ts
git commit -m "feat(HU-10): clasificar el detonante de la conversación en un catálogo fijo"
```

---

### Tarea 2: Regla de la técnica efectiva

**Archivos:**
- Crear: `apps/backend/src/ai-assistant/technique-memory.ts`
- Test: `apps/backend/src/ai-assistant/technique-memory.spec.ts`

**Interfaces:**
- Consume: `TriggerCategory`, `PatientFeedback` y `TechniqueType` de shared-types.
- Produce:
  - `interface MemorySession { triggerCategory: TriggerCategory | null; trigger: string | null; technique: TechniqueType | null; patientFeedback: PatientFeedback | null; llmThoughtHelpful: boolean | null; closedAt: Date }`
  - `normalizeTechnique(text: string | null | undefined): TechniqueType | null`
  - `sessionTechnique(assistantTexts: string[], llmTechnique: string | null): TechniqueType | null`
  - `effectivenessScore(session: MemorySession, panicTimes: Date[]): number`
  - `pickTechnique(sessions: MemorySession[], panicTimes: Date[], category: TriggerCategory): TechniqueType | null`
  - `buildMemoryBlock(sessions: MemorySession[], panicTimes: Date[], category: TriggerCategory): string | null`
  - Constantes `PANIC_VETO_MS = 7_200_000`, `MEMORY_SESSIONS = 10` y `MIN_SESSIONS_WITH_TECHNIQUE = 2`.

- [ ] **Paso 1: escribir el test que falla**

```ts
import {
  MemorySession, buildMemoryBlock, effectivenessScore, normalizeTechnique,
  pickTechnique, sessionTechnique,
} from './technique-memory';

const T0 = new Date('2026-10-01T15:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

function s(over: Partial<MemorySession> = {}): MemorySession {
  return {
    triggerCategory: 'money', trigger: 'sueldo', technique: 'breathing',
    patientFeedback: null, llmThoughtHelpful: null, closedAt: T0, ...over,
  };
}

describe('normalizeTechnique / sessionTechnique', () => {
  it('reconoce las tres técnicas del prompt', () => {
    expect(normalizeTechnique('Hagamos la respiración 4-7-8')).toBe('breathing');
    expect(normalizeTechnique('nombra 5 cosas que puedes ver')).toBe('grounding');
    expect(normalizeTechnique('posterga el impulso 30 minutos')).toBe('postponement');
    expect(normalizeTechnique('Mindfulness')).toBeNull();
    expect(normalizeTechnique(null)).toBeNull();
  });

  it('elige la técnica más mencionada por el asistente y cae al texto del LLM', () => {
    expect(sessionTechnique(['respira conmigo', 'otra respiración', 'grounding'], null)).toBe('breathing');
    expect(sessionTechnique(['hola, ¿cómo estás?'], 'Respiración profunda')).toBe('breathing');
    expect(sessionTechnique([], null)).toBeNull();
  });
});

describe('effectivenessScore', () => {
  it('la respuesta del paciente manda sobre lo que dedujo el LLM', () => {
    expect(effectivenessScore(s({ patientFeedback: 'yes', llmThoughtHelpful: false }), [])).toBe(1);
    expect(effectivenessScore(s({ patientFeedback: 'somewhat' }), [])).toBe(0.5);
    expect(effectivenessScore(s({ patientFeedback: 'no', llmThoughtHelpful: true }), [])).toBe(0);
  });

  it('sin respuesta del paciente, el LLM vale medio punto', () => {
    expect(effectivenessScore(s({ llmThoughtHelpful: true }), [])).toBe(0.5);
    expect(effectivenessScore(s({ llmThoughtHelpful: false }), [])).toBe(0);
    expect(effectivenessScore(s(), [])).toBe(0);
  });

  it('un pánico en las 2 horas siguientes al cierre anula todo', () => {
    expect(effectivenessScore(s({ patientFeedback: 'yes' }), [at(90)])).toBe(0);
  });

  it('un pánico antes del cierre o pasadas las 2 horas no anula', () => {
    expect(effectivenessScore(s({ patientFeedback: 'yes' }), [at(-30)])).toBe(1);
    expect(effectivenessScore(s({ patientFeedback: 'yes' }), [at(121)])).toBe(1);
  });
});

describe('pickTechnique', () => {
  it('exige al menos 2 sesiones con técnica (CA1)', () => {
    expect(pickTechnique([s({ patientFeedback: 'yes' })], [], 'money')).toBeNull();
  });

  it('propone la técnica con más puntaje en la misma categoría', () => {
    const sessions = [
      s({ technique: 'grounding', patientFeedback: 'somewhat', closedAt: at(10) }),
      s({ technique: 'breathing', patientFeedback: 'yes', closedAt: at(5) }),
      s({ triggerCategory: 'work', technique: 'postponement', patientFeedback: 'yes' }),
    ];
    expect(pickTechnique(sessions, [], 'money')).toBe('breathing');
  });

  it('con empate gana la usada más recientemente', () => {
    const sessions = [
      s({ technique: 'grounding', patientFeedback: 'yes', closedAt: at(60) }),
      s({ technique: 'breathing', patientFeedback: 'yes', closedAt: at(0) }),
    ];
    expect(pickTechnique(sessions, [], 'money')).toBe('grounding');
  });

  it('no propone nada si nada sumó puntos', () => {
    const sessions = [s({ patientFeedback: 'no' }), s({ patientFeedback: 'no' })];
    expect(pickTechnique(sessions, [], 'money')).toBeNull();
  });

  it('ignora las filas anteriores a la HdU10, sin categoría ni técnica', () => {
    const viejas = [s({ triggerCategory: null, technique: null }), s({ triggerCategory: null, technique: null })];
    expect(pickTechnique(viejas, [], 'money')).toBeNull();
  });
});

describe('buildMemoryBlock', () => {
  const dos = [
    s({ patientFeedback: 'yes', trigger: 'le llegó el finiquito' }),
    s({ triggerCategory: 'loneliness', technique: 'grounding', patientFeedback: 'yes', trigger: 'se sintió sola' }),
  ];

  it('sin historial suficiente no agrega nada (CA2: técnica general)', () => {
    expect(buildMemoryBlock([], [], 'money')).toBeNull();
    expect(buildMemoryBlock([dos[0]], [], 'money')).toBeNull();
  });

  it('con categoría conocida indica la técnica a proponer primero (CA1)', () => {
    const bloque = buildMemoryBlock(dos, [], 'money')!;
    expect(bloque).toContain('respiración 4-7-8');
    expect(bloque).toContain('dinero');
    expect(bloque).toMatch(/primero/i);
  });

  it('con other entrega la lista para que el LLM juzgue si se parece', () => {
    const bloque = buildMemoryBlock(dos, [], 'other')!;
    expect(bloque).toContain('le llegó el finiquito');
    expect(bloque).toContain('se sintió sola');
    expect(bloque).toMatch(/si lo que cuenta ahora se parece/i);
  });

  it('con other y nada efectivo no agrega nada', () => {
    const malas = dos.map((x) => ({ ...x, patientFeedback: 'no' as const }));
    expect(buildMemoryBlock(malas, [], 'other')).toBeNull();
  });
});
```

- [ ] **Paso 2: correrlo y ver que falla**

Correr: `pnpm --filter @stopbet/backend test -- technique-memory`
Esperado: FAIL, «Cannot find module './technique-memory'».

- [ ] **Paso 3: implementar**

```ts
import type { PatientFeedback, TechniqueType, TriggerCategory } from '@stopbet/shared-types';

export const PANIC_VETO_MS = 2 * 60 * 60 * 1000;
export const MEMORY_SESSIONS = 10;
export const MIN_SESSIONS_WITH_TECHNIQUE = 2;

export interface MemorySession {
  triggerCategory: TriggerCategory | null;
  trigger: string | null;
  technique: TechniqueType | null;
  patientFeedback: PatientFeedback | null;
  llmThoughtHelpful: boolean | null;
  closedAt: Date;
}

const TECHNIQUE_PATTERNS: [TechniqueType, RegExp][] = [
  ['breathing', /\b(respir\w*|4-7-8|inhala\w*|exhala\w*)/g],
  ['grounding', /\b(grounding|5-4-3-2-1|cosas que (?:ves|puedes ver)|anclaje)/g],
  ['postponement', /\b(posterg\w*|postpon\w*|30 minutos|media hora)/g],
];

const CATEGORY_TEXT: Record<TriggerCategory, string> = {
  money: 'dinero', temptation: 'publicidad o tentación', sports: 'deporte',
  emotions: 'emociones difíciles', loneliness: 'soledad o aburrimiento',
  family: 'conflicto familiar o de pareja', work: 'trabajo', other: 'otro motivo',
};

const TECHNIQUE_TEXT: Record<TechniqueType, string> = {
  breathing: 'la respiración 4-7-8',
  grounding: 'el ejercicio de grounding 5-4-3-2-1',
  postponement: 'postergar el impulso 30 minutos',
};

const FEEDBACK_SCORE: Record<PatientFeedback, number> = { yes: 1, somewhat: 0.5, no: 0 };

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function countTechniques(text: string): Map<TechniqueType, number> {
  const t = normalize(text);
  const counts = new Map<TechniqueType, number>();
  for (const [technique, pattern] of TECHNIQUE_PATTERNS) {
    const n = t.match(pattern)?.length ?? 0;
    if (n > 0) counts.set(technique, n);
  }
  return counts;
}

function mostFrequent(counts: Map<TechniqueType, number>): TechniqueType | null {
  let best: TechniqueType | null = null;
  let bestN = 0;
  for (const [technique] of TECHNIQUE_PATTERNS) {
    const n = counts.get(technique) ?? 0;
    if (n > bestN) { best = technique; bestN = n; }
  }
  return best;
}

export function normalizeTechnique(text: string | null | undefined): TechniqueType | null {
  return text ? mostFrequent(countTechniques(text)) : null;
}

// Lo que el asistente aplicó se lee en sus propios mensajes; el texto libre del resumen del LLM
// («Mindfulness») queda solo como último recurso.
export function sessionTechnique(assistantTexts: string[], llmTechnique: string | null): TechniqueType | null {
  return mostFrequent(countTechniques(assistantTexts.join(' '))) ?? normalizeTechnique(llmTechnique);
}

export function effectivenessScore(session: MemorySession, panicTimes: Date[]): number {
  const closed = session.closedAt.getTime();
  // Un pánico poco después de cerrar dice más que cualquier respuesta: la técnica no alcanzó.
  const vetoed = panicTimes.some((p) => p.getTime() > closed && p.getTime() - closed <= PANIC_VETO_MS);
  if (vetoed) return 0;
  if (session.patientFeedback) return FEEDBACK_SCORE[session.patientFeedback];
  return session.llmThoughtHelpful ? 0.5 : 0;
}

function withTechnique(sessions: MemorySession[]): MemorySession[] {
  return sessions.filter((s) => s.technique !== null);
}

export function pickTechnique(
  sessions: MemorySession[],
  panicTimes: Date[],
  category: TriggerCategory,
): TechniqueType | null {
  const usable = withTechnique(sessions);
  if (usable.length < MIN_SESSIONS_WITH_TECHNIQUE) return null;

  const totals = new Map<TechniqueType, { score: number; last: number }>();
  for (const s of usable) {
    if (s.triggerCategory !== category) continue;
    const prev = totals.get(s.technique!) ?? { score: 0, last: 0 };
    totals.set(s.technique!, {
      score: prev.score + effectivenessScore(s, panicTimes),
      last: Math.max(prev.last, s.closedAt.getTime()),
    });
  }

  let best: TechniqueType | null = null;
  let bestScore = 0;
  let bestLast = -1;
  for (const [technique, { score, last }] of totals) {
    if (score > bestScore || (score === bestScore && score > 0 && last > bestLast)) {
      best = technique; bestScore = score; bestLast = last;
    }
  }
  return bestScore > 0 ? best : null;
}

export function buildMemoryBlock(
  sessions: MemorySession[],
  panicTimes: Date[],
  category: TriggerCategory,
): string | null {
  if (withTechnique(sessions).length < MIN_SESSIONS_WITH_TECHNIQUE) return null;

  if (category !== 'other') {
    const technique = pickTechnique(sessions, panicTimes, category);
    if (!technique) return null;
    return `Memoria del paciente: cuando el motivo fue ${CATEGORY_TEXT[category]}, le sirvió ${TECHNIQUE_TEXT[technique]}. Propónsela primero, antes que otra técnica.`;
  }

  const helpful = withTechnique(sessions)
    .filter((s) => effectivenessScore(s, panicTimes) > 0)
    .map((s) => `${TECHNIQUE_TEXT[s.technique!]} (cuando ${s.trigger ?? CATEGORY_TEXT[s.triggerCategory ?? 'other']})`);
  const unique = [...new Set(helpful)];
  if (unique.length === 0) return null;
  return `Técnicas que le han servido antes: ${unique.join('; ')}. Si lo que cuenta ahora se parece a alguna de esas situaciones, propón esa técnica primero.`;
}
```

- [ ] **Paso 4: correrlo y ver que pasa**

Correr: `pnpm --filter @stopbet/backend test -- technique-memory`
Esperado: PASS.

- [ ] **Paso 5: commit**

```bash
git add apps/backend/src/ai-assistant/technique-memory.ts apps/backend/src/ai-assistant/technique-memory.spec.ts
git commit -m "feat(HU-10): decidir qué técnica le sirvió al paciente con una regla fija"
```

---

### Tarea 3: Guardar la memoria al cerrar y no perder sesiones

**Archivos:**
- Modificar: `apps/backend/src/ai-assistant/entities/ai-session-summary.entity.ts` (columnas nuevas)
- Modificar: `apps/backend/src/ai-assistant/prompts/ajuter-system.prompt.ts` (`SUMMARY_EXTRACTION_PROMPT`)
- Modificar: `apps/backend/src/ai-assistant/ai-assistant.service.ts` (`startSession`, `closeSession` y `extractSummary`)
- Test: `apps/backend/src/ai-assistant/ai-assistant.service.spec.ts`

**Interfaces:**
- Consume: `classifyTrigger` e `isTriggerCategory` (Tarea 1), y `sessionTechnique` (Tarea 2).
- Produce: las columnas `triggerCategory`, `technique`, `patientFeedback` y `llmThoughtHelpful` en
  `AiSessionSummary`.

- [ ] **Paso 1: columnas nuevas en la entidad, después de `progressNote`**

```ts
  // HdU10: todas nullable, para que los resúmenes anteriores sigan siendo válidos.
  @Column({ type: 'varchar', nullable: true })
  triggerCategory: TriggerCategory | null;

  @Column({ type: 'varchar', nullable: true })
  technique: TechniqueType | null;

  @Column({ type: 'varchar', nullable: true })
  patientFeedback: PatientFeedback | null;

  @Column({ type: 'boolean', nullable: true })
  llmThoughtHelpful: boolean | null;
```

Ampliar el import de shared-types de la entidad:
`import { PatientFeedback, RiskLevel, TechniqueType, TriggerCategory } from '@stopbet/shared-types';`

- [ ] **Paso 2: escribir los tests que fallan**, en `ai-assistant.service.spec.ts`, en un `describe` nuevo al final:

```ts
  describe('HdU10 — el resumen guarda la memoria', () => {
    it('clasifica el motivo y la técnica que usó el asistente', async () => {
      sessionRepo.findOne.mockResolvedValue({ id: SESSION_ID, userId: USER_ID, startedAt: new Date() });
      messageRepo.find.mockResolvedValue([
        userMessage('me pagaron el sueldo y quiero apostar'),
        { ...userMessage('Hagamos la respiración 4-7-8 juntos'), role: 'assistant' },
      ]);

      await service.closeSession(SESSION_ID, USER_ID);

      expect(summaryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ triggerCategory: 'money', technique: 'breathing' }),
      );
    });

    it('sin mensajes del paciente no inventa categoría', async () => {
      sessionRepo.findOne.mockResolvedValue({ id: SESSION_ID, userId: USER_ID, startedAt: new Date() });
      messageRepo.find.mockResolvedValue([]);

      await service.closeSession(SESSION_ID, USER_ID);

      expect(summaryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ triggerCategory: null, technique: null }),
      );
    });

    it('al abrir un chat nuevo, la sesión que quedó abierta se cierra CON resumen', async () => {
      sessionRepo.find = jest.fn().mockResolvedValue([{ id: 'vieja', userId: USER_ID, startedAt: new Date() }]);
      sessionRepo.findOne.mockResolvedValue({ id: 'vieja', userId: USER_ID, startedAt: new Date() });
      sessionRepo.save.mockImplementation((v) => Promise.resolve({ ...v, id: 'nueva', startedAt: new Date() }));

      await service.startSession(USER_ID);

      expect(summaryRepo.save).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'vieja' }));
    });
  });
```

Agregar `find: jest.Mock` al tipo de `sessionRepo` en el `beforeEach`, con
`find: jest.fn().mockResolvedValue([])`.

- [ ] **Paso 3: correrlos y ver que fallan**

Correr: `pnpm --filter @stopbet/backend test -- ai-assistant.service`
Esperado: FAIL en los tres tests nuevos. Los existentes siguen en verde.

- [ ] **Paso 4: implementar**

En el prompt de resumen, reemplazar el formato y las reglas:

```ts
export const SUMMARY_EXTRACTION_PROMPT = (userMessages: string) => `
Analiza los mensajes del paciente y extrae un resumen clínico en JSON exactamente con este formato:
{"mood":"...","trigger":"...","riskLevel":"low|medium|high","techniqueUsed":"...","progressNote":"...","triggerCategory":"money|temptation|sports|emotions|loneliness|family|work|other","helpful":true}

Reglas:
- mood: estado anímico principal en 1-3 palabras (ej: "Ansiedad", "Soledad", "Bien")
- trigger: detonante detectado en 1-4 palabras o null
- riskLevel: "low" si sin impulso activo, "medium" si impulso presente, "high" si crisis
- techniqueUsed: nombre de la técnica mencionada o null
- progressNote: frase positiva breve de máximo 4 palabras o null
- triggerCategory: una sola de las opciones del formato; "other" si no calza ninguna
- helpful: true si al final de los mensajes el paciente parece más tranquilo o dice que le sirvió; false si no

Mensajes del paciente: "${userMessages}"

Responde SOLO con el JSON válido, sin texto adicional.
`.trim();
```

En el servicio, agregar los imports y un helper junto a las otras funciones del archivo:

```ts
import { classifyTrigger, isTriggerCategory } from './trigger-catalog';
import { sessionTechnique } from './technique-memory';

// Si la técnica sirvió se nota al final de la conversación: antes se mandaban solo los
// primeros 600 caracteres y justo eso quedaba fuera.
function headAndTail(text: string, max = 600): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  return `${text.slice(0, half)} … ${text.slice(-half)}`;
}
```

En `extractSummary`:
- Usar `SUMMARY_EXTRACTION_PROMPT(headAndTail(userContent))`.
- Parsear como `Record<string, unknown>`, convirtiendo cada campo de texto con
  `typeof v === 'string' ? v : null`.
- Agregar al objeto que devuelve:

```ts
          triggerCategory: isTriggerCategory(parsed.triggerCategory) ? parsed.triggerCategory : null,
          llmThoughtHelpful: typeof parsed.helpful === 'boolean' ? parsed.helpful : null,
```

En los dos retornos sin LLM, agregar `triggerCategory: null, llmThoughtHelpful: null`.

En `closeSession`, después de `extractSummary`:

```ts
    const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
    const byCatalog = userText.trim() ? classifyTrigger(userText) : null;
    // El catálogo manda; el LLM solo completa lo que las palabras clave no reconocieron.
    const triggerCategory =
      byCatalog === 'other' && summaryData.triggerCategory ? summaryData.triggerCategory : byCatalog;
    const technique = sessionTechnique(
      messages.filter((m) => m.role === 'assistant').map((m) => m.content),
      summaryData.techniqueUsed ?? null,
    );
```

y guardar `{ sessionId, userId, ...summaryData, triggerCategory, technique, durationMinutes }`.

En `startSession`, reemplazar el `sessionRepo.update(...)` que cerraba sin resumen por:

```ts
    // Cerrarla con `update` dejaba esa conversación sin resumen: se perdía para la memoria (HdU10).
    const abiertas = await this.sessionRepo.find({ where: { userId, status: 'active' } });
    for (const abierta of abiertas) {
      // Abrir un chat nuevo nunca puede fallar porque no se pudo resumir el anterior.
      await this.closeSession(abierta.id, userId).catch(() => undefined);
    }
```

- [ ] **Paso 5: correr la suite completa del asistente**

Correr: `pnpm --filter @stopbet/backend test -- ai-assistant`
Esperado: todo PASS. Si algún test existente de `startSession` esperaba el `update`, ajustarlo a
`sessionRepo.find` sin cambiar lo que verifica.

- [ ] **Paso 6: commit**

```bash
git add apps/backend/src/ai-assistant
git commit -m "feat(HU-10): guardar el motivo y la técnica de cada conversación al cerrarla"
```

---

### Tarea 4: Memoria en la conversación (CA1, CA2 y CA3)

**Archivos:**
- Modificar: `apps/backend/src/ai-assistant/ai-assistant.service.ts`
- Modificar: `apps/backend/src/ai-assistant/ai-assistant.module.ts` (agregar `PanicAlert` a `forFeature`)
- Test: `apps/backend/src/ai-assistant/ai-assistant.service.spec.ts`

**Interfaces:**
- Consume: `classifyTrigger`, más `buildMemoryBlock`, `MemorySession` y `MEMORY_SESSIONS`.
- Produce:
  - `loadMemory(userId): Promise<{ sessions: MemorySession[]; panicTimes: Date[] } | null>`, privado.
  - Un 9.º parámetro del constructor, `panicAlertRepo: Repository<PanicAlert>`.

- [ ] **Paso 1: escribir los tests que fallan**

En el `beforeEach`:
- Agregar `let panicAlertRepo: { find: jest.Mock };` con
  `panicAlertRepo = { find: jest.fn().mockResolvedValue([]) };`.
- Pasarlo como **último** argumento a `new AiAssistantService(...)`.

Al final del archivo:

```ts
  describe('HdU10 — memoria en la conversación', () => {
    const llmInvoke = jest.fn();
    const resumen = (over: object) => ({
      sessionId: 'x', userId: USER_ID, triggerCategory: 'money', trigger: 'sueldo',
      technique: 'breathing', patientFeedback: 'yes', llmThoughtHelpful: null,
      createdAt: new Date('2026-10-01T10:00:00Z'), ...over,
    });

    beforeEach(() => {
      // mockReset y no solo mockResolvedValue: si no, `calls[0]` es la llamada del test anterior.
      (service as any).llm = { invoke: llmInvoke.mockReset().mockResolvedValue({ content: 'ok' }) };
      sessionRepo.findOne.mockResolvedValue({ id: SESSION_ID, userId: USER_ID, status: 'active', previousContext: null });
      messageRepo.find.mockResolvedValue([userMessage('me llegó el finiquito y quiero ir al casino')]);
    });

    const systemPrompt = () => llmInvoke.mock.calls[0][0][0].content as string;

    it('CA1: con 2 sesiones previas propone primero la técnica que le sirvió', async () => {
      summaryRepo.find.mockResolvedValue([resumen({}), resumen({ technique: 'grounding', patientFeedback: 'no' })]);
      await service.sendMessage(SESSION_ID, USER_ID, { content: 'me llegó el finiquito' } as any);
      expect(systemPrompt()).toContain('respiración 4-7-8');
      expect(systemPrompt()).toMatch(/primero/);
    });

    it('CA2: sin historial no agrega memoria y responde igual', async () => {
      summaryRepo.find.mockResolvedValue([]);
      const r = await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);
      expect(systemPrompt()).not.toContain('Memoria del paciente');
      expect(r.assistantMessage.content).toBe('ok');
    });

    it('CA3: si el historial no se puede leer, el chat sigue y el fallo queda registrado', async () => {
      summaryRepo.find.mockRejectedValue(new Error('connection refused'));
      const log = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      const r = await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);
      expect(r.assistantMessage.content).toBe('ok');
      expect(log).toHaveBeenCalled();
      expect(String(log.mock.calls[0][0])).not.toContain('finiquito');
    });

    it('CA3: abrir un chat nuevo funciona aunque falle leer el resumen anterior', async () => {
      summaryRepo.findOne.mockRejectedValue(new Error('connection refused'));
      sessionRepo.save.mockImplementation((v) => Promise.resolve({ ...v, id: 'nueva', startedAt: new Date() }));
      await expect(service.startSession(USER_ID)).resolves.toBeDefined();
    });

    it('un pánico poco después del cierre anula la técnica', async () => {
      summaryRepo.find.mockResolvedValue([resumen({}), resumen({})]);
      panicAlertRepo.find.mockResolvedValue([{ createdAt: new Date('2026-10-01T11:00:00Z') }]);
      await service.sendMessage(SESSION_ID, USER_ID, { content: 'me llegó el finiquito' } as any);
      expect(systemPrompt()).not.toContain('Memoria del paciente');
    });
  });
```

- [ ] **Paso 2: correrlos y ver que fallan**

Correr: `pnpm --filter @stopbet/backend test -- ai-assistant.service`
Esperado: FAIL. El constructor todavía no recibe el 9.º argumento y no hay memoria en el prompt.

- [ ] **Paso 3: implementar**

En el módulo, agregar `PanicAlert` a `TypeOrmModule.forFeature([...])` e importar
`import { PanicAlert } from '../panic/entities/panic-alert.entity';`.

En el servicio:

```ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { PanicAlert } from '../panic/entities/panic-alert.entity';
import { MEMORY_SESSIONS, MemorySession, buildMemoryBlock } from './technique-memory';
```

- En la clase: `private readonly logger = new Logger(AiAssistantService.name);`
- Al final del constructor:
  `@InjectRepository(PanicAlert) private readonly panicAlertRepo: Repository<PanicAlert>,`

```ts
  // CA3: si el historial no se lee, se conversa sin él. El log lleva solo el tipo de error:
  // el mensaje de la base podría arrastrar datos del paciente.
  private async loadMemory(
    userId: string,
  ): Promise<{ sessions: MemorySession[]; panicTimes: Date[] } | null> {
    try {
      const rows = await this.summaryRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: MEMORY_SESSIONS,
      });
      if (rows.length === 0) return { sessions: [], panicTimes: [] };
      const oldest = rows[rows.length - 1].createdAt;
      const alerts = await this.panicAlertRepo.find({
        where: { patientId: userId, createdAt: MoreThanOrEqual(oldest) },
        select: { createdAt: true },
      });
      return {
        sessions: rows.map((r) => ({
          triggerCategory: r.triggerCategory,
          trigger: r.trigger,
          technique: r.technique,
          patientFeedback: r.patientFeedback,
          llmThoughtHelpful: r.llmThoughtHelpful,
          closedAt: r.createdAt,
        })),
        panicTimes: alerts.map((a) => a.createdAt),
      };
    } catch (err) {
      this.logger.error(`No se pudo leer el historial del asistente (${err instanceof Error ? err.name : 'Error'})`);
      return null;
    }
  }
```

En `sendMessage`, después de cargar `history`:

```ts
    // El motivo se lee de todo lo que el paciente lleva escrito en esta conversación, no solo del
    // último mensaje: «sí, eso» no dice nada por sí solo.
    const category = classifyTrigger(
      history.filter((m) => m.role === 'user').map((m) => m.content).join(' '),
    );
    const memory = await this.loadMemory(userId);
    const memoryBlock = memory ? buildMemoryBlock(memory.sessions, memory.panicTimes, category) : null;
```

Pasar `memoryBlock` como 6.º argumento a `generateResponse`. Dentro, pasarlo a
`buildSystemPrompt(previousContext, clinicalTriggers ?? null, omitir, memoryBlock)` y extender esa
función:

```ts
function buildSystemPrompt(
  previousContext: string | null,
  clinicalTriggers: string | null,
  omitir: (texto: string) => string,
  memoryBlock: string | null = null,
): string {
  let prompt = AJUTER_SYSTEM_PROMPT;
  // ... lo existente sin cambios ...
  if (memoryBlock) {
    prompt += `\n\n${omitir(memoryBlock)}`;
  }
  return prompt;
}
```

En `startSession`, envolver la lectura de `lastSummary` (CA3):

```ts
    const lastSummary = await this.summaryRepo
      .findOne({ where: { userId }, order: { createdAt: 'DESC' } })
      .catch((err: unknown) => {
        this.logger.error(`No se pudo leer el historial del asistente (${err instanceof Error ? err.name : 'Error'})`);
        return null;
      });
```

- [ ] **Paso 4: correr la suite completa del asistente**

Correr: `pnpm --filter @stopbet/backend test -- ai-assistant`
Esperado: todo PASS.

- [ ] **Paso 5: commit**

```bash
git add apps/backend/src/ai-assistant
git commit -m "feat(HU-10): proponer primero la técnica que le sirvió ante el mismo motivo"
```

---

### Tarea 5: Endpoints de respuesta del paciente e historial clínico (CA4)

**Archivos:**
- Crear: `apps/backend/src/ai-assistant/dto/session-feedback.dto.ts`
- Modificar: `apps/backend/src/ai-assistant/ai-assistant.controller.ts`
- Modificar: `apps/backend/src/ai-assistant/ai-assistant.service.ts` (`setFeedback` y `getPatientSummaries`)
- Modificar: `apps/backend/src/ai-assistant/ai-assistant.module.ts` (agregar `PatientAssignment` a `forFeature`, que lo necesita `PatientAccessGuard`)
- Test: `apps/backend/src/ai-assistant/ai-assistant.service.spec.ts` y `apps/backend/src/ai-assistant/ai-assistant.controller.spec.ts`

**Interfaces:**
- Produce:
  - `PATCH /ai/sessions/:sessionId/feedback` con body `{ feedback: PatientFeedback }`, que devuelve `AiSessionHistoryItem`.
  - `GET /ai/patients/:patientId/summaries`, que devuelve `AiSessionClinicalItem[]`.

- [ ] **Paso 1: escribir los tests que fallan**

En el spec del servicio:

```ts
  describe('HdU10 — respuesta del paciente', () => {
    it('guarda la respuesta en el resumen de SU sesión', async () => {
      summaryRepo.findOne.mockResolvedValue({ id: 's1', sessionId: SESSION_ID, userId: USER_ID, createdAt: new Date(), durationMinutes: 3 });
      const r = await service.setFeedback(SESSION_ID, USER_ID, 'yes');
      expect(summaryRepo.findOne).toHaveBeenCalledWith({ where: { sessionId: SESSION_ID, userId: USER_ID } });
      expect(r.patientFeedback).toBe('yes');
    });

    it('responder otra vez reemplaza la respuesta anterior', async () => {
      summaryRepo.findOne.mockResolvedValue({ id: 's1', sessionId: SESSION_ID, userId: USER_ID, patientFeedback: 'no', createdAt: new Date(), durationMinutes: 3 });
      const r = await service.setFeedback(SESSION_ID, USER_ID, 'somewhat');
      expect(r.patientFeedback).toBe('somewhat');
      expect(summaryRepo.save).toHaveBeenCalledTimes(1);
    });

    it('404 si la sesión es de otra persona', async () => {
      summaryRepo.findOne.mockResolvedValue(null);
      await expect(service.setFeedback(SESSION_ID, 'otro', 'yes')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('el historial clínico incluye el riesgo', async () => {
      summaryRepo.find.mockResolvedValue([{ id: 's1', sessionId: 'x', userId: 'p1', riskLevel: 'high', mood: 'Ansiedad', trigger: 'sueldo', triggerCategory: 'money', technique: 'breathing', patientFeedback: null, durationMinutes: 4, createdAt: new Date('2026-10-01T10:00:00Z') }]);
      const [item] = await service.getPatientSummaries('p1');
      expect(item).toMatchObject({ riskLevel: 'high', triggerCategory: 'money', createdAt: '2026-10-01T10:00:00.000Z' });
    });
  });
```

En el spec del controlador:

```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PatientAccessGuard } from '../common/guards/patient-access.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AiAssistantController } from './ai-assistant.controller';

describe('HdU10 CA4 — el historial clínico', () => {
  const handler = AiAssistantController.prototype.getPatientSummaries;

  it('solo lo pide el equipo clínico', () => {
    expect(new Reflector().get(ROLES_KEY, handler)).toEqual(['psychologist', 'coordinator']);
  });

  it('acota al psicólogo a sus pacientes asignados', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(PatientAccessGuard);
  });
});
```

Antes de escribirlo, revisar el nombre real de la constante exportada en
`common/decorators/roles.decorator.ts` y usarlo tal cual.

- [ ] **Paso 2: correrlos y ver que fallan**

Correr: `pnpm --filter @stopbet/backend test -- ai-assistant`
Esperado: FAIL, porque `setFeedback` y `getPatientSummaries` no existen.

- [ ] **Paso 3: implementar**

DTO:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { PatientFeedback } from '@stopbet/shared-types';

export class SessionFeedbackDto {
  @ApiProperty({ enum: ['yes', 'somewhat', 'no'] })
  @IsIn(['yes', 'somewhat', 'no'])
  feedback: PatientFeedback;
}
```

Servicio, junto a `getSummaries`:

```ts
  async setFeedback(sessionId: string, userId: string, feedback: PatientFeedback): Promise<AiSessionHistoryItem> {
    const summary = await this.summaryRepo.findOne({ where: { sessionId, userId } });
    if (!summary) throw new NotFoundException('Resumen no encontrado');
    summary.patientFeedback = feedback;
    return this.mapHistoryItem(await this.summaryRepo.save(summary));
  }

  async getPatientSummaries(patientId: string): Promise<AiSessionClinicalItem[]> {
    const rows = await this.summaryRepo.find({ where: { userId: patientId }, order: { createdAt: 'DESC' }, take: 50 });
    return rows.map((r) => ({ ...this.mapHistoryItem(r), mood: r.mood, trigger: r.trigger, riskLevel: r.riskLevel }));
  }

  private mapHistoryItem(r: AiSessionSummary): AiSessionHistoryItem {
    return {
      id: r.id,
      sessionId: r.sessionId,
      createdAt: r.createdAt.toISOString(),
      durationMinutes: r.durationMinutes,
      triggerCategory: r.triggerCategory ?? null,
      technique: r.technique ?? null,
      patientFeedback: r.patientFeedback ?? null,
    };
  }
```

Agregar `AiSessionClinicalItem`, `AiSessionHistoryItem` y `PatientFeedback` al import de
shared-types del servicio.

Controlador:
- Ampliar los imports de `@nestjs/common` con `Patch` y `UseGuards`.
- Importar `Roles`, `RolesGuard`, `PatientAccessGuard` y `SessionFeedbackDto`.
- Agregar los dos métodos:

```ts
  @Patch('sessions/:sessionId/feedback')
  @ApiOperation({ summary: 'HdU10: el paciente dice si la conversación le ayudó' })
  @ApiParam({ name: 'sessionId', description: 'UUID de la sesión ya cerrada' })
  @ApiResponse({ status: 200, description: 'AiSessionHistoryItem' })
  @ApiResponse({ status: 404, description: 'La sesión no existe o no es del paciente' })
  setFeedback(
    @Param('sessionId') sessionId: string,
    @UserId() userId: string,
    @Body() dto: SessionFeedbackDto,
  ) {
    return this.service.setFeedback(sessionId, userId, dto.feedback);
  }

  // CA4: el compañero de viaje y el familiar no son equipo clínico, así que `RolesGuard` los
  // deja fuera; `PatientAccessGuard` acota al psicólogo a sus pacientes asignados.
  @Get('patients/:patientId/summaries')
  @Roles('psychologist', 'coordinator')
  @UseGuards(RolesGuard, PatientAccessGuard)
  @ApiOperation({ summary: 'HdU10: historial de conversaciones del paciente para su equipo clínico' })
  @ApiResponse({ status: 200, description: 'AiSessionClinicalItem[]' })
  @ApiResponse({ status: 403, description: 'No es equipo clínico o no tiene a ese paciente' })
  getPatientSummaries(@Param('patientId') patientId: string) {
    return this.service.getPatientSummaries(patientId);
  }
```

Módulo: agregar `PatientAssignment` a `forFeature`, con
`import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';`.

- [ ] **Paso 4: correr los tests y el type-check del backend**

Correr: `pnpm --filter @stopbet/backend test -- ai-assistant && pnpm --filter @stopbet/backend exec tsc --noEmit`
Esperado: PASS y sin errores de tipos.

- [ ] **Paso 5: commit**

```bash
git add apps/backend/src/ai-assistant
git commit -m "feat(HU-10): guardar si la conversación le ayudó y abrir el historial al equipo clínico"
```

---

### Tarea 6: App — «¿Te ayudó?» e historial

**Archivos:**
- Modificar: `apps/mobile/src/services/api.ts` (dos funciones al final y los tipos en el import)
- Modificar: `apps/mobile/src/components/SessionSummaryModal.tsx`
- Crear: `apps/mobile/src/components/AssistantHistorySheet.tsx`
- Modificar: `apps/mobile/src/screens/AssistantScreen.tsx`

**Interfaces:**
- Consume: los endpoints de la Tarea 5 y el `GET /ai/sessions/summaries` existente.
- Produce: `sendAiFeedback(sessionId, feedback)` y `getAiHistory()`.

- [ ] **Paso 1: funciones al final de `api.ts`**

Sumar `AiSessionHistoryItem` y `PatientFeedback` al import de shared-types del archivo, y al final:

```ts
// ── HdU10: memoria del asistente ──
export const sendAiFeedback = (sessionId: string, feedback: PatientFeedback) =>
  request<AiSessionHistoryItem>(`/ai/sessions/${sessionId}/feedback`, {
    method: 'PATCH',
    body: JSON.stringify({ feedback }),
  });

export const getAiHistory = () => request<AiSessionHistoryItem[]>('/ai/sessions/summaries');
```

- [ ] **Paso 2: la pregunta en el modal de resumen**

En `SessionSummaryModal.tsx`:
- Agregar a `Props`: `feedback: PatientFeedback | null; onFeedback: (f: PatientFeedback) => void;`
- Antes de `noteRow`, renderizar:

```tsx
          <Text style={styles.askTitle}>¿Te ayudó lo que hicimos?</Text>
          <View style={styles.askRow}>
            {([['yes', 'Sí'], ['somewhat', 'Un poco'], ['no', 'No']] as const).map(([value, label]) => {
              const selected = feedback === value;
              return (
                <Touchable
                  key={value}
                  onPress={() => onFeedback(value)}
                  style={[styles.askBtn, selected && styles.askBtnSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.askText, selected && styles.askTextSelected]}>{label}</Text>
                </Touchable>
              );
            })}
          </View>
```

- Cambiar el texto de la nota, porque ahora el psicólogo **sí** ve el resumen, aunque no la
  conversación:
  `Este resumen ayuda al asistente a retomar la próxima vez. Tu psicólogo puede ver este resumen, pero no la conversación.`
- Estilos nuevos en `makeStyles`:

```ts
  askTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: c.ink900, marginTop: 18 },
  askRow: { flexDirection: 'row', gap: 8, marginTop: 10, width: '100%' },
  askBtn: { flex: 1, borderRadius: 9999, borderWidth: 1.5, borderColor: c.border, paddingVertical: 11, alignItems: 'center' },
  askBtnSelected: { backgroundColor: c.primary, borderColor: c.primary },
  askText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.fg1 },
  askTextSelected: { color: c.white },
```

Si `c.border` o `c.fg1` no existen en `Palette`, usar las llaves equivalentes de
`constants/colors.ts`. Revisarlas antes de escribir.

- [ ] **Paso 3: la hoja de historial**, en `AssistantHistorySheet.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import type { AiSessionHistoryItem, TechniqueType, TriggerCategory } from '@stopbet/shared-types';
import type { Palette } from '../constants/colors';
import { useColors, useStyles } from '../context/ThemeContext';
import { Fonts } from '../constants/typography';
import { getAiHistory } from '../services/api';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

const CATEGORY: Record<TriggerCategory, string> = {
  money: 'Dinero', temptation: 'Publicidad o tentación', sports: 'Deporte',
  emotions: 'Emociones difíciles', loneliness: 'Soledad o aburrimiento',
  family: 'Familia o pareja', work: 'Trabajo', other: 'Otro motivo',
};
const TECHNIQUE: Record<TechniqueType, string> = {
  breathing: 'Respiración 4-7-8', grounding: 'Grounding 5-4-3-2-1', postponement: 'Postergar el impulso',
};
const FEEDBACK = { yes: 'Te ayudó', somewhat: 'Te ayudó un poco', no: 'No te ayudó' } as const;
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fecha(iso: string, min: number): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${Math.max(1, min)} min`;
}

type Estado = 'cargando' | 'error' | 'listo';

export function AssistantHistorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [items, setItems] = useState<AiSessionHistoryItem[]>([]);
  const [estado, setEstado] = useState<Estado>('cargando');

  useEffect(() => {
    if (!visible) return;
    let vigente = true;
    setEstado('cargando');
    getAiHistory()
      .then((data) => { if (vigente) { setItems(data); setEstado('listo'); } })
      .catch(() => { if (vigente) setEstado('error'); });
    return () => { vigente = false; };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Tus conversaciones</Text>
            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar historial" style={styles.close}>
              <Icon name="x" size={20} color={c.fg2} />
            </Touchable>
          </View>
          <Text style={styles.sub}>Solo tú y tu psicólogo pueden ver este historial.</Text>
          {estado === 'cargando' && <Text style={styles.empty}>Cargando…</Text>}
          {estado === 'error' && <Text style={styles.empty}>No pudimos cargar tu historial. Revisa tu conexión e inténtalo de nuevo.</Text>}
          {estado === 'listo' && (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              ListEmptyComponent={<Text style={styles.empty}>Todavía no tienes conversaciones guardadas.</Text>}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.date}>{fecha(item.createdAt, item.durationMinutes)}</Text>
                  {item.triggerCategory && <Text style={styles.line}>Motivo: {CATEGORY[item.triggerCategory]}</Text>}
                  {item.technique && <Text style={styles.line}>Técnica: {TECHNIQUE[item.technique]}</Text>}
                  {item.patientFeedback && <Text style={styles.feedback}>{FEEDBACK[item.patientFeedback]}</Text>}
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(30,45,44,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: Fonts.headingBold, fontSize: 20, color: c.ink900 },
  close: { padding: 6 },
  sub: { fontFamily: Fonts.body, fontSize: 13, color: c.fg2, marginTop: 4, marginBottom: 12 },
  empty: { fontFamily: Fonts.body, fontSize: 14, color: c.fg2, textAlign: 'center', paddingVertical: 24 },
  card: { backgroundColor: c.infoSurface, borderRadius: 12, padding: 14, marginBottom: 10 },
  date: { fontFamily: Fonts.bodyBold, fontSize: 14, color: c.ink900 },
  line: { fontFamily: Fonts.body, fontSize: 13.5, color: c.fg2, marginTop: 4 },
  feedback: { fontFamily: Fonts.bodyBold, fontSize: 13.5, color: c.primaryText, marginTop: 6 },
});
```

- [ ] **Paso 4: conectar en `AssistantScreen.tsx`**

- Estado nuevo: `const [historyVisible, setHistoryVisible] = useState(false);` y
  `const [feedback, setFeedback] = useState<PatientFeedback | null>(null);`
- En `handleManualClose`, antes de `setSummary(result)`, poner `setFeedback(null)`.
- Handler:

```tsx
  const handleFeedback = useCallback(async (value: PatientFeedback) => {
    if (!summary) return;
    setFeedback(value);
    try {
      await sendAiFeedback(summary.sessionId, value);
    } catch {
      showToast('No pudimos guardar tu respuesta.', 'error');
    }
  }, [summary]);
```

- Pasar `feedback={feedback} onFeedback={handleFeedback}` a `<SessionSummaryModal …/>`.
- En `headerActions`, antes del botón de terminar:

```tsx
          <Touchable
            onPress={() => setHistoryVisible(true)}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Ver historial"
            accessibilityHint="Muestra tus conversaciones anteriores"
          >
            <Icon name="clock" size={20} color={c.fg2} />
          </Touchable>
```

- Al final del JSX, junto al modal de resumen:
  `<AssistantHistorySheet visible={historyVisible} onClose={() => setHistoryVisible(false)} />`
- Imports: `AssistantHistorySheet`, y `sendAiFeedback` desde `../services/api`, más el tipo
  `PatientFeedback`.

- [ ] **Paso 5: type-check de mobile**

Correr: `pnpm --filter @stopbet/mobile exec tsc --noEmit`
Esperado: sin errores nuevos. Comparar contra `main` si ya había errores antes.

- [ ] **Paso 6: commit**

```bash
git add apps/mobile/src/services/api.ts apps/mobile/src/components/SessionSummaryModal.tsx apps/mobile/src/components/AssistantHistorySheet.tsx apps/mobile/src/screens/AssistantScreen.tsx
git commit -m "feat(HU-10): preguntar si la conversación ayudó y mostrar el historial en la app"
```

---

### Tarea 7: Web — pestaña «Sesiones» con el historial real

**Archivos:**
- Modificar: `apps/web/src/services/api.ts` (tipos y función al final)
- Crear: `apps/web/src/components/AssistantHistorySection.tsx`
- Modificar: `apps/web/src/components/PatientDrawer.tsx` (pestaña «Sesiones»; ⚠️ archivo de Alex, autorizado por Matías el 2026-10-13)

**Interfaces:**
- Consume: `GET /ai/patients/:patientId/summaries` (Tarea 5).
- Produce: `getPatientAssistantHistory(patientId): Promise<AssistantHistoryItem[]>`.

- [ ] **Paso 1: al final de `apps/web/src/services/api.ts`**

```ts
// ── HdU10: historial del asistente para el equipo clínico ──
// Espeja AiSessionClinicalItem de shared-types, como el resto de los tipos de la web.
export interface AssistantHistoryItem {
  id: string
  sessionId: string
  createdAt: string
  durationMinutes: number
  triggerCategory: 'money' | 'temptation' | 'sports' | 'emotions' | 'loneliness' | 'family' | 'work' | 'other' | null
  technique: 'breathing' | 'grounding' | 'postponement' | null
  patientFeedback: 'yes' | 'somewhat' | 'no' | null
  mood: string | null
  trigger: string | null
  riskLevel: 'low' | 'medium' | 'high' | null
}

export const getPatientAssistantHistory = (patientId: string) =>
  get<AssistantHistoryItem[]>(`/ai/patients/${patientId}/summaries`)
```

- [ ] **Paso 2: el componente**

```tsx
import { useQuery } from '@tanstack/react-query'
import { WIcon } from './WIcon'
import { getPatientAssistantHistory, type AssistantHistoryItem } from '../services/api'

const CATEGORY: Record<NonNullable<AssistantHistoryItem['triggerCategory']>, string> = {
  money: 'Dinero', temptation: 'Publicidad o tentación', sports: 'Deporte',
  emotions: 'Emociones difíciles', loneliness: 'Soledad o aburrimiento',
  family: 'Familia o pareja', work: 'Trabajo', other: 'Otro motivo',
}
const TECHNIQUE: Record<NonNullable<AssistantHistoryItem['technique']>, string> = {
  breathing: 'Respiración 4-7-8', grounding: 'Grounding 5-4-3-2-1', postponement: 'Postergar el impulso',
}
const FEEDBACK = { yes: 'Le ayudó', somewhat: 'Le ayudó un poco', no: 'No le ayudó' } as const
const RISK = { low: 'Riesgo bajo', medium: 'Riesgo medio', high: 'Riesgo alto' } as const

const box = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }

export function AssistantHistorySection({ patientId }: { patientId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['assistant-history', patientId],
    queryFn: () => getPatientAssistantHistory(patientId),
  })

  if (isLoading) return <p style={{ color: 'var(--fg2)', fontSize: 13 }}>Cargando conversaciones…</p>
  if (isError) return <p style={{ color: 'var(--danger-text)', fontSize: 13 }}>No pudimos cargar las conversaciones con el asistente.</p>
  if (!data?.length) return <div style={box}><p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)' }}>Este paciente todavía no ha conversado con el asistente.</p></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((s) => (
        <div key={s.id} style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <WIcon name="message-circle" size={16} color="var(--primary-text)" />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>
              {new Date(s.createdAt).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })} · {Math.max(1, s.durationMinutes)} min
            </span>
            {s.riskLevel && (
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: s.riskLevel === 'high' ? 'var(--danger-text)' : 'var(--fg2)' }}>
                {RISK[s.riskLevel]}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)', lineHeight: 1.6 }}>
            {s.triggerCategory && <>Motivo: {CATEGORY[s.triggerCategory]}{s.trigger ? ` («${s.trigger}»)` : ''}<br /></>}
            {s.technique && <>Técnica: {TECHNIQUE[s.technique]}<br /></>}
            {s.mood && <>Ánimo: {s.mood}<br /></>}
            {s.patientFeedback && <strong style={{ color: 'var(--primary-text)' }}>{FEEDBACK[s.patientFeedback]}</strong>}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Paso 3: conectar en `PatientDrawer.tsx`**

- Agregar `import { AssistantHistorySection } from './AssistantHistorySection'`.
- Reemplazar **todo** el contenido del bloque `{tab === 'sesiones' && ( … )}`, incluido el
  comentario y el `.map` de relleno, por:

```tsx
          {tab === 'sesiones' && <AssistantHistorySection patientId={patient.id} />}
```

- [ ] **Paso 4: build de la web**

Correr: `pnpm --filter @stopbet/web build`
Esperado: compila sin errores.

- [ ] **Paso 5: commit**

```bash
git add apps/web/src/services/api.ts apps/web/src/components/AssistantHistorySection.tsx apps/web/src/components/PatientDrawer.tsx
git commit -m "feat(HU-10): mostrar al equipo clínico las conversaciones con el asistente"
```

---

### Tarea 8: Prueba de punta a punta y documentación

**Archivos:**
- Modificar: `CLAUDE.md` (sección «Estado actual»: una entrada nueva de la HdU10)

- [ ] **Paso 1: suite completa del backend**

Correr: `pnpm --filter @stopbet/backend test`
Esperado: todo PASS.

- [ ] **Paso 2: probarlo en el emulador contra el backend local** (`pnpm run backend`, `adb reverse tcp:3000 tcp:3000`, build debug)

1. Como paciente, abrir el asistente y escribir «me pagaron el sueldo y quiero apostar». Seguir la
   técnica que proponga, **Terminar** y responder **Sí**.
2. Repetir con «tengo plata y ganas de ir al casino» y responder **Sí**.
3. En una tercera conversación escribir «me llegó el finiquito». **Debe proponer primero la misma
   técnica** (CA1).
4. **Ver historial** muestra las 3 tarjetas con motivo, técnica y «Te ayudó» (CA4).
5. Como psicólogo asignado en la web: **Mis pacientes → Seguimiento → Sesiones** muestra las mismas
   3 con el riesgo. Con un compañero de viaje, `GET /ai/patients/:id/summaries` responde **403**.

Si algo falla, no seguir: volver a la tarea que corresponde.

- [ ] **Paso 3: actualizar `CLAUDE.md`**

En «Estado actual», agregar una entrada que diga en 3 a 5 líneas:
- dónde vive la regla (`trigger-catalog.ts` y `technique-memory.ts`);
- que la técnica la decide el código y no el LLM;
- que el pánico en las 2 horas siguientes anula la técnica;
- que el historial lo ven el paciente y su equipo clínico, y no el compañero de viaje ni el familiar;
- que `PatientDrawer` ahora llena la pestaña «Sesiones».

No va entrada en `docs/avisos-al-equipo.md`: las columnas nuevas las crea `synchronize` y no hay
dependencias nuevas.

- [ ] **Paso 4: commit**

```bash
git add CLAUDE.md docs/planning/hdu10-memoria-asistente.md docs/planning/hdu10-memoria-asistente-plan.md
git commit -m "docs(HU-10): documentar la memoria del asistente"
```
