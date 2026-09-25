# [E4] Video de usuario - Paquete de grabación (Sprint 1)

Material completo para grabar el video de usuario que pide la rúbrica `[E4]_2026-2_Rubrica_Video HdU.pdf`.

**Decisiones tomadas para esta grabación:**

| Punto | Decisión |
|---|---|
| Perfil a grabar | Paciente, app móvil Android |
| HdU importantes | HdU07 (check-in), HdU05 (comunidad), HdU02 (asistente IA), HdU01 (botón de pánico) |
| Tareas | 4, una por HdU |
| Entorno | Producción: APK **release** contra Railway |
| Cuenta | Demo de Carlos (`demo@stopbet.cl`) |
| Compañero de viaje | Responde en vivo alguien del equipo (ver §2.4, tiene una vuelta) |

**Qué se imprime y se le entrega al usuario:** solo la sección **§3** (4 hojas, una por tarea) y la **§6** (cuestionario). El resto es material interno del equipo.

---

## 1. Ficha de definición de usuario (punto 1 de la rúbrica)

> Esto se graba **en ausencia del usuario**, antes de que llegue. Un integrante lo lee a cámara.
> La rúbrica da el puntaje máximo solo si además de las demográficas están las **3 "inolvidables"** y se explica **la relación del usuario con el software**. Por eso cada bloque tiene una línea final de "por qué representa al usuario objetivo": no la saltes.

Completa los campos entre corchetes y lee el texto tal cual.

### 1.a Características demográficas

| Campo | Valor |
|---|---|
| Nombre o seudónimo | [ ] |
| Edad | [ ] |
| Género | [ ] |
| Comuna donde vive | [ ] |
| Nivel educacional | [ ] |
| Ocupación actual | [ ] |
| Situación respecto del dominio | [ persona en tratamiento por ludopatía / persona con experiencia de juego problemático / persona sin relación con el juego que representa al perfil demográfico ] |

**Entorno en que usaría el sistema** (describir, no listar):

- Dispositivo con que usaría la app en su vida diaria: [ modelo y tamaño de pantalla ]
- Dónde y cuándo la usaría: [ ej.: en su casa al final del día, en el transporte público, en momentos de ansiedad ]
- Con qué conexión: [ datos móviles / wifi ]
- Si lo usaría a solas o acompañado, y si le importa que otros vean la pantalla: [ ]
- Condiciones de la grabación, si difieren del entorno real: [ ej.: sala LAB-UX, celular del equipo, no su celular personal ]

**Principales tareas que desarrolla actualmente** (su día a día, no el de la app):

[ 3 o 4 líneas: en qué trabaja o estudia, qué aplicaciones usa a diario, qué tipo de trámites o registros hace por celular ]

> **Cierre del bloque, decirlo explícitamente:** "Representa al usuario objetivo de StopBet porque [ ... ]".

### 1.b Las 3 características "inolvidables"

**1. Conocimiento del dominio** (ludopatía, tratamiento, AJUTER)

[ Marcar y justificar: ninguno / lo conoce de cerca por un tercero / está o estuvo en tratamiento. Indicar si conoce el vocabulario que usa la app: check-in, compañero de viaje, sede, recaída ]

**2. Conocimiento computacional**

[ Marcar y justificar: usa el celular solo para mensajería y redes / instala apps y hace trámites en línea sin ayuda / nivel técnico o de programación. Indicar si usa Android o iPhone habitualmente, porque la app es Android ]

**3. Conocimiento de sistemas similares**

[ Marcar y justificar: nunca usó apps de salud o bienestar / usó apps de hábitos, meditación, ejercicio o recordatorios de medicamentos / usó alguna app clínica o de telemedicina. Nombrar cuáles ]

> **Cierre del bloque, decirlo explícitamente:** "Estas tres características importan para esta prueba porque [ ej.: no conoce el término compañero de viaje, así que si lo entiende es mérito de la interfaz / nunca usó una app de salud, así que no trae expectativas de otro producto ]".

### 1.c Si son varios usuarios

Repetir §1.a y §1.b completo por cada uno. La nota de la rúbrica es el **promedio de todas las HdU importantes**, no de los usuarios, así que grabar a más de una persona no baja la nota: solo alarga el video.

---

## 2. Preparación antes de grabar (material interno)

### 2.1 La app tiene que ser el APK release

