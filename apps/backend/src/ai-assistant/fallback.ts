// Mensajes de respaldo cuando el asistente IA falla (S.8).
// Tono validado en docs/reglas-asistente.md §2: 2-4 frases, cálido, sin tecnicismos,
// SIEMPRE con la ruta de escalada visible — un fallo del LLM no puede dejar sin
// salida a alguien en crisis.

export const ASSISTANT_FALLBACK_MESSAGES: string[] = [
  'Ahora mismo no puedo responderte como me gustaría, pero no estás solo en esto. ' +
    'Si necesitas ayuda inmediata, usa el botón de pánico o contacta a tu padrino — también ' +
    'puedes llamar al *4141*.',
  'Tuve un problema técnico y no pude procesar tu mensaje. Tu bienestar es lo primero: ' +
    'si sientes que necesitas apoyo ahora, el botón de pánico y tu padrino están siempre ' +
    'disponibles, igual que el *4141*.',
  'No logré generar una respuesta en este momento. Eso no significa que estés desatendido — ' +
    'el botón de pánico y tu padrino siguen ahí para ti, y también puedes llamar al *4141*.',
];

// Determinista: la misma sesión ve el mismo mensaje si falla varias veces seguidas,
// en vez de un mensaje distinto cada vez que sugiera que el sistema es errático.
export function getFallbackMessage(seed = 0): string {
  const index = Math.abs(seed) % ASSISTANT_FALLBACK_MESSAGES.length;
  return ASSISTANT_FALLBACK_MESSAGES[index];
}