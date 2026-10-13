# Sprint 3

> Catálogo de las 8 historias del Sprint 3, con los criterios de aceptación del Plan de Proyecto
> (sección 7). Las asignaciones están en [`sprint-3-reparto.md`](sprint-3-reparto.md).
>
> **Estado del código (revisado el 13-10-2026 sobre `origin/main`).** Cada criterio lleva una
> marca: ✅ ya está hecho · 🟡 hay una parte · ⬜ no existe. Nada está completo, y aun lo que ya
> existe se documenta dentro de este sprint. Los puntos son los re-estimados; entre paréntesis,
> los del Plan de Proyecto.

**Total: 52 SP** (el plan original sumaba 37; el tablero exige un mínimo de 50). 1 SP = 6 h.
Cada historia sube solo donde el código mostró más trabajo del estimado, y la razón está bajo
su título.

---

## Estado de Pago de Pacientes (vista del Psicólogo) · Deseable - HdU09 · 5 SP (4)

> Como psicólogo de AJUTER, Quiero revisar el estado de pago de mis pacientes Para mantener un
> registro ordenado de las cuotas al día y las pendientes.

**Por qué 5:** `FinanzasPage` funciona con datos de ejemplo y no hay un endpoint que liste a
todos los pacientes con su deuda; además nada pasa una cuota de pendiente a vencida (solo el seed).

1. 🟡 Dado que el psicólogo accede a la vista de Finanzas del dashboard, cuando la página carga, entonces el sistema muestra un listado de sus pacientes con el monto adeudado, la fecha de vencimiento más próxima y un estado visual (al día / pendiente / vencido) para cada uno. _Existe la tabla con esas columnas (`apps/web/src/pages/FinanzasPage.tsx`) pero con datos inventados, y `GET /billing/patients/:id/status` entrega un paciente a la vez._
2. 🟡 Dado que el psicólogo está en la vista de Finanzas, cuando filtra por estado "vencido", entonces el sistema muestra únicamente los pacientes con al menos una cuota vencida, ordenados por días de atraso de mayor a menor. _El filtro existe; no ordena por días de atraso._
3. ⬜ Dado que el psicólogo no tiene pacientes con pagos registrados aún, cuando accede a la vista de Finanzas, entonces el sistema muestra un estado vacío explicativo en lugar de una tabla en blanco o un error.

---

## Pago de Mensualidad por el Familiar · Deseable - HdU12 · 8 SP (5)

> Como familiar de un paciente, Quiero realizar el pago de la mensualidad de AJUTER desde la
> vista web, Para gestionar la mensualidad del tratamiento sin depender del acceso del paciente
> a medios de pago.

**Por qué 8:** Webpay Oneclick existe en sandbox, pero solo para el paciente (`apps/backend/src/payments/`);
el familiar no tiene endpoint de pago, la vista no trae las cuotas ya pagadas y no hay comprobante PDF.
Quién paga y cuándo se reactiva una cuenta siguen pendientes de decisión del cliente
(`docs/ASUNCIONES-PENDIENTES.md`, puntos 4-6).

