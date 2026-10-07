# SPIKE 2 (CA5-CA6) — Pasarela de pago para la mensualidad de AJUTER

**Dueño:** Matías Lara (ejecutado por José Meza) · **Rama:** `feature/spike-2-pasarela-pago`
**Historias que dependen de esto:** HdU09 y HdU12 (pago de la mensualidad), HdU19 (activación de la cuenta tras aprobar la solicitud), HdU23 (el familiar paga las cuotas del paciente)
**Criterios:** CA5 y CA6 del SPIKE 2 (`docs/Sprint 2.md`).

> **Estado (07-10-2026):** CA5 redactado, con fuentes del mismo día (§2 y §3). El **PoC del CA6 está
> diseñado** (§4); falta correr el sandbox real y adjuntar la evidencia (§5 y §6, paso 3). Lo marcado
> _verificado_ tiene fuente en §3; lo marcado _inferencia_ o _no verificado_ **no se afirma todavía**.

**Respuesta corta:** la pasarela recomendada es **Transbank Webpay Oneclick (Mall)**. Es la única de
las tres que une una comisión más baja, un SDK oficial para Node, un sandbox con credenciales
públicas (sin crear cuenta) y un cobro posterior que el **propio backend** dispara sin que el
paciente haga nada. Su costo es de trámite, no técnico: AJUTER tiene que afiliarse a Transbank y
pasar su validación, y **nada de eso se puede acelerar desde el código** (§7, riesgo principal).
**Flow** queda como respaldo; **Mercado Pago** no encaja con un cobro a demanda.

---

## 1. Qué necesita StopBet de una pasarela

La mensualidad es de **$30.000 CLP** (`MONTHLY_AMOUNT_CLP`, `apps/backend/src/billing/billing.service.ts`).
Hoy `POST /billing/pay` **marca la cuota como pagada sin cobrar nada** (`docs/ASUNCIONES-PENDIENTES.md`,
punto 6). Lo que le pedimos a la pasarela real:

| Necesidad | Por qué |
|---|---|
| **Enrolar la tarjeta una sola vez** | El paciente no debería teclear su tarjeta cada mes: la HdU09 y la regla del cliente de suspender al tercer mes impago suponen un cobro que ocurre solo |
| **Cobrar después desde el backend, sin el paciente** | Es el CA6: «el segundo [cobro], sin interacción del usuario» |
| **StopBet nunca ve la tarjeta** | Datos de pago de personas en tratamiento por ludopatía: lo mínimo posible en nuestra base. La tarjeta se ingresa en un formulario de la pasarela |
| **Confirmación que el backend pueda verificar** | Una cuota solo se marca pagada con la respuesta de la pasarela, nunca con lo que diga el navegador |
| **Sandbox usable en el plazo** | El Spike se cierra dentro del sprint |

---

## 2. Comparación (CA5)

### 2.0 Matriz

