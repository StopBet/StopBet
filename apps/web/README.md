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

Íconos Lucide baked como data-URI en `src/styles/icons.css`. No requieren instalación npm — son CSS puro.

```tsx
// Clase base: .ico  |  Ícono: .ico-<nombre>
// Color via currentColor (hereda el text-color de Tailwind)
// Tamaño default: 24×24px — sobreescribir con style o clases de width/height

<i className="ico ico-heart text-primary" />
<i className="ico ico-bell text-fg2" style={{ width: 20, height: 20 }} />
<i className="ico ico-triangle-alert text-danger" />
```

### Referencia rápida

| Grupo | Íconos |
|---|---|
| Navegación / UI | `house`, `arrow-left`, `arrow-right`, `chevron-down/left/right`, `more-horizontal`, `plus`, `x`, `search`, `filter`, `settings` |
| Usuarios | `user`, `users`, `user-plus`, `user-round` |
| Clínico / Salud | `heart`, `heart-handshake`, `life-buoy`, `shield`, `hand`, `leaf`, `activity` |
| Logros / Gamif. | `trophy`, `award`, `medal`, `crown`, `star`, `sparkles`, `flame`, `gift`, `thumbs-up` |
| Comunicación | `message-circle`, `messages-square`, `bell`, `send`, `phone`, `phone-call`, `mail`, `inbox` |
| Tiempo / Datos | `calendar`, `clock`, `chart-column`, `chart-line`, `trending-up`, `trending-down`, `target` |
| Documentos | `book-open`, `clipboard-list`, `notebook-pen` |
| Estados | `circle-check`, `circle-alert`, `triangle-alert`, `check` |
| Auth | `lock`, `eye`, `eye-off`, `fingerprint` |
| Pagos | `wallet`, `credit-card`, `landmark`, `receipt`, `smartphone` |