1. 🟡 Dado que el familiar inició sesión en la vista web y está vinculado a un paciente, cuando accede a la sección "Pagos", entonces el sistema muestra en menos de 5 segundos el estado de cuenta del paciente, indicando para cada cuota: el mes correspondiente, el monto, la fecha de vencimiento y su estado (al día, pendiente o vencida). _`GET /family/billing` solo devuelve las vencidas y la próxima; no hay lista completa ni medición de tiempo._
2. 🟡 Dado que el paciente vinculado tiene al menos una cuota con estado "vencida", cuando el familiar selecciona las cuotas que desea pagar y confirma el pago con un método válido, entonces el sistema marca esas cuotas como pagadas, reactiva la cuenta del paciente si estaba suspendida y notifica al paciente en la app móvil que su mensualidad fue pagada. _`BillingService.settleInvoices` ya hace las tres cosas, pero ningún endpoint del familiar lo usa._
3. 🟡 Dado que el familiar quiere adelantar el pago de la próxima cuota que aún no ha vencido, cuando la selecciona y completa el pago, entonces el sistema la marca como pagada, actualiza la fecha del próximo cobro y muestra una confirmación con el detalle de lo pagado. _El botón existe en `BillingCard`; lleva a un pago simulado._
4. ⬜ Dado que el familiar intenta pagar una cuota que ya fue pagada previamente (por el paciente u otro familiar), cuando accede a la sección de pagos, entonces esa cuota aparece marcada como "Pagada" con la fecha en que se realizó el pago, y el sistema no permite seleccionarla para un nuevo pago. _El backend ya rechaza volver a pagarla._
5. 🟡 Dado que el método de pago ingresado por el familiar es rechazado por el servicio de pago, cuando intenta confirmar la operación, entonces el sistema muestra un mensaje indicando que se rechazó el pago, sin modificar el estado de cuenta del paciente, y le permite reintentar con otro método. _Un cobro rechazado ya no toca la cuota (payments); falta la pantalla._
6. ⬜ Dado que el familiar completó un pago exitosamente, cuando el sistema lo registra, entonces muestra una pantalla de confirmación con el resumen del pago (monto total, cuotas pagadas, fecha y hora) y ofrece la opción de descargar un comprobante en formato PDF.
7. 🟡 Dado que el paciente vinculado no tiene cuotas pendientes ni vencidas, cuando el familiar accede a la sección "Pagos", entonces el sistema muestra el mensaje "Todas las cuotas están al día" junto con la fecha del próximo cobro programado. _Hoy dice «Al día» / «No hay cuotas por pagar»._

---

## Gestión de Grupos de Sesión · Deseable - HdU14 · 8 SP (5)

> Como psicólogo de AJUTER, Quiero gestionar los grupos de sesión (crear, editar, ver
> asistentes), Para organizar las sesiones grupales y llevar control de participación.

**Detalle:** el psicólogo puede crear sesiones grupales asociadas a una sede, definir fecha, hora,
cupo y tipo (pacientes o familiares). Las de tipo "pacientes" las ven solo los pacientes de esa sede
desde la app; las de tipo "familiares" las ven los pacientes (app) y sus familiares vinculados (web).
Después de la sesión, el psicólogo registra quién asistió realmente.

**Por qué 8:** existen las sesiones de familiares de HdU11 (crear por API y ver confirmaciones),
pero faltan editar, el tipo pacientes/familiares, la asistencia real, los avisos y el formulario.

1. 🟡 Dado que el psicólogo se encuentra en la sección de sesiones del dashboard y no tiene una sesión grupal para una fecha específica, cuando completa los datos requeridos (nombre del grupo, sede, fecha, hora, cupo máximo, tipo de sesión, etc.) y presiona "Crear sesión", entonces el sistema registra la sesión y la muestra en el listado de sesiones programadas de esa sede. _Solo existe `POST /family/sessions`, sin formulario ni tipo._
2. ⬜ Dado que existe una sesión grupal programada con fecha futura y algunos pacientes ya confirmaron asistencia, cuando el psicólogo modifica algún dato de esa sesión (fecha, hora o cupo) y guarda los cambios, entonces el sistema actualiza la información y notifica a los pacientes que ya habían confirmado asistencia sobre la modificación realizada.
3. 🟡 Dado que existe una sesión grupal programada con personas invitadas, cuando el psicólogo accede al detalle de esa sesión, entonces el sistema muestra tres listas separadas: quienes confirmaron asistencia, quienes indicaron que no asistirán y quienes aún no han respondido. En sesiones de tipo "familiar", las listas incluyen tanto a los pacientes como a sus familiares vinculados. _La web muestra las confirmaciones de familiares; faltan las tres listas y los pacientes._
4. ⬜ Dado que una sesión grupal ya ocurrió (la fecha y hora programadas ya pasaron), cuando el psicólogo accede al detalle de esa sesión, entonces el sistema le permite marcar a cada participante como "asistió" o "no asistió" y guarda ese registro. En sesiones de tipo "familiar", el registro incluye tanto a los pacientes como a sus familiares vinculados.
5. ✅ Dado que la sede del psicólogo no tiene sesiones grupales programadas en el futuro, cuando accede a la sección de sesiones de esa sede, entonces el sistema muestra un mensaje indicando que no hay sesiones próximas y un botón para crear una nueva. _El mensaje existe («Sin sesiones agendadas»); el botón depende del formulario del CA1._
6. ⬜ Dado que el psicólogo crea una sesión grupal de tipo "familiar", cuando la sesión queda registrada, entonces los pacientes la ven en su listado de sesiones de la app móvil y los familiares vinculados la ven en su vista web, ya que ambos participan en la sesión. Las sesiones de tipo "pacientes" no son visibles para los familiares.

