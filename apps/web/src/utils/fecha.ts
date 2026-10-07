// Formato fijo dd/mm/aaaa (hh:mm): `toLocaleString('es-CL')` cambia según el motor y puede salir
// con guiones o en 12 horas.
const dos = (n: number) => String(n).padStart(2, '0')

export function fechaCorta(iso: string): string {
  const d = new Date(iso)
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function fechaHora(iso: string): string {
  const d = new Date(iso)
  return `${fechaCorta(iso)} ${dos(d.getHours())}:${dos(d.getMinutes())}`
}
