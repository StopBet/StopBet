import { formatRut } from './rut'

// Modo demo del registro de familiar (HDU 22): genera cuentas nuevas con datos únicos para que quien
// hace una demo no choque con «ya existe una cuenta» cada vez que repite el registro. Solo escribe
// en el formulario del navegador: no toca el backend ni se salta ninguna validación.

export type DemoKind = 'paciente-existe' | 'paciente-no-existe'

/** Lo que se escribe en el formulario de registro. */
export interface DemoPerfil {
  kind: DemoKind
  firstName: string
  lastName: string
  email: string
  password: string
  rut: string
  patientIdBy: 'rut' | 'email'
  patientRut: string
  patientEmail: string
}

/** Una cuenta que se registró con éxito en este navegador, para poder entrar con ella después. */
export interface DemoCuenta {
  nombre: string
  email: string
  password: string
  rut: string
  declara: string
  creadaEn: number
}

export const DEMO_PASSWORD = 'Demo2026!'
// Es el paciente del seed (Carlos Demo): la cuenta que existe en producción.
export const DEMO_PATIENT_EMAIL = 'demo@stopbet.cl'

export const KIND_LABEL: Record<DemoKind, { titulo: string; detalle: string }> = {
  'paciente-existe': {
    titulo: 'Familiar de un paciente que existe',
    detalle: 'Declara a Carlos Demo por correo (HDU 22 · CA1)',
  },
  'paciente-no-existe': {
    titulo: 'Familiar de un paciente que no existe',
    detalle: 'Declara un RUT que no está en el sistema (HDU 22 · CA2)',
  },
}

const NOMBRES = ['Ana', 'Luis', 'Marta', 'Pedro', 'Rosa', 'Jorge', 'Elena', 'Hugo', 'Carla', 'Raúl']
const APELLIDOS = ['Prueba', 'Ensayo', 'Muestra', 'Demo']

const entre = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const elegir = <T,>(items: T[]) => items[entre(0, items.length - 1)]

// Mismo cálculo (módulo 11) que `isValidRut`: el RUT generado pasa la validación del formulario.
function digitoVerificador(cuerpo: number): string {
  let suma = 0
  let multiplicador = 2
  for (const d of String(cuerpo).split('').reverse()) {
    suma += Number(d) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }
  const resto = 11 - (suma % 11)
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
}

export function generarRut(min: number, max: number): string {
  const cuerpo = entre(min, max)
  return formatRut(`${cuerpo}${digitoVerificador(cuerpo)}`)
}

// Los RUT propios caen entre 25 y 29 millones y los de un paciente inexistente entre 40 y 49:
// ningún paciente del seed vive en esos rangos.
export function generarPerfil(kind: DemoKind): DemoPerfil {
  // Date.now() en base 36 + dos letras al azar: dos toques seguidos nunca repiten el correo.
  const codigo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`
  const existe = kind === 'paciente-existe'
  return {
    kind,
    firstName: elegir(NOMBRES),
    lastName: elegir(APELLIDOS),
    email: `familiar.${codigo}@demo.stopbet.cl`,
    password: DEMO_PASSWORD,
    rut: generarRut(25_000_000, 29_999_999),
    patientIdBy: existe ? 'email' : 'rut',
    patientRut: existe ? '' : generarRut(40_000_000, 49_999_999),
    patientEmail: existe ? DEMO_PATIENT_EMAIL : '',
  }
}

const KEY = 'sb-demo-familiares'
const DOMINIO_DEMO = '@demo.stopbet.cl'

// Solo las cuentas que generó el panel (correo del dominio de demo y la clave fija de demo). Con
// `?demo=1` cualquiera puede abrir el registro y escribir sus datos reales: esa clave no puede
// terminar guardada en el navegador ni mostrada en pantalla.
export function esCuentaDemo(email: string, password: string): boolean {
  return email.trim().toLowerCase().endsWith(DOMINIO_DEMO) && password === DEMO_PASSWORD
}

export function leerCuentas(): DemoCuenta[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? (parsed as DemoCuenta[]).filter((c) => esCuentaDemo(String(c?.email ?? ''), String(c?.password ?? '')))
      : []
  } catch {
    return []
  }
}

export function guardarCuenta(cuenta: DemoCuenta): DemoCuenta[] {
  if (!esCuentaDemo(cuenta.email, cuenta.password)) return leerCuentas()
  const todas = [cuenta, ...leerCuentas().filter((c) => c.email !== cuenta.email)]
  try {
    localStorage.setItem(KEY, JSON.stringify(todas))
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): la cuenta se ve en esta pantalla y ya.
  }
  return todas
}

export function borrarCuentas(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada que borrar.
  }
}
