# Sprint 3

> Catálogo de las 8 historias del Sprint 3, con los criterios de aceptación del Plan de Proyecto
> (sección 7). Las asignaciones están en [`sprint-3-reparto.md`](sprint-3-reparto.md).
>
> **Estado del código (revisado el 13-10-2026 sobre `origin/main`).** Cada criterio lleva una
> marca: ✅ ya está hecho · 🟡 hay una parte · ⬜ no existe. Nada está completo, y aun lo que ya
> existe se documenta dentro de este sprint. Los puntos son los re-estimados; entre paréntesis,
> los del Plan de Proyecto.
>
> Los criterios se acortaron respecto del Plan de Proyecto para poder demostrarlos en vivo; el sentido es el mismo.

**Total: 52 SP** (el plan original sumaba 37; el tablero exige un mínimo de 50). 1 SP = 6 h.
Cada historia sube solo donde el código mostró más trabajo del estimado, y la razón está bajo
su título.

---

## Estado de Pago de Pacientes (vista del Psicólogo) · Deseable - HdU09 · 5 SP (4)

> Como psicólogo de AJUTER, Quiero revisar el estado de pago de mis pacientes Para mantener un
> registro ordenado de las cuotas al día y las pendientes.

**Por qué 5:** `FinanzasPage` funciona con datos de ejemplo y no hay un endpoint que liste a
todos los pacientes con su deuda; además nada pasa una cuota de pendiente a vencida (solo el seed).

1. 🟡 Dado que el psicólogo entra a Finanzas, cuando carga la página, entonces ve a sus pacientes con monto adeudado, próximo vencimiento y estado (al día / pendiente / vencido). _Existe la tabla con esas columnas (`apps/web/src/pages/FinanzasPage.tsx`) pero con datos inventados, y `GET /billing/patients/:id/status` entrega un paciente a la vez._
2. 🟡 Dado que está en Finanzas, cuando filtra por «vencido», entonces ve solo a los pacientes con cuotas vencidas, del más atrasado al menos. _El filtro existe; no ordena por días de atraso._
3. ⬜ Dado que no tiene pacientes con cuotas, cuando entra a Finanzas, entonces ve un mensaje explicativo en vez de una tabla vacía.

---

## Pago de Mensualidad por el Familiar · Deseable - HdU12 · 8 SP (5)

> Como familiar de un paciente, Quiero realizar el pago de la mensualidad de AJUTER desde la
> vista web, Para gestionar la mensualidad del tratamiento sin depender del acceso del paciente
> a medios de pago.

**Por qué 8:** Webpay Oneclick existe en sandbox, pero solo para el paciente (`apps/backend/src/payments/`);
el familiar no tiene endpoint de pago, la vista no trae las cuotas ya pagadas y no hay comprobante PDF.
Quién paga y cuándo se reactiva una cuenta siguen pendientes de decisión del cliente
(`docs/ASUNCIONES-PENDIENTES.md`, puntos 4-6).

1. 🟡 Dado que el familiar está vinculado, cuando entra a «Pagos», entonces ve cada cuota con mes, monto, vencimiento y estado. _`GET /family/billing` solo devuelve las vencidas y la próxima; no hay lista completa ni medición de tiempo._
2. 🟡 Dado que hay cuotas vencidas, cuando el familiar las paga, entonces quedan pagadas, la cuenta del paciente se reactiva y el paciente recibe un aviso. _`BillingService.settleInvoices` ya hace las tres cosas, pero ningún endpoint del familiar lo usa._
3. 🟡 Dado que la próxima cuota no ha vencido, cuando el familiar la paga por adelantado, entonces queda pagada y ve la confirmación. _El botón existe en `BillingCard`; lleva a un pago simulado._
4. ⬜ Dado que una cuota ya fue pagada, cuando el familiar entra a «Pagos», entonces la ve como «Pagada» con su fecha y no puede volver a pagarla. _El backend ya rechaza volver a pagarla._
5. 🟡 Dado que el pago es rechazado, cuando el familiar confirma, entonces ve que se rechazó, las cuotas no cambian y puede reintentar. _Un cobro rechazado ya no toca la cuota (payments); falta la pantalla._
6. ⬜ Dado que el pago fue exitoso, cuando termina, entonces ve un resumen y puede descargar el comprobante en PDF.
7. 🟡 Dado que no hay cuotas pendientes, cuando el familiar entra a «Pagos», entonces ve «Todas las cuotas están al día» y la fecha del próximo cobro. _Hoy dice «Al día» / «No hay cuotas por pagar»._

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

