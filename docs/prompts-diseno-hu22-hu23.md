# Prompts de diseño — HDU 22 y HDU 23 (Familiar)

> Prompts listos para pegar en Claude Design. Cubren las vistas nuevas que necesitan HDU 22
> (registro público del familiar) y HDU 23 (el psicólogo confirma o rechaza el vínculo), sacadas
> de `docs/Sprint 2.md`. Cada prompt es autocontenido — puedes copiar uno solo sin los demás.
>
> Las historias completas y sus criterios de aceptación están en `docs/Sprint 2.md` (HDU 22 y
> HDU 23). El detalle técnico de qué existe hoy y qué falta está en
> `C:\Users\jmeza\.claude\plans\necesito-ayuda-hace-poco-luminous-newell.md`.

## Brief de marca (repetido en cada prompt, no hace falta leerlo aparte)

- **Producto:** StopBet, plataforma clínica de acompañamiento para tratamiento de ludopatía.
  Tono calmado, profesional, nunca alarmante — es software clínico, no una app de consumo.
- **Paleta:**
  - Primario (acciones, headers, texto de marca): `#396fb6`, hover `#2d5a9e`
  - Acento / fondos claros de badges: `#93bce5` (fondo de badge real: `#ECF3FA`)
  - Fondo de página: `#f4f4e9` (crema)
  - Superficie (tarjetas, modales): `#FFFFFF`, con un fondo alterno tinte azul `#ECF3FA`
  - Texto principal: `#3a3939` — texto secundario: `#6b6a6a`
  - Verde (solo para confirmaciones positivas, nunca como color dominante): texto `#5B7324`
  - Rojo — **reservado casi exclusivamente para el botón de pánico**; en estas vistas solo se
    usa en el estado "rechazado" y en el botón de rechazar, nunca decorativo: `#B83232`
  - Bordes/separadores: `#E2E2D6`
- **Tipografía:** Encabezados en **Chillax** (si no está disponible, Nunito) con peso 600-800.
  Cuerpo/UI en **Satoshi** (si no está disponible, Inter), peso 400-600.
- **Forma:** esquinas muy redondeadas — tarjetas 16-20px, botones tipo píldora (`border-radius:
  9999px`), inputs 8-10px.
- **Iconografía:** trazo lineal estilo Lucide, 1.5-2px de grosor, nunca relleno sólido salvo
  círculos de fondo. Los nombres de ícono sugeridos abajo existen en el set real del proyecto
  (Lucide): `clock`, `circle-alert`, `circle-check`, `inbox`, `users`, `user-plus`, `shield`,
  `heart-handshake`, `x`, `chevron-down`. No inventes íconos fuera de ese estilo.
- **Todo el texto de interfaz va en español de Chile**, trato de "tú", nunca en inglés.
- **Accesibilidad:** contraste mínimo AA en todo texto sobre color. Todo estado interactivo
  (botón, campo, fila) necesita un estado de foco visible.
- **Responsive:** diseña dos anchos — de escritorio (≥ 960px, layout de dos columnas o tabla) y
  angosto/móvil (< 960px, todo apilado en una columna, tarjetas en vez de tabla).

---

## Prompt 1 — Página de registro del familiar (pública, sin sesión)

