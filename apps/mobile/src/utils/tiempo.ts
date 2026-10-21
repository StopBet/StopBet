/** «hace instantes», «hace 3 min»: para una alerta que se está mirando en este momento. */
export function haceCuanto(iso: string, ahora: number = Date.now()): string {
  const min = Math.floor((ahora - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(min) || min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h`;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** «18 de octubre de 2026», a partir de una fecha `YYYY-MM-DD` sin hora. */
export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** Una fecha `YYYY-MM-DD` movida `dias` días. En UTC para que el cambio de horario no corra el día. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}
