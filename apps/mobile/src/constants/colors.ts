// Paleta oficial StopBet — sincronizada con el manual de marca
//
// Hay dos paletas con las mismas llaves. El manual de marca no cambia: en oscuro los
// azules, verdes y rojos de la marca se siguen usando como RELLENO (un botón azul con
// texto blanco da 5,09:1 igual que en claro). Lo que cambia son los tokens de TEXTO,
// porque #396fb6 sobre un fondo oscuro da 3,16:1 y no alcanza AA; su versión clara,
// 8,86:1. Es el mismo criterio que ya se usó en claro con `greenText` y `fg2`.
export const lightColors = {
  // Azul principal
  primary:      '#396fb6',   // azul StopBet — headers, acciones principales
  primaryDark:  '#2d5a9e',   // azul oscuro — pressed states
  primaryLight: '#93bce5',   // azul claro — estados secundarios

  // Secundarios
  green:   '#c2d66e',        // verde — rellenos de progreso y logros; como texto no se lee (1,6:1)
  greenText: '#5B7324',      // verde para texto e íconos sobre fondos claros (5,35:1 sobre blanco)
  // Azul y rojo tienen dos tokens: el de marca para RELLENOS y uno para TEXTO. En claro
  // son el mismo; en oscuro el de marca como texto da 3,16:1 (azul) y 2,72:1 (rojo).
  primaryText: '#396fb6',
  dangerText:  '#B83232',
  purple:  '#b7a9d3',        // lavanda — variante secundaria

  // Fondo y superficie
  bg:      '#f4f4e9',        // crema suave — fondo principal
  surface: '#FFFFFF',        // blanco — tarjetas, modales
  border:  '#DDDDD0',

  // Tipografía
  fg1:    '#504f4f',         // texto principal
  fg2:    '#6b6a6a',         // texto secundario — igual que la web; el anterior (#737070) daba 4,43:1 sobre crema
  ink900: '#504f4f',
  onPrimaryMuted: '#EFF3F9', // texto secundario sobre azul (4,57:1); el azul claro daba 2,56:1

  // Acento (azul claro secundario)
  accent:  '#93bce5',
  amber50: '#F2F7FC',

  // Verde (compatibilidad con referencias existentes a sage/gold)
  gold:    '#c2d66e',
  gold50:  '#F3F8E6',
  sage50:  '#F3F8E6',
  sage500: '#c2d66e',
  teal400: '#93bce5',

  // Peligro — exclusivo para botón de pánico y alertas críticas
  danger: '#B83232',

  // Fondos de estado. Antes cada pantalla inventaba su propio pálido: convivían
  // #FEE2E2, #FFF5F5, #FFF0F0, #FBF0F0, #FEECEC y #F7E7E7 para el mismo rojo suave,
  // y #EAF3F2, #E6F4F2, #EFF9F4, #EAF5F3 —verdes azulados del tema AJUTER anterior—
  // para el mismo azul suave. Tenerlos con nombre es lo que hace posible un tema
  // oscuro más adelante (SIS-07).
  dangerSurface:  '#FBF0F0',
  dangerBorder:   '#F0D3D3',
  successSurface: '#F0FAF5',
  infoSurface:    '#F2F7FC',
  infoBorder:     '#D6E4F2',

  // Utilidades
  white:          '#FFFFFF',
  overlayWhite16: 'rgba(255,255,255,0.16)',
  overlayWhite35: 'rgba(255,255,255,0.35)',
  overlayWhite72: 'rgba(255,255,255,0.72)',

  // El velo detrás de los diálogos. En claro es un azul de marca translúcido; en oscuro
  // ese mismo azul deja el fondo lavado, así que va un negro.
  overlay: 'rgba(45,90,158,0.32)',

  shadowMedium: 'rgba(80,79,79,0.10)',
  shadowSoft:   'rgba(80,79,79,0.06)',
};

/** Las llaves las define la paleta clara; la oscura tiene que tener exactamente las mismas. */
export type Palette = typeof lightColors;

export const darkColors: Palette = {
  // La marca se mantiene como relleno
  primary:      '#396fb6',
  primaryDark:  '#2d5a9e',
  primaryLight: '#93bce5',

  green:   '#c2d66e',
  // En claro el verde de texto se oscurece; en oscuro se aclara, por el mismo motivo
  greenText: '#c2d66e',      // 10,08:1 sobre la superficie oscura
  primaryText: '#9CC4EE',    // 8,86:1 — el azul de marca daría 3,16:1
  dangerText:  '#F08A8A',    // 6,68:1 — el rojo de marca daría 2,72:1
  purple:  '#b7a9d3',

  // Ni negro puro ni gris plano: el negro puro con texto claro deja halos en OLED
  bg:      '#15171C',
  surface: '#1E2128',
  border:  '#31353F',

  fg1:    '#F2F3F5',         // 14,51:1
  fg2:    '#B4B8C2',         // 8,11:1 sobre superficie, 9,03:1 sobre fondo
  ink900: '#F2F3F5',
  onPrimaryMuted: '#EFF3F9',

  // El azul de marca como texto da 3,16:1 en oscuro: para íconos y enlaces va el claro
  accent:  '#9CC4EE',        // 8,86:1
  amber50: '#232833',

  gold:    '#c2d66e',
  gold50:  '#232A1C',
  sage50:  '#232A1C',
  sage500: '#c2d66e',
  teal400: '#9CC4EE',

  // El rojo de marca se mantiene como relleno (blanco encima: 5,48:1); para texto va dangerText
  danger: '#B83232',

  dangerSurface:  '#33222A',
  dangerBorder:   '#5A3540',
  successSurface: '#1C2A24',
  infoSurface:    '#1C2432',
  infoBorder:     '#2E3A4D',

  white:          '#FFFFFF',
  overlayWhite16: 'rgba(255,255,255,0.10)',
  overlayWhite35: 'rgba(255,255,255,0.22)',
  overlayWhite72: 'rgba(255,255,255,0.60)',

  overlay: 'rgba(0,0,0,0.62)',

  shadowMedium: 'rgba(0,0,0,0.45)',
  shadowSoft:   'rgba(0,0,0,0.30)',
};

/** Se mantiene para lo que todavía no lee el tema; apunta a la paleta clara. */
export const Colors = lightColors;
