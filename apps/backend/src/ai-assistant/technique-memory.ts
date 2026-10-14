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

// Marcas diacríticas combinantes (U+0300–U+036F) escritas como escape: un carácter
// invisible literal en el código no se ve al revisar el diff.
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
