// Validación de fechas de calendario. Usado por HdU06 (registro de pacientes) en la app
// mobile y en el backend: comprobar el formato no basta, porque `31/02/2024` tiene forma
// válida y no existe — y la columna `date` de Postgres la rechaza con un error crudo.

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Date normaliza los desbordes en silencio (31 de febrero pasa a ser 2 o 3 de marzo);
  // comparar contra la entrada es lo que delata la fecha inexistente.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function chileanDateToIso(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;

  return isValidIsoDate(iso) ? iso : null;
}