1. 🟡 Dado que el psicólogo está en Sesiones, cuando completa nombre, sede, fecha, hora, cupo y tipo y crea la sesión, entonces aparece en el listado de su sede. _Solo existe `POST /family/sessions`, sin formulario ni tipo._
2. ⬜ Dado que una sesión tiene confirmados, cuando el psicólogo cambia la fecha, hora o cupo, entonces se guarda y los confirmados reciben un aviso.
3. 🟡 Dado que una sesión tiene invitados, cuando el psicólogo abre su detalle, entonces ve tres listas: confirmados, no asistirán y sin respuesta. _La web muestra las confirmaciones de familiares; faltan las tres listas y los pacientes._
4. ⬜ Dado que la sesión ya pasó, cuando el psicólogo abre su detalle, entonces puede marcar a cada participante como «asistió» o «no asistió».
5. ✅ Dado que la sede no tiene sesiones futuras, cuando el psicólogo entra a Sesiones, entonces ve un mensaje y un botón para crear una. _El mensaje existe («Sin sesiones agendadas»); el botón depende del formulario del CA1._
6. ⬜ Dado que se crea una sesión de tipo «familiar», cuando queda guardada, entonces la ven los pacientes en la app y sus familiares en la web; una de tipo «pacientes» no la ven los familiares.

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

1. ⬜ Dado que el psicólogo entra a Sitios bloqueados, cuando carga la página, entonces ve cada sitio con su dirección, fecha y quién lo agregó.
2. ⬜ Dado que un sitio no está en la lista, cuando el psicólogo lo agrega, entonces aparece en la lista y el teléfono de un paciente con protección lo bloquea.
3. ⬜ Dado que un sitio está en la lista, cuando el psicólogo lo elimina, entonces desaparece y el teléfono deja de bloquearlo.
4. ⬜ Dado que un sitio ya está en la lista, cuando el psicólogo intenta agregarlo de nuevo, entonces ve que ya está bloqueado y no se duplica.
5. ⬜ Dado que la lista es larga, cuando el psicólogo escribe en el buscador, entonces la lista se filtra mientras escribe.

_Punto de partida: diseño de `GET /blocking/domains?since=` en `docs/planning/spike2-bloqueo-android.md`._

---

## Solicitud de Revisión de URL Bloqueada · Deseable - HdU16 · 5 SP (4)

> Como paciente en rehabilitación, Quiero enviar una solicitud de revisión sobre una URL que
> creo está bloqueada por error, Para que un psicólogo evalúe si corresponde desbloquearla.

**Detalle:** el paciente ve la lista de sitios bloqueados en su dispositivo y puede enviar una
solicitud con la URL y un motivo opcional. Queda "Pendiente" hasta que el psicólogo emita un veredicto.

**Por qué 5:** pantalla nueva en la app, envío con reintento sin conexión y aviso del veredicto.
Se pueden reutilizar `checkInQueue` y `reintentoEscritura` de mobile.

1. ⬜ Dado que el paciente tiene la protección activa, cuando pide revisar una URL bloqueada, entonces la solicitud queda «Pendiente», el psicólogo recibe un aviso y el paciente ve la confirmación.
2. ⬜ Dado que ya pidió revisar esa URL, cuando lo intenta de nuevo, entonces ve que ya hay una solicitud en curso.
3. ⬜ Dado que el paciente no tiene conexión, cuando envía la solicitud, entonces ve que no se pudo enviar y que lo intente con conexión.
4. ⬜ Dado que el psicólogo ya decidió, cuando el paciente abre la app, entonces ve un aviso con el resultado y una breve explicación.

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

