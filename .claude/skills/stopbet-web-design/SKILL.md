---
name: stopbet-web-design
description: Design system del dashboard web StopBet (marca azul StopBet). Úsala al construir cualquier componente o página de React en apps/web — cubre colores, tipografía, íconos y restricciones de UX clínica.
---

# StopBet Web Design System

El dashboard usa la **marca StopBet**: azul `#396fb6` sobre crema, con Chillax y Satoshi.

> **Cambió el 31-08-2026.** Antes el shell clínico iba con el tema AJUTER (naranja `#E8883A`)
> y el login era la única excepción azul. Ahora **todo** el panel va con la marca del producto,
> y `ajuter-theme.css` **ya no existe**. Si encuentras un naranja escrito a mano en una vista,
> es residuo de esa migración: cámbialo por el token semántico.

## Cómo está armado (importa para saber qué tocar)

`src/index.css` importa en este orden:

```
colors_and_type.css   ← paleta cruda + tokens semánticos + escalas (spacing, radius, motion)
stopbet-brand.css     ← @font-face de Chillax/Satoshi + tokens --sb-
stopbet-theme.css     ← REDEFINE la paleta cruda con los valores de marca
icons.css             ← clases .ico legadas (ver "Íconos")
```

**La mecánica:** `colors_and_type.css` define los semánticos apuntando a la paleta cruda
(`--primary: var(--teal-700)`), y `stopbet-theme.css` se carga después y **redefine la cruda**
(`--teal-700: #396fb6`). Por eso el panel entero cambió de color sin tocar las páginas una por una.

**Consecuencia práctica:** para cambiar la paleta, edita `stopbet-theme.css`. Los nombres de las
variables crudas (`--teal-700`, `--amber-500`, `--sage-500`) **conservan el nombre viejo y ya no
describen su color** — `--teal-700` es azul, `--amber-500` es azul claro. No te guíes por el nombre.

## Tokens de color — valores resueltos hoy

Usa siempre el token semántico, nunca el crudo ni un hex a mano.

| Clase Tailwind | Token CSS | Valor real | Uso |
|---|---|---|---|
| `bg-primary` / `text-primary` | `--primary` | `#396fb6` | Azul StopBet — acciones, headers |
| `hover:bg-primary-hover` | `--primary-hover` | `#2d5a9e` | Azul oscuro — hover/pressed |
| `bg-accent` / `text-accent` | `--accent` | `#93bce5` | Azul claro — CTAs, highlights |
| `bg-secondary` / `text-secondary` | `--secondary` | `#97b23f` | Verde del manual — progreso, logros |
| `bg-danger` / `text-danger` | `--danger` | `#B83232` | **SOLO** pánico y alertas críticas |
| `bg-bg` | `--bg` | `#f4f4e9` | Fondo crema de la app |
| `bg-surface` | `--surface` | `#FFFFFF` | Tarjetas, modales, paneles |
| `bg-surface-alt` | `--surface-alt` | `#EAF1F9` | Fondo alternativo (tinte azul) |
| `text-fg1` | `--fg1` | `#3a3939` | Texto principal |
| `text-fg2` | `--fg2` | `#6b6a6a` | Texto secundario, labels |
| `text-fg-on-primary` | `--fg-on-primary` | `#FFFFFF` | Texto sobre fondo primario |
| `border-border` | `--border` | `#E2E2D6` | Bordes, separadores |
| `text-disabled` | `--disabled` | `#B9B9AE` | Estados deshabilitados |

**Ojo con el verde:** el manual trae `#c2d66e`, pero se usa oscurecido a `#97b23f` porque el
original no alcanza contraste AA sobre blanco. Usa `--secondary`, no el hex del manual.

### Gradiente institucional

```tsx
style={{ background: 'var(--ajuter-gradient)' }}
// = linear-gradient(90deg, #93bce5 0%, #396fb6 55%, #2d5a9e 100%)
```

**Conserva el nombre `--ajuter-gradient` pero hoy es azul.** Se dejó así para no tocar las páginas
que ya lo consumen.

## Dos formas de consumir los tokens

Ambas funcionan; el mapeo Tailwind existe vía `@theme inline` en `index.css`.

```tsx
// A) Clases utilitarias de Tailwind
<div className="bg-surface text-fg1 border border-border rounded-2xl">

// B) Estilos en línea con la variable
<div style={{ background: 'var(--surface)', color: 'var(--fg1)' }}>
```

