# Auditoría UX/UI · StopBet Web

- **Fecha:** 14-09-2026
- **Alcance:** `apps/web` completo:
  - el panel clínico que usan psicólogos y coordinación: Resumen, ficha del paciente, Alertas, Solicitudes, Sesiones de familiares, Equipo, Finanzas, Configuración, Mis pacientes y Reportes;
  - el portal del familiar;
  - el login.
- **Método:** recorrido en Chromium con Playwright a 1440, 1280 y 390 px, usando tres cuentas del seed (psicólogo, coordinadora y familiar). Además:
  - axe-core con WCAG 2.1 AA en cada página;
  - el detector de impeccable;
  - lectura completa del código.
- **Tipo:** solo diagnóstico. Ningún archivo de la app se modificó para esta auditoría.
- **Restricción del PO:** los colores del manual de marca no se tocan (ver más abajo).
- **Rutas:** relativas a `apps/web/src/`, salvo que se indique otra.

## Resumen

| Métrica | Resultado |
|---|---|
| Salud técnica (impeccable, auditoría web) | **9/20** · Pobre, requiere trabajo mayor |
| Heurísticas de Nielsen (impeccable, crítica) | **20/40** · Aceptable, mejoras importantes |
| Hallazgos | **42** · 1 P0 · 17 P1 · 19 P2 · 5 P3 |
| axe-core (WCAG 2.1 AA) | 225 textos sin contraste suficiente · 25 botones sin nombre · 10 selectores y 6 campos sin etiqueta |

Gravedad: **P0** bloquea o pone en riesgo a un paciente · **P1** arreglar antes de lanzar · **P2** próxima pasada · **P3** pulido.

**Veredicto: buen esqueleto, datos de utilería.**

- **La base es sólida:**
  - la marca está aplicada con tokens y la mecánica del tema permite cambiar la paleta en un solo archivo;
  - bajo 860 px las tablas se convierten en tarjetas;
  - Equipo y el portal del familiar tienen estados de carga, error y vacío pensados con cuidado.
- **El problema es la confianza.** Un panel clínico se lee como verdad, y hoy mezcla datos reales con datos inventados:
  - una campana con "3" fijo, un tiempo de respuesta "8m" fijo y un perfil de otra persona en Configuración;
  - más de 20 botones que no hacen nada;
  - lo más grave: **un estado de alerta de pánico traducido al revés**.
- **La accesibilidad casi no existe:**
  - el verde y el azul claro se usan como texto y no se leen;
  - no hay foco visible;
  - los modales no son diálogos;
  - hay botones que solo tienen un ícono y no tienen nombre.

### Puntajes por dimensión

| Salud técnica | Puntaje | Heurística | Puntaje |
|---|---|---|---|
| Accesibilidad | 1/4 | Estado del sistema | 1/4 |
| Rendimiento | 3/4 | Lenguaje del usuario | 3/4 |
| Adaptabilidad | 2/4 | Control y libertad | 2/4 |
| Tema y tokens | 2/4 | Consistencia | 2/4 |
| Integridad de la implementación | 1/4 | Prevención de errores | 2/4 |
|  |  | Reconocer, no recordar | 3/4 |
|  |  | Flexibilidad | 1/4 |
|  |  | Estética y foco | 2/4 |
|  |  | Recuperación de errores | 3/4 |
|  |  | Ayuda | 1/4 |

## Restricción del PO: los colores del manual no cambian

Ningún arreglo de esta lista modifica un color del manual (`#396fb6`, `#93bce5`, `#c2d66e`, `#f4f4e9`, `#504f4f`, `#b7a9d3`) ni los derivados que ya existen.

**El contraste se arregla de otra forma, sin tocar la paleta:**

- **Verde:** se agrega un token derivado solo para texto. Es el mismo criterio que ya se usó con `#97b23f`, y que mobile ya aplicó con `greenText` (`#5B7324`).
- **Azul claro:** donde hoy se usa como texto, pasa a usarse el azul principal.

**Corrección a la skill del proyecto:** `.claude/skills/stopbet-web-design/SKILL.md` dice que `#97b23f` "alcanza contraste AA sobre blanco". No es así: da **2,40:1**, y AA pide 4,5:1 para texto normal y 3:1 para texto grande. Sirve para rellenos y bordes, no para texto.

## Lo que hay que arreglar primero (P0)

### ALE-01 · Los estados de las alertas de pánico se muestran al revés

- **Dónde:** `pages/AlertasPage.tsx:24-28` (`mapStatus`) · `pages/OverviewPage.tsx:70-92` · `:687` (`resolved: a.status !== 'pending'`)
- **Qué pasa:** el backend usa cuatro estados. La web los traduce mal:

  | Estado en el backend | Qué significa | Cómo lo muestra la web |
  |---|---|---|
  | `pending` | recién enviada | ok |
  | `responded` | el padrino respondió | "Resuelto manualmente" |
  | `escalated` | el padrino no respondió en 120 s, o el paciente la escaló; es un estado **activo** | **"Resuelto con IA"**, con el ícono de chispas |
  | `cancelled` | el paciente la cerró, o la reemplazó una alerta nueva | **"Sin resolver"**, dentro de "Requieren atención", con un botón rojo "Atender" |

  En Resumen, cualquier alerta que no sea `pending` se lee como "Contención con IA".

  **Verificado con datos del seed:** las tres alertas de Carlos Demo están `cancelled` y Alertas las muestra como "Sin resolver".

  **La consecuencia:** un psicólogo ve como resuelta justo la crisis que sigue abierta (la que el padrino no atendió) y persigue las que ya se cerraron.