1. ⬜ Dado que hay solicitudes pendientes, cuando el psicólogo entra a Solicitudes de desbloqueo, entonces ve URL, paciente, motivo y fecha, de la más reciente a la más antigua.
2. ⬜ Dado que hay una solicitud pendiente, cuando el psicólogo la aprueba, entonces la URL sale de la lista bloqueada y el paciente recibe un aviso.
3. ⬜ Dado que hay una solicitud pendiente, cuando el psicólogo la rechaza con un comentario, entonces queda «Rechazada», la URL sigue bloqueada y el paciente recibe el aviso con el comentario.
4. ⬜ Dado que no hay solicitudes, cuando el psicólogo entra a la sección, entonces ve un mensaje de que no hay pendientes.
5. ⬜ Dado que el psicólogo decide una solicitud, cuando la cierra, entonces queda registrado quién, cuándo, qué URL y qué decidió.

---

## Memoria de Técnicas Efectivas del Asistente IA · Opcional - HdU10 · 8 SP (5)

> Como paciente, Quiero que el asistente virtual conserve el historial de mis conversaciones,
> Para que recuerde las técnicas que me ayudaron en momentos de crisis.

**Por qué 8:** hoy el asistente recuerda la última técnica usada, no la que funcionó: hay que
guardar si cada técnica ayudó (dato nuevo), tolerar el fallo de la base y crear la pantalla «Ver historial».

1. ⬜ Dado que una técnica ya le sirvió al paciente con un detonante, cuando vuelve a escribir por un detonante parecido, entonces el asistente le sugiere esa técnica primero. _Hoy solo dice «La última vez probaste X»._
2. 🟡 Dado que el paciente no tiene sesiones previas, cuando inicia su primera conversación de crisis, entonces el asistente le ofrece una técnica general sin fallar. _Sin resumen previo no falla, pero no hay un caso pensado ni probado para esto._
3. ⬜ Dado que el historial no se puede leer, cuando el paciente inicia una sesión, entonces el chat funciona igual, sin contexto, y el error queda registrado. _`startSession` no tiene try/catch: si falla la consulta, falla el inicio._
4. 🟡 Dado que el paciente quiere ver sus sesiones anteriores, cuando toca «Ver historial», entonces ve un resumen de cada una, y nadie más puede verlo. _`GET /ai/sessions/summaries` y `getAiSummaries` existen; ninguna pantalla los usa, y el endpoint no restringe el rol._

---

## Actualización Automática de Lista de URLs Bloqueadas · Opcional - HdU18 · 8 SP

> Como psicólogo de AJUTER, Quiero que la lista de URLs bloqueadas se actualice automáticamente
> de forma periódica consultando fuentes externas confiables, Para no tener que buscar
> manualmente nuevas plataformas de apuestas que aparezcan en el mercado chileno.

**Detalle:** un proceso periódico consulta fuentes externas de dominios de casinos y agrega a la
lista activa los dominios nuevos. Si algún dominio fue bloqueado por error, el paciente lo reporta
con el flujo de revisión (HdU16/HdU17). Las fuentes salen del spike: HaGeZi como principal (93 % de
cobertura) más la nómina de Subtel (`docs/planning/spike2-bloqueo-android.md`).

1. ⬜ Dado que el proceso está programado, cuando llega su hora, entonces consulta las fuentes externas y compara con la lista actual.
2. ⬜ Dado que encuentra un dominio nuevo, cuando termina, entonces lo agrega a la lista bloqueada.
3. ⬜ Dado que no hay dominios nuevos, cuando termina, entonces la lista no cambia y la ejecución queda registrada como exitosa.
4. ⬜ Dado que una fuente no responde, cuando falla, entonces la lista no cambia, el error queda registrado y se reintenta en la siguiente ejecución.

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
