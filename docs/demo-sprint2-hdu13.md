# Runbook - demo de la HdU13 (Ficha Clínica del Paciente)

Guion para mostrar en vivo los **6 criterios de aceptación** de la HDU 13. Dura unos **10
minutos** sin el móvil y unos **15** con él.

Mismo formato que [`demo-sprint1.md`](demo-sprint1.md), pero acotado a esta historia. Si vas a
mostrar el sprint completo, ese archivo cubre el resto y este se intercala después de
"Mis pacientes".

La idea del recorrido: **un solo paciente, de principio a fin**. Se abre su ficha vacía, se
intenta guardar mal, se guarda bien, se edita, se mira el historial y recién al final se cambia
de cuenta para mostrar el bloqueo. Cambiar de usuario en cada criterio es lo que más tiempo
come y lo que más confunde a quien mira.

---

## 1. Antes de empezar (5 minutos antes, no durante)

```bash
# 1. Base de datos poblada (los tres, en este orden)
pnpm run seed
pnpm run seed:family
pnpm run seed:fichas

# 2. Backend y dashboard, cada uno en su terminal
pnpm run backend        # http://localhost:3000
pnpm run web            # http://localhost:5173
```

`pnpm run seed:fichas` es **idempotente y además resetea la demo**: a los seis pacientes que
tienen que quedar sin ficha les borra la ficha, su historial y sus anotaciones. Si ya hiciste
esta demo antes y creaste la ficha de Tomás Riquelme, correrlo de nuevo la deja como estaba.
**Córrelo siempre antes de presentar.**

### Verificación de 20 segundos

```bash
curl -s localhost:3000/health          # {"status":"ok", database up}
```

Y en el dashboard, entrando como Miguel: **Mis pacientes** tiene que mostrar **9 pacientes, 4
con ficha y 5 con el chip «Sin ficha clínica»**. Si aparecen 3 pacientes, entraste con otra
cuenta. Si no aparece ningún chip, falta correr `seed:fichas`.

### Solo si vas a mostrar el móvil

```bash
adb reverse --list      # si sale vacío, ese es el problema
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000
```

Los túneles se caen solos y los síntomas mienten: la app muestra datos vacíos como si no
hubiera nada. Está explicado en `CLAUDE.md`.

---

## 2. Cuentas

Clave de todas: `Stopbet2026!`

| Cuenta | Rol | Para qué en esta demo |
|---|---|---|
| `miguel.lara@ajuter.cl` | psychologist | **La cuenta principal.** 9 pacientes, 5 sin ficha, uno con cuestionario de ingreso |
| `tomas.herrera@ajuter.cl` | psychologist | Viña del Mar. Solo para el CA5: intentar abrir una ficha ajena |
| `sofia.reyes@ajuter.cl` | coordinator | Opcional: la coordinación sí ve la ficha de cualquier paciente |
| `demo@stopbet.cl` (Carlos) | patient | Solo si muestras el asistente en el móvil |

⚠️ **`camila.soto@ajuter.cl` no sirve** para el CA5 aunque sea de otra sede: está **suspendida**
en el seed y `/auth/login` la rechaza con 403. Usa a Tomás Herrera.

## 3. Qué paciente usar para qué

| Paciente | Por qué ese |
|---|---|
| **Tomás Riquelme** | **El protagonista.** Sin ficha y **el único con el cuestionario de ingreso respondido**, así que su ficha muestra las tres capas: lo que él declaró, lo que escribe el psicólogo y las anotaciones |
| **Carlos Demo** | Ficha completa con **3 versiones** de historial ya sembradas. Úsalo si quieres mostrar un historial más rico sin editar en vivo |
| Héctor, Ignacio, Pedro, Rodrigo | Los otros sin ficha. Sirven de repuesto si algo sale mal con Tomás |

URL directa de la ficha de Tomás, para tenerla copiada antes de empezar:

```
http://localhost:5173/pacientes/ad54b950-99f0-409c-af0c-69a4ebb65e09/ficha
```

---

## 4. El guion

### Paso 0 · Dónde vive la ficha (30 s)

Entra como **Miguel** y abre **Mis pacientes**.

> "La ficha clínica se abre desde la lista de pacientes. Lo primero que ve el psicólogo es a
> quién le falta: estos cinco tienen el chip «Sin ficha clínica»."

Ojo con el nombre: el panel de **Seguimiento** (lo que el paciente genera: check-ins, alertas,
sesiones con el asistente) es otra cosa que la **ficha clínica** (lo que el psicólogo escribe
sobre él). Si alguien pregunta, esa es la distinción.

### Paso 1 · CA1 - la ficha vacía y lo que el paciente declaró (1,5 min)

Clic en **Ficha clínica** en la fila de **Tomás Riquelme**.

> "Nunca se le pidió una ficha a este paciente, así que el sistema no muestra un error: abre
> directo en modo edición, con los cinco campos obligatorios en blanco y listos para completar."

