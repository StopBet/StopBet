import type { AIMessage } from '@stopbet/shared-types';

// S.8 — Respaldo del lado del cliente, para cuando la petición ni siquiera llega
// al servidor (sin red, backend caído). El respaldo del backend
// (ai-assistant/fallback.ts) cubre el otro caso: el servidor responde pero el LLM
// falla. Son fallos distintos, por eso el texto vive en los dos lados.
//
// La regla que comparten: un fallo del asistente NUNCA puede dejar sin salida a
// alguien en crisis, así que la ruta de escalada va siempre visible.
const OFFLINE_FALLBACK =
  'No pude conectarme para responderte, pero no estás solo en esto. ' +
  'Si necesitas ayuda ahora mismo, usa el botón de pánico o contacta a tu padrino — ' +
  'también puedes llamar al *4141*.';

// Se construye un AIMessage local para que aparezca como un mensaje más del hilo.
// El id lleva prefijo para distinguirlo de los del servidor: nunca se persiste.
export function buildOfflineFallbackMessage(sessionId: string): AIMessage {
  return {
    id: `local-fallback-${Date.now()}`,
    sessionId,
    role: 'assistant',
    content: OFFLINE_FALLBACK,
    techniqueTriggered: null,
    createdAt: new Date().toISOString(),
  };
}

// El mensaje del paciente se limpia del input antes de enviarlo, así que si la
// petición falla se perdería de la vista. Se reconstruye local para que el hilo
// muestre lo que alcanzó a escribir — en una crisis eso importa.
export function buildLocalUserMessage(sessionId: string, content: string): AIMessage {
  return {
    id: `local-user-${Date.now()}`,
    sessionId,
    role: 'user',
    content,
    techniqueTriggered: null,
    createdAt: new Date().toISOString(),
  };
}
