# Manual de marca StopBet

Referencia rápida de la identidad visual, para que no haya que pedir la imagen del manual
por el grupo cada vez. Si algo acá contradice al manual original, **manda el manual** —
y corrige este archivo.

## Paleta

| Hex | Nombre | Uso |
|---|---|---|
| `#396fb6` | Azul principal | Headers, acciones principales, enlaces |
| `#93bce5` | Azul claro | Estados secundarios, acentos |
| `#f4f4e9` | Crema | Fondo principal de la app |
| `#504f4f` | Gris texto | Texto principal |
| `#c2d66e` | Verde | Progreso, logros, estados positivos |
| `#b7a9d3` | Lavanda | Variante secundaria |

`#B83232` (rojo) **no es del manual**: es exclusivo del botón de pánico y las alertas
críticas, y no debe usarse decorativamente.

Los seis colores están en [`apps/mobile/src/constants/colors.ts`](../apps/mobile/src/constants/colors.ts).

> ⚠️ El dashboard web **no** usa esta paleta: usa el tema AJUTER (naranja `#E8883A`),
> descrito en la sección "Design System" de [`CLAUDE.md`](../CLAUDE.md). Son dos marcas
> distintas conviviendo — AJUTER es la institución, StopBet el producto. No unificar sin
> preguntar.

## Tipografías

| Jerarquía | Familia | Uso |
|---|---|---|
| Primaria | **Chillax** | Títulos y headings |
| Secundaria | **Satoshi** | Cuerpo, labels, botones, UI |
| Terciaria | **Lato** | Complementaria: apoyos, metadata, texto de bajo énfasis |

Los pesos disponibles están mapeados en
[`apps/mobile/src/constants/typography.ts`](../apps/mobile/src/constants/typography.ts);
usa siempre `Fonts.*` desde ahí, nunca el nombre del archivo a mano.

**Hay que declarar `fontFamily` en cada estilo de texto.** No existe —ni puede existir— un
default global: `App.tsx` tenía uno con `Text.defaultProps`, pero React 19 dejó de aplicar
`defaultProps` en componentes de función y el `Text` de RN 0.86 lo es, así que se ignoraba
en silencio. Comprobado poniendo `'Chillax-Bold'` ahí: ninguna pantalla cambió. Ese código
muerto ya se eliminó; si alguien lo reintroduce, no va a funcionar.

Un `<Text>` sin `fontFamily` sale en la fuente del sistema, no en la del manual. Y
`fontWeight` **no** sirve para poner negrita: en Android cada peso es un archivo propio,
así que la negrita se pide con `Fonts.bodyBold` / `Fonts.headingBold`.

```tsx
// ✅ correcto
<Text style={{ fontFamily: Fonts.headingBold }}>Mis logros</Text>

// ❌ sale en la fuente del sistema, no en la del manual
<Text style={{ fontWeight: '700' }}>Mis logros</Text>
```

Los `.ttf` viven en `apps/mobile/android/app/src/main/assets/fonts/` (8 archivos: Chillax
Regular/SemiBold/Bold, Satoshi Regular/Medium/Bold, Lato Regular/Bold).

## Logotipos

En [`apps/mobile/src/assets/`](../apps/mobile/src/assets/), en tres densidades cada uno
(`@1x`, `@2x`, `@3x` — React Native elige la que corresponde al dispositivo):

- `isotipo-blanco.png` — solo el símbolo, en blanco. Va sobre fondo azul `#396fb6`;
  sobre el crema o el azul claro no se lee.
- `logo-horizontal.png` — símbolo + palabra "StopBet" en azul. Para fondos claros.

La marca se escribe **StopBet**, con las dos mayúsculas.

## Estado de la implementación

Al 2026-08-30 **toda la app usa las tipografías del manual**: 261 estilos de texto en 29
archivos declaran `fontFamily` explícito y no queda ningún `fontWeight` en
`apps/mobile/src`.

El reparto quedó así, y sirve de criterio para lo que se agregue después:

| Familia | Dónde | Aprox. |
|---|---|---|
| `Fonts.headingBold` / `Fonts.heading` (Chillax) | Títulos de pantalla, números grandes, nombres destacados | 41 |
| `Fonts.bodyBold` (Satoshi Bold) | Botones, labels, énfasis dentro de texto | 121 |
| `Fonts.body` (Satoshi) | Cuerpo, subtítulos, metadata | 99 |

Chillax quedó reservado a texto de 16px o más que titula algo. Los subtítulos van en
Satoshi aunque acompañen a un título.