Después sube a la tarjeta de arriba:

> "Y esto de acá arriba no lo escribió el psicólogo: son las cuatro preguntas que Tomás
> respondió desde la app cuando se registró. Está en solo lectura y nunca se mezcla con lo que
> escribe el psicólogo, porque el contraste entre lo que el paciente dice de sí mismo y lo que
> el equipo observa es justamente lo que importa en un registro clínico."

**Cubre CA1.**

### Paso 2 · CA3 - no deja guardar a medias (1,5 min)

Completa **cuatro** campos y deja **«Motivo de ingreso» vacío a propósito**. Texto sugerido,
corto para no perder tiempo tecleando:

- Antecedentes de la conducta de juego: `Apuestas deportivas en línea desde 2023, a diario desde marzo.`
- Detonantes: `Días de pago y transmisiones de fútbol con publicidad de casinos.`
- Antecedentes de salud y red de apoyo: `Sin diagnósticos previos. Vive con su madre.`
- Objetivos del tratamiento: `Asistir al grupo cada semana y sostener 60 días sin jugar.`

Clic en **Guardar ficha**.

> "No guarda. Marca el campo que falta, explica qué falta, y lo más importante: **no perdí nada
> de lo que ya había escrito**. En una herramienta clínica perder media entrevista por un campo
> vacío es inaceptable."

Muestra también que el contador de arriba dice **4 de 5 completados**.

**Cubre CA3.**

### Paso 3 · CA2 - guardar deja rastro (1 min)

Completa el motivo de ingreso: `Derivado por su médico tratante tras una recaída en agosto.`
y guarda.

> "Guardó. Confirmación en pantalla con la fecha y la hora, y arriba queda registrado quién la
> modificó: Miguel Ángel Lara. La ficha pasó a modo lectura, que es como se abre de aquí en
> adelante; para volver a editarla hay que pedirlo explícitamente."

**Cubre CA2.**

### Paso 4 · CA4 - el historial de auditoría (2 min)

Clic en **Editar ficha**, cambia **un solo campo** (por ejemplo, agrega `Retomar el trabajo.` a
los objetivos) y guarda. Después abre **Historial de cambios** al final de la página.

> "Dos versiones. La primera es la creación, con los cinco campos desde vacío. La segunda
> registra únicamente el campo que cambié, con el antes y el después. Cada una con fecha, hora
> y autor."

Dos cosas que vale la pena decir acá, porque son decisiones de diseño y no accidentes:

> "El historial guarda **el cambio, no una copia entera de la ficha**, y no se puede editar ni
> borrar: es el registro de auditoría clínica. Y si guardo sin haber cambiado nada, **no crea
> una versión**, para que el historial no se llene de ruido y encontrar la modificación real no
> cueste más."

Si quieres un historial más largo, abre la ficha de **Carlos Demo**, que trae 3 versiones
sembradas con cambios realistas.

**Cubre CA4.**

### Paso 5 · Anotaciones de seguimiento (1 min, opcional)

No es un CA, pero es parte de la historia y responde sola la pregunta "¿y dónde anoto lo de
cada sesión?".

Clic en **Agregar anotación**, escribe algo como `Primera sesión grupal. Participó poco pero se
quedó hasta el final.` y guarda.

> "La ficha se reescribe; las anotaciones se acumulan. Cuelgan del paciente y no de la ficha,
> así que se puede anotar antes de que exista la entrevista de ingreso. Tampoco se editan ni se
> borran."

La ficha de **Carlos Demo** ya trae una anotación sembrada, por si prefieres mostrarla sin
escribir nada en vivo.

### Paso 6 · CA5 - una ficha ajena no se alcanza por la URL (1,5 min)

**Copia la URL** de la ficha de Tomás de la barra de direcciones. Cierra sesión y entra como
**Tomás Herrera** (Viña del Mar). Pega la URL.

> "No es que la pantalla esconda los campos. El backend responde 403 y **no viaja ni un dato
> clínico**: ni los campos, ni el nombre del paciente. Los cinco endpoints de la ficha están
> cerrados igual."

Vale la pena agregar el matiz, porque habla bien de la implementación:

> "El criterio pide bloquear a un psicólogo de otra sede. Acá el filtro es **por asignación**,
> que es más estricto: un psicólogo de la misma sede que no tenga asignado al paciente tampoco
> entra. Se hizo así a propósito, porque la columna de sede guarda a veces el nombre y a veces
> el identificador, y un filtro por sede fallaría en silencio."

Si alguien pregunta por el paciente: **tampoco accede a su propia ficha** (403). Es material que
el psicólogo escribe sobre él, y abrirlo es una decisión clínica de AJUTER.

**Cubre CA5.**

### Paso 7 · CA6 - los detonantes llegan al asistente, los datos personales no (2 min)