| | **Transbank Oneclick Mall** | **Flow** (Cargo Automático / Suscripciones) | **Mercado Pago** (Suscripciones) |
|---|---|---|---|
| **Comisión crédito** | **2,29 % + IVA** [T1] | 2,89 % + IVA (abono al 3.er día hábil) o 3,19 % + IVA (día hábil siguiente) [F1] | 2,89 % + IVA (a 10 días) o 3,19 % + IVA (al instante) [M1] |
| **Débito y prepago** | **1,49 % + IVA** [T1]. Que Oneclick los admita: ver §2.1 | Mismo % que crédito [F1]. Cargo Automático «en tarjetas de crédito, débito y prepago» [F3]; la especificación de la API solo dice crédito [F4] | Mismo % [M1]. «Tarjeta de crédito o débito» [M3] |
| **Costos fijos o de instalación** | Ninguno publicado [T5] [T6] | «Sin costos fijos ni de mantención» [F1] | «No hay costos fijos» [M2] |
| **Abono** | 24 a 72 h; en Oneclick, débito 24 h y crédito 48 h hábiles [T1] [T5] | 3.er día hábil o día siguiente [F1] | Al instante o a 10 días, **a la cuenta Mercado Pago** [M1] |
| **Devolución** | Reversa (monto total, dentro de 3 h) o anulación (hasta 90 días por API) [T8]. El costo solo aparece en un PDF de 2023 [T9] | $202 + IVA por reembolso; el pagador debe aceptarlo en 10 días [F1] [F2] | Hasta 180 días, requiere saldo [M7]. Costo: no verificado |
| **Quién agenda el cobro** | **Nuestro backend** (un cron) | Flow (planes) **o** nuestro backend (`customer/charge`) [F3] | Mercado Pago [M4] |
| **Cobro sin el usuario, por API** | **Sí:** `authorize` con el `tbk_user` guardado [T3] | **Sí:** `customer/charge` [F4] | **No a demanda.** Se modifica la suscripción. «Pagos Automáticos» exige autorización comercial y no se confirmó en Chile [M9] |
| **Reintentos** | Los maneja el comercio | `charges_retries_number` en planes (3 por omisión) [F4] | Hasta 4 en 10 días; tras 3 cuotas rechazadas se da de baja [M4] |
| **Límites** | Se fijan en la afiliación (códigos -97, -98, -99) [T3] [T4] | $250.000 por pago, $500.000 diarios, 5 pagos diarios por cliente; ampliables [F3] | No encontrados |
| **SDK para Node** | `transbank-sdk` 6.1.1, **oficial** [T15] | **No hay oficial**: REST con firma HMAC-SHA256 [F4] | `mercadopago` 3.6.1, **oficial** [M11] |
| **Cómo llega la confirmación** | Redirección del navegador + una llamada del backend. **Sin webhook, sin URL pública de servidor a servidor** | Llamada de Flow a nuestra URL (POST con token) y consulta; **URL pública** | Webhooks; **URL pública** [M8] |
| **Sandbox** | **Credenciales públicas, sin cuenta** [T7] | Cuenta aparte en sandbox.flow.cl [F5] | Cuentas y usuarios de prueba [M6] |

**Costo de un cobro de $30.000** (cálculo propio con las tasas de arriba; la comisión no incluye IVA):

| Opción | Comisión neta | Con IVA 19 % |
|---|---|---|
| Transbank, crédito (2,29 %) | $687 | $818 |
| Transbank, débito o prepago (1,49 %) | $447 | $532 |
| Flow o Mercado Pago (2,89 %) | $867 | $1.032 |
| Flow o Mercado Pago (3,19 %) | $957 | $1.139 |

Con 100 pacientes pagando con crédito, Transbank cuesta ≈ **$81.800 al mes** y Flow o Mercado Pago a
2,89 %, ≈ **$103.200**: unos $21.000 mensuales de diferencia, que crecen con el número de pacientes.

> ⚠️ **Corrección al presupuesto.** `docs/presupuesto-stack-2026-09.md` (§3.4) usa 2,35 % y 1,75 %.
> La página oficial de tarifas hoy dice **2,29 % y 1,49 %** «a partir del 1 de septiembre de 2026
> para nuevos comercios afiliados» [T1]. Las cifras del presupuesto siguen publicadas en el centro de
> ayuda de Transbank [T2], pero sin fecha. Se actualizó el presupuesto. Ambas valen **para comercios
> nuevos**: si AJUTER ya fuera cliente de Transbank, hay que confirmar cuál le toca.

### 2.1 Transbank Webpay Oneclick Mall — la recomendada