El build de desarrollo apunta fijo a `localhost:3000` (`apps/mobile/src/services/api.ts:64`, decidido por `__DEV__`). **Solo un APK release pega a Railway.** Si grabas con el build debug sin backend local ni `adb reverse`, la app se ve vacía y no es un hallazgo de usabilidad, es un problema de ambiente.

Verificación de 10 segundos antes de grabar: abre la app, intenta iniciar sesión. Si entra, hay backend.

### 2.2 Poblar la base de producción, la misma mañana

Desde `apps/backend/.env` apuntando `DATABASE_URL` al Postgres **público** de Railway y con la **misma `ENCRYPTION_KEY`** del servicio (si no coincide, los RUT quedan ilegibles). Detalle completo en `docs/demo-sprint1.md`.

```bash
pnpm run seed
pnpm run seed:family
pnpm run seed:demo -- --reset
```

`--reset` es obligatorio el día de la grabación: deja a Carlos **sin check-in de hoy** (si no, la Tarea 1 arranca ya cumplida) y limpia las alertas y reportes de corridas anteriores.

**No uses `--sin-padrino`.** Esa bandera desactiva al compañero de viaje y la Tarea 4 se iría directo a la IA en vez de mostrar la respuesta humana.

### 2.3 Checklist previo

- [ ] APK release instalado en el celular de la grabación
- [ ] Los tres seeds corridos contra Railway ese mismo día, el tercero con `--reset`
- [ ] Sesión cerrada en la app (el usuario debe partir desde el login, o entra directo a la sesión guardada)
- [ ] `https://stopbetbackend-production.up.railway.app/health` responde `200`
- [ ] `GEMINI_API_KEY` viva en Railway (sin ella el asistente cae al mensaje de respaldo y la Tarea 3 no prueba nada)
- [ ] `pnpm run demo:padrino` corriendo y mostrando «Esperando alertas» (§2.4)
- [ ] Hojas de §3 impresas, una por tarea, y la de §6
- [ ] Grabación de pantalla del celular **y** cámara sobre el rostro (la rúbrica pide expresiones faciales si es factible)
- [ ] Consentimiento del usuario para grabar rostro y voz

### 2.4 Cómo responde el compañero de viaje (leer completo, hay un problema)

⚠️ **El compañero de viaje no tiene interfaz.** Daniela Soto (`daniela.soto@stopbet.cl`) tiene rol `sponsor`, y ese rol **no puede entrar ni a la app ni al panel web**: la app solo admite `patient` y `psychologist` (`apps/mobile/App.tsx:40`) y la web solo `psychologist`, `coordinator` y `family` (`apps/web/src/pages/LoginPage.tsx:75`). No es un bug de esta grabación, es alcance que el Sprint 1 no cubrió: el criterio CA 1.1 existe en el backend pero nadie construyó la pantalla del compañero de viaje.

Consecuencia práctica: **la respuesta se manda por API**, y para eso hay un script que responde solo. Déjalo corriendo en tu computador antes de que llegue el usuario:

```bash
pnpm run demo:padrino                     # responde a los 45 s, contra Railway
pnpm run demo:padrino -- --segundos 30    # otro plazo (máximo 110)
```

Cada 3 s revisa si Daniela tiene alertas pendientes y responde las que llevan 45 s esperando. Vuelve a iniciar sesión solo cuando vence el token de 15 minutos, así que puede quedar prendido toda la mañana. **No necesita un APK nuevo**: la app consulta la alerta cada 5 s, así que el «Daniela respondió» aparece como mucho 5 s después. Tampoco toca el backend. Cuando cierras el script (Ctrl+C), deja de responder.

- El computador tiene que estar **prendido y con internet** durante la Tarea 4. Si se corta la red, el script reintenta solo.
- **Tiene que quedar respondiendo antes de 120 s.** Pasado ese plazo el backend escala sola la alerta al asistente (`panic.service.ts`, `ESCALATION_MS = 120 * 1000`), y el usuario ve la escalada a la IA en vez del nombre de Daniela. Con 45 s se alcanza a ver en el video la pantalla de espera con su cuenta regresiva.
- La respuesta es automática, no de una persona. Para evaluar la interfaz da lo mismo, pero no la presentes como una respuesta humana si alguien lo pregunta.

<details><summary>Respaldo manual por curl, si el script falla</summary>

```bash
BASE=https://stopbetbackend-production.up.railway.app
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"daniela.soto@stopbet.cl","password":"Stopbet2026!"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')
curl -s $BASE/panic/pending -H "Authorization: Bearer $TOKEN"
curl -s -X POST $BASE/panic/alerts/<ID>/respond -H "Authorization: Bearer $TOKEN"
```
</details>

