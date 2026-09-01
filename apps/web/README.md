# StopBet Web Dashboard

Dashboard para terapeutas. React 19 + Vite 6 + Tailwind v4.

## Setup

```bash
# Desde la raíz del monorepo
pnpm install
pnpm run web        # http://localhost:5173
```

## Design System

El dashboard usa la marca **StopBet** — azul sobre crema. Hasta el 2026-08-31 el shell iba
con la paleta AJUTER (naranja) y solo el login era azul; ahora todo el panel va con la marca
del producto y el logo de AJUTER vive al pie del sidebar.

### Estructura

```
src/styles/
├── fonts/               ← Fuentes self-hosted (.woff2)
│   ├── Inter-{400,600,700}.woff2     ← respaldo de body text
│   └── Nunito-{400,600,700}.woff2   ← respaldo de headings
├── colors_and_type.css  ← Tokens base + @font-face
├── stopbet-brand.css    ← @font-face de Chillax/Satoshi + tokens del login (--sb-)
└── stopbet-theme.css    ← Override de paleta del shell (azul StopBet)
```

### Paleta de colores

| Token | Clase Tailwind | Hex | Uso |
|---|---|---|---|
| primary | `bg-primary` `text-primary` | `#396fb6` | Azul StopBet — acciones, headers |
| primary-hover | `text-primary-hover` | `#2d5a9e` | Azul oscuro — hover states |
| accent | `bg-accent` `text-accent` | `#93bce5` | Azul claro — CTAs, highlights, badges |
| secondary | `bg-secondary` | `#97b23f` | Verde del manual — progreso, positivo |
| danger | `bg-danger` `text-danger` | `#B83232` | **Solo** botón de pánico y alertas críticas |
| bg | `bg-bg` | `#f4f4e9` | Fondo principal |
| surface | `bg-surface` | `#FFFFFF` | Tarjetas, modales |
| surface-alt | `bg-surface-alt` | `#EAF1F9` | Fondo alternativo azulado |
| fg1 | `text-fg1` | `#3a3939` | Texto principal |
| fg2 | `text-fg2` | `#6b6a6a` | Texto secundario, captions |
| border | `border-border` | `#E2E2D6` | Bordes, divisores |

El verde del manual es `#c2d66e`, pero sobre blanco no alcanza contraste AA: se usa
oscurecido a `#97b23f`.

### Tipografía

| Fuente | Pesos | Uso | Clase |
|---|---|---|---|
| **Chillax** | 600, 700 | Títulos, headings | `font-heading` |
| **Satoshi** | 400, 700 | UI, body text | `font-body` (default en `body`) |

Nunito e Inter quedan como respaldo en la cadena de fuentes.

Escala de tamaños via CSS vars: `--fs-12` hasta `--fs-36`.

### Gradiente institucional

```css
background: var(--ajuter-gradient);
/* = linear-gradient(90deg, #93bce5, #396fb6, #2d5a9e) */
```

> El nombre de la variable quedó de la etapa AJUTER. Se conserva para no tocar las páginas
> que ya la consumen; su contenido es azul.

### Regla de uso

Usar siempre los tokens semánticos — nunca colores Tailwind genéricos:

```tsx
// ✅
<button className="bg-primary text-fg-on-primary hover:bg-primary-hover">

// ❌
<button className="bg-orange-500 text-white hover:bg-orange-600">
```

Esto permite cambiar el tema completo modificando solo `stopbet-theme.css`.

## Íconos

Los íconos se usan con el componente **`WIcon`** (`src/components/WIcon.tsx`), que envuelve
**`lucide-react`**. No son clases CSS.

```tsx
import { WIcon } from '../components/WIcon'

<WIcon name="triangle-alert" size={18} color="var(--danger)" />
<WIcon name="users" size={16} />          // hereda currentColor si no pasas `color`
```

### Agregar un ícono

`WIcon` solo conoce los nombres que están en su `ICON_MAP`. Son dos líneas:

1. Agregar el componente al `import { ... } from 'lucide-react'` del archivo.
2. Agregar la entrada `'nombre-kebab': ComponentePascal,` al `ICON_MAP`.

> ⚠️ **Un nombre que no está en el mapa no da error.** `WIcon` devuelve un `<span>` vacío
> del mismo tamaño, así que la interfaz queda con un hueco en blanco y nada en consola. Si
> un ícono "no aparece", lo primero es revisar que su nombre esté en el mapa.

### Nombres disponibles hoy

`activity`  `arrow-right`  `bell`  `calendar`  `camera`  `chart-column`  `check`
`chevron-down`  `chevron-left`  `chevron-right`  `circle-alert`  `circle-check`
`clipboard-list`  `clock`  `download`  `hand`  `heart-handshake`  `house`  `inbox`
`life-buoy`  `map-pin`  `message-circle`  `menu`  `more-horizontal`  `notebook-pen`
`search`  `send`  `settings`  `shield`  `sparkles`  `target`  `trending-up`
`triangle-alert`  `trophy`  `users`  `user-round`  `user-plus`  `wallet`  `x`

> `src/styles/icons.css` es un sistema anterior de íconos Lucide como data-URI
> (`<i className="ico ico-heart" />`). **Ningún archivo de `src/` lo usa**, pero sigue
> importado desde `index.css` y pesa en el bundle. Su lista de nombres **no** coincide con la
> de `WIcon`: no la uses como referencia. Queda pendiente decidir si se borra.
