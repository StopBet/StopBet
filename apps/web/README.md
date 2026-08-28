# StopBet Web Dashboard

Dashboard para terapeutas. React 19 + Vite 6 + Tailwind v4.

## Setup

```bash
# Desde la raíz del monorepo
pnpm install
pnpm run web        # http://localhost:5173
```

## Design System

El dashboard usa la paleta **AJUTER** — naranja cálido institucional.

### Estructura

```
src/styles/
├── fonts/               ← Fuentes self-hosted (.woff2)
│   ├── Inter-{400,600,700}.woff2     ← UI / body text
│   └── Nunito-{400,600,700}.woff2   ← Headings
├── colors_and_type.css  ← Tokens base + @font-face
└── ajuter-theme.css     ← Override de paleta AJUTER
```

### Paleta de colores

| Token | Clase Tailwind | Hex | Uso |
|---|---|---|---|
| primary | `bg-primary` `text-primary` | `#E8883A` | Naranja AJUTER — acciones, headers |
| primary-hover | `text-primary-hover` | `#C8513B` | Coral — hover states |
| accent | `bg-accent` `text-accent` | `#F0B040` | Oro — CTAs, highlights, badges |
| secondary | `bg-secondary` | `#6A9E6A` | Verde salvia — progreso, positivo |
| danger | `bg-danger` `text-danger` | `#B83232` | **Solo** botón de pánico y alertas críticas |
| bg | `bg-bg` | `#FAF7F4` | Fondo principal |
| surface | `bg-surface` | `#FFFFFF` | Tarjetas, modales |
| surface-alt | `bg-surface-alt` | `#FFF5EB` | Fondo alternativo cálido |
| fg1 | `text-fg1` | `#2A2624` | Texto principal |
| fg2 | `text-fg2` | `#574F4A` | Texto secundario, captions |
| border | `border-border` | `#E8E2DC` | Bordes, divisores |

### Tipografía

| Fuente | Pesos | Uso | Clase |
|---|---|---|---|
| **Nunito** | 400, 600, 700 | Títulos, headings | `font-heading` |
| **Inter** | 400, 600, 700 | UI, body text | `font-body` (default en `body`) |

Escala de tamaños via CSS vars: `--fs-12` hasta `--fs-36`.

### Gradiente institucional

```css
background: var(--ajuter-gradient);
/* = linear-gradient(90deg, #F0B040, #E8883A, #D06A30) */
```

### Regla de uso

Usar siempre los tokens semánticos — nunca colores Tailwind genéricos:

```tsx
// ✅
<button className="bg-primary text-fg-on-primary hover:bg-primary-hover">

// ❌
<button className="bg-orange-500 text-white hover:bg-orange-600">
```

Esto permite cambiar el tema completo modificando solo `ajuter-theme.css`.

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
