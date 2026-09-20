# Sprint 2

## Gestión de Ficha Clínica del Paciente · Esencial - HDU 13

> Como psicólogo de AJUTER, Quiero crear y mantener la ficha clínica de cada uno de mis pacientes Para llevar un seguimiento clínico estructurado que sustente las decisiones del tratamiento.

1. Dado que un paciente fue aprobado e ingresó a la sede del psicólogo, cuando el psicólogo abre el perfil del paciente por primera vez, entonces el sistema muestra una ficha clínica vacía con los campos obligatorios (motivo de consulta, antecedentes de la conducta de juego, detonantes, antecedentes de salud/red de apoyo, objetivos terapéuticos) listos para completar.
2. Dado que el psicólogo está editando la ficha clínica de su paciente, cuando completa los campos y guarda, entonces el sistema almacena la información, registra fecha, hora y autor de la modificación, y muestra una confirmación visual.
3. Dado que el psicólogo intenta guardar la ficha con un campo obligatorio vacío (ej. motivo de consulta), cuando presiona guardar, entonces el sistema bloquea el guardado y resalta los campos pendientes sin perder la información ya ingresada.
4. Dado que una ficha clínica fue modificada anteriormente, cuando el psicólogo consulta su historial de cambios, entonces el sistema muestra las versiones anteriores con fecha, hora, autor y los campos que cambiaron en cada una, para auditoría clínica.
5. Dado que un psicólogo intenta abrir la ficha de un paciente de una sede distinta a la suya, cuando accede a la URL del perfil, entonces el sistema bloquea el acceso por falta de permisos y no expone ningún dato clínico.
6. Dado que el psicólogo registró detonantes en la ficha, cuando el paciente inicia una conversación con el asistente virtual, entonces esos detonantes se incluyen como contexto de la personalización, sin enviar nombre, RUT ni datos de contacto al modelo.

---

## Gestión de Solicitudes de Ingreso de Pacientes · Esencial - HDU 19

> Como psicólogo de AJUTER, Quiero revisar y gestionar las solicitudes de ingreso de nuevos pacientes a mis sedes, Para aprobar o rechazar su acceso a la plataforma según los criterios de AJUTER.

1. Dado que existen solicitudes pendientes en mi sede, cuando el psicólogo accede a la sección de solicitudes de ingreso en el dashboard, entonces el sistema muestra un listado con el nombre, RUT, correo y fecha de solicitud de cada paciente pendiente.
2. Dado que un psicólogo revisa una solicitud pendiente, cuando la aprueba, entonces el sistema asigna al paciente a la sede del psicólogo (incorporándolo a la lista de pacientes de todos los psicólogos de esa sede) y notifica al paciente que ya puede continuar con el pago de su mensualidad para activar la cuenta.
3. Dado que el psicólogo determina que una solicitud no cumple los criterios de ingreso, cuando la rechaza, entonces el sistema notifica al paciente que su solicitud no fue aprobada y le indica contactar directamente a AJUTER; la solicitud queda en estado "Rechazada", sin otorgarle acceso a la app, y el coordinador puede reabrirla si el paciente contacta a AJUTER.
4. Dado que no hay solicitudes pendientes en la sede, cuando el psicólogo accede a la sección, entonces el sistema muestra un estado vacío indicando que no hay solicitudes por revisar.
5. Dado que existen solicitudes pendientes en una sede distinta a la del psicólogo, cuando este accede a la sección, entonces el sistema no muestra esas solicitudes.
6. Dado que el psicólogo aprueba o rechaza una solicitud, cuando completa la acción, entonces el sistema registra autor, rol, fecha y veredicto para auditoría clínica.

---

## Asignación de Padrino a Paciente · Esencial - HDU 20

> Como psicólogo de AJUTER, Quiero asignar a un miembro de la comunidad como padrino de un paciente Para que el paciente cuente con una red de contención humana que reciba sus alertas de pánico y lo acompañe durante la rehabilitación.

