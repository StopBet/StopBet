// Paleta oficial StopBet — sincronizada con el manual de marca
export const Colors = {
  // Azul principal
  primary:      '#396fb6',   // azul StopBet — headers, acciones principales
  primaryDark:  '#2d5a9e',   // azul oscuro — pressed states
  primaryLight: '#93bce5',   // azul claro — estados secundarios

  // Secundarios
  green:   '#c2d66e',        // verde — rellenos de progreso y logros; como texto no se lee (1,6:1)
  greenText: '#5B7324',      // verde para texto e íconos sobre fondos claros (5,35:1 sobre blanco)
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

  shadowMedium: 'rgba(80,79,79,0.10)',
  shadowSoft:   'rgba(80,79,79,0.06)',
};