---

## Gestión de Lista de URLs Bloqueadas · Deseable - HdU15 · 5 SP (2)

> Como psicólogo de AJUTER, Quiero gestionar la lista de URLs bloqueadas (ver, agregar y
> eliminar URLs), Para mantener actualizado el filtrado de enlaces bloqueados de mis pacientes
> según nuevas plataformas de riesgo.

**Detalle:** el psicólogo ve la lista completa de sitios bloqueados para los pacientes de AJUTER,
agrega plataformas de riesgo emergentes y elimina las que ya no representen un peligro. Cada cambio
se propaga a los dispositivos con protección activa.

**Por qué 5:** hay que crear el módulo `blocking` desde cero (backend, página web y sincronización
con el módulo nativo). Hoy la lista está fija en el teléfono (`DomainList.kt`).

1. ⬜ Dado que el psicólogo se encuentra en el dashboard, cuando accede a la sección de sitios bloqueados, entonces el sistema muestra la lista de todos los sitios de apuestas actualmente bloqueados, indicando para cada uno su dirección, la fecha en que fue agregado y quién lo agregó.
2. ⬜ Dado que el psicólogo identificó un nuevo sitio de apuestas que debe ser bloqueado y este no se encuentra en la lista actual, cuando ingresa la dirección del sitio y confirma la acción, entonces el sistema lo agrega a la lista y lo propaga a los dispositivos de los pacientes que tengan la protección activa.
3. ⬜ Dado que un sitio se encuentra en la lista de bloqueados y el psicólogo determina que ya no debe estar bloqueado, cuando selecciona ese sitio y confirma su eliminación, entonces el sistema lo remueve de la lista y los dispositivos de los pacientes dejan de bloquearlo en la siguiente sincronización.
4. ⬜ Dado que el psicólogo intenta agregar un sitio que ya se encuentra en la lista de bloqueados, cuando confirma el ingreso, entonces el sistema le muestra un mensaje indicando que ese sitio ya está bloqueado y no crea un registro duplicado.
5. ⬜ Dado que la lista de sitios bloqueados contiene muchos registros y el psicólogo necesita encontrar uno específico, cuando escribe parte del nombre o dirección en el campo de búsqueda, entonces el sistema filtra la lista en tiempo real mostrando solo los sitios que coinciden con lo escrito.

_Punto de partida: diseño de `GET /blocking/domains?since=` en `docs/planning/spike2-bloqueo-android.md`._

---

## Solicitud de Revisión de URL Bloqueada · Deseable - HdU16 · 5 SP (4)

> Como paciente en rehabilitación, Quiero enviar una solicitud de revisión sobre una URL que
> creo está bloqueada por error, Para que un psicólogo evalúe si corresponde desbloquearla.

**Detalle:** el paciente ve la lista de sitios bloqueados en su dispositivo y puede enviar una
solicitud con la URL y un motivo opcional. Queda "Pendiente" hasta que el psicólogo emita un veredicto.

**Por qué 5:** pantalla nueva en la app, envío con reintento sin conexión y aviso del veredicto.
Se pueden reutilizar `checkInQueue` y `reintentoEscritura` de mobile.