**Verificado:**
- **Enrolamiento:** el backend llama a `inscriptions` (`username`, `email`, `response_url`) y recibe un token y una URL. El navegador del paciente se envía por **POST con `TBK_TOKEN`** al formulario de Transbank. Ahí el paciente ingresa la tarjeta y se autentica con su banco. El formulario dura **4 minutos** en producción [T3].
- **Al volver** al `response_url`, el backend debe llamar a `finish` **dentro de 60 segundos** o Transbank borra la inscripción. `finish` entrega el `tbk_user` y los datos de la tarjeta (tipo y últimos 4 dígitos). Un mismo `username` solo puede tener una tarjeta [T3].
- **Cobro sin el paciente:** `authorize` con `username`, `tbk_user`, una orden de compra y el detalle. Responde en el mismo llamado, por cada tienda. «Oneclick solo opera en modalidad Mall»: un código de comercio mall y uno o más códigos de tienda [T3]. **Aprobado = `response_code` 0 y `status` `AUTHORIZED` en cada detalle** [T4].
- **Límites** de monto por pago, monto diario y cantidad diaria: se definen en el contrato de afiliación [T3] [T4].
- **Sandbox con credenciales públicas** (mall `597055555541`, tiendas `597055555542` y `597055555543`) y tarjetas de prueba documentadas [T7]. La URL de retorno puede ser `localhost`: es una redirección del navegador, no una llamada de Transbank a nuestro servidor.
- **Alta de comercio:** formulario en publico.transbank.cl, firma digital y código de comercio por correo. La validación de integraciones Oneclick Mall con SDK es **un formulario online**; al aprobarla entregan la llave secreta de producción y piden una **compra real de $50** [T7].
- **Requisitos:** una persona jurídica debe tener inicio de actividades en el SII [T10]. La documentación que listan (escritura o extracto de constitución con vigencia, cédula del representante legal) corresponde a solicitudes posteriores a la afiliación y se trata como indicativa [T11].
- **SDK:** `transbank-sdk` 6.1.1 (publicada el 09-12-2025, BSD-3, Node ≥ 18, depende de `axios`). **Todos sus métodos devuelven `Promise<any>`**: la regla del repo de no usar `any` obliga a tipar las respuestas en un adaptador [T15].

**Débito y prepago: las fuentes se contradicen.** La documentación técnica dice que la autorización valida «tarjeta de crédito, débito o prepago» y la respuesta lista los tipos `VD` y `VP` [T3] [T4]. La frase «no se aceptan tarjetas de débito ni prepago» está en la sección de **captura diferida**, no en la descripción general [T3]. El centro de ayuda afirma que desde 2020 Oneclick admite todos los medios, pero en otros párrafos habla solo de crédito [T6]. _Lo más probable es que sí admita débito, pero hay que pedírselo por escrito al ejecutivo antes de comprometerse._

**Inferencias:**
- Sin webhook, el flujo en la app móvil queda como: abrir en el navegador la página de Transbank, volver a un endpoint HTTPS **del backend** que llama a `finish` y de ahí redirigir a la app.
- Los cobros posteriores no se autentican con el banco. Ante un contracargo, el riesgo probablemente recae en el comercio [T9]. Sin confirmar.
- La ayuda dice que para usar Oneclick «es necesario que el comercio ya posea Webpay Plus» [T6]; la página pública dice que un cliente existente puede contratarlo [T5]. **Preguntar si Oneclick se contrata solo.**

### 2.2 Flow — el respaldo

**Verificado:**
- **Cargo Automático** es lo más parecido a Oneclick: se enrola la tarjeta una vez en una página de Flow (`customer/register`) y después el backend cobra con `customer/charge`, con la respuesta en el mismo llamado [F4]. Además ofrece **suscripciones** donde es Flow quien agenda (planes con reintentos) [F3] [F4].
- **Pero** el comercio necesita **una cuenta corriente bancaria a nombre de una empresa con RUT en el SII**, que el giro del SII ampare lo que cobra, y que el servicio esté publicado en una página web pública con precio y condiciones. «Si eres persona natural, por el momento este servicio solo se encuentra disponible para empresas» [F3].
- Acepta contribuyentes afectos, exentos «o que reciben donaciones» [F5].
- La API es REST con firma HMAC-SHA256 [F4]. **No existe cliente oficial para Node**: el repositorio oficial es de PHP y no se toca desde 2019. Hay paquetes de terceros, pero conviene un cliente propio de ~100 líneas antes que depender de un paquete no oficial con un solo mantenedor _(opinión)_.
- El sandbox exige crear una cuenta en dashboard.sandbox.flow.cl [F5]. Para pagos recurrentes la documentación solo trae tarjetas de prueba **de Perú** [F6].

**No verificado:** si una **fundación** cuenta como «empresa» para Cargo Automático, los documentos exactos y el plazo de revisión (las páginas de creación de cuenta devolvieron 403), y si el débito enrola de verdad (la FAQ dice que sí; la especificación de la API dice solo crédito).

### 2.3 Mercado Pago — no encaja con un cobro a demanda

