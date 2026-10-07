# HdU19 — Solicitudes de Ingreso · versión 2 (solo el coordinador decide)

> **Estado: SUPUESTO EN ESPERA DE CONFIRMACIÓN.** Esta versión se programa **antes** de tener la
> afirmación literal del cliente. Si estás leyendo el código de `registration/` y te parece
> raro que un psicólogo común no pueda aprobar nada, es a propósito: léelo acá antes de
> "arreglarlo".

| | |
|---|---|
| **Versión** | v2 (la v1 es el texto de `docs/Sprint 2.md`, HDU 19, sin modificar) |
| **Fecha** | 2026-10-04 |
| **Responsable** | Matías Lara (`feature/HU-19-solicitudes-ingreso`) |
| **Origen del cambio** | Reuniones recientes con Miguel Ángel, psicólogo coordinador de AJUTER |
| **Confirmación del cliente** | **Pendiente.** Se espera su respuesta literal en un par de días (alrededor del 2026-10-06) |

## Qué cambió y por qué

En reuniones recientes, Miguel Ángel dio **indicios** (no una instrucción literal) de que las
solicitudes de ingreso las quiere aceptar o denegar **él**, sea de la sede que sea. Es una
decisión que pasa por la coordinación, no por un psicólogo común.

Hasta ahora la HdU19 decía lo contrario: «cualquier psicólogo de esa sede revisa». Con este
indicio, esa redacción deja de describir lo que el cliente quiere.

**Por qué se programa sin esperar la confirmación:** el plazo de entrega del Sprint 2 no deja
margen para esperar la respuesta y recién entonces empezar. Se asume el cambio y se avanza. Si
Miguel Ángel lo desmiente, volver atrás es acotado (ver «Si se desmiente», abajo).

## Qué texto cambia

| Parte | v1 (`docs/Sprint 2.md`) | v2 (este documento) |
|---|---|---|
| **Quién decide** | «Como psicólogo de AJUTER… a mis sedes» | «Como **psicólogo coordinador** de AJUTER… de **todas las sedes**» |
| **CA1** listado | pendientes «en mi sede» | pendientes de **cualquier sede**; el listado suma la **sede** de cada solicitud, porque ahora se mezclan |
| **CA2** aprobar | «asigna al paciente a la sede **del psicólogo**» | asigna al paciente a **un psicólogo de la sede que él eligió al registrarse**: lo escoge el coordinador, porque quien aprueba ya no atiende pacientes. **Decidido el 07-10: modelo individual (B)**, ver abajo |
| **CA3** rechazar | «el psicólogo determina…» | lo determina el **coordinador**. La reapertura sigue siendo suya |
| **CA4** vacío | «no hay solicitudes pendientes **en la sede**» | no hay solicitudes pendientes |
| **CA5** aislamiento | un psicólogo **no ve** las de otra sede | **se invierte:** un psicólogo sin rol de coordinador **no accede** a la sección (403 en los endpoints; «Solicitudes» desaparece del menú del psicólogo y sus posts reportados pasan a una entrada propia, «Moderación»). Mismo patrón que HdU24 CA4 |
| **CA6** trazabilidad | «el psicólogo aprueba o rechaza» | «**el coordinador** aprueba o rechaza». Se sigue registrando autor, rol, fecha y veredicto |

## Texto completo v2