1. ⬜ (Éxito - envío de solicitud) Dado que el paciente tiene protección activa y está autenticado, cuando selecciona una URL bloqueada y envía una solicitud de revisión con o sin motivo, entonces el sistema registra la solicitud en estado "Pendiente", notifica al psicólogo asignado y le confirma al paciente que su solicitud fue enviada.
2. ⬜ (Duplicado) Dado que el paciente ya tiene una solicitud pendiente para una URL específica, cuando intenta enviar otra solicitud para esa misma URL, entonces el sistema se lo impide e indica que ya existe una solicitud en curso para ese sitio.
3. ⬜ (Sin conexión) Dado que el paciente no tiene conexión a internet, cuando intenta enviar una solicitud de revisión, entonces el sistema muestra un mensaje indicando que no fue posible enviarla y le pide intentarlo cuando recupere conexión.
4. ⬜ (Seguimiento) Dado que el paciente envió una solicitud y el psicólogo emitió un veredicto, cuando el paciente abre la app, entonces recibe una notificación indicando si la URL fue desbloqueada o si se mantiene el bloqueo, con una breve explicación del resultado.

---

## Revisión de Solicitudes de Desbloqueo de URL · Deseable - HdU17 · 5 SP (4)

> Como psicólogo de AJUTER, Quiero revisar las solicitudes de desbloqueo enviadas por mis
> pacientes y emitir un veredicto (desbloquear o mantener el bloqueo), Para gestionar el
> filtrado URL de forma justa y controlada.

**Detalle:** desde el dashboard el psicólogo ve las solicitudes de sus pacientes con URL, motivo y
fecha. Aprobar remueve la URL de la lista global; rechazar la mantiene. En ambos casos el paciente
recibe la notificación.

**Por qué 5:** página web nueva, veredicto con comentario, propagación a la lista global (depende de
HdU15) y fila de auditoría inmutable, como `registration_reviews`.

1. ⬜ (Listado) Dado que existen solicitudes pendientes de sus pacientes, cuando el psicólogo accede a la sección de solicitudes de desbloqueo en el dashboard, entonces el sistema muestra un listado con la URL solicitada, el nombre del paciente, el motivo ingresado y la fecha de envío, ordenadas de más reciente a más antigua.
2. ⬜ (Aprobación - desbloqueo) Dado que existe una solicitud pendiente, cuando el psicólogo la aprueba, entonces el sistema remueve esa URL de la lista global de AJUTER, los dispositivos de los pacientes dejan de bloquearla en la siguiente sincronización, y el paciente solicitante recibe una notificación indicando que su solicitud fue aprobada.
3. ⬜ (Rechazo - mantener bloqueo) Dado que existe una solicitud pendiente, cuando el psicólogo la rechaza con un comentario opcional explicando el motivo, entonces la URL se mantiene en la lista de bloqueados, la solicitud queda en estado "Rechazada" y el paciente recibe una notificación indicando que el bloqueo se mantiene junto al comentario del psicólogo si fue ingresado.
4. ⬜ (Sin solicitudes pendientes) Dado que ningún paciente ha enviado solicitudes de revisión, cuando el psicólogo accede a la sección, entonces el sistema muestra un estado vacío indicando que no hay solicitudes pendientes.
5. ⬜ (Trazabilidad) Dado que el psicólogo emite un veredicto sobre una solicitud, cuando completa la acción, entonces el sistema registra el autor, fecha, URL y veredicto emitido para auditoría clínica.

---

## Memoria de Técnicas Efectivas del Asistente IA · Opcional - HdU10 · 8 SP (5)

> Como paciente, Quiero que el asistente virtual conserve el historial de mis conversaciones,
> Para que recuerde las técnicas que me ayudaron en momentos de crisis.

**Por qué 8:** hoy el asistente recuerda la última técnica usada, no la que funcionó: hay que
guardar si cada técnica ayudó (dato nuevo), tolerar el fallo de la base y crear la pantalla «Ver historial».