> Si prefieres no responder, basta con no correr el script y dejar que la alerta escale sola a los 120 s. Eso cubre CA 1.3 en vez de CA 1.1, y el video se queda 2 minutos en la pantalla de espera. El enunciado de la Tarea 4 sirve igual en los dos casos.

### 2.5 Orden recomendado de las tareas

1. Tarea 1, check-in. Es la más simple y sirve de calentamiento con la app.
2. Tarea 2, comunidad.
3. Tarea 3, asistente IA.
4. Tarea 4, botón de pánico. Va al final a propósito: es la de mayor carga emocional, deja una alerta real en el sistema y notifica al equipo clínico de la demo.

---

## 3. Enunciados de las tareas (punto 2 de la rúbrica)

> **Cómo se usa cada hoja:** el observador la lee en voz alta a cámara, se la entrega impresa al usuario, y **recién ahí** empieza a grabar la interacción. La hoja se queda con el usuario durante toda la tarea.
>
> Cada hoja trae los **datos que debe introducir** y las **metas que debe cumplir**, que es exactamente lo que la rúbrica exige para el nivel "Excelente".
>
> Las hojas **no dicen dónde tocar**. Esto es a propósito: la rúbrica castiga cada aclaración del observador, y encontrar el camino es justamente lo que se está midiendo.

---

### HOJA 1 de 4 - Tarea: registrar cómo te sientes hoy

**Contexto**

Estás en tratamiento en AJUTER y usas StopBet todos los días. Tu psicólogo te pidió que dejes registrado cómo te sientes cada día, para poder conversarlo en la sesión.

Es de noche y todavía no has hecho el registro de hoy.

**Datos que vas a usar**

| Dato | Valor |
|---|---|
| Correo | `demo@stopbet.cl` |
| Contraseña | `Stopbet2026!` |
| Cómo te sientes hoy | **Ansioso** |

**Lo que tienes que lograr**

1. Entrar a la aplicación con la cuenta de arriba.
2. Dejar registrado que hoy te sientes **ansioso**.
3. Confirmar en la pantalla que tu registro quedó guardado.
4. Después de guardarlo, intenta **cambiarlo a "Bien"** y cuéntanos qué pasa.

**Mientras lo haces**

Di en voz alta todo lo que estás pensando: qué estás buscando, qué esperabas que pasara, qué te confunde. No hay respuestas equivocadas y no estamos evaluándote a ti, estamos evaluando la aplicación.

---

### HOJA 2 de 4 - Tarea: participar en la comunidad

**Contexto**

StopBet tiene un espacio donde las personas en tratamiento se acompañan entre ellas. Hoy quieres dejar un mensaje de apoyo, y además te topas con una publicación que te parece fuera de lugar.

**Datos que vas a usar**

| Dato | Valor |
|---|---|
| Mensaje que vas a publicar | `Hoy fue un día difícil pero lo logré. Ánimo a todos.` |
| Motivo del reporte | `Contenido inapropiado` |

**Lo que tienes que lograr**

1. Publicar el mensaje de apoyo de arriba para que lo vea el resto de la comunidad.
2. Reportar **una publicación de otra persona** que consideres inapropiada, indicando el motivo de arriba.
3. Verificar qué pasó con la publicación que reportaste.
4. Borrar **tu propia** publicación, la que escribiste en el paso 1.

**Mientras lo haces**

Di en voz alta todo lo que estás pensando: qué estás buscando, qué esperabas que pasara, qué te confunde. No hay respuestas equivocadas y no estamos evaluándote a ti, estamos evaluando la aplicación.

---

### HOJA 3 de 4 - Tarea: conversar con el asistente

**Contexto**

StopBet tiene un asistente con el que puedes hablar a cualquier hora, incluso de madrugada, cuando no hay nadie del equipo clínico disponible.

Hoy quieres usarlo dos veces: primero para contar algo cotidiano, y después, más tarde, porque estás pasando un momento difícil.

**Datos que vas a usar**

| Momento | Lo que vas a escribir |
|---|---|
| Primer mensaje | `Hoy estuve tranquilo, salí a caminar con mi hermana.` |
| Segundo mensaje | `Estoy solo en la casa y tengo muchas ganas de apostar, no sé si voy a aguantar.` |

**Lo que tienes que lograr**

