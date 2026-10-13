# Sprint 3

> Catálogo de las 8 historias del Sprint 3, con los criterios de aceptación del Plan de Proyecto
> (sección 7). Las asignaciones están en [`sprint-3-reparto.md`](sprint-3-reparto.md).
>
> **Estado del código (revisado el 13-10-2026 sobre `origin/main`).** Cada criterio lleva una
> marca: ✅ ya está hecho · 🟡 hay una parte · ⬜ no existe. Nada está completo, y aun lo que ya
> existe se documenta dentro de este sprint. Los puntos son los re-estimados; entre paréntesis,
> los del Plan de Proyecto.
>
> Los criterios se acortaron respecto del Plan de Proyecto para poder demostrarlos en vivo, sin perder el detalle que los hace verificables.

**Total: 52 SP** (el plan original sumaba 37; el tablero exige un mínimo de 50). 1 SP = 6 h.
Cada historia sube solo donde el código mostró más trabajo del estimado, y la razón está bajo
su título.

---

## Estado de Pago de Pacientes (vista del Psicólogo) · Deseable - HdU09 · 5 SP (4)

> Como psicólogo de AJUTER, Quiero revisar el estado de pago de mis pacientes Para mantener un
> registro ordenado de las cuotas al día y las pendientes.

**Por qué 5:** `FinanzasPage` funciona con datos de ejemplo y no hay un endpoint que liste a
todos los pacientes con su deuda; además nada pasa una cuota de pendiente a vencida (solo el seed).

1. 🟡 Dado que el psicólogo inició sesión en el dashboard, cuando entra a la vista de Finanzas, entonces ve el listado de sus pacientes con el monto adeudado, la fecha de vencimiento más próxima y un estado visual (al día / pendiente / vencido) para cada uno. _Existe la tabla con esas columnas (`apps/web/src/pages/FinanzasPage.tsx`) pero con datos inventados, y `GET /billing/patients/:id/status` entrega un paciente a la vez._
2. 🟡 Dado que el psicólogo está en la vista de Finanzas, cuando filtra por estado "vencido", entonces ve solo los pacientes con al menos una cuota vencida, ordenados de más a menos días de atraso. _El filtro existe; no ordena por días de atraso._
3. ⬜ Dado que el psicólogo no tiene pacientes con pagos registrados, cuando entra a la vista de Finanzas, entonces ve un mensaje que explica que aún no hay pagos, en lugar de una tabla vacía o un error.

---

## Pago de Mensualidad por el Familiar · Deseable - HdU12 · 8 SP (5)

> Como familiar de un paciente, Quiero realizar el pago de la mensualidad de AJUTER desde la
> vista web, Para gestionar la mensualidad del tratamiento sin depender del acceso del paciente
> a medios de pago.

**Por qué 8:** Webpay Oneclick existe en sandbox, pero solo para el paciente (`apps/backend/src/payments/`);
el familiar no tiene endpoint de pago, la vista no trae las cuotas ya pagadas y no hay comprobante PDF.
Quién paga y cuándo se reactiva una cuenta siguen pendientes de decisión del cliente
(`docs/ASUNCIONES-PENDIENTES.md`, puntos 4-6).

1. 🟡 Dado que el familiar inició sesión y está vinculado a un paciente, cuando entra a la sección "Pagos", entonces ve cada cuota del paciente con su mes, monto, fecha de vencimiento y estado (al día, pendiente o vencida). _`GET /family/billing` solo devuelve las vencidas y la próxima; no hay lista completa._
2. 🟡 Dado que el paciente tiene cuotas vencidas, cuando el familiar las selecciona y paga con un método válido, entonces esas cuotas quedan pagadas, la cuenta del paciente se reactiva si estaba suspendida y el paciente recibe un aviso en la app. _`BillingService.settleInvoices` ya hace las tres cosas, pero ningún endpoint del familiar lo usa._
3. 🟡 Dado que la próxima cuota aún no vence, cuando el familiar la selecciona y la paga por adelantado, entonces queda pagada, se actualiza la fecha del próximo cobro y ve una confirmación con el detalle. _El botón existe en `BillingCard`; lleva a un pago simulado._
4. ⬜ Dado que una cuota ya fue pagada (por el paciente u otro familiar), cuando el familiar entra a "Pagos", entonces la ve marcada como "Pagada" con su fecha de pago y no puede seleccionarla de nuevo. _El backend ya rechaza volver a pagarla._
5. 🟡 Dado que el servicio de pago rechaza el método del familiar, cuando intenta confirmar el pago, entonces ve un mensaje de rechazo, las cuotas no cambian de estado y puede reintentar con otro método. _Un cobro rechazado ya no toca la cuota (payments); falta la pantalla._
6. ⬜ Dado que el familiar completó un pago con éxito, cuando el sistema lo registra, entonces ve una pantalla con el monto total, las cuotas pagadas, la fecha y la hora, y puede descargar el comprobante en PDF.
7. 🟡 Dado que el paciente no tiene cuotas pendientes ni vencidas, cuando el familiar entra a "Pagos", entonces ve el mensaje "Todas las cuotas están al día" y la fecha del próximo cobro. _Hoy dice «Al día» / «No hay cuotas por pagar»._

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

