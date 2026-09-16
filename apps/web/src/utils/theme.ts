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
