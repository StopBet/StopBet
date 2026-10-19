import type { PatientGroupSession } from '@stopbet/shared-types';

/** "Miércoles 21 de octubre · 18:00 h", en la hora del teléfono (HdU14). */
export function formatSessionWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  // hour12 explícito, como en CommunityScreen: en Chile la hora va en formato 24.
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora} h`;
}

/** La próxima sesión que todavía no empieza, o null. La lista ya viene ordenada por fecha. */
export function nextGroupSession(sessions: PatientGroupSession[], now = Date.now()): PatientGroupSession | null {
  return sessions.find((s) => new Date(s.sessionDate).getTime() > now) ?? null;
}