1. Abrir una conversación con el asistente y enviar el **primer mensaje**.
2. Leer la respuesta y decirnos si te parece adecuada a lo que escribiste.
3. Enviar el **segundo mensaje** en la misma conversación.
4. Contarnos qué te ofrece la aplicación al leer ese segundo mensaje, y **qué harías tú a continuación** si esto te estuviera pasando de verdad.

**Mientras lo haces**

Di en voz alta todo lo que estás pensando: qué estás buscando, qué esperabas que pasara, qué te confunde. No hay respuestas equivocadas y no estamos evaluándote a ti, estamos evaluando la aplicación.

---

### HOJA 4 de 4 - Tarea: pedir ayuda urgente

**Contexto**

Estás en una situación de riesgo: tienes la aplicación de apuestas abierta en el celular y sientes que estás a punto de jugar. Necesitas ayuda **ahora**, no en diez minutos.

En StopBet tienes asignada una persona de confianza que te acompaña en el proceso.

**Datos que vas a usar**

No tienes que escribir ningún dato. La tarea se resuelve solo con la aplicación.

**Lo que tienes que lograr**

1. Pedir ayuda urgente desde la aplicación, de la forma más rápida que encuentres.
2. Quedarte en la pantalla y decirnos **qué está pasando** mientras esperas.
3. Decirnos **quién respondió** a tu pedido de ayuda y cómo te enteraste.
4. Contarnos qué otras opciones te da la aplicación en ese momento, si es que ves alguna.

**Mientras lo haces**

Di en voz alta todo lo que estás pensando: qué estás buscando, qué esperabas que pasara, qué te confunde. No hay respuestas equivocadas y no estamos evaluándote a ti, estamos evaluando la aplicación.

---

## 4. Guion del observador (material interno)

### 4.1 Antes de la primera tarea, a cámara y con el usuario presente

> "Gracias por acompañarnos. Vamos a probar una aplicación que estamos desarrollando para personas en tratamiento por ludopatía. Quiero dejar clara una cosa: **no te estamos evaluando a ti, estamos evaluando la aplicación**. Si algo no se entiende o no lo encuentras, eso es información valiosa para nosotros, no un error tuyo.
>
> Te voy a entregar una hoja por cada tarea. La leo en voz alta, te la dejo, y tú la resuelves a tu ritmo. Mientras lo haces te voy a pedir algo que al principio se siente raro: **que digas en voz alta lo que estás pensando**. Qué estás buscando, qué esperabas que pasara, qué te llamó la atención. Si te quedas en silencio te voy a recordar que pienses en voz alta, y eso es lo único que voy a decir.
>
> Durante la tarea **no te voy a ayudar**, aunque te quedes pegado. No es mala onda: si no logras terminar, eso también es un resultado que necesitamos. ¿Alguna duda antes de partir?"

### 4.2 Lo único que el observador puede decir durante la tarea

La rúbrica da el puntaje máximo con **ninguna aclaración de enunciado** y baja un nivel por cada grado de ayuda. Las únicas frases permitidas son:

- "Sigue pensando en voz alta."
- "¿Qué estás pensando ahora?"
- "¿Qué esperabas que pasara?"
- "Tú decides si quieres seguir intentando o pasar a la siguiente tarea."

**Prohibido**, aunque duela: señalar la pantalla, nombrar un botón, decir "más abajo", "arriba a la derecha", "esa no", "ahí", "casi", o releer el enunciado con otras palabras. Si el usuario pregunta directamente, responder: "Prefiero no adelantarte nada, quiero ver cómo lo resolverías tú solo."

Si se atasca, aguantar en silencio. El silencio incómodo es el dato.

### 4.3 Al cerrar cada tarea, a cámara

La rúbrica exige **hacer notar en el video** si la tarea se completó y si hubo errores. Decirlo en voz alta, no dejarlo implícito:

> "Tarea [N]: el usuario [completó / no completó] la tarea. [Se detectaron los siguientes errores: ... / No se detectaron errores durante la interacción.]"

---

## 5. Hoja de registro de la sesión (material interno, punto 3 de la rúbrica)

Una fila por tarea. Se llena durante o inmediatamente después de la grabación.

| Tarea | HdU | ¿Completó? | % logrado | Tiempo | Aclaraciones del observador | Errores detectados |
|---|---|---|---|---|---|---|
| 1. Check-in | HdU07 | Sí / No | | | | |
| 2. Comunidad | HdU05 | Sí / No | | | | |
| 3. Asistente | HdU02 | Sí / No | | | | |
| 4. Pánico | HdU01 | Sí / No | | | | |