- **Qué arreglar:** un solo mapa de estados, compartido por las dos páginas:

  | Estado | Etiqueta | Tono | ¿Requiere atención? |
  |---|---|---|---|
  | `pending` | "Esperando respuesta" | alerta | sí |
  | `escalated` | "Escalada · sin respuesta" | alerta | sí |
  | `responded` | "Respondida" | azul | no |
  | `cancelled` | "Cerrada" | neutro | no |

  _Las etiquetas de `pending` y `responded` decían "al padrino" y "El padrino respondió";
  se acortaron al renombrar a «compañero de viaje» (PR #101), que no cabía en la fila._

  El paciente queda "En riesgo" si tiene alguna alerta `pending` o `escalated`.
- **Dueño:** dashboard (HdU04, Eduardo Pacheco), con los datos de pánico (HdU01, Matías Barraza).

## Estado al cierre y traspaso · 15-09-2026

**Esta auditoría ya está hecha y 39 de sus 42 hallazgos están arreglados y mergeados en
`main` (PR #95). No hace falta volver a auditar la web: lo que queda es corto y está
listado acá abajo.** Quien siga con el dashboard puede tomar esta sección como punto de
partida.

| Métrica | Antes | Después |
|---|---|---|
| Hallazgos resueltos | 0 de 42 | 39 de 42 |
| axe: textos sin contraste | 225 nodos | 0 |
| axe: botones · selectores · campos sin nombre | 25 · 10 · 6 | 0 · 0 · 0 |
| Foco visible (login / panel) | 5 de 7 · 11 de 12 | 7 de 7 · 12 de 12 |
| Desborde lateral a 1280 px | 140 px (Resumen) | 0 en todas las páginas |

### Los 3 que quedan de la auditoría

| # | Qué falta | Dónde | Por qué no se cerró |
|---|---|---|---|
| **SIS-09** (P2) | Pasar a tokens los hex y `rgba` escritos a mano | transversal, `apps/web/src/pages/` | **Parcial.** Salieron `#574F4A`, el `#B83232` a mano, el verde azulado del menú (`rgba(30,45,44,…)`) y el `#EAF1F9` del login. Quedan los demás de los 62 hex y 44 `rgba` originales. Es trabajo mecánico, sin decisión de por medio. |
| **SIS-13** (P3) | Decidir si Inter y Nunito se siguen cargando | `apps/web/src/styles/colors_and_type.css` | Son **solo respaldo** de Chillax y Satoshi, y se descargan siempre. Falta medir cuánto pesa y decidir. |
| **SHL-03** (P2) | Guardar el logo de AJUTER en el repo | `apps/web/src/components/...` (pie del sidebar) | **Bloqueado por un archivo, no por código:** hoy se carga desde `ajuter.org`. El logo está en `~/Stopbet/marca` (carpeta del PO) — pedirlo y commitearlo. |

### Lo que cambió en la web *después* de la auditoría (no vuelvas a reportarlo)

- **Estados de alerta de pánico.** `escalated` es una alerta **activa**, no una resuelta —
  esa inversión era el P0 de la auditoría. Los estados salen de `utils/alertStatus.ts`; las
  etiquetas visibles ahora son «Esperando respuesta» y «Respondida».
- **«Compañero de viaje», no «padrino»** (PR #101). Es el término del programa de AJUTER.
  **En el código nada se renombró:** el rol sigue siendo `sponsor`. Regla: `sponsor` en el
  código, «compañero de viaje» en la pantalla.
- **Modales propios** vía `hooks/useDialog` — no queda ningún `window.confirm`.
- **El verde de texto es `--secondary-text`.** El `#c2d66e` del manual no alcanza AA sobre
  blanco (1,6:1) y por eso existe la versión oscurecida. No lo "corrijas" de vuelta al hex
  del manual: la marca se respeta en los rellenos.
- **Finanzas avisa en pantalla que son datos de ejemplo.**

### Huecos conocidos que la auditoría UX no cubre

No son hallazgos de UX, pero quien tome la web se los va a encontrar:

- **`FinanzasPage` y `ConfiguracionPage` siguen con datos mock.** Las demás páginas ya están
  conectadas a la API real con TanStack Query.
- **14 de 17 controladores del backend leen `x-user-id` sin verificarlo.** Solo `family`,
  `metrics` y `users` tienen guard. El cliente HTTP de la web ya manda `Bearer`, pero algunas
  llamadas siguen con el header viejo porque el endpoint no lo pide. Ver
  `docs/security/permissions-matrix.md`.
- **Nadie aprueba los vínculos de familiar.** `requestLink` los crea en `pending` y no hay
  endpoint ni pantalla que los pase a `active`: en producción un familiar quedaría esperando
  para siempre. Es una pantalla web que falta.
- **Vercel Hobby prohíbe el uso comercial.** Funciona porque el repo está público. Ver
  `ASUNCIONES-PENDIENTES.md`.

### Cómo reproducir la verificación

El recorrido fue con axe sobre las 7 vistas del terapeuta más el portal del familiar, a
1280 px y a 1920 px, con las cuentas de `pnpm run seed` y `pnpm run seed:family` (clave
`Stopbet2026!`). Para el teléfono, ojo con Vite: escucha solo en IPv6, hay que levantarlo con
`pnpm --filter @stopbet/web dev -- --host 0.0.0.0`.

## Lista de arreglos

Para ir marcando. El detalle de cada punto está en la sección siguiente, por pantalla.

### P0 · bloqueante (1)

- [x] **ALE-01** · Estados de alerta de pánico invertidos. **Arreglo:** mapa único de los cuatro estados reales. _(HdU04 · Eduardo Pacheco · datos HdU01)_ — **Resuelto en local 14-09:** Mapa único en `utils/alertStatus.ts` y `components/AlertStatusBadge.tsx`, usado en Resumen, en la ficha, en Alertas y en el PDF. Verificado con una alerta de prueba: `pending` se ve como "Esperando al padrino", `cancelled` como "Cerrada" y `responded` como "El padrino respondió". El contador de la barra lateral muestra ahora las alertas activas reales.

### P1 · antes de lanzar (17)

- [x] **SIS-01** · 225 textos sin contraste suficiente. **Arreglo:** un token de texto verde derivado; usar el azul principal en vez del azul claro como texto; chips de sede más oscuros. _(transversal)_ — **Resuelto en local 14-09:** Token `--secondary-text` (`#5B7324`) para el verde como texto e íconos.
  - `--accent` y `--gold` como texto pasaron a `--primary`.
  - `--teal-50` se aclaró a `#ECF3FA`: los chips y las iniciales quedan en 4,55:1.
  - La barra lateral oscurece con `--primary-hover` en vez de velos blancos, y el texto blanco va al 90–100 %.

  axe: de 225 nodos a 0 en las páginas medidas. Ningún color del manual cambió.
- [x] **SIS-02** · Botones solo de ícono, selectores y campos sin nombre accesible. **Arreglo:** `aria-label` en los íconos; etiquetas asociadas a sus campos con `htmlFor`/`id`. _(transversal)_ — **Resuelto en local 14-09:** `aria-label` en los botones de ícono (cerrar, paginación), en los selectores y en el buscador.
  - Etiquetas asociadas con `htmlFor`/`id` en el reporte PDF, en Solicitudes y en Equipo.
  - Los interruptores de sede llevan `aria-pressed` y las pestañas de la ficha `role="tab"`.

  axe: pasó de 25 botones, 10 selectores y 6 campos sin nombre a 0.
- [x] **SIS-03** · Foco invisible: 15 `outline: none` sin reemplazo y ninguna regla `:focus-visible`. **Arreglo:** un anillo global de `:focus-visible` con el azul de marca. _(transversal)_ — **Resuelto en local 14-09:** Regla global `:focus-visible`: anillo azul, y blanco en la barra lateral. Lleva `!important` para ganarle a los `outline: none` en línea. Medido: el foco se ve en 7 de 7 pasos del login y en 12 de 12 del panel.
- [x] **SIS-04** · Modales y cajones sin semántica de diálogo. **Arreglo:** `role="dialog"`, `aria-modal`, cierre con Escape y foco inicial dentro del diálogo. _(transversal)_ — **Resuelto en local 14-09:** Nuevo hook `hooks/useDialog.ts`: foco inicial dentro del diálogo, Tab atrapado, cierre con Escape y devolución del foco al cerrar.
  - Se aplica en la ficha, en los 3 modales de Solicitudes y en los 5 de Equipo, todos con `role="dialog"`, `aria-modal` y un nombre.
  - El menú del teléfono también es un diálogo y se cierra con Escape.
- [x] **SIS-05** · Filas de tabla que se abren con clic pero no con teclado. **Arreglo:** hacer que la acción sea un botón o un enlace dentro de la fila. _(transversal)_ — **Resuelto en local 14-09:** La acción de cada fila del Resumen es ahora un botón real ("Ver ficha"). En Alertas y Finanzas se quitó el cursor de mano de las filas que no hacen nada.
- [x] **SIS-06** · Más de 20 controles que no hacen nada. **Arreglo:** conectarlos, ocultarlos o marcarlos como "Próximamente". _(transversal)_ — **Resuelto en local 14-09:** Resumen:
  - se quitaron "Exportar lista", el `···` y la paginación falsa;
  - "Ver historial completo" lleva a Alertas;
  - "Ver sesión" pasó a llamarse "Ver ficha".

  Alertas: se quitaron "Exportar", "Ver" y "Atender" (ahora cada alerta muestra su estado).

  Finanzas: se quitaron sus cuatro botones sin efecto.

  Configuración, ficha y barra superior: FIC-01, CON-01 y SHL-01.

  Navegación: "Mis pacientes" y "Reportes" aparecen con la etiqueta "Pronto" y no llevan a ninguna parte.

  Verificado en vivo.
- [x] **SHL-01** · Datos inventados en el marco de la app: campana "3", contador "3" en Alertas y avatar "MG". **Arreglo:** usar datos reales o quitarlos. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** El contador de la barra lateral sale de las alertas `pending` + `escalated`. Se quitaron la campana y el avatar "MG" de la barra superior, cuyo título ahora es el `h1`.
- [x] **RES-01** · Anchos mínimos de 1180/1100/820 px: en un notebook la página se desplaza de lado. **Arreglo:** quitar el `minWidth` y dejar que la cuadrícula se adapte. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** Se quitaron los `minWidth` de las cuatro páginas. El Resumen usa áreas de cuadrícula: bajo 1400 px pasa a una columna, con las alertas de pánico primero. Medido: 0 px de desborde a 1280 en todas las páginas.
- [x] **RES-02** · "Alertas hoy" usa la fecha UTC: después de las 20–21 h de Chile marca 0. **Arreglo:** comparar con el día local. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** `isToday()` compara el día local. Verificado a las 22:39 hora de Chile: "Alertas hoy" cuenta las alertas de esa tarde.
- [x] **FIC-01** · La pestaña "Editar" de la ficha tiene un "Guardar cambios" que no guarda. **Arreglo:** quitar la pestaña o dejarla solo de lectura. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** La pestaña se llama ahora "Datos" y es de solo lectura (`dl`), con el aviso "Estos datos todavía no se pueden editar desde el panel".
- [x] **FIC-02** · "Sesiones IA" dice siempre que el paciente no usó el asistente. **Arreglo:** mostrar los resúmenes reales o decir que la información no está disponible. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** Dice "Todavía no disponible" y aclara que estar vacía no significa que el paciente no haya usado el asistente.
- [x] **ALE-02** · Métrica "8m" fija y protocolo con pasos marcados siempre igual. **Arreglo:** métricas reales; el protocolo como información, sin estado falso. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** Las métricas salen del historial real: requieren atención, respondidas por el padrino y cerradas. El protocolo describe lo que hace `panic.service.ts`: avisa al padrino, escala a los 2 minutos o de inmediato si no hay padrino, deja el asistente y el *4141 en la app y aclara que el panel no avisa al psicólogo.
- [x] **SOL-01** · Aprobar y rechazar descartan lo que el profesional escribe (padrino, fecha, notas, motivo, mensaje). **Arreglo:** enviarlo o quitar esos campos; no prometer avisos ni reembolsos que no ocurren. _(HdU06 · Matías Lara)_ — **Resuelto en local 14-09:** El backend solo recibe `assignedPsychologistId`, así que se quitaron el padrino de ejemplo, la fecha de inicio y las notas del modal de aprobación, además del motivo y el mensaje del rechazo. También salieron las promesas de reembolso y de aviso al solicitante. El arancel "$30.000" queda como está: no se pudo comprobar si es inventado.
- [x] **CON-01** · Configuración muestra el perfil de otra persona (Dra. González, con RUT y correo). **Arreglo:** usar los datos de la sesión o marcar la sección como "Próximamente". _(sin dueño · deuda conocida)_ — **Resuelto en local 14-09:** El perfil sale de la sesión (nombre, correo, rol y sede) y es de solo lectura. Notificaciones, Sede y Seguridad dicen "Próximamente".
- [x] **FIN-01** · Finanzas usa solo datos de ejemplo y no lo dice. **Arreglo:** un aviso visible de "datos de ejemplo" y quitar los botones sin efecto. _(billing · sin dueño)_ — **Resuelto en local 14-09:** Aviso fijo "Datos de ejemplo" (`role="note"`) y sin los botones de exportar ni de ver.
- [x] **ING-01** · "¿Olvidaste tu contraseña?" enlaza a `#`. **Arreglo:** decir a quién escribir, o quitar el enlace hasta que exista el flujo. _(auth · José Meza)_ — **Resuelto en local 14-09:** Abre un correo a `admin@stopbet.cl` con el asunto "Recuperar contraseña", el mismo contacto que ya figura al pie del formulario.
- [x] **FAM-01** · En el portal del familiar, el saludo blanco va sobre el tramo más claro del degradado (1,99:1). **Arreglo:** poner el texto sobre el tramo oscuro, o un fondo sólido. _(HdU11 · Alex Domínguez)_ — **Resuelto en local 14-09:** El encabezado usa un degradado entre los dos azules oscuros de la marca (`--primary-hover` → `--primary`): el texto blanco queda a 5,09:1 o más.

### P2 · próxima pasada (19)

- [x] **SIS-07** · Cinco animaciones con rebote y ningún `prefers-reduced-motion`. **Arreglo:** curvas de desaceleración suave y respetar el ajuste de reducir movimiento. _(transversal)_ — **Resuelto en local 14-09:** Las 5 curvas con rebote pasaron a `--ease-calm`. Un bloque `prefers-reduced-motion` quita los latidos y los desplazamientos, y deja girando el spinner.
- [x] **SIS-08** · 33 textos de menos de 12 px. **Arreglo:** un mínimo de 12 px. _(transversal)_ — **Resuelto en local 14-09:** Los 24 textos de 10,5 a 11,5 px pasaron a 12 px, incluidas las cabeceras de tabla y los chips.
- [ ] **SIS-09** · 62 colores hexadecimales y 44 `rgba` escritos a mano, con restos del tema AJUTER. **Arreglo:** pasarlos a tokens. _(transversal)_ — **Parcial 14-09:** se quitaron `#574F4A`, `#B83232` escrito a mano, el fondo verde azulado viejo del menú (`rgba(30,45,44,…)`) y el `#EAF1F9` del login. Siguen pendientes los demás hex y `rgba` escritos a mano.
- [x] **SIS-10** · Borde lateral grueso como acento en las tarjetas de métricas y en las alertas. **Arreglo:** marcar la jerarquía de otra forma. _(transversal)_ — **Resuelto en local 14-09:** `MetricCard` ya no pone la franja lateral: solo una tarjeta roja con valor mayor que 0 lleva borde rojo. También se quitó la franja de las alertas en el Resumen y en la ficha.
- [x] **SIS-11** · El panel no tiene `h1`: el título de la barra superior es un `div`. **Arreglo:** que el título de la página sea el `h1`. _(transversal)_ — **Resuelto en local 14-09:** El título de la barra superior es el `h1`. En pantallas angostas hay un `h1` solo para lectores de pantalla. Equipo y Configuración pasaron su título de página a `h2`.
- [x] **SIS-12** · El aviso emergente (toast) no se anuncia y se sale de la pantalla en el teléfono. **Arreglo:** `role="status"` y que el texto pueda partirse en líneas. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** Ahora tiene `role="status"` y `aria-live`, y un ancho máximo que deja que el texto pase a otra línea.
- [x] **SHL-02** · "Cerrar sesión" usa el ícono de salvavidas. **Arreglo:** ícono de salida y 13 px como mínimo. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** Usa el ícono `log-out` (agregado a `WIcon`), a 13 px.
- [ ] **SHL-03** · El logo de AJUTER se carga desde ajuter.org. **Arreglo:** guardarlo como imagen del repo. _(HdU04 · Eduardo Pacheco)_
- [x] **SHL-04** · "Alertas de pánico", cuando está activa, se parte en dos líneas en la barra lateral. **Arreglo:** que la negrita no cambie el ancho, o una etiqueta más corta. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** La etiqueta va en una sola línea y se recorta si no cabe (`nowrap` + `ellipsis`).
- [x] **RES-03** · Punto rojo que late aunque haya 0 alertas. **Arreglo:** mostrarlo solo si hay alertas activas. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** `MetricCard` solo hace latir el punto cuando el valor es mayor que 0.
- [x] **RES-04** · El reporte PDF viene con fechas de mayo de 2026 y un ícono que no existe. **Arreglo:** proponer los últimos 30 días; usar un ícono del mapa. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** El reporte propone los últimos 30 días, en fecha local. El ícono `loader` se agregó al mapa de `WIcon` y ahora gira.
- [x] **RES-05** · "Registrar recaída" usa el rojo del pánico. **Arreglo:** un botón neutro con confirmación. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** El botón y la confirmación son neutros (`--fg1` y `--primary`).
- [x] **ALE-03** · En la tabla de Alertas, la fecha queda cortada a 1440 px. **Arreglo:** una columna más ancha o un formato de fecha más corto. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** Sin las columnas Tipo y Ver, la fecha tiene 180 px y el estado 210 px.
- [x] **SOL-02** · "Ignorar" un post reportado solo lo esconde hasta recargar. **Arreglo:** guardarlo en el backend o decir que es temporal. _(HdU05 · Catalina Yáñez)_ — **Resuelto en local 14-09:** El botón ahora dice «Ocultar», y una nota explica que el post vuelve a aparecer al recargar y que no cambia nada en la comunidad.
- [x] **SOL-03** · Los motivos de rechazo son botones que se comportan como opciones únicas, sin rol. **Arreglo:** `role="radiogroup"`/`radio`. _(HdU06 · Matías Lara)_ — **Resuelto en local 14-09:** Se resolvió al quitar los motivos (ver SOL-01).
- [x] **FAM-02** · Verde claro como texto ("Asistiré") y texto blanco sobre verde en el calendario; todos los interruptores tienen el mismo nombre. **Arreglo:** el token de texto verde y el nombre de la sesión en el `aria-label`. _(HdU11 · Alex Domínguez)_ — **Resuelto en local 14-09:** "Asistiré" y los íconos van en `--secondary-text`. Los días confirmados del calendario llevan texto oscuro sobre el verde. Cada interruptor se llama "Confirmar asistencia: {sesión}".
- [x] **ING-02** · El panel de marca del login le habla solo al equipo clínico, aunque también entran familiares. **Arreglo:** un texto que sirva para los dos. _(auth · José Meza)_ — **Resuelto en local 14-09:** El panel de marca dice «Panel StopBet · Para el equipo clínico de AJUTER y las familias que acompañan el tratamiento», y la lista incluye las sesiones de familiares.
- [x] **ING-03** · El aviso de "sesión expirada" va en posición absoluta y en el teléfono tapa la cabecera. **Arreglo:** que ocupe su lugar en el flujo de la página. _(auth · José Meza)_ — **Resuelto en local 14-09:** El aviso ahora forma parte del flujo, antes de la tarjeta, en vez de ir en posición absoluta.
- [x] **CON-02** · Los interruptores de Configuración no dicen su estado a los lectores de pantalla. **Arreglo:** `role="switch"` y `aria-checked`. _(sin dueño)_ — **Resuelto en local 14-09:** Se resolvió al quitar los interruptores que no guardaban (ver CON-01).

### P3 · pulido (5)

- [ ] **SIS-13** · Inter y Nunito, que son solo fuentes de respaldo, se cargan siempre. **Arreglo:** evaluar si hace falta cargarlas. _(transversal)_
- [x] **SHL-05** · `icons.css` sigue importado aunque ya nadie lo usa. **Arreglo:** borrarlo. _(transversal)_ — **Resuelto en local 14-09:** Se quitó el import en `index.css`: ningún componente usa las clases `.ico` (comprobado con un grep estricto). El archivo `styles/icons.css` sigue en el repo y se puede borrar.
- [x] **RES-06** · Flecha de tendencia en "Pacientes activos" sin ningún dato de tendencia detrás. **Arreglo:** quitarla. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** La tarjeta dice solo «en tu sede».
- [x] **ALE-04** · La columna "Tipo" repite "Botón de pánico" en todas las filas. **Arreglo:** quitar la columna. _(HdU04 · Eduardo Pacheco)_ — **Resuelto en local 14-09:** Se quitó la columna, tanto en la tabla como en la tarjeta del teléfono.
- [x] **ING-04** · La ilustración del login queda cortada en el borde (el hito 90). **Arreglo:** ajustar el recorte. _(auth · José Meza)_ — **Resuelto en local 14-09:** El contenedor pasó de `right: -60` a `-10`: el hito 90 se ve completo.

## Detalle por pantalla

### Toda la web (`SIS`)

Dueño: cada dueño en su pantalla.

#### [P1] SIS-01 · Textos sin contraste suficiente

- **Dónde:** 225 nodos marcados por axe, en todas las páginas. Los orígenes son pocos:
  - `--sage-500` (`#97b23f`) como texto: 2,40:1 sobre blanco. Aparece en "Normal", "Resuelto manualmente", "Activo", "Asistiré" y "Pagado".
  - `--accent`/`--gold` (`#93bce5`) como texto: 1,99:1. Son los números de las tarjetas "Solicitudes" y "Promedio abstinencia", el contador de Solicitudes y sus iniciales, y "Pendiente".
  - Chips de sede, `--primary` sobre `--teal-50`: 4,47:1.
  - Texto blanco al 70 % y al 55 % sobre azul en la barra lateral: 3,38:1 y 2,68:1.
  - Texto blanco sobre `#97b23f`: 2,40:1. Es el avatar de la barra superior y los días confirmados del calendario.
  - Estado deshabilitado de la paginación: 1,31:1 y 1,98:1.
- **Qué pasa:** justo lo que más se mira (cuántas solicitudes hay, el estado del paciente) es lo que menos se lee.
- **Qué arreglar:** nuevo token `--secondary-text: #5B7324` (5,35:1 sobre blanco) para el texto verde. `--primary` donde hoy va `--accent` como texto. Chips con `--primary-hover` (`#2d5a9e`). Texto blanco al 90 % como mínimo sobre azul. **Ningún color del manual cambia.**

#### [P1] SIS-02 · Controles sin nombre accesible

- **Dónde:**
  - Botones: los 25 que marca axe, por ejemplo el `···` de cada fila del Resumen, la X de la ficha y de los modales, la paginación y la campana.
  - Selectores: filtro de sede y filtros de Finanzas.
  - Campos: las fechas del reporte y la pestaña Editar.
  - Etiquetas: las de los modales de Solicitudes y Equipo son `<label>` sin `htmlFor`.
- **Qué pasa:** un lector de pantalla anuncia "botón" y nada más, o "cuadro combinado" sin decir de qué.
- **Qué arreglar:** `aria-label` en los botones de ícono y asociar cada `label` a su campo.

#### [P1] SIS-03 · Foco invisible

- **Dónde:** 15 `outline: 'none'`: los campos del login, el buscador, los selectores y los campos de los modales. En toda la web no hay ni una regla `:focus-visible`.
- **Qué pasa:** navegando con teclado, el foco se pierde justo en los campos de texto. Medido en el login: en 2 de 7 pasos de tabulación no se ve dónde está el foco.
- **Qué arreglar:** una regla global `:focus-visible` con anillo azul de marca en `index.css`, y quitar los `outline: 'none'` que no tienen reemplazo.

#### [P1] SIS-04 · Modales sin semántica de diálogo

- **Dónde:** la ficha del paciente (`OverviewPage.tsx:163-174`), aprobar, rechazar, eliminar publicación, crear psicólogo, desactivar, editar sedes y el cajón del menú en el teléfono.
- **Qué pasa:**
  - no tienen `role="dialog"` ni `aria-modal`;
  - no se cierran con Escape;
  - el foco se queda detrás, en la página.

  Equipo ya resolvió el cierre por el fondo con un botón (`EquipoPage.tsx:19-23`); el resto no.
- **Qué arreglar:** un componente de diálogo común con esos cuatro requisitos.

#### [P1] SIS-05 · Filas clicables sin teclado

- **Dónde:** `OverviewPage.tsx:445` (`<tr onClick>` abre la ficha) · Alertas y Finanzas tienen `cursor: pointer` en filas que no hacen nada.
- **Qué arreglar:** que "Ver perfil" sea un botón real dentro de la fila, y quitar el cursor de mano donde no hay acción.

#### [P1] SIS-06 · Controles que no hacen nada

- **Dónde:**
  - **Resumen:** "Exportar lista", `···` de cada fila, la paginación ("Mostrando 1–7 de 7" y flechas sin acción) y "Ver historial completo". Además, "Ver sesión" en realidad abre la ficha.
  - **Ficha:** "Guardar cambios".
  - **Alertas:** "Exportar", "Ver" y "Atender".
  - **Finanzas:** "Exportar", "Ver", "Ver historial completo" y "Exportar PDF".
  - **Configuración:** "Guardar cambios" y "Cambiar foto".
  - **Barra superior:** la campana.
  - **Navegación:** "Mis pacientes" y "Reportes" llevan a "Sección en construcción".
- **Qué pasa:** en una herramienta clínica, un botón que no responde se lee como un fallo del sistema. Justo cuando hay apuro, el profesional pierde tiempo reintentando.
- **Qué arreglar:** según el caso:
  - **conectar lo que ya tiene backend:** "Ver historial completo" → `/alertas`, y "Ver" en Alertas → la ficha del paciente;
  - **ocultar** lo que no lo tiene;
  - **marcar como "Próximamente"** las secciones de navegación.

#### [P2] SIS-07 · Animaciones con rebote y sin reducir movimiento

- **Dónde:** `cubic-bezier(0.34,1.56,0.64,1)` en el aviso emergente y en 4 modales. `prefers-reduced-motion` no aparece ni una vez.
- **Qué arreglar:** una curva de desaceleración suave (`--ease-calm`, que ya existe) y un bloque de `prefers-reduced-motion` en `index.css`.

#### [P2] SIS-08 · Textos de menos de 12 px

- **Dónde:** 33 casos de 10,5 a 11,5 px: el rol del usuario en la barra lateral, "Para" junto al logo de AJUTER, las fechas de las listas y los chips.

#### [P2] SIS-09 · Colores fuera de los tokens

- **Dónde:** 62 hex y 44 `rgba` escritos a mano. Algunos son restos del tema anterior:
  - `#574F4A` en los íconos del login (la tinta de AJUTER);
  - `rgba(30,45,44,…)` en el fondo del menú en el teléfono (el verde azulado viejo);
  - `#B83232` repetido en lugar de `var(--danger)`.

#### [P2] SIS-10 · Borde lateral grueso como acento

- **Dónde:** `components/MetricCard.tsx:42`: las 4 tarjetas de cada página llevan `important` y con eso un borde izquierdo de 4 px. También las alertas del Resumen y de la ficha (`OverviewPage.tsx:290`, `:520`) y "Próximos cobros".
- **Qué pasa:** cuando todas las tarjetas son importantes, ninguna lo es. El detector de impeccable lo marca como patrón genérico.
- **Qué arreglar:** reservar el acento para lo que de verdad pide atención, por ejemplo las alertas activas, y marcarlo con fondo o con un ícono en vez de una franja.

#### [P2] SIS-11 · Jerarquía de títulos

- **Dónde:** `components/TopBar.tsx:16`: el título es un `div`. Salvo Equipo y Configuración, las páginas empiezan en `h2`.

#### [P2] SIS-12 · Aviso emergente mudo

- **Dónde:** `DashboardApp.tsx:207-222`: no tiene `role="status"` y lleva `whiteSpace: nowrap`. En el teléfono, "Solicitud rechazada. Se notificó al solicitante." se sale por los lados.

#### [P3] SIS-13 · Fuentes de respaldo siempre cargadas

- **Dónde:** `styles/colors_and_type.css:9-38`: Nunito e Inter se declaran como `@font-face`. Solo se usan si falla Chillax/Satoshi. El detector lo marca como "fuente sobreusada"; con Satoshi como fuente principal, es un falso positivo.

### Marco de la app: barra lateral y superior (`SHL`)

Dueño: HdU04 · Eduardo Pacheco (`DashboardApp.tsx`, `Sidebar.tsx`, `TopBar.tsx`).

#### [P1] SHL-01 · Datos inventados en el marco

- **Dónde:** `TopBar.tsx:21-34` (campana con "3") · `:37-42` (avatar "MG", aunque el usuario es Miguel Ángel Lara, con fondo verde y texto blanco a 2,40:1) · `Sidebar.tsx:94-96` (contador "3" en Alertas de pánico).
- **Qué pasa:** estos contadores se ven en todas las pantallas. Un "3" rojo permanente enseña a ignorar el rojo, justo el color que se reserva para las crisis.
- **Qué arreglar:**
  - el contador de la barra lateral debe salir de las alertas activas (`pending` + `escalated`);
  - la campana, quitarla hasta que exista un centro de notificaciones;
  - el avatar, con las iniciales reales o fuera, porque la barra lateral ya muestra al usuario.

#### [P2] SHL-02 · "Cerrar sesión" con salvavidas

- **Dónde:** `Sidebar.tsx:131`: usa `life-buoy`, que evoca ayuda y crisis, en 12,5 px.

#### [P2] SHL-03 · Logo de AJUTER desde un sitio externo

- **Dónde:** `Sidebar.tsx:141`: `https://ajuter.org/wp-content/uploads/…`.
- **Qué pasa:** si el sitio cambia o se cae, el panel pierde el logo. Además, cada carga del panel queda registrada en un servidor de terceros.

#### [P2] SHL-04 · El ítem activo se parte en dos líneas

- **Dónde:** `Sidebar.tsx:85`: la negrita del ítem activo ensancha "Alertas de pánico" y el contador lo empuja a una segunda línea (se ve en la captura de Alertas a 1440 px).

#### [P3] SHL-05 · `icons.css` sin uso

- **Dónde:** `index.css:5`: importa 43 clases `.ico-*` que ningún componente usa (lo dice la propia skill del proyecto).

### Resumen (`RES`) y ficha del paciente (`FIC`)

Dueño: HdU04 · Eduardo Pacheco (`pages/OverviewPage.tsx`, `components/MetricCard.tsx`).

#### [P1] RES-01 · Ancho mínimo que obliga a desplazarse de lado

- **Dónde:** `OverviewPage.tsx:712` (`minWidth: 1180`) · `AlertasPage.tsx:113` y `FinanzasPage.tsx:45` (1100) · `ConfiguracionPage.tsx:177` (820).
- **Qué pasa:** con una ventana de 1280 px, al restar los 240 px de la barra lateral quedan 1040. Medido: el contenido se desborda 140 px en Resumen y 60 px en Alertas y en Finanzas. En un notebook de 1366 px pasa lo mismo.
- **Qué arreglar:** quitar los `minWidth`. La cuadrícula ya usa `minmax(0, …)` y se adapta sola.

#### [P1] RES-02 · "Alertas hoy" usa el día UTC

- **Dónde:** `OverviewPage.tsx:680` (`new Date().toISOString().slice(0, 10)`).
- **Qué pasa:** en Chile, desde las 20:00–21:00, el día UTC ya es mañana y la tarjeta marca 0. **Verificado:** a las 22:31 del 14-09, una alerta de las 18:41 de ese mismo día no se contaba.
- **Qué arreglar:** comparar fechas locales (`toLocaleDateString` o año/mes/día locales).

#### [P1] FIC-01 · "Editar" que no guarda

- **Dónde:** `OverviewPage.tsx:320-331`: nombre, correo y sede se pueden editar, pero "Guardar cambios" no llama a nada.
- **Qué pasa:** el psicólogo cree que corrigió el correo de un paciente y no quedó guardado.

#### [P1] FIC-02 · "Sesiones IA" siempre vacía

- **Dónde:** `OverviewPage.tsx:94` (`sessions: []`) · `:306-318`.
- **Qué pasa:** dice "Este paciente aún no ha usado el asistente virtual" aunque sí lo haya usado; `docs/demo-sprint1.md` ya lo registra con Carlos. Es información clínica falsa.
- **Qué arreglar:** mostrar los resúmenes de sesión (ánimo, técnica y riesgo; nunca la conversación, que el paciente sabe privada), o reemplazar el texto por "Esta información todavía no está disponible en el panel".

#### [P2] RES-03 · Alarma que late con 0

- **Dónde:** `MetricCard.tsx:59-61`: con `tone="red"`, el punto late siempre, incluso con valor 0 ("Alertas hoy" y "Total alertas").

#### [P2] RES-04 · Reporte con fechas viejas

- **Dónde:** `OverviewPage.tsx:550-551`: las fechas vienen fijas del 01-05 al 29-05-2026. En `:621`, `WIcon name="loader"` no existe en el mapa y deja un hueco mientras se genera el PDF.

#### [P2] RES-05 · "Registrar recaída" en rojo de pánico

- **Dónde:** `OverviewPage.tsx:274-280` · `:266-271`: botón con contorno rojo y confirmación en rojo relleno.
- **Qué pasa:** la regla clínica del proyecto reserva el rojo para el pánico. Una recaída es una acción delicada, pero no una emergencia.

#### [P3] RES-06 · Flecha de tendencia sin tendencia

- **Dónde:** `OverviewPage.tsx:723`: "↗ activos · total en mi sede". No hay ningún dato que compare contra un período anterior.

### Alertas de pánico (`ALE`)

Dueño: HdU04 · Eduardo Pacheco (`pages/AlertasPage.tsx`), con los datos de HdU01.

- **ALE-01 [P0]:** ver "Lo que hay que arreglar primero".

#### [P1] ALE-02 · Métrica y protocolo inventados

- **Dónde:**
  - `AlertasPage.tsx:122`: "Tiempo prom. respuesta 8m" es un valor fijo.
  - `:318-339`: el protocolo marca siempre los pasos 1 y 2 como hechos y promete "Si no hay respuesta en 30 minutos, se llama al contacto de emergencia". El backend escala al padrino a los 120 s y no hace ninguna llamada.
- **Qué arreglar:** métricas calculadas a partir del historial real. El protocolo, como texto informativo sin estados, y con lo que el sistema de verdad hace.

#### [P2] ALE-03 · Fecha cortada

- **Dónde:** `AlertasPage.tsx:197`: la columna de 148 px corta "14-09-2026, 06:41 p. m.".

#### [P3] ALE-04 · Columna "Tipo" que no informa

- **Dónde:** `AlertasPage.tsx:94`: el tipo siempre es "Botón de pánico".

### Solicitudes y moderación (`SOL`)

Dueños: registro HdU06 · Matías Lara; posts reportados HdU05 · Catalina Yáñez (`pages/SolicitudesPage.tsx`).

#### [P1] SOL-01 · Formularios que descartan lo que se escribe

- **Dónde:**
  - `SolicitudesPage.tsx:18-23`: "Padrino de seguimiento" sale de una lista de ejemplo (`PADRINOS`) y la fecha de inicio viene fija en `2026-06-10`.
  - `:124`: al confirmar solo se envía el psicólogo, no las "Notas clínicas".
  - `:177`: rechazar no envía el motivo ni el mensaje.
  - `:170` y `:413` prometen "se iniciará el reembolso automáticamente" y "notifican automáticamente al solicitante".
  - `DashboardApp.tsx:111`: el arancel "$30.000" está escrito a mano.
- **Qué pasa:** el profesional escribe notas clínicas que se pierden, y el sistema promete acciones que no ocurren.
- **Qué arreglar:** enviar lo que el backend acepte y quitar lo demás, o marcarlo como "no se guarda todavía". Las promesas se dejan solo si el backend las cumple.

#### [P2] SOL-02 · "Ignorar" temporal

- **Dónde:** `SolicitudesPage.tsx:233,307`: el estado vive en memoria. Al recargar, el post reportado vuelve a aparecer.

#### [P2] SOL-03 · Motivos de rechazo sin rol

- **Dónde:** `SolicitudesPage.tsx:156-164`: se ven como opciones de selección única pero son botones sueltos, sin `role="radio"`.

### Equipo (`EQU`)

Dueño: HU-24.

No hay hallazgos propios más allá de los transversales (SIS-01, 02 y 04). Es la página mejor resuelta del panel: tiene estados de carga, error con "Reintentar" y vacío; filtra los destinos según la sede; y el fondo de sus modales es un botón accesible. Sirve de modelo para las demás.

### Finanzas (`FIN`) y Configuración (`CON`)

Sin dueño en el Sprint 1. `CLAUDE.md` ya las anota como deuda ("conectar a la API").

#### [P1] FIN-01 · Datos de ejemplo sin aviso

- **Dónde:** `FinanzasPage.tsx:4`: todo sale de `mockData`. Hay textos como "+12% vs. mes anterior" y "vencen antes del 30 jun", y cuatro botones sin efecto.
- **Qué arreglar:** mientras no haya API, un aviso fijo arriba ("Datos de ejemplo: esta sección todavía no está conectada") y quitar los botones.

#### [P1] CON-01 · Perfil de otra persona

- **Dónde:** `ConfiguracionPage.tsx:82-121`: "Dra. González", `m.gonzalez@ajuter.cl`, RUT `15.234.789-K` y "MG". Los interruptores de notificaciones son solo locales y "Guardar cambios" y "Cambiar foto" no hacen nada.
- **Qué arreglar:** llenar el perfil con el usuario de la sesión, de solo lectura, y marcar como "Próximamente" lo que todavía no se guarda.

#### [P2] CON-02 · Interruptores mudos

- **Dónde:** `ConfiguracionPage.tsx:65`: son botones sin `role="switch"` ni `aria-checked`.

### Portal y sesiones de familiares (`FAM`)

Dueño: HdU11 · Alex Domínguez (`pages/familiar/*`, `pages/SesionesFamiliaresPage.tsx`).

Es la parte mejor cuidada de la web:
- los estados de vínculo pendiente o sin vínculo están explicados;
- el interruptor tiene tres estados, con `aria-checked="mixed"` para "sin responder";
- el calendario tiene `caption` y los días llevan `abbr`;
- la respuesta se ve al instante (actualización optimista).

#### [P1] FAM-01 · Saludo sobre el tramo claro del degradado

- **Dónde:** `pages/familiar/FamiliarPortal.tsx:25`: el `--ajuter-gradient` va de `#93bce5` a `#2d5a9e` de izquierda a derecha, y "Hola, Patricia" queda justo sobre el azul claro (blanco sobre `#93bce5`: 1,99:1).
- **Qué arreglar:** invertir el degradado para que el texto quede sobre el tramo oscuro, o usar el azul principal sólido. No se cambia ningún color de la marca.

#### [P2] FAM-02 · Verde como texto y un mismo nombre para todos los interruptores

- **Dónde:**
  - `SessionCard.tsx:40`: "Asistiré" va en `--secondary` (2,40:1).
  - `SessionCalendar.tsx:199-209`: los días confirmados llevan texto blanco sobre verde.
  - `SessionCard.tsx:52`: todos los interruptores se llaman "Confirmar asistencia a la sesión", sin decir cuál.

### Login (`ING`)

Dueño: auth · José Meza (`pages/LoginPage.tsx`).

#### [P1] ING-01 · "¿Olvidaste tu contraseña?" sin destino

- **Dónde:** `LoginPage.tsx:321`: `href="#"`. En mobile pasa lo mismo (ACC-01 de la auditoría mobile).

#### [P2] ING-02 · Texto solo para el equipo clínico

- **Dónde:** `LoginPage.tsx:152-185`: "Panel clínico · Gestiona el progreso de tus pacientes". Los familiares entran por la misma puerta y leen una promesa que no es para ellos.

#### [P2] ING-03 · El aviso de sesión expirada tapa la cabecera en el teléfono

- **Dónde:** `LoginPage.tsx:231-236`: `position: absolute; top: 28`. En angosto se superpone a la cabecera con el logo. Se detectó en el código; no se reprodujo.

#### [P3] ING-04 · Ilustración cortada

- **Dónde:** `LoginPage.tsx:189-194`: el hito "90" queda cortado por el borde del panel en 1440 px.

## Lo que está bien

Conviene conservarlo y copiarlo:

- **Tokens semánticos con un tema que se redefine en un solo archivo** (`stopbet-theme.css`): cambiar la paleta no obliga a tocar las páginas.
- **Responsive pensado:** bajo 860 px, cada tabla se convierte en tarjetas con los mismos datos, en vez de forzar un desplazamiento lateral.
- **Comentarios que explican el porqué** de cada decisión rara. Hacen que el código se pueda mantener.
- **Equipo y el portal del familiar** tienen estados completos (carga, error con reintento, vacío) y ARIA usada con criterio.
- **El login distingue un error de red de uno de credenciales.** Así nadie reintenta a ciegas.

## Orden propuesto de arreglos

1. **ALE-01 (P0):** los estados de alerta. Se aprovecha para arreglar también RES-02 y el contador real de SHL-01.
2. **Integridad (P1):** datos inventados y controles sin efecto (SHL-01, SIS-06, FIC-01, FIC-02, ALE-02, SOL-01, CON-01, FIN-01, ING-01). Cada cosa se conecta, se oculta o se marca como "Próximamente".
3. **Accesibilidad transversal (P1):** contraste (SIS-01, FAM-01), nombres (SIS-02), foco (SIS-03), diálogos (SIS-04) y filas (SIS-05).
4. **Notebook (P1):** RES-01.
5. **P2 y P3** por pantalla.

## Cómo se midió

- **Capturas y métricas:** los scripts de Playwright y de axe-core se corrieron desde una carpeta temporal, fuera del repo, y no se agregaron dependencias al proyecto.
- **Cuentas del seed:**
  - `miguel.lara@ajuter.cl` (psicólogo);
  - `sofia.reyes@ajuter.cl` (coordinadora);
  - `patricia.gomez@stopbet.cl` (familiar).
- **Desborde horizontal:** diferencia entre `scrollWidth` y `clientWidth` del `<main>` en cada ancho.
- **Contraste:** fórmula WCAG 2.1, calculada para cada par de colores citado.