> **Gestión de Solicitudes de Ingreso de Pacientes · Esencial - HDU 19 (v2)**
> Como psicólogo coordinador de AJUTER, Quiero revisar y gestionar las solicitudes de ingreso de nuevos pacientes de todas las sedes, Para aprobar o rechazar su acceso a la plataforma según los criterios de AJUTER.
>
> 1. Dado que existen solicitudes pendientes, cuando el coordinador accede a la sección de solicitudes de ingreso en el dashboard, entonces el sistema muestra un listado con el nombre, RUT, correo, sede y fecha de solicitud de cada paciente pendiente, de cualquier sede.
> 2. Dado que el coordinador revisa una solicitud pendiente, cuando la aprueba, entonces el sistema asigna al paciente a un psicólogo de la sede que eligió al registrarse, que el coordinador escoge entre los que atienden esa sede, y notifica al paciente que ya puede continuar con el pago de su mensualidad para activar la cuenta. _(modelo individual, ver CA2 abajo)_
> 3. Dado que el coordinador determina que una solicitud no cumple los criterios de ingreso, cuando la rechaza, entonces el sistema notifica al paciente que su solicitud no fue aprobada y le indica contactar directamente a AJUTER; la solicitud queda en estado "Rechazada", sin otorgarle acceso a la app, y el coordinador puede reabrirla si el paciente contacta a AJUTER.
> 4. Dado que no hay solicitudes pendientes, cuando el coordinador accede a la sección, entonces el sistema muestra un estado vacío indicando que no hay solicitudes por revisar.
> 5. Dado que un psicólogo sin rol de coordinador intenta ver, aprobar o rechazar solicitudes de ingreso, cuando accede a la función, entonces el sistema bloquea la acción por falta de permisos.
> 6. Dado que el coordinador aprueba o rechaza una solicitud, cuando completa la acción, entonces el sistema registra autor, rol, fecha y veredicto para auditoría clínica.

## Lo que NO cambia

- La **sede de la solicitud** se sigue guardando y sigue importando: es la sede a la que
  quedará asignado el paciente. Lo que desaparece es que la sede **limite quién revisa**.
- Los CA3 (reapertura), CA4, CA6 conservan su intención; solo cambia quién los ejecuta.
- La moderación de la comunidad (posts reportados) sigue siendo del psicólogo.

## CA2 — decidido el 07-10: modelo individual (B), por plazo

La pregunta era: ¿el paciente queda en la lista de **todos** los psicólogos de su sede
(modelo por sede, A) o de **uno** (modelo individual, B, el que ya tenía el código)? El texto
original del CA2 pedía A. **Se eligió B por el plazo del Sprint 2**: A obliga a cambiar
`listPatients`, `PatientAccessGuard` y el estado de las fichas, que son de otro integrante, y a
re-estimar. Es una decisión de tiempo, no de producto: A sigue siendo lo que se corrigió el
10-09 y queda en el backlog.

Cómo funciona con B:
- Como aprueba el coordinador, que **no atiende pacientes**, `approve()` no puede asumir «el que
  aprueba es el psicólogo asignado»: sin `assignedPsychologistId` responde 400 «Indica a qué
  psicólogo se asigna el paciente».
- **El psicólogo elegido tiene que atender la sede del paciente.** La lista de la web ya
  filtraba así, pero la API aceptaba a cualquiera; ahora responde 400 «El psicólogo asignado no
  atiende la sede del paciente» antes de tocar nada.
- Una sede sin psicólogos activos (hoy «Online») no se puede aprobar hasta que alguien la cubra
  desde *Equipo*.

**Para pasar a A después:** cambiar la visibilidad a «asignado o de la misma sede» en los tres
puntos de arriba y decidir si `PatientAssignment` queda como «psicólogo responsable». Pasar toda
consulta por sede por `formasDeSede`, o la lista sale incompleta sin error. Con A, el coordinador
dejaría de elegir psicólogo al aprobar.

## Si Miguel Ángel lo desmiente

Volver a la v1 es acotado: se vuelve a permitir `psychologist` en los `@Roles` de los endpoints de
revisión de `registration`, se restituye el filtro por sede en `listPending`/`assertCoversSede`
(que **no se borra**, se deja de usar para el coordinador) y se vuelve a mostrar la sección a los
psicólogos: quitar `roles` de `requests` en `Sidebar.tsx` y la condición de la ruta `/solicitudes`
en `DashboardApp.tsx`. No hay migración de datos de por medio.

## Cuándo se cierra este documento

Cuando llegue la respuesta literal del cliente:
1. Si la confirma → cambiar el estado de arriba a «CONFIRMADO», con fecha y cómo respondió.
2. Si la desmiente → marcar esta versión «DESCARTADA», con fecha, y revertir como se indica arriba.
3. En cualquiera de los dos casos, actualizar la entrada gemela en `docs/ASUNCIONES-PENDIENTES.md`
   y el punto correspondiente de «Estado actual» en `CLAUDE.md`.
