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

const WALL_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHILE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

// Cuánto se adelanta (o atrasa) la hora de Chile respecto de UTC en ese instante, en ms.
function chileOffsetMs(at: Date): number {
  const p = Object.fromEntries(WALL_CLOCK.formatToParts(at).map((part) => [part.type, part.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Interpreta una fecha ISO como la HORA DE PARED de Chile, ignorando su sufijo `Z`, y devuelve el
 * instante real. Transbank manda `transaction_date` así: medido en su ambiente de integración, una
 * transacción hecha a las 22:27 UTC (19:27 en Chile) llega como `…T19:27:52.253Z`. Tomarla por UTC
 * dejaría cada cobro 3 o 4 horas corrido, según el horario de verano.
 */
export function chileWallClockToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/.exec(iso);
  if (!m) return null;
  const ms = m[7] ? Number(m[7].padEnd(3, '0')) : 0;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms);
  // Dos pasadas: la primera usa el desfase de la hora tal cual; la segunda lo corrige en los
  // días en que cambia el horario, cuando el desfase de esa hora y el real difieren.
  const first = wall - chileOffsetMs(new Date(wall));
  return new Date(wall - chileOffsetMs(new Date(first)));
}
