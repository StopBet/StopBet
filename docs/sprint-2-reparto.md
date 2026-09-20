# Reparto Sprint 2

> Divide las historias de `docs/Sprint 2.md` en 6 pistas de trabajo, una por integrante, para
> que cada quien pueda avanzar en su propia rama sin chocar con las de los demás. No reemplaza
> las historias ni sus criterios de aceptación — léelas ahí antes de partir tu pista.

## Cómo se armó

Cada pista vive en un módulo del backend distinto (o en mobile / investigación pura), así que
dos personas casi nunca van a tocar el mismo archivo. Las dos parejas de historias (20+21 y
22+23) quedan con la misma persona justo porque comparten módulo: repartirlas entre dos personas
distintas generaría conflictos de merge en los mismos archivos.

La asignación por nombre sigue, en la medida de lo posible, quién ya tiene puesto el módulo
correspondiente según el historial de PRs y `docs/avisos-al-equipo.md` — así cada quien parte
sobre terreno conocido en vez de leer código ajeno desde cero. La excepción es José, que pidió
directamente la pista con más carga real (Familiar): se la quedó él y Ficha Clínica pasó a Alex,
que igual tenía buen calce por su trabajo previo en vistas de paciente. No salió perfectamente
parejo (ver el aviso sobre Eduardo más abajo), pero se acerca.

## Resumen

| Integrante | Historias | Talla | Por qué esta pista |
|---|---|---|---|
| **José Meza** | HDU 22 + HDU 23 — Familiar (registro y vinculación) | Media-grande (la de más carga real) | 2 historias, 12 criterios combinados, y de `family` solo existe la parte más liviana (`requestLink`/`getLinkStatus`) — autoasignada |
| **Matías Lara** | HDU 19 — Solicitudes de Ingreso + SPIKE 2 CA5-CA6 (pasarela de pago) | Media + Media | Dueño de `registration`; ya integró una API externa de pago... digo, de correo (Brevo) |
| **Matías Barraza** | HDU 20 + HDU 21 — Padrino (asignación y designación) | Media-grande | Dueño del módulo `panic`, donde ya vive la asignación de padrino |
| **Alex Domínguez** | HDU 13 — Ficha Clínica | Grande | Ya hizo el panel web de resumen y la vista del psicólogo en mobile; buen calce para la ficha del paciente |
| **Catalina Yáñez** | HDU 03 — Logros (deseable) + SPIKE 2 CA7 (manual de usuario) | Pequeña + Media | Dueña de Comunidad; ya conectó insignias con anuncios automáticos |
| **Eduardo Pacheco** | SPIKE 2 CA1-CA4 — Bloqueo de sitios de apuestas en Android | Grande (investigación) | Sin módulo de este sprint como territorio propio — ver aviso abajo |

## Avisos generales

- **Sobre Eduardo:** no hay una pista que calce con su trabajo previo (dashboard de métricas
  JITAI, HU-04) tan bien como para los demás. Se le dejó el Spike de bloqueo Android porque es
  autocontenido — no depende de código de nadie más — y es del tamaño de una pista grande por sí
  sola, igual que la ficha clínica de José. Si prefiere, puede coordinar con Matías Barraza o Alex
  (los con más código mobile/Android encima) para una revisión rápida antes de dar el Spike por
  cerrado.
- **Dependencia de pagos, no bloqueo.** El SPIKE 2 dice que la decisión de pasarela de pago
  "condiciona la activación de cuentas de HdU19 y el acceso a pagos del familiar de HdU23". Los
  criterios de aceptación de este sprint para ambas historias no exigen cobrar de verdad todavía
  (HDU19 CA2 solo *notifica* que el paciente ya puede continuar con el pago), así que no frena el
  cierre del sprint. Matías Lara lleva HDU 19 y el Spike de pago, así que solo necesita avisar a
  José si el enganche con HDU 23 conviene dejarlo pensado.
- **Los módulos `billing` y `subscriptions` ya existen** en el backend (aunque `Finanzas` en el
  dashboard sigue con datos mock). El sandbox de la pasarela probablemente engancha ahí en vez de
  partir de cero — vale la pena que Matías Lara los revise antes de arrancar el Spike.
- **Archivos compartidos.** Varias pistas van a tocar `apps/backend/src/app.module.ts` (registrar
  su módulo nuevo) y las rutas del dashboard web (agregar su página). Son diffs de una línea cada
  uno, pero como caen en las mismas líneas conviene mergear a `main` seguido en vez de dejarlo
  todo para el final.
- **Una rama por historia.** Aunque alguien lleve dos historias, cada una mantiene su propia rama
  y PR (`feature/HU-13-...`, `feature/HU-19-...`, etc.), siguiendo la convención ya existente del
  proyecto.

---

## José Meza — HDU 22 + HDU 23: Familiar (registro y vinculación)

Historias completas en `docs/Sprint 2.md` (HDU 22, CA 1-6; HDU 23, CA 1-6). Es la pista con más
carga real del sprint — ver "Cómo se armó" arriba.

**Qué ya existe:** el módulo `family` ya tiene la solicitud de vínculo y la consulta de estado
(`requestLink`, `getLinkStatus`), pero eso asume que el familiar ya tiene cuenta. No existe el
alta de cuenta en sí (HDU 22) ni el lado del psicólogo para confirmar o rechazar el vínculo
(HDU 23) — hoy nadie aprueba los vínculos, solo el seed de datos de prueba los activa.