**En la práctica, las páginas existentes usan mayoritariamente la opción B** (estilos en línea con
`var(--token)`). Si estás editando una página, sigue el estilo que ya tiene en vez de mezclar los dos.

```tsx
// ❌ nunca
<div className="bg-orange-100 text-gray-900">
<div style={{ background: '#396fb6' }}>
```

## Tipografía

```tsx
// Títulos — Chillax (respaldo Nunito)
<h1 className="font-heading">                              // o style={{ fontFamily: 'var(--font-heading)' }}

// Body/UI — Satoshi (respaldo Inter), ya aplicado globalmente en body
<p className="text-fg1">
```

Las `@font-face` de Chillax y Satoshi viven en `stopbet-brand.css`; Nunito e Inter son
self-hosted en `styles/fonts/` y quedan de respaldo.

Escala de tamaños: `--fs-12` (0.75rem) → `--fs-36` (2.25rem). Pesos: `--fw-regular/semibold/bold`.

## Íconos — usa `WIcon`, no las clases `.ico`

```tsx
import { WIcon } from '../components/WIcon'

<WIcon name="life-buoy" />                                  // 20px, hereda currentColor
<WIcon name="trophy" size={24} color="var(--primary)" />
```

`WIcon` (`src/components/WIcon.tsx`) envuelve `lucide-react` con un mapa de nombres.

⚠️ **El mapa es una lista cerrada y un nombre desconocido no falla: renderiza un hueco vacío
del tamaño pedido, sin error ni warning en consola.** Si un ícono "no aparece", casi siempre es
que el nombre no está en `ICON_MAP` — verifica contra esta lista antes de buscar en otro lado.

**Los 41 nombres disponibles:**

`activity` · `arrow-right` · `bell` · `calendar` · `camera` · `chart-column` · `check` ·
`chevron-down` · `chevron-left` · `chevron-right` · `circle-alert` · `circle-check` ·
`clipboard-list` · `clock` · `download` · `flag` · `hand` · `heart-handshake` · `house` ·
`inbox` · `life-buoy` · `map-pin` · `menu` · `message-circle` · `more-horizontal` ·
`notebook-pen` · `search` · `send` · `settings` · `shield` · `sparkles` · `target` ·
`trash-2` · `trending-up` · `triangle-alert` · `trophy` · `user-plus` · `user-round` ·
`users` · `wallet` · `x`

No existen `heart` (usa `heart-handshake`), `user` (usa `user-round`), `arrow-left`, `plus`,
`filter`, `star`, `award`, `medal`, `flame`. **Si necesitas uno nuevo, agrégalo al `ICON_MAP`**
importándolo de `lucide-react`; no lo dibujes a mano.

`icons.css` todavía define 43 clases `.ico-*` (máscaras SVG) y sigue importado, pero **ningún
componente las usa**: es residuo. En código nuevo usa `WIcon`.

## Patrones de componentes

### Botón primario
```tsx
<button className="bg-primary text-fg-on-primary px-6 py-3 rounded-full font-semibold
                   hover:bg-primary-hover transition-colors duration-150">
  Guardar
</button>
```

### Botón de pánico (solo emergencias clínicas)
```tsx
<button className="bg-danger text-white px-6 py-4 rounded-full font-bold">
  <WIcon name="triangle-alert" />
  Llamar emergencia
</button>
```

### Card
```tsx
<div className="bg-surface rounded-2xl p-6 shadow-soft border border-border">
```

### Label / Caption
```tsx
<span className="text-fg2 text-sm font-semibold tracking-wide uppercase">Etiqueta</span>
<span className="text-fg2 text-xs">Caption</span>
```

## Reglas clínicas de diseño

- **`bg-danger` SOLO** para el botón de pánico y alertas críticas. Nunca para validaciones de formulario.
- Sin colores vibrantes ni animaciones llamativas en estados de crisis del paciente.
- Íconos de salud (`heart-handshake`, `life-buoy`, `shield`) van con `text-primary` o
  `text-secondary`, nunca `text-danger` en contextos neutros.
- Contraste mínimo **WCAG AA** en todo texto sobre fondo de color. Es la razón por la que el
  verde del manual se usa oscurecido.

## AJUTER sigue presente

El logo de AJUTER no desapareció con el cambio de marca: **vive al pie del sidebar**, porque el
panel sigue identificando a la institución que lo usa. La paleta completa de la marca está en
[`docs/manual-marca.md`](../../../docs/manual-marca.md).
