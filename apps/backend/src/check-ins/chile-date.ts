// El "día" de un check-in es el día local del paciente, no el UTC. Calculado en
// UTC, para Chile el día cambia a las 20:00 o 21:00 hora local — exactamente
// cuando se envía el recordatorio de las 20:00 (CA7.4): un check-in hecho a las
// 21:00 quedaba contado como del día siguiente.
const CHILE_TZ = 'America/Santiago';

export function todayInChile(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