**Qué cubre:** para HDU 22 — el formulario público de registro con el RUT del paciente, sin
filtrar si el RUT existe o no, bloqueando duplicados de correo/RUT y sin duplicar solicitudes
pendientes. Para HDU 23 — la sección del dashboard con los familiares pendientes de la sede,
confirmar/rechazar/revocar el vínculo, y el registro de autor/fecha/veredicto para auditoría.

**Rama sugerida:** `feature/HU-22-registro-cuenta-familiar`, `feature/HU-23-vinculacion-familiar`

---

## Matías Lara — HDU 19: Solicitudes de Ingreso + SPIKE 2 CA5-CA6 (pasarela de pago)

Historia completa en `docs/Sprint 2.md` (HDU 19, CA 1-6) y SPIKE 2 (CA5, CA6).

**Qué ya existe:** el listado de pendientes y los endpoints de aprobar/rechazar ya están en
`registration` (con guards por rol y sede). Es la historia esencial más avanzada del sprint.

**Qué cubre para HDU 19:** el estado vacío cuando no hay solicitudes, que el rechazo quede
reabrible por el coordinador (CA3), y la vista del dashboard que muestra nombre/RUT/correo/fecha
de cada solicitud.

**Qué cubre del Spike:** comparar ≥3 pasarelas de pago chilenas (Webpay Oneclick, Flow, Mercado
Pago) en costo, cobro recurrente, requisitos para operar como comercio e integración con NestJS,
y dejar el sandbox de la elegida funcionando con una inscripción y 2 cobros de prueba confirmados
por el backend (revisar primero los módulos `billing`/`subscriptions` que ya existen).

**Rama sugerida:** `feature/HU-19-solicitudes-ingreso`, `feature/spike-2-pasarela-pago`

---

## Matías Barraza — HDU 20 + HDU 21: Padrino (asignación y designación)

Historias completas en `docs/Sprint 2.md` (HDU 20, CA 1-5; HDU 21, CA 1-4).

**Qué ya existe:** el endpoint de asignar padrino y de consultar el padrino de un paciente ya
están en `panic`. Falta todo el lado de designar a alguien *como* padrino — ese rol no se puede
otorgar ni revocar hoy.

**Qué cubre:** para HDU 20 — listar candidatos (solo padrinos activos de la misma sede,
excluyendo al paciente), confirmar reemplazo conservando el registro del padrino anterior, y
advertir en el perfil cuando no hay nadie asignado. Para HDU 21 — otorgar el rol según criterio
del psicólogo, listar solo pacientes activos sin el rol, bloquear la revocación si el padrino
tiene pacientes asignados, y notificar al paciente designado.

**Rama sugerida:** `feature/HU-20-asignacion-padrino`, `feature/HU-21-designacion-padrino`

---

## Alex Domínguez — HDU 13: Ficha Clínica del Paciente

Historia completa en `docs/Sprint 2.md` (HDU 13, CA 1-6).

**Qué ya existe:** nada — no hay ningún modelo de ficha clínica en el repo hoy. Es la pista más
grande del sprint porque parte de cero.

**Qué cubre:** el módulo nuevo de ficha clínica (campos obligatorios, guardado con autor/fecha,
validación de campos vacíos), el historial de versiones para auditoría, el bloqueo de acceso
cruzado entre sedes, y la integración de los detonantes registrados como contexto del asistente
IA (sin enviarle datos identificables).

**Rama sugerida:** `feature/HU-13-ficha-clinica-paciente`

---

## Catalina Yáñez — HDU 03 (deseable) + SPIKE 2 CA7 (manual de usuario)

Historia completa en `docs/Sprint 2.md` (HDU 03, CA1) y SPIKE 2 (CA7).

**Qué ya existe:** los módulos `achievements` (insignias) y `push` (notificaciones) ya existen
por separado y funcionan cada uno por su lado. Falta el enganche entre ambos.

**Qué cubre:** que otorgar una insignia dispare la notificación push aunque la app esté cerrada
(HDU 03). El manual de usuario de los 5 roles (CA7 del Spike) conviene dejarlo para el final del
sprint, cuando las demás pistas ya tengan algo andando y haya qué documentar.

**Rama sugerida:** `feature/HU-03-notificacion-logros`, `feature/spike-2-manual-usuario`

---

## Eduardo Pacheco — SPIKE 2 CA1-CA4: Bloqueo de sitios de apuestas en Android

Contexto completo en `docs/Sprint 2.md` (SPIKE 2, CA1-CA4). Requiere un dispositivo Android
físico — ver `apps/mobile/README.md` para el setup y los túneles `adb reverse`.

**Qué cubre:** comparar ≥3 mecanismos de bloqueo (VpnService solo DNS, VpnService con todo el
tráfico, DNS privado con filtrado externo) documentando permisos, si el paciente puede
desactivarlo, privacidad y política de Google Play; probar en dispositivo físico un APK que
bloquee ≥20 dominios con evidencia en video; evaluar ≥3 fuentes externas de dominios de
apuestas; y dejar documentado el alcance (carga manual vs. actualización automática, si el
bloqueo de apps queda dentro del alcance).

**Rama sugerida:** `feature/spike-2-bloqueo-android`