```
Diseña una página web pública (sin sesión iniciada) de registro de cuenta para "StopBet", una
plataforma clínica de acompañamiento para tratamiento de ludopatía. Esta pantalla es el punto de
entrada para un FAMILIAR de un paciente en tratamiento: crea su cuenta y declara el RUT del
paciente al que dice estar vinculado, para que el equipo clínico revise y confirme después el
vínculo (esa confirmación no se pide, no la diseñes — solo la creación de la cuenta).

CONTEXTO DE MARCA
- Producto: StopBet. Tono calmado, profesional, clínico — nunca alarmante ni "gamificado".
- Paleta: primario #396fb6 (hover #2d5a9e), fondo de página crema #f4f4e9, tarjetas blancas
  #FFFFFF, texto principal #3a3939, texto secundario #6b6a6a, bordes #E2E2D6, acento azul claro
  de fondo #ECF3FA. El rojo (#B83232) NO se usa en esta pantalla salvo para bordes/texto de error
  de validación puntual — no es una pantalla de alerta.
- Tipografía: encabezados en Chillax (respaldo Nunito), peso 700-800; cuerpo en Satoshi (respaldo
  Inter), peso 400-600.
- Esquinas muy redondeadas: tarjeta contenedora 16-20px, inputs 8-10px, botón principal en
  píldora (completamente redondeado).
- Texto en español de Chile, trato de "tú".

LAYOUT — ESCRITORIO (≥960px)
Panel dividido en dos columnas, igual que la pantalla de login del mismo producto:
- Columna izquierda (fondo con degradado azul institucional, de #93bce5 a #396fb6 a #2d5a9e):
  logo/isotipo simple, el nombre "StopBet" y una frase breve de bienvenida orientada al familiar,
  por ejemplo "Acompaña a tu familiar en su proceso" — sin ilustraciones complejas, algo sobrio.
- Columna derecha (fondo crema #f4f4e9): tarjeta blanca centrada, ancho máximo ~460px, sombra
  suave, con el formulario.

LAYOUT — MÓVIL (<960px)
Una sola columna: header compacto con isotipo + "StopBet" arriba, tarjeta del formulario debajo
ocupando el ancho disponible con margen lateral.

CONTENIDO DE LA TARJETA
1. Título "Crea tu cuenta de familiar" (Chillax, ~28px).
2. Subtítulo corto: "Vas a poder ver las sesiones grupales y el estado de tu familiar una vez
   que el equipo clínico confirme el vínculo."
3. Formulario con estos campos, cada uno con su etiqueta arriba y mensaje de error en rojo
   debajo del campo (nunca un banner genérico arriba que tape los datos ya escritos):
   - Nombre
   - Apellido
   - Correo electrónico
   - Contraseña (con ícono de ojo para mostrar/ocultar)
   - Teléfono (opcional, indicarlo con "(opcional)" junto a la etiqueta)
   - Una separación visual clara antes del siguiente campo, con un texto breve tipo "Datos del
     paciente"
   - RUT del paciente al que estás vinculado — input con formato de RUT chileno (12.345.678-9),
     con un texto de ayuda pequeño debajo: "Se lo pediremos a tu familiar o lo encuentras en su
     ficha de ingreso."
4. Botón principal en píldora, ancho completo, color primario #396fb6, texto blanco: "Crear
   cuenta".
5. Debajo del botón, un enlace de texto pequeño "¿Ya tienes cuenta? Inicia sesión".
6. Estado de error de campo: borde rojo (#B83232) en el input + texto de error de 12-13px en
   rojo debajo, SIN perder el resto de los datos ya ingresados en otros campos.
7. Estado de envío: el botón muestra un pequeño loader y se deshabilita.

DISEÑA TAMBIÉN el estado de éxito que reemplaza la tarjeta del formulario tras enviar: un ícono
de confirmación circular (fondo azul claro #ECF3FA, ícono de check en #396fb6), título "Solicitud
enviada" y un texto que NO confirma ni niega si el paciente fue encontrado (mensaje genérico),
algo como: "Revisamos tu solicitud y te avisaremos por correo cuando el equipo clínico confirme
el vínculo." con un botón secundario (borde, sin relleno) "Ir a iniciar sesión".

No incluyas navegación superior ni sidebar — es una pantalla pública aislada, como un login.
```

---

## Prompt 2 — Sección "Familiares pendientes" del dashboard clínico

```
Diseña una sección dentro del panel/dashboard interno de "StopBet" (plataforma clínica de
acompañamiento para tratamiento de ludopatía), pensada para el rol PSICÓLOGO. Esta sección
muestra los familiares que se registraron declarando un vínculo con un paciente de su sede y
están esperando que el psicólogo confirme o rechace ese vínculo.

Esta vista vive DENTRO de un dashboard ya existente con sidebar de navegación a la izquierda
(no la diseñes, solo el contenido de la página a la derecha) y header superior simple.

CONTEXTO DE MARCA
- Paleta: primario #396fb6, fondo de página crema #f4f4e9, tarjetas/paneles blancos #FFFFFF con
  borde sutil #E2E2D6 y sombra suave, texto principal #3a3939, texto secundario #6b6a6a, azul
  claro de fondo para badges #ECF3FA con texto #396fb6, verde de confirmación #5B7324 (solo
  texto/ícono, nunca relleno sólido grande), rojo #B83232 reservado para el botón/estado de
  rechazo.
- Tipografía: encabezados Chillax (respaldo Nunito) 600-700, cuerpo Satoshi (respaldo Inter).
- Botones en píldora, tarjetas con esquinas de 16px, badges con esquinas de 8-10px.

ESTRUCTURA DE LA PÁGINA
1. Banner introductorio arriba: fondo azul claro (#ECF3FA), borde #93bce5, ícono de bandeja de
   entrada a la izquierda, título "Tienes N familiares pendientes de vinculación" y una línea
   secundaria "Confirma el vínculo si corresponde, o recházalo si el familiar se equivocó de
   paciente."
2. Panel blanco con el listado, encabezado propio: título "Familiares pendientes" a la izquierda
   y un contador en píldora azul claro a la derecha ("N pendientes").
3. **Estado vacío** (sin nadie pendiente): centrado, ícono grande de check circular en verde
   (#5B7324), título "Sin familiares pendientes" y subtítulo "Todas las solicitudes fueron
   revisadas."
4. **Listado con datos — versión escritorio (tabla):** columnas Familiar (avatar circular con
   iniciales sobre fondo azul claro + nombre + correo), Paciente declarado (nombre del paciente,
   o si el RUT no coincidió con nadie, un badge de advertencia "RUT no encontrado" en vez del
   nombre), Fecha de solicitud, Acciones (dos botones: "Confirmar" en píldora azul sólida con
   ícono de check, y "Rechazar" en píldora con borde rojo y texto rojo, sin relleno).
5. **Listado con datos — versión móvil (tarjetas apiladas):** una tarjeta por familiar con la
   misma información en vertical y los dos botones de acción en la parte inferior, uno junto al
   otro ocupando el ancho.
6. Incluye 4-5 filas de ejemplo con datos ficticios variados (incluye al menos una fila con "RUT
   no encontrado" para mostrar ese caso).

No diseñes los modales de confirmar/rechazar en este prompt — van en un prompt aparte.
```