**Cómo calcular el % logrado:** cada hoja de §3 tiene 4 metas numeradas. Cada meta cumplida vale 25%. Es el mismo tramo que usa la rúbrica (25 / 50 / 75 / 100).

**Observaciones cualitativas** (lo que después alimenta las mejoras al producto):

| # | Tarea | Momento del video | Qué pasó | Qué revela |
|---|---|---|---|---|
| | | | | |

---

## 6. Cuestionario de cierre (punto 4 de la rúbrica)

> Se hace **en vivo, dentro de la grabación**, al terminar todas las tareas. Se imprime y se le entrega al usuario para que tenga la escala a la vista.

**Escala: 1 = totalmente en desacuerdo, 7 = totalmente de acuerdo.**

```
1 ---- 2 ---- 3 ---- 4 ---- 5 ---- 6 ---- 7
```

**1. En general, estoy satisfecho con la facilidad de completar las tareas en este escenario.**

Nota: ____ / 7

¿Por qué esa nota? ______________________________________________

**2. En general, estoy satisfecho con el tiempo que tomó completar las tareas en este escenario.**

Nota: ____ / 7

¿Por qué esa nota? ______________________________________________

**3. En general, estoy satisfecho con la información de apoyo para completar las tareas (mensajes en pantalla, ayuda en línea, documentación).**

Nota: ____ / 7

¿Por qué esa nota? ______________________________________________

**4. Nota con la que calificarías las funcionalidades que probaste.**

Nota: ____ / 7

¿Por qué esa nota? ______________________________________________

> **Nota interna:** las preguntas 1, 2 y 3 son las que la rúbrica mide en "Análisis del Cuestionario", y el nivel máximo exige **las tres sobre 6**. La justificación es obligatoria en las cuatro: sin ella la respuesta no sirve para el análisis posterior. No sugieras notas ni las defiendas si son bajas, solo pregunta el porqué.

---

## 7. Cierre y agradecimientos (punto 5 de la rúbrica)

A cámara, con el usuario presente:

> "[Nombre], muchas gracias por tu tiempo. Lo que hiciste hoy es lo que nos permite mejorar la interfaz: cada vez que algo no se entendió o te costó encontrar, nos mostraste un lugar concreto donde la aplicación tiene que cambiar. Eso no lo podemos ver nosotros solos, porque ya sabemos dónde está todo.
>
> Lo que encontramos hoy va a entrar como mejoras en el próximo sprint. Gracias por colaborar con nosotros."

---

## 8. Riesgos conocidos de esta grabación

| # | Riesgo | Qué hacer |
|---|---|---|
| 1 | **El compañero de viaje no tiene interfaz.** La respuesta la da `pnpm run demo:padrino` desde tu computador (§2.4) | Dejarlo corriendo antes de que llegue el usuario, con el computador prendido y conectado |
| 2 | **La alerta escala sola a los 120 s.** Si el script no está corriendo, CA 1.1 se pierde y el video muestra CA 1.3 | Revisar que diga «Esperando alertas» antes de la Tarea 4 |
| 3 | **Sin `GEMINI_API_KEY` viva, el asistente cae al mensaje de respaldo** y la Tarea 3 no prueba el comportamiento real | Verificar en Railway antes de grabar. Enviar un mensaje de prueba y ver que la respuesta no sea el texto de respaldo |
| 4 | **El tono del asistente no es determinista.** Es un LLM: una misma frase puede recibir respuestas distintas entre corridas (`docs/reglas-asistente.md`) | No prometer una respuesta exacta en el enunciado. La Hoja 3 pide al usuario que **evalúe** la respuesta, no que la reciba tal cual |
| 5 | **Sin `--reset` el mismo día**, Carlos ya tiene check-in de hoy y la Tarea 1 arranca cumplida | Correr `pnpm run seed:demo -- --reset` la mañana de la grabación |
| 6 | **Con el APK debug la app se ve vacía** aunque todo funcione (apunta a `localhost`) | Usar APK release. Verificar con un login antes de grabar |
| 7 | **La Tarea 4 crea una alerta real** que le llega al equipo clínico de la demo | Avisar al equipo antes, para que nadie la confunda con una alerta de verdad |

---

## 9. Referencias

- Rúbrica: `~/Stopbet/[E4]_2026-2_Rubrica_Video HdU.pdf`
- HdU y criterios del Sprint 1: `docs/planning/SPRINT1.md` §4
- Cuentas, seeds y datos de demostración: `docs/demo-sprint1.md`
- Reglas de tono del asistente: `docs/reglas-asistente.md`