Este es el único criterio que **no se ve en una pantalla**: lo que hay que demostrar es lo que
sale hacia el modelo de IA. Hay dos formas y conviene hacer las dos.

**a) En la ficha.** Vuelve a entrar como Miguel, abre una ficha y muestra la tarjeta lateral
**«Quién ve esto»** y el aviso del campo de detonantes.

> "De los cinco campos, el único que sale hacia el asistente son los detonantes. El motivo de
> ingreso y los antecedentes de salud no tienen por qué viajar a un modelo de terceros para
> personalizar una conversación."

**b) En la terminal.** Este comando muestra en qué consiste la garantía:

```bash
npx jest --config apps/backend/package.json --rootDir apps/backend --verbose -t "CA6"
```

Los nombres de los tests están escritos para leerse en voz alta:

```
✓ incluye los detonantes registrados por el psicólogo en el prompt
✓ omite el nombre y el RUT que el psicólogo haya escrito dentro de los detonantes
✓ omite el teléfono y el correo que el psicólogo haya escrito en los detonantes
✓ no confunde con un teléfono el monto que el paciente perdió
✓ omite el nombre de un familiar vinculado nombrado en los detonantes
✓ omite el nombre de su compañero de viaje
✓ todavía deja pasar el nombre de un tercero que no está registrado
```

> "Lo que estos tests capturan es **el texto exacto que se le manda al modelo**. Los detonantes
> llegan; el nombre, el RUT, los teléfonos y los correos se tachan antes de salir, igual que los
> nombres de los familiares y del compañero de viaje que el sistema tiene registrados."

Y di el último en voz alta, no lo escondas:

> "El anteúltimo test dice que un tercero que **no** está registrado sí pasa. Es un límite
> conocido y está documentado: detectar nombres propios en texto clínico en español daría falsos
> positivos («Santiago» es una sede) y rompería el detonante que el asistente necesita entender.
> La mitigación es el aviso en el campo, que pide escribir la situación y no quién la
> protagoniza."

**Cubre CA6.**

---

## 5. Las dos preguntas que te van a hacer

**"El CA1 dice «motivo de consulta», tu pantalla dice «motivo de ingreso»."**

> Es una decisión del PO, no un descuido. AJUTER no hace consultas individuales, hace terapia
> grupal: «motivo de consulta» describe un modelo de atención que no es el del programa. Está en
> `docs/ASUNCIONES-PENDIENTES.md`, punto 2-ter. Lo mismo con «objetivos del tratamiento» en vez
> de «objetivos terapéuticos».

**"¿Y si el psicólogo escribe el nombre de alguien en los detonantes?"**

> Si esa persona está registrada en la plataforma (un familiar vinculado, el compañero de
> viaje), se tacha. Si no, pasa. Está en `ASUNCIONES-PENDIENTES`, punto 2-bis, con las dos
> salidas posibles para que lo decida AJUTER.

---

## 6. Si algo falla

| Síntoma | Casi siempre es |
|---|---|
| "Correo o contraseña incorrectos" con una cuenta buena | El backend no está corriendo, o `camila.soto` (que está suspendida a propósito) |
| La lista de pacientes sale con 3 filas y sin chips | Entraste como Valentina o falta `pnpm run seed:fichas` |
| Tomás Riquelme ya tiene ficha | La demo anterior la creó. `pnpm run seed:fichas` la borra |
| La ficha abre en modo lectura cuando esperabas edición | Ese paciente ya tiene ficha. Usa otro de los cinco sin ficha |
| El asistente responde siempre lo mismo en el móvil | Falta `GEMINI_API_KEY`. No afecta a la HdU13: el CA6 se demuestra con los tests |
| La app móvil muestra todo vacío | `adb reverse --list`. Es la causa número uno |

---

## 7. Versión larga: cerrar el círculo con el móvil (5 min extra)

Si tienes el emulador o el teléfono listo, esta es la secuencia más convincente, porque muestra
el dato naciendo en un lado y apareciendo en el otro:

1. **En la app**: registro de un paciente nuevo. Entre los datos y la sede aparece el paso nuevo
   con las **cuatro preguntas sobre el juego** (`RegisterIntakeScreen`). Son opcionales y se
   pueden saltar: responde dos y salta el resto, para mostrar que no bloquea el registro.
2. **En el dashboard, como Miguel**: **Solicitudes** → aprobar al paciente recién registrado y
   asignárselo.
3. **Mis pacientes** → aparece con el chip *Sin ficha clínica* → **Ficha clínica**.
4. Arriba están las respuestas que acaba de dar en el teléfono, en solo lectura, y abajo los
   cinco campos en blanco.

> "El paciente cuenta su versión desde el teléfono. El psicólogo escribe la suya en el panel.
> Nunca se mezclan."

Si haces esta versión, el **Paso 1** del guion se reemplaza por esto y el resto sigue igual.
