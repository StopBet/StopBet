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

  it('el borde del veto: exactamente 120 minutos anula, exactamente al cierre no', () => {
    expect(effectivenessScore(s({ patientFeedback: 'yes' }), [at(120)])).toBe(0);
    expect(effectivenessScore(s({ patientFeedback: 'yes' }), [at(0)])).toBe(1);
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

  it('con empate gana la usada más recientemente, sin importar el orden de entrada', () => {
    const masRecienteAlFinal = [
      s({ technique: 'breathing', patientFeedback: 'yes', closedAt: at(0) }),
      s({ technique: 'grounding', patientFeedback: 'yes', closedAt: at(60) }),
    ];
    const masRecienteAlPrincipio = [
      s({ technique: 'grounding', patientFeedback: 'yes', closedAt: at(60) }),
      s({ technique: 'breathing', patientFeedback: 'yes', closedAt: at(0) }),
    ];
    expect(pickTechnique(masRecienteAlFinal, [], 'money')).toBe('grounding');
    expect(pickTechnique(masRecienteAlPrincipio, [], 'money')).toBe('grounding');
  });

  it('sin sesiones en la categoría pedida no propone nada', () => {
    const otraCategoria = [
      s({ triggerCategory: 'work', technique: 'breathing', patientFeedback: 'yes' }),
      s({ triggerCategory: 'work', technique: 'grounding', patientFeedback: 'yes' }),
    ];
    expect(pickTechnique(otraCategoria, [], 'money')).toBeNull();
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