1. 🟡 Dado que el psicólogo está en la sección de sesiones del dashboard, cuando completa nombre, sede, fecha, hora, cupo y tipo de sesión y presiona "Crear sesión", entonces la sesión queda registrada y aparece en el listado de su sede. _Solo existe `POST /family/sessions`, sin formulario ni tipo._
2. ⬜ Dado que una sesión futura ya tiene pacientes confirmados, cuando el psicólogo cambia su fecha, hora o cupo y guarda, entonces la sesión se actualiza y los confirmados reciben un aviso del cambio.
3. 🟡 Dado que una sesión tiene personas invitadas, cuando el psicólogo abre su detalle, entonces ve tres listas separadas: confirmados, no asistirán y sin respuesta (en sesiones de tipo "familiar", con pacientes y familiares). _La web muestra las confirmaciones de familiares; faltan las tres listas y los pacientes._
4. ⬜ Dado que la fecha y hora de una sesión ya pasaron, cuando el psicólogo abre su detalle, entonces puede marcar a cada participante como "asistió" o "no asistió" y el registro queda guardado.
5. ✅ Dado que la sede del psicólogo no tiene sesiones futuras, cuando entra a la sección de sesiones, entonces ve un mensaje de que no hay sesiones próximas y un botón para crear una nueva. _El mensaje existe («Sin sesiones agendadas»); el botón depende del formulario del CA1._
6. ⬜ Dado que el psicólogo crea una sesión de tipo "familiar", cuando queda registrada, entonces los pacientes la ven en la app y sus familiares vinculados en la web; las sesiones de tipo "pacientes" no las ven los familiares.

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

1. ⬜ Dado que el psicólogo inició sesión en el dashboard, cuando entra a la sección de sitios bloqueados, entonces ve la lista de sitios con su dirección, la fecha en que se agregó y quién lo agregó.
2. ⬜ Dado que un sitio de apuestas no está en la lista, cuando el psicólogo ingresa su dirección y confirma, entonces el sitio se agrega a la lista y los teléfonos con protección activa empiezan a bloquearlo.
3. ⬜ Dado que un sitio está en la lista, cuando el psicólogo lo elimina y confirma, entonces sale de la lista y los teléfonos dejan de bloquearlo en la siguiente sincronización.
4. ⬜ Dado que un sitio ya está en la lista, cuando el psicólogo intenta agregarlo de nuevo, entonces ve un mensaje de que ya está bloqueado y no se crea un duplicado.
5. ⬜ Dado que la lista tiene muchos sitios, cuando el psicólogo escribe parte de una dirección en el buscador, entonces la lista se filtra en tiempo real mostrando solo los que coinciden.

_Punto de partida: diseño de `GET /blocking/domains?since=` en `docs/planning/spike2-bloqueo-android.md`._

---

## Solicitud de Revisión de URL Bloqueada · Deseable - HdU16 · 5 SP (4)

> Como paciente en rehabilitación, Quiero enviar una solicitud de revisión sobre una URL que
> creo está bloqueada por error, Para que un psicólogo evalúe si corresponde desbloquearla.

**Detalle:** el paciente ve la lista de sitios bloqueados en su dispositivo y puede enviar una
solicitud con la URL y un motivo opcional. Queda "Pendiente" hasta que el psicólogo emita un veredicto.

**Por qué 5:** pantalla nueva en la app, envío con reintento sin conexión y aviso del veredicto.
Se pueden reutilizar `checkInQueue` y `reintentoEscritura` de mobile.

1. ⬜ Dado que el paciente inició sesión y tiene la protección activa, cuando elige una URL bloqueada y envía la solicitud de revisión (con o sin motivo), entonces queda en estado "Pendiente", el psicólogo asignado recibe un aviso y el paciente ve una confirmación.
2. ⬜ Dado que el paciente ya tiene una solicitud pendiente para una URL, cuando intenta enviar otra para la misma URL, entonces el sistema no la crea y le indica que ya hay una solicitud en curso.
3. ⬜ Dado que el paciente no tiene conexión a internet, cuando intenta enviar una solicitud de revisión, entonces ve un mensaje de que no se pudo enviar y que lo intente al recuperar la conexión.
4. ⬜ Dado que el psicólogo ya emitió un veredicto, cuando el paciente abre la app, entonces recibe una notificación que dice si la URL se desbloqueó o sigue bloqueada, con una breve explicación.

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

