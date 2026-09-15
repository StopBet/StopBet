# Presupuesto del stack tecnológico — StopBet

> **Fecha:** 15 de septiembre de 2026 · **Tipo de cambio usado:** 1 USD = **$941 CLP**
> ([dolaronline.cl, 15-09-2026](https://www.dolaronline.cl/)).
> Todos los precios de servicios están en USD porque así los cobran sus proveedores; el
> equivalente en pesos se mueve con el dólar.

## Qué incluye y qué no

**Incluye:** todo lo que hay que pagarle a un tercero para que StopBet funcione — nube,
base de datos, IA, notificaciones, correo, archivos, tiendas de aplicaciones y dominio.

**No incluye:**

- **Horas de desarrollo del equipo.** Es, de lejos, el costo más grande del proyecto y va en
  una planilla aparte.
- Validación clínica de AJUTER (revisión de textos del asistente, protocolos).
- Asesoría legal por tratamiento de **datos sensibles de salud** (Ley 19.628 y su reforma):
  para una plataforma clínica esto no es opcional.
- Soporte y operación en marcha (alguien que responda cuando se cae algo a las 3 AM).
- Marketing, diseño de marca, contenidos.

---

## 1. Resumen: tres escenarios

| Escenario | Qué es | USD/mes | CLP/mes | CLP/año |
|---|---|---|---|---|
| **A · Piloto** | Lo que corre hoy, sin regularizar | **$5** | **$4.705** | **$56.460** |
| **B · Producción mínima** | Regularizado y con dominio propio, hasta ~100 pacientes | **$44** | **$41.404** | **$496.848** |
| **C · Producción con 500 pacientes** | Con holgura de recursos y correo pagado | **$120** | **$113.108** | **$1.357.298** |

A esto se suman los **pagos únicos** (sección 4) y, cuando exista la pasarela, la **comisión
de Transbank** (sección 3.4), que es un porcentaje de lo recaudado y no un costo fijo.

> **La conclusión honesta:** la infraestructura de StopBet es barata. Con 500 pacientes
> pagando $30.000 mensuales, los servicios cuestan **$113.108 al mes: un 0,75 % de lo recaudado**. El costo
> real del proyecto son las personas, no los servidores.

---

## 2. El stack, capa por capa

| Capa | Servicio | Para qué se usa | Plan hoy | Costo | Cuándo hay que subir de plan |
|---|---|---|---|---|---|
| **Backend + Base de datos** | [Railway](https://railway.com/pricing) | API NestJS y PostgreSQL | Hobby | **$5/mes** (incluye $5 de uso) | Al pasar de $5 de consumo, o al necesitar SMTP y varios ambientes → **Pro $20/asiento** |
| **Dashboard web** | [Vercel](https://vercel.com/pricing) | Panel del psicólogo y portal del familiar | Hobby | $0 | **Ya:** Hobby prohíbe el uso comercial → **Pro $20/usuario/mes** (anual) o $24 (mensual) |
| **Asistente IA** | [Gemini API](https://ai.google.dev/pricing) (`gemini-3.5-flash-lite`) | Conversación de apoyo y resumen clínico | Pago por uso | **$0,30 / millón de tokens de entrada** y **$2,50 / millón de salida** | Es variable puro: ver 3.1 |
| **Notificaciones push** | [Firebase Cloud Messaging](https://firebase.google.com/pricing) | Recordatorio de las 20:00 y alertas de pánico | Spark | **$0** | Nunca: FCM es gratis e ilimitado, también en el plan Blaze |
| **Correo transaccional** | [Brevo](https://www.brevo.com/pricing/) | Credenciales de psicólogos, avisos | Free | $0 (300 correos/día) | Sobre 300 diarios → **Starter desde $9/mes** |
| **Archivos (PDF, fotos)** | [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) | Informes y adjuntos | Free | $0 (10 GB y salida gratis) | Sobre 10 GB → **$0,015 por GB/mes** |
| **Repositorio y CI** | [GitHub](https://github.com/pricing) | Código y pruebas automáticas | Free (organización) | $0 | Sobre 2.000 min/mes de CI, o si se necesitan ramas protegidas → **Team $4/usuario/mes** |
| **Gestión** | Jira | Historias de usuario | Free | $0 | Sobre 10 usuarios |
| **Monitoreo** | Webhook de Discord | Aviso si el backend se cae | — | $0 | Si se quiere trazabilidad de errores real → Sentry (plan gratis alcanza al inicio) |
| **Dominio** | [NIC Chile](https://www.nic.cl/) | `stopbet.cl` | — | **$9.940 + IVA al año** (≈ $11.829) | Descuento por 2, 5 o 10 años |
| **Certificado SSL** | Vercel / Cloudflare | HTTPS | Incluido | $0 | — |
| **Tipografías** | Chillax y Satoshi (Fontshare) | Marca | Licencia gratuita | $0 | Confirmar la licencia comercial antes de publicar |
| **Pasarela de pago** | [Transbank Webpay Plus](https://publico.transbank.cl/tarifas) | Cobro del plan mensual | **No implementada** | Sin cargo fijo mensual | Comisión por venta: ver 3.4 |

### Detalle de los tres escenarios

| Servicio | A · Piloto | B · Producción mínima | C · 500 pacientes |
|---|---|---|---|
| Railway | $5 (Hobby) | $20 (Pro, 1 asiento) | $45 (Pro + holgura de CPU/RAM) |
| Vercel | $0 (Hobby, **no comercial**) | $20 (Pro, 1 asiento) | $40 (Pro, 2 asientos) |
| Gemini | ~$0 | ~$3 | ~$15 |
| Brevo | $0 | $0 | $19 (20.000 correos) |
| Cloudflare R2 | $0 | $0 | ~$0,20 |
| Firebase FCM | $0 | $0 | $0 |
| GitHub | $0 | $0 | $0 |
| Dominio `.cl` | — | ~$1 (prorrateado) | ~$1 (prorrateado) |
| **Total USD/mes** | **$5** | **$44** | **$120** |
| **Total CLP/mes** | **$4.705** | **$41.404** | **$113.108** |

---

## 3. Los costos que crecen con los pacientes

### 3.1 Gemini (el asistente)

Con `gemini-3.5-flash-lite` a **$0,30 por millón de tokens de entrada** y **$2,50 por millón
de salida**, y midiendo cómo conversa hoy el asistente (instrucciones clínicas + historial de
la sesión como entrada, respuesta de 2 a 4 frases como salida):

| Unidad | Costo estimado |
|---|---|
| Un mensaje del asistente | **≈ $0,0008 USD** (≈ $0,75 CLP) |
| Un resumen clínico de sesión | **≈ $0,0011 USD** (≈ $1 CLP) |
| **Un paciente activo al mes** (4 sesiones × 8 mensajes + 4 resúmenes) | **≈ $0,03 USD** (≈ **$28 CLP**) |

| Pacientes activos | USD/mes | CLP/mes |
|---|---|---|
| 100 | $3 | $2.823 |
| 500 | $15 | $14.115 |
| 2.000 | $60 | $56.460 |

**Dos advertencias sobre la IA:**

1. **El plan gratuito de la API no sirve acá.** Además de los límites de uso, los términos del
   nivel gratuito permiten que Google use el contenido para mejorar sus productos. Estamos
   mandando conversaciones de pacientes en tratamiento: **hay que usar el nivel pagado y
   confirmar por escrito el tratamiento de datos** antes de operar con pacientes reales.
   Hoy el backend ya sanitiza nombre y RUT antes de enviar, pero el contenido de la
   conversación viaja igual.
2. **Los modelos se jubilan.** Google retira `gemini-2.5-flash-lite` el 16 de octubre de 2026;
   el proyecto ya tuvo que migrar una vez cuando el modelo anterior empezó a responder 404.
   Hay que presupuestar una revisión de modelo **una o dos veces al año**.

### 3.2 Correo

Brevo regala 300 correos diarios (~9.000 al mes), suficiente mientras los correos sean solo
las credenciales de psicólogos nuevos. Si se agregan recordatorios o resúmenes por correo a
pacientes, se pasa rápido: Starter parte en **$9/mes por 5.000 correos** y llega a **$69/mes
por 100.000**.

### 3.3 Almacenamiento de archivos

Los 10 GB gratis de R2 alcanzan para miles de informes en PDF. Sobre eso, **$0,015 por GB al
mes**, y la salida de datos no se cobra — que es justamente lo caro en AWS S3.

> ⚠️ R2 está en el diseño pero **todavía no está conectado**: hoy no hay subida de archivos en
> el código. El costo es real solo cuando se implemente.

### 3.4 Transbank (cuando exista la pasarela)

Tarifa vigente desde el 20 de mayo de 2026 para comercios nuevos, **sin cargo fijo mensual**:

| Medio de pago | Comisión |
|---|---|
| Crédito | **2,35 % + IVA** |
| Débito y prepago | **1,75 % + IVA** |

Sobre el plan de $30.000 mensuales:

| Pacientes | Recaudación mensual | Comisión (crédito, con IVA) |
|---|---|---|
| 100 | $3.000.000 | ≈ **$83.895** |
| 500 | $15.000.000 | ≈ **$419.475** |

Es decir: **la comisión de Transbank, con 500 pacientes, cuesta casi cuatro veces todo el resto del stack junto.**
Es el único número grande de este presupuesto, y se descuenta de lo recaudado, no se paga
aparte. Conviene empujar el débito, que cuesta casi un punto menos.

---

## 4. Pagos únicos y anuales

| Concepto | Costo | Cuándo |
|---|---|---|
| [Google Play Console](https://play.google.com/console/signup) | **$25 USD, una sola vez** (≈ $23.525) | Antes de publicar la app Android |
| [Apple Developer Program](https://developer.apple.com/programs/) | **$99 USD al año** (≈ $93.159) | **Solo si se hace iOS.** Hoy el MVP es Android |
| Dominio `stopbet.cl` | **$9.940 + IVA al año** (≈ $11.829) | Ya, para no depender de `*.vercel.app` |

**Primer año, solo Android:** $25 + dominio ≈ **$35.354 CLP**.
**Primer año con iOS:** ≈ **$128.513 CLP**.

---

## 5. Tres cosas que hay que regularizar antes de cobrarle a un paciente

Esto no es opinión de diseño: son condiciones para poder operar.

1. **Vercel Hobby no permite uso comercial.** El dashboard del psicólogo está hoy en el plan
   gratuito, y los términos de Vercel definen uso comercial de forma amplia — incluye cualquier
   proyecto del que alguien obtenga un beneficio económico, incluso si quien programó es un
   empleado o un consultor pagado. Cobrar $30.000 mensuales por la plataforma cae de lleno ahí.
   **Costo de regularizar: $20 por usuario al mes.**
2. **La base de datos de producción corre en modo desarrollo.** Railway está con
   `NODE_ENV=development` a propósito, para que TypeORM cree las tablas solo con
   `synchronize`. Funciona, pero es exactamente lo que el propio proyecto prohíbe, y el día
   que haya datos de pacientes reales un cambio de esquema los puede destruir. **Costo: horas
   de desarrollo (migraciones), no dinero de servicios.**
3. **No existe la pasarela de pago.** `POST /billing/pay` marca las facturas como pagadas y
   reactiva la cuenta: no cobra nada. La app ya no dice lo contrario, pero mientras no se
   integre Webpay el cobro se coordina fuera del sistema. **Costo: horas de desarrollo + el
   convenio comercial de AJUTER con Transbank.**

Hay una cuarta, menor: en Railway los planes Free, Trial y Hobby **bloquean el SMTP saliente**,
por eso el correo va por la API HTTPS de Brevo y no por SMTP. Si alguien cambia esa variable en
producción, los correos dejan de salir y el `POST /psychologists` tarda 10 segundos en
responder.

---

## 6. Supuestos usados

- **Escenario B** asume 1 asiento de desarrollador en Vercel y 1 en Railway, ~100 pacientes
  activos y el correo solo para credenciales de psicólogos.
- **Escenario C** asume 500 pacientes activos, 2 asientos de Vercel, backend y base de datos
  con holgura (aproximadamente 1 vCPU y 2 GB de RAM en total) y 20.000 correos al mes.
- El consumo de Gemini se estimó midiendo el comportamiento actual del asistente, no con datos
  de producción: **hay que recalcularlo con uso real después del primer mes.**
- Los planes de Railway y Vercel incluyen crédito de uso ($5 y $20 respectivamente). Si el
  consumo lo supera, se paga la diferencia encima de la suscripción — **la suscripción es un
  piso, no un techo.**
- No se consideró respaldo externo de la base de datos. Para datos clínicos **debería
  considerarse**; Railway ofrece respaldos, pero conviene además una copia fuera del proveedor.

---

## 7. Fuentes

Todos los precios fueron verificados el **15 de septiembre de 2026**. Los proveedores los
cambian sin aviso: conviene revisarlos antes de firmar cualquier compromiso con el cliente.

- [Railway — Pricing](https://railway.com/pricing) y [Pricing Plans (docs)](https://docs.railway.com/pricing/plans)
- [Vercel — Pricing](https://vercel.com/pricing) y [Fair use / uso comercial](https://vercel.com/docs/limits/fair-use-guidelines)
- [Gemini API — Pricing](https://ai.google.dev/pricing)
- [Firebase — Pricing](https://firebase.google.com/pricing)
- [Brevo — Pricing](https://www.brevo.com/pricing/)
- [Cloudflare R2 — Pricing](https://developers.cloudflare.com/r2/pricing/)
- [GitHub — Pricing](https://github.com/pricing) y [facturación de Actions](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [Transbank — Tarifas y comisiones](https://publico.transbank.cl/tarifas)
- [NIC Chile — Aranceles](https://www.nic.cl/registrar-dominio/)
- [Google Play Console](https://play.google.com/console/signup) · [Apple Developer Program](https://developer.apple.com/programs/)
- Tipo de cambio: [dolaronline.cl](https://www.dolaronline.cl/)
