// Preferencia de tema del panel. Es una comodidad por persona y por navegador, así que vive
// en localStorage y no en el backend. Todas las lecturas van con try/catch: en una ventana
// privada o con el almacenamiento bloqueado, el panel sigue funcionando en automático.

export type ThemePref = 'auto' | 'light' | 'dark'

const KEY = 'sb-theme'

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

// «Automático» no pone el atributo: el CSS sigue a prefers-color-scheme. Claro u Oscuro lo
// fuerzan con data-theme en <html>. index.html hace lo mismo antes de cargar la app, para
// que la página no destelle en claro.
export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
}

export function saveThemePref(pref: ThemePref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Sin almacenamiento la elección dura hasta recargar, que es lo mejor que se puede.
  }
  applyThemePref(pref)
}

export function isDarkActive(): boolean {
  if (typeof window === 'undefined') return false
  const forced = document.documentElement.getAttribute('data-theme')
  if (forced) return forced === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

// Colores de la institución (hoy, AJUTER) encima de claro/oscuro. Es un eje aparte del tema:
// AJUTER tiene su versión clara y su versión oscura, y en «Automático» también sigue al sistema.
export type BrandPref = 'stopbet' | 'ajuter'

const BRAND_KEY = 'sb-brand'

// null = la persona nunca eligió, y manda el valor por defecto de su cuenta. Por eso elegir
// StopBet se guarda explícito y no borra la clave: si no, un psicólogo de AJUTER que eligió
// StopBet volvería a AJUTER en la próxima carga.
export function readBrandPref(): BrandPref | null {
  try {
    const v = localStorage.getItem(BRAND_KEY)
    return v === 'ajuter' || v === 'stopbet' ? v : null
  } catch {
    return null
  }
}

// El equipo clínico de una institución arranca con sus colores; familias y cuentas sin
// institución, con StopBet. Hoy la única institución con colores propios es AJUTER.
const BRAND_BY_INSTITUTION: Record<string, BrandPref> = { AJUTER: 'ajuter' }

export function defaultBrandFor(user: { role: string; institutionId?: string | null }): BrandPref {
  if (user.role !== 'psychologist' && user.role !== 'coordinator') return 'stopbet'
  return (user.institutionId && BRAND_BY_INSTITUTION[user.institutionId]) || 'stopbet'
}

// A diferencia del tema, index.html NO aplica esto antes de cargar: el login tiene que verse
// siempre StopBet. Lo ponen el panel clínico y el portal al montarse (useBrandInShell).
export function applyBrandPref(pref: BrandPref) {
  const root = document.documentElement
  if (pref === 'stopbet') root.removeAttribute('data-brand')
  else root.setAttribute('data-brand', pref)
}

export function saveBrandPref(pref: BrandPref) {
  try {
    localStorage.setItem(BRAND_KEY, pref)
  } catch {
    // Sin almacenamiento la elección dura hasta recargar.
  }
  applyBrandPref(pref)
}

export function isBrandActive(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-brand')
}