1. ⬜ Dado que hay solicitudes pendientes de sus pacientes, cuando el psicólogo entra a la sección de solicitudes de desbloqueo, entonces ve la URL, el nombre del paciente, el motivo y la fecha de envío, de la más reciente a la más antigua.
2. ⬜ Dado que existe una solicitud pendiente, cuando el psicólogo la aprueba, entonces la URL sale de la lista de bloqueados, los teléfonos dejan de bloquearla y el paciente recibe un aviso de aprobación.
3. ⬜ Dado que existe una solicitud pendiente, cuando el psicólogo la rechaza con un comentario opcional, entonces queda "Rechazada", la URL sigue bloqueada y el paciente recibe un aviso con el comentario.
4. ⬜ Dado que ningún paciente ha enviado solicitudes, cuando el psicólogo entra a la sección, entonces ve un mensaje de que no hay solicitudes pendientes.
5. ⬜ Dado que el psicólogo emite un veredicto, cuando completa la acción, entonces queda registrado el autor, la fecha, la URL y el veredicto para auditoría.

---

## Memoria de Técnicas Efectivas del Asistente IA · Opcional - HdU10 · 8 SP (5)

> Como paciente, Quiero que el asistente virtual conserve el historial de mis conversaciones,
> Para que recuerde las técnicas que me ayudaron en momentos de crisis.

**Por qué 8:** hoy el asistente recuerda la última técnica usada, no la que funcionó: hay que
guardar si cada técnica ayudó (dato nuevo), tolerar el fallo de la base y crear la pantalla «Ver historial».

1. ⬜ Dado que el paciente tiene al menos dos sesiones cerradas con una técnica registrada, cuando inicia una conversación por un detonante parecido, entonces el asistente le sugiere primero la técnica que le funcionó antes, en vez de una genérica. _Hoy solo dice «La última vez probaste X»._
2. 🟡 Dado que el paciente no tiene sesiones previas, cuando inicia su primera conversación de crisis, entonces el asistente aplica una técnica general validada por AJUTER sin fallar por falta de historial. _Sin resumen previo no falla, pero no hay un caso pensado ni probado para esto._
3. ⬜ Dado que el historial del paciente no se puede recuperar (por ejemplo, un error de base de datos), cuando inicia una nueva sesión, entonces el chat continúa sin contexto en vez de bloquearse y el fallo queda registrado. _`startSession` no tiene try/catch: si falla la consulta, falla el inicio._
4. 🟡 Dado que el paciente quiere revisar sesiones anteriores, cuando toca "Ver historial" en el chat, entonces ve un resumen de cada sesión, sin que padrino, familiar ni otros roles puedan verlo. _`GET /ai/sessions/summaries` y `getAiSummaries` existen; ninguna pantalla los usa, y el endpoint no restringe el rol._

---

## Actualización Automática de Lista de URLs Bloqueadas · Opcional - HdU18 · 8 SP

> Como psicólogo de AJUTER, Quiero que la lista de URLs bloqueadas se actualice automáticamente
> de forma periódica consultando fuentes externas confiables, Para no tener que buscar
> manualmente nuevas plataformas de apuestas que aparezcan en el mercado chileno.

**Detalle:** un proceso periódico consulta fuentes externas de dominios de casinos y agrega a la
lista activa los dominios nuevos. Si algún dominio fue bloqueado por error, el paciente lo reporta
con el flujo de revisión (HdU16/HdU17). Las fuentes salen del spike: HaGeZi como principal (93 % de
cobertura) más la nómina de Subtel (`docs/planning/spike2-bloqueo-android.md`).

1. ⬜ Dado que el proceso automático está configurado, cuando se cumple el intervalo definido, entonces consulta las fuentes externas y compara los dominios obtenidos con la lista activa.
2. ⬜ Dado que el proceso detecta un dominio que no está en la lista, cuando termina la comparación, entonces lo agrega a la lista y los teléfonos lo bloquean en la siguiente sincronización.
3. ⬜ Dado que el proceso no detecta dominios nuevos, cuando termina la comparación, entonces la lista no cambia y la ejecución queda registrada como exitosa.
4. ⬜ Dado que una fuente externa no responde, cuando el proceso falla, entonces la lista activa no cambia, el error queda registrado y se reintenta en el siguiente intervalo.

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