1. Dado que el psicólogo revisa el perfil de un paciente sin padrino asignado, cuando selecciona un miembro disponible con rol de padrino de la misma sede y confirma la asignación, entonces el sistema vincula al padrino con el paciente, notifica a ambos y refleja la asignación en el perfil del paciente.
2. Dado que el psicólogo busca a quién asignar, cuando consulta la lista de candidatos, entonces el sistema muestra únicamente a los miembros previamente designados como padrino y activos en la sede del paciente, excluyendo al propio paciente.
3. Dado que un paciente ya tiene un padrino asignado, cuando el psicólogo intenta asignar uno nuevo, entonces el sistema solicita confirmar el reemplazo y, al confirmarse, reasigna el padrino conservando el registro del anterior para trazabilidad.
4. Dado que un paciente no tiene padrino asignado, cuando el psicólogo revisa su perfil, entonces el sistema lo indica explícitamente y advierte que las alertas de botón de pánico se derivarán directamente al asistente IA hasta completar la asignación.
5. Dado que un paciente tiene un padrino asignado, cuando activa el botón de pánico, entonces la alerta llega a ese padrino específico y no a otro.

---

## Designación de un Miembro como Padrino · Esencial - HDU 21

> Como psicólogo de AJUTER, Quiero designar como padrino, según mi criterio clínico, a un paciente que considere preparado para apoyar a otros Para habilitarlo como referente de apoyo asignable a otros pacientes.

1. Dado que el psicólogo decide, según su criterio clínico, que un paciente está preparado para apoyar a otros, cuando lo designa como padrino, entonces el sistema le otorga el rol, lo incorpora a la lista de padrinos disponibles y registra al psicólogo que lo designó y la fecha.
2. Dado que el psicólogo busca a quién designar, cuando consulta la lista de candidatos, entonces el sistema muestra únicamente pacientes activos que aún no tienen el rol de padrino.
3. Dado que un padrino tiene pacientes actualmente asignados, cuando el psicólogo intenta revocar su rol, entonces el sistema advierte y solicita reasignar a esos pacientes antes de completar la revocación.
4. Dado que un psicólogo designa a un paciente como padrino, cuando la designación se registra, entonces el paciente recibe una notificación explicándole qué implica el rol y desde cuándo puede recibir alertas de pánico.

---

## Registro de Cuenta del Familiar · Esencial - HDU 22

> Como familiar de un paciente, Quiero crear mi cuenta desde la plataforma web Para acceder a las funcionalidades de familiares una vez que un psicólogo confirme la vinculación.

1. Dado que el familiar completa su registro indicando el RUT del paciente al que está relacionado, cuando envía el formulario, entonces el sistema crea su cuenta con rol "familiar" en estado "pendiente de vinculación", notifica a los psicólogos de la sede de ese paciente que tienen un familiar por vincular, y muestra una confirmación.
2. Dado que el familiar completa el registro con el RUT de un paciente, cuando lo envía —exista o no ese RUT entre los pacientes de AJUTER—, entonces el sistema crea igual la cuenta del familiar en estado "pendiente de vinculación" y responde con la misma confirmación al familiar, sin indicarle si el paciente fue encontrado. Si el RUT no corresponde a ningún paciente registrado, el sistema no genera una solicitud de vinculación visible para ningún psicólogo, pero registra el intento y alerta al coordinador de que se intentó vincular a un RUT que no está en el sistema.
3. Dado que el familiar ingresa un correo o un RUT que ya pertenecen a una cuenta existente, cuando envía el formulario, entonces el sistema rechaza la solicitud indicando que ya existe una cuenta con esos datos y no crea un duplicado.
4. Dado que el familiar deja un campo obligatorio vacío o con formato inválido, cuando intenta enviar, entonces el sistema bloquea el envío y resalta el campo sin perder los datos ya ingresados.
5. Dado que la cuenta del familiar está en estado "pendiente de vinculación", cuando intenta acceder a cualquier vista de sesiones o pagos, entonces el sistema no expone ningún dato del paciente declarado.
6. Dado que ya existe una solicitud de vinculación pendiente entre ese familiar y ese paciente, cuando el familiar la envía de nuevo, entonces el sistema no genera un duplicado y le indica que ya está en revisión.

---

## Vinculación de Familiar a Paciente · Esencial - HDU 23

> Como psicólogo de AJUTER, Quiero confirmar o rechazar la vinculación de un familiar a un paciente Para habilitar su acceso a las sesiones grupales y al pago de la mensualidad de ese paciente.