1. ⬜ Dado que el paciente tiene al menos dos sesiones previas cerradas con una técnica de contención registrada, cuando inicia una nueva conversación describiendo un detonante similar a uno ya registrado, entonces el asistente prioriza sugerir la técnica que le resultó efectiva en esas sesiones anteriores en lugar de elegir una técnica genérica. _Hoy solo dice «La última vez probaste X»._
2. 🟡 Dado que el paciente no tiene sesiones previas registradas, cuando inicia su primera conversación de crisis, entonces el asistente aplica una técnica de contención general validada por AJUTER, sin fallar por falta de historial. _Sin resumen previo no falla, pero no hay un caso pensado ni probado para esto._
3. ⬜ Dado que el historial de conversaciones del paciente no puede recuperarse (ej. error temporal de base de datos), cuando el paciente inicia una nueva sesión, entonces el asistente continúa la conversación sin contexto histórico en lugar de bloquear el chat, y el fallo queda registrado para revisión técnica. _`startSession` no tiene try/catch: si falla la consulta, falla el inicio._
4. 🟡 Dado que el paciente quiere revisar lo conversado en sesiones anteriores, cuando accede a la opción "Ver historial" dentro del chat, entonces el sistema muestra un resumen de las sesiones anteriores sin exponer ese historial a otros roles (padrino, familiar, psicólogo sin permiso clínico). _`GET /ai/sessions/summaries` y `getAiSummaries` existen; ninguna pantalla los usa, y el endpoint no restringe el rol._

---

## Actualización Automática de Lista de URLs Bloqueadas · Opcional - HdU18 · 8 SP

> Como psicólogo de AJUTER, Quiero que la lista de URLs bloqueadas se actualice automáticamente
> de forma periódica consultando fuentes externas confiables, Para no tener que buscar
> manualmente nuevas plataformas de apuestas que aparezcan en el mercado chileno.

**Detalle:** un proceso periódico consulta fuentes externas de dominios de casinos y agrega a la
lista activa los dominios nuevos. Si algún dominio fue bloqueado por error, el paciente lo reporta
con el flujo de revisión (HdU16/HdU17). Las fuentes salen del spike: HaGeZi como principal (93 % de
cobertura) más la nómina de Subtel (`docs/planning/spike2-bloqueo-android.md`).

1. ⬜ (Ejecución periódica) Dado que el sistema tiene configurado el proceso automático, cuando se cumple el intervalo definido, entonces el sistema consulta las fuentes externas configuradas y compara los dominios obtenidos con la lista activa actual.
2. ⬜ (Detección de dominio nuevo) Dado que el proceso detecta un dominio no presente en la lista activa, cuando completa la comparación, entonces el sistema lo agrega directamente a la lista y se propaga a los dispositivos de los pacientes en la siguiente sincronización.
3. ⬜ (Sin dominios nuevos) Dado que el proceso se ejecuta y no detecta dominios nuevos, cuando completa la comparación, entonces el sistema no modifica la lista y registra la ejecución como exitosa.
4. ⬜ (Fallo de fuente externa) Dado que el proceso no puede contactar la fuente externa, cuando ocurre el fallo, entonces el sistema no modifica la lista activa, registra el error y reintenta en el siguiente intervalo programado.

---

## Resumen de puntos

| Historia | Plan | Sprint 3 |
|---|---|---|
| HdU09 Estado de pago (psicólogo) | 4 | **5** |
| HdU12 Pago del familiar | 5 | **8** |
| HdU14 Grupos de sesión | 5 | **8** |
| HdU15 Lista de URLs bloqueadas | 2 | **5** |
| HdU16 Solicitud de revisión de URL | 4 | **5** |
| HdU17 Revisión de desbloqueos | 4 | **5** |
| HdU10 Memoria del asistente IA | 5 | **8** |
| HdU18 Actualización automática de URLs | 8 | **8** |
| **Total** | **37** | **52** |
