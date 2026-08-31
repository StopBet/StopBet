// Todas las fechas "de calendario" del dominio (día del check-in, días de racha,
// vencimiento de una cuota) son días locales del paciente, no días UTC. Derivarlas
// con `toISOString()` adelanta el día a las 20:00 o 21:00 hora de Chile, según si
// hay horario de verano: el contador de días sin apostar saltaba esa misma tarde.
//
// `Intl` resuelve el desfase real de `America/Santiago` en cada fecha, así que el
// cambio de horario de verano no hay que mantenerlo a mano.
const CHILE_TZ = 'America/Santiago';

const FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHILE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha de calendario en Chile, como `YYYY-MM-DD`. */
export function todayInChile(now: Date = new Date()): string {
  return FORMATTER.format(now);
}

/** La fecha en Chile de hace `days` días, como `YYYY-MM-DD`. */
export function daysAgoInChile(days: number, now: Date = new Date()): string {
  return todayInChile(new Date(now.getTime() - days * 86_400_000));
}