1. Dado que existen familiares que declararon estar relacionados con pacientes de una sede, cuando un psicólogo de esa sede accede a la sección de familiares pendientes del dashboard, entonces el sistema muestra cada familiar, el paciente que declaró y la fecha de registro — limitado a los pacientes de su propia sede.
2. Dado que un familiar declaró correctamente a su paciente, cuando el psicólogo confirma la vinculación, entonces el sistema asocia al familiar con el paciente, notifica a ambos y habilita las funcionalidades del familiar.
3. Dado que un familiar declaró un paciente que no le corresponde, cuando el psicólogo rechaza la vinculación, entonces el sistema mantiene la cuenta sin vincular y notifica al familiar que su solicitud no fue aprobada.
4. Dado que un familiar solicita vincularse a un paciente, cuando el psicólogo revisa la solicitud, entonces el sistema muestra si el paciente fue consultado o registra que el psicólogo lo verificó presencialmente.
5. Dado que un familiar vinculado ya no debe tener acceso, cuando el psicólogo revoca la vinculación, entonces el sistema le retira el acceso a sesiones y pagos de inmediato y notifica a ambas partes.
6. Dado que el psicólogo confirma o rechaza una vinculación, cuando completa la acción, entonces el sistema registra autor, fecha y veredicto para auditoría clínica.

---

## Tracker de Logros y Gamificación · Deseable - HDU 03

> Como paciente en rehabilitación, Quiero visualizar mis logros y días sin apostar Para reforzar mi motivación y percepción de autoeficacia durante el proceso.

1. Dado que el paciente alcanza un hito de progreso, cuando el sistema le otorga la insignia correspondiente, entonces el paciente recibe una notificación en su celular felicitándolo por su logro, incluso si la aplicación está cerrada en ese momento.

---

## SPIKE 2

**Objetivo del Spike (qué se quiere investigar):** Investigar y probar la factibilidad técnica del bloqueo de sitios de apuestas en dispositivos Android dentro de React Native CLI, seleccionar una pasarela de pago chilena compatible con cobros recurrentes para la mensualidad de AJUTER, y consolidar la documentación de usuario del sistema.

**Descripción (contexto adicional):** Este Spike aborda la incertidumbre técnica de dos funcionalidades. La primera es el bloqueo de sitios de apuestas a nivel de dispositivo (HdU08, HdU15–18): el stack tecnológico definió VPNService como mecanismo candidato, y este Spike corresponde a su etapa de investigación y prueba de factibilidad, en la que se compara con otras alternativas y se prueba en un dispositivo Android físico antes de comprometer su implementación. La segunda es la integración con una pasarela de pago real para la mensualidad de AJUTER (HdU09, HdU12), ausente del stack tecnológico. Se ejecuta después del Spike 1. La decisión de pagos condiciona la activación de cuentas de HdU19 y el acceso a pagos del familiar de HdU23.

- **CA1:** ≥3 mecanismos de bloqueo comparados (VpnService solo DNS, VpnService con todo el tráfico, DNS privado con servicio de filtrado externo), documentando para cada uno: permisos, si el paciente puede desactivarlo, privacidad de sus datos, política de Google Play y limitaciones. Device Owner y AccessibilityService quedan documentados como descartes justificados.
- **CA2:** Prueba de factibilidad en un dispositivo Android físico: APK que bloquea ≥20 dominios de apuestas con el mecanismo elegido, con evidencia en video, documentando su comportamiento al desactivar la VPN y con el DNS seguro de Chrome activado.
- **CA3:** ≥3 fuentes externas evaluadas para mantener actualizada la lista de dominios, comparando licencia de uso, frecuencia de actualización, cobertura de sitios de apuestas que operan en Chile y falsos positivos.
- **CA4:** Alcance definido y documentado a partir de los resultados de la prueba de factibilidad: carga manual (HdU15) vs. actualización automática futura (HdU18), y si el bloqueo de aplicaciones que menciona HdU08 queda dentro o fuera del alcance.
- **CA5:** ≥3 pasarelas de pago chilenas comparadas (Webpay Oneclick, Flow, Mercado Pago) en costo, soporte de cobro recurrente, requisitos para que AJUTER opere como comercio e integración con el backend NestJS.
- **CA6:** Sandbox de la pasarela elegida funcionando: inscripción de un medio de pago y 2 cobros de prueba, el segundo sin interacción del usuario, con la confirmación recibida por el backend.
- **CA7:** Manual de usuario entregado para los 5 roles (paciente, psicólogo, padrino, familiar, coordinador).
