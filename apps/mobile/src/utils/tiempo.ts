/** «hace instantes», «hace 3 min»: para una alerta que se está mirando en este momento. */
export function haceCuanto(iso: string, ahora: number = Date.now()): string {
  const min = Math.floor((ahora - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(min) || min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h`;
}
