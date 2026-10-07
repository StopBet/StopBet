// Formato fijo dd/mm/aaaa hh:mm: `toLocaleString('es-CL')` cambia según el motor y puede salir
// con guiones o en 12 horas.
export function fechaHora(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