**Verificado:**
- Las **suscripciones** (`/preapproval`) las agenda Mercado Pago: «programa y crea automáticamente los pagos». **El comercio no dispara un cobro ad hoc**; se modifica la suscripción [M4] [M5].
- Reintentos: hasta 4 en 10 días; **tras 3 cuotas rechazadas, la suscripción se da de baja** [M4]. Eso pisa la regla del cliente (suspender al tercer mes impago): sería Mercado Pago quien decide.
- «Pagos Automáticos» (cobro iniciado por el comercio, sin CVV) existe en la documentación, pero «es necesario contar con la autorización del equipo Comercial», y **no pude confirmar que aplique a Chile** [M9].
- Las notificaciones de las suscripciones exigen una **URL pública** [M8]. El abono llega a una cuenta Mercado Pago, no directamente al banco [M1].
- SDK oficial `mercadopago` 3.6.1, con tipos incluidos [M11].

**No verificado:** requisitos de una cuenta de empresa para una fundación, plazos y costo de reembolso (las páginas exigen sesión o cargan por JavaScript).

### 2.4 Descartes

| Opción | Por qué se descarta |
|---|---|
| **Webpay Plus** | Cada pago exige al titular en el formulario de Transbank [T3]. **No cumple el CA6** |
| **PatPass by Webpay** | Solo tarjetas de crédito, y la documentación dice que los cobros se administran en Transdata (un archivo BIC), no por API [T13] [T14] |
| **Khipu, pago instantáneo** | Transferencia que exige al usuario cada vez |
| **Khipu, Pagos Automáticos** | Existe, por mandato y transferencia, «desde 0,0125 UF + IVA» por transacción (≈ $612 con IVA). Pero requiere activación comercial y no verifiqué bancos, límites ni plazos [K1] [K2]. **Vale una consulta como alternativa**, no se evaluó a fondo |

---

## 3. Fuentes

Todas consultadas el **07-10-2026**. Las cifras de tarifas cambian: antes de contratar, repetir la consulta.

**Transbank**
- [T1] https://publico.transbank.cl/tarifas · [T2] https://ayuda.transbank.cl/tarifas-vender-webpay
- [T3] https://www.transbankdevelopers.cl/documentacion/oneclick · [T4] https://www.transbankdevelopers.cl/referencia/oneclick
- [T5] https://publico.transbank.cl/productos-y-servicios/soluciones-para-ventas-internet/webpay-oneclick · [T6] https://ayuda.transbank.cl/que-es-webpay-oneclick
- [T7] https://www.transbankdevelopers.cl/documentacion/como_empezar · [T8] https://www.transbankdevelopers.cl/producto/webpay
- [T9] PDF «Servicios y Tarifas a Establecimientos de Comercios» (~2023): https://publico.transbank.cl/documents/20129/0/Servicios+y+Tarifas+a+Establecimientos+de+Comercios.pdf/fd4a881b-602e-68a6-e681-b7fcb61391dc
- [T10] https://ayuda.transbank.cl/como-vender-transbank · [T11] https://ayuda.transbank.cl/requerimientos
- [T13] https://publico.transbank.cl/productos-y-servicios/soluciones-para-ventas-internet/webpay-patpass · [T14] https://www.transbankdevelopers.cl/documentacion/patpass
- [T15] `npm view transbank-sdk` (6.1.1)

**Flow**
- [F1] https://web.flow.cl/tarifas/ · [F2] https://web.flow.cl/es-cl/reembolsos/ · [F3] https://web.flow.cl/es-cl/preguntas-frecuentes/cargo-automatico/
- [F4] https://www.flow.cl/docs/apiFlow.yaml · [F5] https://web.flow.cl/es-cl/ayuda/ · [F6] https://developers.flow.cl/docs/credentials

**Mercado Pago**
- [M1] https://www.mercadopago.cl/herramientas-para-vender/suscripciones · [M2] https://www.mercadopago.cl/herramientas-para-vender/link-de-pago
- [M3] https://www.mercadopago.cl/developers/es/docs/subscriptions/overview · [M4] .../subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments
- [M5] .../subscriptions/integration-configuration/subscription-associated-plan · [M6] .../subscriptions/additional-content/your-integrations/test/cards
- [M7] .../subscriptions/additional-content/cancellations-and-refunds · [M8] .../subscriptions/additional-content/your-integrations/notifications/webhooks
- [M9] https://www.mercadopago.cl/developers/es/docs/automatic-payments/overview.md · [M11] `npm view mercadopago` (3.6.1)

