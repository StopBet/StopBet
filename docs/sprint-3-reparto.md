# Reparto Sprint 3

> Divide las historias de `docs/Sprint 3.md` en 6 pistas de trabajo, una por integrante, para
> que cada quien pueda avanzar en su propia rama sin chocar con las de los demás. No reemplaza
> las historias ni sus criterios de aceptación: léelas ahí antes de partir tu pista. Cada pista
> dice **qué ya existe**, para que nadie rehaga lo que otro dejó hecho.

## Cómo se armó

Se repitió el criterio del Sprint 2. Cada pista vive en un módulo distinto, así que dos personas
casi nunca tocan el mismo archivo, y las historias que comparten módulo van con la misma persona:
**HdU15 + HdU18** (la lista de URLs y su actualización automática) y **HdU16 + HdU17** (la solicitud
del paciente y el veredicto del psicólogo, que son los dos lados del mismo flujo).

La asignación sigue a quien ya trabajó en el módulo, según el historial de PRs y
`docs/avisos-al-equipo.md`. Los puntos son los re-estimados (52 en total contra los 37 del plan,
porque el tablero exige 50 como mínimo); la razón de cada alza está en `docs/Sprint 3.md`.

Al 13-10 ningún criterio estaba completo. Desde entonces se mergearon **HdU10** (PR #162, 15-10) y
**HdU14** (PR #163, 19-10): sus pistas ya están hechas y lo que sigue ahí es revisarlas. El resto
se documenta igual dentro del Sprint 3, y la tabla de abajo dice dónde hay algo hecho y de quién es.

## Resumen

| Integrante | Historias | SP | Por qué esta pista |
|---|---|---|---|
| **José Meza** | HdU12 — Pago de mensualidad por el familiar | 8 | Hizo Webpay Oneclick (PR #149) y el módulo `family`; falta llevarlo al familiar |
| **Alex Domínguez** | HdU14 — Grupos de sesión | 8 | **Mergeada el 19-10 (PR #163)** |
| **Eduardo Pacheco** | HdU15 — Lista de URLs + HdU18 — Actualización automática | 5 + 8 = **13** | Hizo el spike de bloqueo; crea el módulo `blocking` |
| **Matías Lara** | HdU16 — Solicitud de revisión + HdU17 — Revisión de desbloqueos | 5 + 5 = **10** | Mismo flujo solicitud → veredicto que HdU19 (`registration`) |
| **Matías Barraza** | HdU10 — Memoria del asistente IA | 8 | **Mergeada el 15-10 (PR #162)** |
| **Catalina Yáñez** | HdU09 — Estado de pago (vista del psicólogo) | 5 | Página web con estados visuales y vacío; sube desde el diseño de Finanzas |

La carga no salió pareja: Eduardo lleva 13 SP, pero HdU18 depende de HdU15 y las dos comparten
módulo, y partirlas generaría conflictos. Catalina queda con la pista más liviana; si le sobra
tiempo, lo natural es que ayude a Eduardo con la página web de HdU15.

## Avisos generales

- **Pagos (HdU09 y HdU12):** siguen sin respuesta del cliente quién paga, cuándo se reactiva una
  cuenta y qué pasa con la suspensión al tercer mes (`docs/ASUNCIONES-PENDIENTES.md`, puntos 4-6). Se
  puede construir con el supuesto que dejó el Spike: el cobro automático **no reactiva** cuentas
  suspendidas. Mientras esté sin decidir, hay que dejarlo escrito en el PR.
- **HdU09 y HdU12 comparten `billing`:** Catalina lee las cuotas (y necesita que pasen a «vencida»
  solas) y José las salda. Antes de empezar, hablen de quién agrega el endpoint de listado y el
  proceso que marca vencidas, para no hacerlo dos veces.
- **`blocking` lo tocan dos pistas:** Eduardo crea el módulo (lista y sincronización) y Matías Lara
  agrega las solicitudes encima. Eduardo debería mergear el esqueleto del módulo y la entidad de
  dominios lo antes posible; Matías Lara parte con la parte móvil y con la tabla de solicitudes.
- **Archivos compartidos:** `apps/backend/src/app.module.ts` (registrar módulos y entidades) y las
  rutas del dashboard web. Agreguen al final y mergeen seguido a `main`.
- **Sin migraciones:** las tablas nuevas las sigue creando `synchronize`. Esa deuda no es de este
  sprint, pero cualquier tabla nueva debería entrar con sus índices únicos pensados desde el inicio.
- **Una rama y un PR por historia**, aunque una persona lleve dos.
- **Aviso al equipo:** cada PR que cambie un comando, una variable de entorno o una dependencia
  agrega su entrada arriba de `docs/avisos-al-equipo.md`.

---

## José Meza — HdU12: Pago de mensualidad por el familiar

Historia completa en `docs/Sprint 3.md` (HdU12, CA 1-7).

**Qué ya existe:**
- `GET /family/billing` (solo lectura) y la web del familiar (`BillingCard`, `PaymentPage`), hechos por Alex.
  El botón de pagar hoy dice «El pago en línea todavía no está disponible».
- Webpay Oneclick en sandbox (`apps/backend/src/payments/`, PR #149), pero todos los endpoints son
  solo para pacientes.
- `BillingService.settleInvoices`, que marca la cuota pagada, avisa al paciente y (solo si se pide)
  reactiva la cuenta.
- El cobro rechazado ya no toca la cuota, y una cuota pagada no se vuelve a cobrar.

**Qué cubre:** el pago del familiar (inscribir su tarjeta y cobrar las cuotas elegidas, con la
decisión de quién inscribe), la lista de todas las cuotas con las pagadas marcadas, la pantalla de
confirmación y rechazo con reintento, y el comprobante PDF.

**Rama sugerida:** `feature/HU-12-pago-mensualidad-familiar`

## Alex Domínguez — HdU14: Grupos de sesión

Historia completa en `docs/Sprint 3.md` (HdU14, CA 1-6).

**Estado:** hecha y mergeada el 19-10 (PR #163). Cubre los seis criterios: formulario de crear y
editar en el dashboard (`SessionFormDialog`), cupo y tipo pacientes/familiares, detalle con las tres
listas, pasar lista (`session_presences`), aviso a los confirmados cuando cambia algo, y que el
paciente vea y confirme la sesión en la app (`GroupSessionsScreen`). El aviso del PR está en
`docs/avisos-al-equipo.md`.

**Queda:** probarla en vivo con los datos de `seed:family` y, si sobra tiempo, ayudar a quien
vaya más atrasado (ver «Cómo se armó»).

**Rama:** `feature/HU-14-grupos-sesion-alex-dominguez` (ya mergeada)

## Eduardo Pacheco — HdU15 + HdU18: Lista de URLs bloqueadas

Historias completas en `docs/Sprint 3.md` (HdU15, CA 1-5; HdU18, CA 1-4). Es la pista con más
puntos; el módulo nace con HdU15 y HdU18 se monta encima.

**Qué ya existe:** el módulo nativo de bloqueo (tuyo, del Spike 2) con la lista fija en
`apps/mobile/android/.../blocking/DomainList.kt` (54 dominios). El diseño de la API
(`GET /blocking/domains?since=`) y las fuentes evaluadas están en
`docs/planning/spike2-bloqueo-android.md` (HaGeZi como principal y la nómina de Subtel a mano).
**No hay** módulo `blocking` en el backend, página web ni `@Cron` de dominios, y la interfaz nativa
no tiene cómo cargar dominios desde fuera.

**Qué cubre:** el módulo `blocking` (entidad con dirección, fecha y autor), la página del dashboard
para ver, agregar, eliminar y buscar, evitar duplicados, la sincronización hacia el teléfono, y para
HdU18 la tarea periódica con las fuentes, el registro de cada corrida y el reintento.

**Rama sugerida:** `feature/HU-15-lista-urls-bloqueadas`, `feature/HU-18-actualizacion-automatica-urls`

## Matías Lara — HdU16 + HdU17: Solicitudes de desbloqueo

Historias completas en `docs/Sprint 3.md` (HdU16, CA 1-4; HdU17, CA 1-5).

**Qué ya existe:** nada de estas dos historias. Sirven de modelo `registration` (HdU19: solicitud,
veredicto, `registration_reviews` inmutable) y, para el envío sin conexión, `checkInQueue` y
`reintentoEscritura` en mobile. La app ya expone `recentBlocked` desde el módulo nativo.

**Qué cubre:** la tabla de solicitudes (con su índice contra duplicados por paciente y URL), la
pantalla del paciente y su cola sin conexión, la página del psicólogo con aprobar o rechazar con
comentario, la fila de auditoría, y los avisos al psicólogo y al paciente. Aprobar quita la URL de la
lista de Eduardo: acuerden la forma de hacerlo (función del servicio, no consulta directa).

**Rama sugerida:** `feature/HU-16-solicitud-revision-url`, `feature/HU-17-revision-desbloqueos`

## Matías Barraza — HdU10: Memoria de técnicas efectivas del asistente IA

Historia completa en `docs/Sprint 3.md` (HdU10, CA 1-4).

**Estado:** hecha y mergeada el 15-10 (PR #162). Guarda el detonante y la técnica de cada
conversación, le pregunta al paciente si le ayudó, propone primero la técnica que mejor funcionó
(`technique-memory.ts`), sigue sin contexto si la base falla y agrega «Ver historial» en el chat.

**Queda un punto por confirmar:** el CA4 pide que ningún otro rol vea el historial, pero #162 le
muestra las conversaciones al equipo clínico (`GET /ai/patients/:id/summaries`). Es una decisión
con AJUTER, no un error de código; está anotada en `docs/ASUNCIONES-PENDIENTES.md` (punto 12).

**Rama:** `feature/HU-10-memoria-asistente-matias-barraza` (ya mergeada)

## Catalina Yáñez — HdU09: Estado de pago (vista del psicólogo)

Historia completa en `docs/Sprint 3.md` (HdU09, CA 1-3).

**Qué ya existe:** `apps/web/src/pages/FinanzasPage.tsx` con filtro por estado, pero con datos de
ejemplo y un aviso en pantalla que lo dice. En el backend, `BillingService.getBillingStatus` calcula
la deuda, los días de atraso y el próximo pago de **un** paciente (`GET /billing/patients/:id/status`).
**No hay** un listado de todos los pacientes con su deuda, y **nada marca las cuotas como vencidas**:
las vencidas hoy solo salen del seed.

**Qué cubre:** el endpoint que lista a los pacientes del psicólogo (solo los asignados, como
`GET /users/patients`) con deuda y vencimiento más próximo, el proceso que pasa una cuota a vencida
(coordínalo con José, ver avisos), conectar la página, el estado al día / pendiente / vencido, el
orden por días de atraso al filtrar y el estado vacío.

**Rama sugerida:** `feature/HU-09-estado-de-pago-psicologo`