---

## Prompt 3 — Modal de confirmar o rechazar vínculo

```
Diseña dos variantes de un modal de confirmación para el dashboard clínico de "StopBet"
(plataforma de acompañamiento para tratamiento de ludopatía), rol PSICÓLOGO. Se abren desde una
lista de "familiares pendientes de vinculación" al presionar "Confirmar" o "Rechazar" sobre un
familiar.

CONTEXTO DE MARCA
- Fondo oscurecido semitransparente detrás del modal (scrim negro ~40% opacidad).
- Modal: tarjeta blanca #FFFFFF, esquinas de 20px, sombra pronunciada, ancho ~480-520px en
  escritorio, casi ancho completo con margen en móvil.
- Primario #396fb6, texto principal #3a3939, texto secundario #6b6a6a, borde #E2E2D6, verde de
  confirmación #5B7324, rojo #B83232 solo para la variante de rechazo.
- Tipografía: título en Chillax (respaldo Nunito) 700, cuerpo en Satoshi (respaldo Inter).
- Botones en píldora.

VARIANTE A — Confirmar vínculo
- Header del modal: título "Confirmar vínculo" a la izquierda, botón circular de cerrar (×) a la
  derecha.
- Debajo, una tarjeta pequeña de resumen con fondo azul claro (#ECF3FA): avatar circular con
  iniciales del familiar, su nombre y correo, y debajo "Paciente: [nombre del paciente]".
- Texto de cuerpo: "Al confirmar, [nombre del familiar] podrá ver las sesiones grupales y el
  estado de [nombre del paciente]. Esta acción notifica a ambos."
- Footer con dos botones alineados a la derecha: "Cancelar" (borde gris, sin relleno) y
  "Confirmar vínculo" (píldora azul sólida, ícono de check, texto blanco).

VARIANTE B — Rechazar vínculo
- Mismo header pero título "Rechazar vínculo".
- Misma tarjeta de resumen del familiar y el paciente declarado.
- Un aviso con borde/ícono en rojo suave: "Esta acción le indica al familiar que su solicitud no
  fue aprobada. No podrá ver información del paciente."
- Footer con "Cancelar" (borde gris) y "Rechazar vínculo" (píldora con fondo blanco, borde rojo
  #B83232, texto rojo, ícono de X) — el rojo se reserva para esta acción, no lo uses como color
  decorativo en el resto del modal.

Ambas variantes deben verse como parte de la misma familia visual que el resto del panel clínico
(no como una alerta crítica): son decisiones administrativas, no emergencias.
```

---

## Prompt 4 — Estado "vínculo rechazado" en el portal del familiar

```
Diseña una pantalla de estado dentro del "Portal de familiares" de StopBet (plataforma clínica de
acompañamiento para tratamiento de ludopatía), la vista que ve un FAMILIAR después de iniciar
sesión cuando su vínculo con el paciente fue rechazado por el equipo clínico.

CONTEXTO DE MARCA Y LAYOUT
- Header superior con degradado azul institucional (de un azul oscuro #2d5a9e a #396fb6), con el
  saludo "Hola, [nombre del familiar]" en blanco a la izquierda y un botón "Cerrar sesión" con
  borde blanco translúcido a la derecha.
- Debajo, sobre fondo crema #f4f4e9, una sola tarjeta blanca centrada (ancho máximo ~720px),
  esquinas de 16px, sombra suave, padding generoso.
- Tipografía: título en Chillax (respaldo Nunito) 700, cuerpo en Satoshi (respaldo Inter).

CONTENIDO DE LA TARJETA
- Un círculo de fondo suave a la izquierda con un ícono de alerta discreto (no el rojo de
  pánico — usa el mismo azul claro de fondo #ECF3FA con ícono en tono neutro #6b6a6a, es una
  notificación administrativa, no una emergencia clínica).
- Título: "Tu solicitud de vinculación no fue aprobada".
- Cuerpo: "El equipo clínico revisó tu solicitud y no pudo confirmar el vínculo con el paciente
  declarado. Si crees que esto es un error, contacta directamente al equipo clínico de tu sede."
- Un botón secundario (borde #396fb6, sin relleno, texto azul) "Volver a registrarme" que lleva
  de vuelta al formulario de registro.

Tono sobrio y respetuoso, sin colores de alarma — es información administrativa, no una crisis.
```