**Khipu:** [K1] https://www.khipu.com/en-us/page/tarifas-pagos-automaticos · [K2] https://docs.khipu.com/en/payment-solutions/automatic-payments/description

**No se pudieron leer** (exigen sesión, cargan por JavaScript o dieron 403): https://www.mercadopago.cl/costs-section/, la ayuda de comisiones de Mercado Pago, las páginas de creación de cuenta de Flow y las de alta de empresa de Mercado Pago. Lo que dependía de ellas está marcado _no verificado_.

---

## 4. El PoC del CA6

> **Pendiente de redactar con el código real.** Se completa en el paso 2 de §6: flujo, tablas,
> endpoints, idempotencia, configuración y seguridad.

## 5. Evidencia del sandbox

> **Pendiente.** Se llena en el paso 3 de §6, con la prueba real contra el ambiente de integración de
> Transbank: capturas de la inscripción, los dos cobros y la consulta de estado a Transbank.

---

## 6. Pasos para cubrir mis CA

### Paso 1 — CA5: comparación de pasarelas ✅ listo
Secciones 2 y 3. Tres pasarelas comparadas (Oneclick, Flow, Mercado Pago) en costo, cobro recurrente,
requisitos de comercio e integración con NestJS, con los descartes justificados.

### Paso 2 — CA6: construir el sandbox ⬜
Módulo `payments` del backend con Webpay Oneclick Mall (§4).

### Paso 3 — CA6: correr el sandbox y juntar la evidencia ⬜
Una inscripción de tarjeta y **dos cobros**, el segundo disparado por el backend sin el paciente (§5).

### Paso 4 — Cierre ⬜
Actualizar `docs/ASUNCIONES-PENDIENTES.md`, `docs/presupuesto-stack-2026-09.md` y `CLAUDE.md`.

---

## 7. Alcance para producción

**Fuera de este Spike** (el sandbox no toca las pantallas de pacientes ni de familiares):
- **Cambiar el pago simulado por el real** en `PaymentScreen`, `SuspendedAccountScreen` y el portal del familiar.
- **Quién paga**, el paciente o el familiar (`ASUNCIONES-PENDIENTES.md`, punto 4). Inscribir la tarjeta de un familiar no está resuelto.
- **Paciente suspendido:** hoy no puede ni iniciar sesión para pagar (punto 5). Un cobro automático lo reactiva **sin que él entre**, lo que resuelve parte del problema. Falta decidir si eso es lo que quiere el cliente.
- **La regla del tercer mes** (punto 5-bis) y los **reintentos** ante un rechazo: ninguna pasarela decide eso por nosotros con Oneclick.
- **Devoluciones**, y **qué dice la notificación** al paciente cuando un cobro falla.
- **Atar la activación de la cuenta** (HdU19) al primer cobro exitoso.

**Riesgo principal: la afiliación de AJUTER a Transbank.** Es un trámite comercial con firma de contrato,
validación y una compra real de $50, y **ninguna cifra pública dice cuánto demora** (el único «24 a 72
horas» que encontré es de otro producto, el Link de Pago [T16]). Hay que pedir los datos por escrito
**ya**, porque ni la integración ni el sandbox lo adelantan:
1. ¿La tarifa de Oneclick es la misma 2,29 % / 1,49 %?
2. ¿Oneclick admite débito y prepago?
3. ¿Se contrata sin tener Webpay Plus? ¿Qué límites de monto diario y por pago se pueden fijar para $30.000?
4. ¿Qué documentos pide a una **fundación**, y cuánto demora?
5. IVA: si los ingresos de AJUTER son exentos o no afectos, el IVA de la comisión es un costo no recuperable _(inferencia tributaria: consultar al contador)_.

Si la respuesta de Transbank es mala o lenta, **el respaldo es Flow**, que exige una cuenta corriente de
empresa y tiene una comisión más alta. La integración está aislada detrás de un adaptador (§4) justo
para que cambiar de pasarela no toque el resto del backend.
