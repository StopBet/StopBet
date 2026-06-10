---
name: stopbet-web-design
description: Design system guide for StopBet web dashboard (AJUTER theme). Use when building any React component or page in apps/web — covers colors, typography, icons, and clinical UX constraints.
---

# StopBet Web Design System

The web dashboard uses the **AJUTER theme**: warm orange institutional palette, NOT the teal-green StopBet base.
All tokens are in `apps/web/src/styles/`.

## Color tokens — Tailwind classes

Always use semantic tokens. Never use Tailwind generic colors like `bg-orange-500`.

| Clase | Hex | Uso |
|---|---|---|
| `bg-primary` / `text-primary` | `#E8883A` | Naranja AJUTER — botones CTA, headers, acciones |
| `hover:bg-primary-hover` | `#C8513B` | Coral — hover de botones primarios |
| `bg-accent` / `text-accent` | `#F0B040` | Oro — highlights, badges, secondary CTA |
| `bg-secondary` / `text-secondary` | `#6A9E6A` | Verde salvia — progreso, estados positivos |
| `bg-danger` / `text-danger` | `#B83232` | **SOLO** botón de pánico y alertas críticas |
| `bg-bg` | `#FAF7F4` | Fondo principal de la app |
| `bg-surface` | `#FFFFFF` | Tarjetas, modales, panels |
| `bg-surface-alt` | `#FFF5EB` | Fondo alternativo cálido |
| `text-fg1` | `#2A2624` | Texto principal |
| `text-fg2` | `#574F4A` | Texto secundario, labels, captions |
| `text-fg-on-primary` | `#FFFFFF` | Texto sobre fondo primario |
| `border-border` | `#E8E2DC` | Bordes, separadores |

### Gradiente institucional
```tsx
style={{ background: 'var(--ajuter-gradient)' }}
// = linear-gradient(90deg, #F0B040, #E8883A, #D06A30)
```

## Tipografía

```tsx
// Headings — Nunito
<h1 style={{ fontFamily: 'var(--font-heading)' }}>  // o className="font-heading"

// Body/UI — Inter (aplicado globalmente en body)
<p className="text-fg1">  // Inter por defecto
```

Escala de tamaños via CSS vars: `--fs-12` (0.75rem) → `--fs-36` (2.25rem)

## Íconos

Los íconos son clases CSS con máscara SVG (Lucide). No requieren ningún import JS.

```tsx
// Tamaño default 24×24. Color via currentColor (hereda text-color).
<i className="ico ico-heart text-primary" />
<i className="ico ico-heart" style={{ color: 'var(--primary)', width: 20, height: 20 }} />
```

### Íconos disponibles

**Navegación / UI:** `ico-house`, `ico-arrow-left`, `ico-arrow-right`, `ico-chevron-down`, `ico-chevron-left`, `ico-chevron-right`, `ico-more-horizontal`, `ico-plus`, `ico-x`, `ico-search`, `ico-filter`, `ico-settings`

**Usuarios / Personas:** `ico-user`, `ico-users`, `ico-user-plus`, `ico-user-round`

**Clínico / Salud:** `ico-heart`, `ico-heart-handshake`, `ico-life-buoy`, `ico-shield`, `ico-hand`, `ico-leaf`, `ico-activity`

**Logros / Gamificación:** `ico-trophy`, `ico-award`, `ico-medal`, `ico-crown`, `ico-star`, `ico-sparkles`, `ico-flame`, `ico-gift`, `ico-thumbs-up`

**Comunicación:** `ico-message-circle`, `ico-messages-square`, `ico-bell`, `ico-send`, `ico-phone`, `ico-phone-call`, `ico-mail`, `ico-inbox`

**Tiempo / Datos:** `ico-calendar`, `ico-clock`, `ico-chart-column`, `ico-chart-line`, `ico-trending-up`, `ico-trending-down`, `ico-target`

**Documentos:** `ico-book-open`, `ico-clipboard-list`, `ico-notebook-pen`

**Estados:** `ico-circle-check`, `ico-circle-alert`, `ico-triangle-alert`, `ico-check`

**Auth / Seguridad:** `ico-lock`, `ico-eye`, `ico-eye-off`, `ico-fingerprint`

**Pagos:** `ico-wallet`, `ico-credit-card`, `ico-landmark`, `ico-receipt`, `ico-smartphone`

**Misc:** `ico-moon-star`, `ico-sun`, `ico-wind`, `ico-map-pin`, `ico-user-plus`

## Patrones de componentes

### Botón primario
```tsx
<button className="bg-primary text-fg-on-primary px-6 py-3 rounded-full font-semibold
                   hover:bg-primary-hover transition-colors duration-150">
  Guardar
</button>
```

### Botón de pánico (solo para emergencias clínicas)
```tsx
<button className="bg-danger text-white px-6 py-4 rounded-full font-bold">
  <i className="ico ico-phone-call mr-2" />
  Llamar emergencia
</button>
```

### Card
```tsx
<div className="bg-surface rounded-2xl p-6 shadow-soft border border-border">
  ...
</div>
```

### Label / Caption
```tsx
<span className="text-fg2 text-sm font-semibold tracking-wide uppercase">Etiqueta</span>
<span className="text-fg2 text-xs">Caption</span>
```

## Reglas clínicas de diseño

- **`bg-danger` SOLO** para el botón de pánico. Nunca para validaciones de formulario.
- No usar colores vibrantes ni animaciones llamativas en estados de crisis del paciente.
- Iconos relacionados con salud (`ico-heart`, `ico-life-buoy`) deben ir con `text-primary` o `text-secondary`, nunca `text-danger` en contextos neutros.
- Mantener contraste mínimo WCAG AA en todo texto sobre fondo de color.
