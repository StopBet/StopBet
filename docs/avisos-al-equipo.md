# Avisos al equipo

Bitácora de cambios que **obligan a hacer algo distinto después de pullear**, o que cambian
un comportamiento visible lo bastante como para que alguien lo confunda con un bug.

**Esto no es el manual de setup.** Cómo se levanta el proyecto está en `README.md`, en
"Comandos frecuentes" de `CLAUDE.md` y en `apps/mobile/README.md`. Acá va solo lo que
cambió y a quién le pega, para que nadie pierda una tarde buscando el problema donde no
está.

## Cómo se usa

- Entradas **nuevas arriba**, con fecha y el PR que las trae.
- Si un cambio no le pide nada a nadie, **no va**. Esto sirve mientras se pueda leer entero
  en un minuto.
- Cuando una entrada deja de aplicar (el paso se automatizó, el flujo se revirtió), muévela
  a "Histórico" al final con una línea de qué la cerró. No la borres: alguien que pullea
  después de dos semanas necesita entender por qué su repo estaba raro.
- El archivo es de todos. Editarlo no necesita permiso de nadie.

---

## 2026-09-22 - Revisión de botones del panel: Equipo, moderación y login (PR #116)

**A quién le pega:** a **Matías Lara** (Equipo), a **Catalina** (`community`) y a quien haga la
demo del panel.

**Qué hacer después de pullear:** nada. La columna nueva la crea `synchronize` al arrancar.

**Qué cambió, y por qué te puede parecer un bug:**

- **Un psicólogo ya no ve «Crear psicólogo», «Sedes» ni «Desactivar» en Equipo.** El backend
  los tiene con `@Roles('coordinator')`: el psicólogo llenaba el formulario y recibía un 403. Si
  haces la demo de la HU-24, **entra con la cuenta de coordinación**.
- **«Ocultar» en Posts reportados ahora es «Descartar» y se guarda.** Antes vivía en memoria: al
  recargar la publicación volvía y el Resumen la seguía contando. Ahora
  `POST /community/moderation/posts/:id/dismiss` marca los reportes con `dismissedAt` y
  `dismissedBy` (columnas nuevas en `post_reports`; no se borran, quedan como registro) y deja
  `reportCount` en 0. La publicación sale de la cola del **equipo entero**, también en la app
  móvil del psicólogo, y vuelve si alguien nuevo la reporta.
- **Login:** apretar «Iniciar sesión» con un campo vacío ahora avisa, y «¿Olvidaste tu
  contraseña?» muestra a quién pedirle una clave nueva en vez de abrir un `mailto:`.

---

## 2026-09-22 - Las cuentas tienen institución y el equipo de AJUTER arranca con sus colores (PR #115)

**A quién le pega:** a **José** (`users`, `auth`), a **Matías Lara** (`psychologists`) y a quien
despliegue en Railway.

**Qué hacer después de pullear:**

- `pnpm install` no hace falta. Sí recompilar `shared-types` (`AuthUser` tiene un campo nuevo):
  `pnpm run backend` ya lo hace solo.
- La columna nueva la crea `synchronize` al arrancar. Para marcar las cuentas que ya tienes en
  tu base local: `pnpm run seed` **o** `pnpm --filter @stopbet/backend run backfill:institution`.
- **En Railway hay que correr `backfill:institution` una vez**, o el equipo clínico que ya
  existe en producción se queda sin institución y sigue viendo StopBet.

**Qué cambió:**

- **`users.institutionId`** (`varchar`, nullable), mismo valor que ya usaba
  `registration_requests.institutionId` (`'AJUTER'`). `/auth/login` la devuelve dentro de
  `user`. En `AuthUser` es opcional, así que nada de mobile se rompe.
- **`POST /psychologists`** deja al psicólogo nuevo en la institución de la coordinación que lo
  crea (`create(dto, coordinatorId)`; el segundo parámetro es opcional).
- **La web**: psicólogos y coordinación de AJUTER arrancan con los colores de AJUTER. Si alguien
  elige StopBet en Apariencia, se respeta. Familias y pacientes no cambian.

**Por qué te puede parecer un bug:** si entras como psicólogo y el panel sale carbón y ocre con
otra letra, **está funcionando**. Se cambia en Configuración → Apariencia → Colores. Una sesión
abierta antes de este cambio no trae la institución hasta volver a iniciar sesión.

---

## 2026-09-20 - El asistente tacha más cosas antes de mandarlas al modelo (PR #111)

**A quién le pega:** a **Matías Barraza** (S.3, el sanitizador) y a quien mire resúmenes de
sesión del asistente.

**Qué hacer después de pullear:** nada. No hay dependencias nuevas ni columnas nuevas.

**Qué cambió:** `sanitizePii` (`apps/backend/src/ai-assistant/sanitizer.ts`) ya no omite solo
el nombre del paciente y los RUT. Ahora también:

- **teléfonos y correos**, que salen como `[CONTACTO OMITIDO]`;
- los **nombres de los familiares vinculados y del compañero de viaje** del paciente, que
  salen como `[NOMBRE OMITIDO]` igual que el suyo.

**Por qué te puede parecer un bug:** si abres un resumen de sesión y ves `[CONTACTO OMITIDO]`
donde antes iba un número, **está funcionando**. El CA6 de la HdU13 pide mandar los detonantes
de la ficha al modelo «sin nombre, RUT ni datos de contacto», y los detonantes los escribe el
psicólogo en texto libre. **Lo guardado en la base sigue intacto**: se sanea solo lo que sale
hacia el LLM, igual que antes.

**Un efecto secundario que es un arreglo:** la comparación de nombres ahora respeta los límites
de palabra. Antes, una paciente llamada Ana convertía «mañana» en «mañ[NOMBRE OMITIDO]» dentro
del prompt.

Un tercero que **no** está registrado en la plataforma («su jefe Nelson») sigue llegando al
modelo, y eso está anotado en `docs/ASUNCIONES-PENDIENTES.md`, punto 2-bis.

---

## 2026-09-19 — El formulario de ingreso pregunta por el juego (HdU13 + HdU19)

**A quién le pega:** a **Matías Lara** sobre todo (`registration` es su módulo y lleva la
HdU19), y a quien toque el registro en la app móvil.

**Qué hacer después de pullear:** nada que instalar más allá de recompilar `shared-types`. La
columna nueva la crea `synchronize` al arrancar.

**Qué cambió, y qué NO:**

- **`registration_requests` tiene una columna nueva, `intake` (`jsonb`, nullable).** Se eligió
  **una sola columna** en vez de seis sueltas justamente para dejar la huella más chica posible
  en una tabla que es de otra pista. `null` = la solicitud es anterior a estas preguntas o el
  paciente se las saltó.
- **`POST /registration/submit` acepta un `intake` opcional.** Todo dentro es opcional y el
  endpoint sigue funcionando igual sin él: **ninguna llamada existente se rompe**. Los tests de
  registro pasan sin tocarlos.
- **El registro móvil tiene un paso nuevo** entre Datos y Sede: `RegisterIntakeScreen`, con
  cuatro preguntas de alternativas y un «Otro» de texto libre. Se puede saltar («Prefiero no
  responder ahora»). El stepper pasó de 2 a 3 pasos.
- **Lo que el paciente declara NO se copia a la ficha clínica.** Se lee desde
  `GET /clinical-records/patients/:patientId/intake` y el panel lo muestra aparte, marcado como
  «Declarado por el paciente al ingresar», en solo lectura. Si se fusionara con lo que redacta
  el psicólogo se perdería el contraste entre lo que el paciente dice de sí mismo y lo que el
  equipo observa, que clínicamente es lo que importa.
- **No se tocó ningún endpoint del controller de `registration`** salvo el DTO de `submit`.
  Aprobar, rechazar y listar pendientes quedaron intactos.

**Ojo con el CA1 de la HdU13**, que dice que el psicólogo ve una ficha «vacía, lista para
completar». Sigue siendo así: el cuestionario se muestra al lado, no adentro. Verificado.

---

## 2026-09-19 — Ficha clínica (HdU13): módulo nuevo y tipos compartidos

**A quién le pega:** a **todos** (hay que recompilar `shared-types`), y en particular a quien
toque `ai-assistant` o vaya a agregar su módulo a `app.module.ts` esta semana.

**Qué hacer después de pullear:**

```bash
pnpm --filter @stopbet/shared-types build
pnpm run seed:fichas          # opcional, después de `pnpm run seed`
```

Sin eso, el backend no compila y el error sale en archivos que nadie tocó: los tipos
`ClinicalRecord`, `ClinicalRecordVersion` y `CLINICAL_RECORD_FIELDS` son nuevos. No hay
dependencias nuevas, así que `pnpm install` no hace falta.

**Qué cambió:**

- **Módulo `clinical-records`** con tres endpoints, todos para el equipo clínico
  (`GET`/`PUT /clinical-records/patients/:patientId` y `GET .../history`). La ficha es una por
  paciente y guarda los cinco campos del CA1.
- **Dos tablas nuevas**, `clinical_records` y `clinical_record_versions`. En local las crea
  `synchronize` al arrancar; no hay que correr nada.
- **`ai-assistant` cambió de firma.** `AiAssistantService` recibe un parámetro más en el
  constructor (`ClinicalRecordsService`). Si tienes un test que lo instancia a mano, agrégale el
  doble o te va a fallar el type-check. Los detonantes de la ficha ahora entran al prompt del
  modelo, saneados; `previousContext` (lo que ve el paciente) no cambió.
- **`app.module.ts` tiene tres líneas más.** Es el archivo compartido del que habla el reparto
  del sprint: si vas a registrar tu módulo, mergea seguido para no chocar.

**Datos de prueba — `pnpm run seed:fichas` hace dos cosas, ojo con la segunda:**

1. **Llena fichas clínicas**: Carlos (con 3 versiones, para ver el historial), Ana, Marcela,
   Paulina, Lucía y Jorge. **Pedro, Roberto, Rodrigo, Héctor e Ignacio quedan sin ficha a
   propósito**: sirven para ver la ficha vacía del CA1 y el chip «Sin ficha clínica» de la
   lista. Si los llenas todos, esos estados dejan de poder demostrarse.
2. **Crea 4 pacientes nuevos** (Marcela Ibáñez, Rodrigo Cáceres, Paulina Núñez, Héctor
   Sandoval) y los asigna a **Miguel Ángel Lara**, más Ignacio Vidal, que estaba sin
   psicólogo. Miguel pasa de 3 a 8 pacientes: con 3 filas no se puede juzgar cómo se ve la
   lista del panel.

**No toca a los `approval_pending`** (Fernanda, Diego, Camila): son las solicitudes de ingreso
de la HdU19 y asignarlas las haría desaparecer de esa pantalla. **Tampoco mueve** a los
pacientes de Tomás ni de Valentina, para que se siga viendo que cada psicólogo alcanza solo a
los suyos.

El seed es idempotente: correrlo dos veces no duplica nada.

**Cambio de nombre que te puede confundir:** el panel lateral de «Mis pacientes» (Evolución,
Alertas, Sesiones IA, Datos) **ya no se llama «ficha»: ahora es «Seguimiento»**. Su botón en la
lista dice `Seguimiento` y al lado hay uno nuevo, `Ficha clínica`, que es otra pantalla. Son
cosas distintas: el Seguimiento es lo que genera el paciente, la ficha clínica es lo que el
psicólogo escribe sobre él. Si buscas «ficha» en el código y no encuentras lo que esperabas, es
por esto.

**Ojo con una cosa:** el historial de versiones **no se borra ni se edita nunca**. Es el registro
de auditoría clínica del CA4. Si necesitas limpiar datos de prueba, bórralos por la base.

---

## 2026-09-16 — El backend exige token en todo: `x-user-id` ya no se lee

**A quién le pega:** a **todos** los que toquen el backend, y a cualquiera con scripts,
colecciones de Postman o pruebas con `curl` que manden `x-user-id` sin token.

**Qué hacer:** nada que instalar. Pero **si llamas a la API a mano, necesitas un token**:
`POST /auth/login` y después `Authorization: Bearer <accessToken>`. Con solo `x-user-id`,
ahora recibes **401**.

**Qué cambió:**

- **`JwtAuthGuard` está registrado global** (`app.module.ts`). Todo endpoint exige token
  salvo los marcados con `@Public()`: login, refresh, logout, `/health`, `GET /sedes`, el envío
  y la consulta de una solicitud de registro, y el stream de alertas (SSE, porque `EventSource`
  no puede mandar `Authorization`; solo emite conteos).
- **La identidad sale del token.** Los 40 `@Headers('x-user-id')` de 9 controladores pasaron a
  `@UserId()` (`common/decorators/user-id.decorator.ts`). Antes, quien supiera el UUID de un
  paciente podía leer sus check-ins o sus conversaciones con el asistente sin iniciar sesión.
- **Tres endpoints que no pedían nada:** `POST /panic/assign` (cualquiera cambiaba el compañero
  de viaje de cualquier paciente) ahora exige rol de equipo clínico; `POST /subscriptions` toma
  el paciente del token, no del cuerpo; y `GET /community/posts/:id/replies` quedó cubierto por
  el guard global.
- **Guard nuevo `PatientAccessGuard`** para endpoints del equipo clínico sobre un paciente: la
  coordinación accede a todos y un psicólogo, solo a sus asignados. Se aplica a
  `GET /metrics/patients/:id` y `GET /users/:id/progress`, que antes dejaban a cualquier
  psicólogo leer cualquier paciente cambiando el id en la URL.
- **Dos endpoints nuevos** para que la web deje de hacerse pasar por el paciente:
  `POST /achievements/patients/:patientId/relapse` (la ficha registraba la recaída mandando el
  id del paciente en `x-user-id`) y `GET /billing/patients/:patientId/status` (el reporte PDF).

**Si escribes un endpoint nuevo:**

1. **No uses `@Headers('x-user-id')`.** Usa `@UserId()` para quien pregunta.
2. Si es público, `@Public()` **con un comentario que diga por qué**.
3. Si el equipo clínico actúa sobre un paciente puntual, `@UseGuards(RolesGuard, PatientAccessGuard)`
   con el id en la ruta como `:patientId` o `:id`.

**Clientes:** la web y mobile ya mandaban `Authorization: Bearer`, así que siguen funcionando.
Verificado: las 12 llamadas de la app del paciente responden 200 con token, y la web completa
con psicólogo, coordinadora y familiar no tiene ningún 401/403 nuevo. **Mobile sigue mandando
`x-user-id`**: es inofensivo (se ignora) y se puede sacar de `services/api.ts` cuando alguien
toque ese archivo. ⚠️ Un **APK anterior al 15-09** (sin sesión real) ya no puede hablar con el
backend: hay que reinstalar.

**Tests:** 5 unitarios nuevos del guard y 15 e2e nuevos en `test/auth-global.e2e-spec.ts`.
Quedan 279 unitarios y 66 e2e pasando. La matriz de permisos
(`docs/security/permissions-matrix.md`) está reescrita, con lo que sigue pendiente: sobre todo,
que varios endpoints autenticados no restringen **qué rol** puede llamarlos.

---

## 2026-09-16 — El panel web tiene modo oscuro: usa `--primary-text` y `--danger-text` para texto

**A quién le pega:** a cualquiera que escriba UI en `apps/web`.

**Qué hacer:** nada que instalar. Pero **si escribes un color, fíjate en qué token usas**, o tu
pantalla va a quedar ilegible en oscuro sin que nada te avise en claro.

**Cómo funciona.** `styles/stopbet-dark.css` redefine los tokens semánticos. Se activa solo si
el sistema está en oscuro, o se fuerza desde **Configuración → Apariencia** (Automático / Claro /
Oscuro, igual que Perfil → Apariencia en mobile). La elección se guarda en `localStorage`
(`sb-theme`) y `index.html` la aplica antes de pintar, para que no destelle. La paleta es la de
mobile (`darkColors`), así que las dos apps se ven hermanas.

**Las tres reglas para no romperlo:**

1. **Texto e íconos de marca van con `--primary-text` y `--danger-text`**, no con `--primary` ni
   `--danger`. En claro son el mismo color, así que no vas a notar la diferencia hasta que
   alguien active el oscuro: ahí `#396fb6` da 3,16:1 y `#B83232` 2,72:1. `--primary` y
   `--danger` quedan para **rellenos y bordes** (botones, sidebar, bordes de error).
2. **Sobre un relleno verde (`--secondary`) el texto va con `--fg-on-secondary`**, que es oscuro
   en los dos temas. `--fg1` en oscuro es casi blanco.
3. **Si agregas un token de color, defínelo también en `stopbet-dark.css`** — en los dos bloques
   de ese archivo, que están repetidos a propósito.

**Qué se tocó:** 96 usos de azul y rojo como texto pasaron a los tokens de texto (script que mira
la propiedad CSS de cada uso, no un reemplazo ciego), más ~20 revisados a mano. También
`utils/alertStatus.ts`: los chips de estado de alerta.

**Verificado con axe-core** (la herramienta de la auditoría): **0 nodos con contraste
insuficiente en los dos temas**, en las 8 páginas del panel, el login, el portal del familiar, la
ficha con sus 4 pestañas y el diálogo del reporte.

**Tres cosas que se arreglaron de paso:**

- **El reporte PDF siempre sale en claro.** Lee los colores del CSS, así que con el panel en
  oscuro habría impreso texto casi blanco. Además los leía una sola vez al cargar: ahora los
  lee en cada documento.
- **Las cifras del PDF estaban mal.** «Check-ins registrados» contaba los puntos del gráfico,
  que agrupa por semana: a Ana, con 28 check-ins, le ponía 5. Y «alertas del período» era el
  total histórico. Ahora las dos salen de `/metrics` (últimos 30 días) y la etiqueta lo dice.
- **El botón «Iniciar sesión» quedaba sin fondo mientras cargaba:** usaba `${BLUE}cc`, que con
  un token CSS produce `var(--sb-blue)cc`, que no es un color.

⚠️ **Queda una inconsistencia en el PDF, para decidir:** el diálogo pide un rango de fechas y el
informe lo imprime como «Período del reporte», pero **no filtra nada con él**: las cifras son de
los últimos 30 días y el gráfico y las alertas, de lo que haya. O se quita el selector de fechas,
o el backend tiene que aceptar un rango.

---

## 2026-09-16 — El Resumen pasó a ser solo un resumen; la ficha y el PDF se mudaron a «Mis pacientes»

**A quién le pega:** a **Eduardo** (Resumen, `OverviewPage.tsx`), a quien toque la vista del
psicólogo en **mobile**, y a quien consuma `GET /users/patients`.

**Qué hacer:** nada que instalar. Pero si tenías algo abierto en `OverviewPage.tsx`, el archivo
se reescribió entero: rebasea antes de seguir.

**El Resumen ya no es una sección de pacientes.** Decisión del PO: un bloque por sección, que
responde una sola pregunta y lleva a la sección con un clic. El detalle vive en cada sección.

| Bloque | Qué muestra | Lleva a |
|---|---|---|
| Alertas que requieren atención | Esperando respuesta o escaladas (no «las de hoy») | Alertas de pánico |
| Requieren seguimiento | Los 3 primeros con su motivo | Mis pacientes |
| Por revisar | Solicitudes de ingreso + posts reportados | Solicitudes |
| Próxima sesión de familiares | Fecha, lugar y confirmaciones | Sesiones de familiares |
| Equipo *(solo coordinación)* | Psicólogos activos y **sedes sin psicólogo activo** | Equipo |

Las tarjetas de arriba son las cifras de esos bloques. Salió «Promedio abstinencia», que no le
pedía nada a nadie. **Finanzas no aparece a propósito:** sigue con datos de ejemplo, y un número
inventado en la pantalla de inicio es justo el problema de confianza que marcó la auditoría.

**Qué se movió:**

- La **tabla de pacientes** salió del Resumen: duplicaba «Mis pacientes».
- La **ficha** es ahora `components/PatientDrawer.tsx` y la abre «Mis pacientes». El Resumen
  manda a una ficha puntual con `/pacientes?paciente=<id>`.
- El **reporte PDF** se genera desde cada fila de «Mis pacientes» (`components/ReportDialog.tsx`),
  ya sin desplegable para elegir paciente. Valida que el rango de fechas no esté invertido.
- La lógica de «quién requiere seguimiento» y el armado del paciente viven en
  `utils/patientView.ts`. **Usala en vez de copiarla:** «Mis pacientes» tenía su propia tabla
  de ánimo y puntuaba distinto la misma emoción que el Resumen.

**Backend — `GET /users/patients` ya no devuelve postulantes.** `registration.submit` crea el
usuario con rol `patient` antes de la revisión, así que las solicitudes pendientes
(`onboardingStatus: 'approval_pending'`) aparecían como pacientes en el panel de la coordinadora,
duplicando Solicitudes. Ahora se excluyen. Verificado: Sofía pasa de 10 a 7. Con test nuevo;
274 unitarios y 49 e2e pasando.

⚠️ **Para mobile:** el filtro por psicólogo asignado de la entrada de abajo también le cambió a
`StaffHomeScreen` lo que cuenta. Antes mostraba todos los pacientes de la sede; ahora, solo los
asignados al psicólogo. La etiqueta sigue diciendo **«Pacientes activos · en esta sede»**, que
quedó impreciso — debería decir algo como «tus pacientes en esta sede». No se tocó mobile.

**Pregunta abierta para el PO:** las alertas del Resumen son de toda la sede, la lista de
pacientes es solo la del psicólogo. Un psicólogo ve nombre y hora de la crisis de pacientes de
otros colegas (sin poder abrir su ficha). Puede ser deseable por cobertura —si alguien está de
vacaciones—, pero es una decisión de confidencialidad, no de diseño.

---

## 2026-09-16 — «Mis pacientes» ya existe, y `/users/patients` ahora filtra por psicólogo

**A quién le pega:** a **José** (es su `users.service.ts`), a **Eduardo** (Resumen) y a
cualquiera que consuma `GET /users/patients`.

**Qué hacer:** nada que instalar. Pero si tenías una pantalla contando pacientes, ojo con el
cambio de abajo.

**El cambio de fondo.** `GET /users/patients` devolvía **todos** los pacientes del sistema a
cualquiera de los dos roles. En el panel, «Mis pacientes» le mostraba a Miguel también los de
Valentina y Tomás, con su correo y su historial de alertas. Ahora:

- un **psicólogo** recibe solo los pacientes con asignación activa en `patient_assignments`;
- un **coordinador** los sigue recibiendo todos, porque es administrativo — si filtrara, una
  sede sin psicólogos no tendría quién la mire.

Verificado contra la base del seed: Miguel 3, Valentina 2, Sofía 10. Coincide con lo que
muestra Equipo. Hay 3 tests nuevos en `users.service.spec.ts` y uno en el del controller; los
273 unitarios y los 49 e2e siguen pasando.

⚠️ **Esto cambia lo que ves en el Resumen:** consume la misma query, así que un psicólogo pasa
de ver 7–10 pacientes a ver los suyos. No es que se hayan perdido datos.

**Sección nueva: «Mis pacientes»** (`pages/MisPacientesPage.tsx`, ruta `/pacientes`). Dejó de
ser «Próximamente». No repite la tabla del Resumen: ordena por **quién necesita atención**, con
el motivo escrito (`N días sin check-in`, `Nunca hizo check-in`, `Ánimo bajo esta semana`,
`Registro sin completar`, `Cuenta suspendida`), más adherencia de 28 días, racha y ánimo de la
semana. Todo sale de lo que `/users/patients` ya mandaba y nadie mostraba.

**Dos cosas que conviene saber si tocás esto:**

- **El umbral de 7 días sin check-in no está validado clínicamente.** Es
  `DIAS_SIN_CHECKIN_ALERTA` en esa página, y conviene revisarlo con AJUTER. La pantalla dice el
  motivo en vez de emitir un juicio, justamente por eso.
- **«Ver ficha» navega a `/?paciente=<id>`.** La ficha sigue siendo un cajón que vive dentro de
  `OverviewPage`, así que se abre por query param. Cuando tenga su propia ruta
  (`/pacientes/:id`), eso se reemplaza por navegación normal.

**Para José:** se tocó `users/users.service.ts`, `users.controller.ts` y `users.module.ts`, que
son tuyos. El cambio es acotado (un filtro por asignación y el `@CurrentUser()` en el
controller) y quedó con tests, pero avísame si preferís revisarlo antes de que suba.

---

## 2026-09-16 — Regla de cobro del cliente: la cuenta se suspende al TERCER mes · corre `seed:demo`

**A quién le pega:** a quien muestre la demo o toque algo de `billing`.

**Qué tienes que hacer:**

```bash
pnpm run seed:demo -- --reset
```

Sin eso, Lucía Vega te queda con **1 cuota vencida y la cuenta suspendida**, que con la regla
nueva es un estado imposible.

**La regla, traída del cliente por el PO:** el paciente **pierde el acceso a la app al cumplir
el tercer mes de no pago**, no antes. Con una o dos cuotas vencidas sigue entrando con
normalidad. Hay además una figura de **«congelar suscripción»** —la mensualidad se detiene y el
paciente tampoco entra— que **no existe en el código**.

**Ojo con la distancia entre la regla y lo implementado:**

- **Nada suspende por mora.** El único lugar que escribe `accountStatus: 'suspended'` fuera de
  los seeds es desactivar un *psicólogo*. Un paciente moroso **no se suspende nunca solo**:
  hoy habría que hacerlo a mano en la base.
- **No existe el estado congelado.** `AccountStatus` es `'active' | 'suspended'`; cero
  ocurrencias de frozen/congelar/pause en los cuatro workspaces.

**Qué se ajustó mientras tanto:**

- **El reporte PDF** usa 3 meses como umbral (`MESES_PARA_PERDER_ACCESO`). Con 1 o 2 cuotas la
  deuda va en tono neutro y dice cuánto margen queda; recién al tercer mes se pone en rojo.
  Antes alarmaba desde la primera cuota, y el rojo está reservado a la crisis.
- **El seed de Lucía** pasó de 1 a **3 cuotas vencidas** ($90.000), coherente con estar
  suspendida.

**Lo que falta decidir con el cliente** (en `ASUNCIONES-PENDIENTES.md`): qué conserva un
paciente suspendido o congelado. `CLAUDE.md` exige que la ruta de escalada del pánico esté
**siempre** disponible; si dejar de pagar apaga el botón de pánico y el `*4141`, eso choca con
la regla clínica del proyecto. Es la pregunta importante, y no es de facturación.

---

## 2026-09-16 — La auditoría UX de la web quedó cerrada: 42 de 42

**A quién le pega:** a quien toque estilos en `apps/web`, y a **Eduardo** (dueño de
`Sidebar.tsx` y del reporte PDF).

**Qué hacer:** nada que instalar ni correr. Tres cosas que conviene saber si escribes UI:

1. **No escribas `#fff` ni `rgba()` de marca a mano.** Ya no queda ninguno en `.tsx`. Usa
   `var(--fg-on-primary)` para texto e íconos sobre azul o rojo, `var(--surface)` para
   fondos blancos, y `var(--scrim)` para el velo de un modal (token nuevo: estaba escrito a
   mano en 6 archivos, así que cambiar la opacidad obligaba a tocar los seis). Para una
   opacidad puntual de un color de marca, `color-mix(in srgb, var(--primary) 30%, transparent)`.
   Los `rgba` de blanco y negro con alfa del sidebar **se dejaron a propósito**: no son
   colores del design system.
2. **El logo de AJUTER ya no se pide a `ajuter.org`.** Vive en
   `apps/web/src/assets/logo-ajuter.png` y `Sidebar.tsx` lo importa como módulo. Si el sitio
   del cliente cambiaba, el panel perdía el logo, y cada carga quedaba registrada en un
   servidor de terceros. **Para el PO:** el archivo se bajó del sitio público de AJUTER
   porque no estaba en la carpeta de marca; conviene que AJUTER confirme que es la versión
   vigente.
3. **El reporte PDF salía con la marca naranja de AJUTER.** `generatePatientPDF.ts` tenía la
   paleta vieja escrita a mano (`#E8883A`, `#574F4A`, `#2A2624`, `#FAF7F4`) desde antes del
   cambio de marca del 31-08: **el panel era azul y el informe que el psicólogo entrega salía
   naranja.** Ahora los colores se leen de los tokens del CSS en runtime, con respaldo fijo,
   así que el PDF no puede volver a desincronizarse del tema.

4. **En el login ya no aparece AJUTER.** El panel de marca decía «Para el equipo clínico de
   AJUTER y las familias…» y ahora dice «Para los equipos clínicos y las familias…».
   **Decisión del PO:** StopBet es el producto y AJUTER su primer cliente, pero puede haber
   más; quien todavía no entró no tiene sesión, así que el sistema no sabe a qué institución
   pertenece y nombrar una sería adivinar. Dentro del panel el logo de AJUTER **se queda** al
   pie del sidebar: ahí ya se sabe de quién es la cuenta. Es la misma regla que mobile aplicó
   en el PR #100.

   ⚠️ **Queda AJUTER escrito a mano en tres lugares post-login** (ver abajo), y sacarlo de uno
   de ellos no es solo cambiar el texto.

**AJUTER salió también de los textos post-login, en neutro.** Decisión del PO del 16-09: en
vez de esperar a que exista un campo de institución, los textos se escriben sin nombrar a
nadie. Qué cambió:

| Dónde | Antes | Ahora |
|---|---|---|
| `pages/familiar/FamiliarPortal.tsx` | «Portal de familiares de AJUTER» · «Un profesional de AJUTER debe aprobar tu vínculo…» · «Pídele a tu profesional de AJUTER…» | «Portal de familiares» · «Un profesional del equipo clínico…» · «Pídele al equipo clínico…» |
| `utils/generatePatientPDF.ts` | «Dashboard Clínico - AJUTER» · «Sede AJUTER:» · pie «StopBet · Dashboard Clínico AJUTER…» | «Panel clínico» · «Sede:» · «StopBet · Panel clínico · Documento de uso interno» |
| `pages/EquipoPage.tsx` | `placeholder` `fernanda.fuentes@ajuter.cl` | `nombre.apellido@tuinstitucion.cl` |

«Sede AJUTER:» era además redundante: el valor que va al lado ya es la sede.

**Lo único que sigue nombrando a AJUTER es el logo al pie del sidebar**, y se queda: ahí ya hay
sesión y el panel identifica a la institución dueña de la cuenta.

**Se borró `--ajuter-gradient`** de `stopbet-theme.css`. Era el último resto del tema naranja y
**no lo usaba ningún archivo** — FAM-01 lo había reemplazado en el portal del familiar.

⚠️ **El bloqueo de fondo sigue en pie, y es bueno saberlo antes de prometer multi-institución:**
`institutionId` existe en `registration_requests` pero **no en `users`**, así que al aprobar un
registro el usuario se crea sin institución y **después del login el sistema no sabe a cuál
pertenece**. Mientras eso no cambie, el panel no puede mostrar la marca de cada cliente: el
texto neutro es la solución correcta, no un parche. Está anotado en
`ASUNCIONES-PENDIENTES.md`, ítem 7.

**Un dato para quien mire rendimiento:** Inter y Nunito **no se descargan nunca** — son solo
respaldo de Chillax y Satoshi, y el navegador solo baja una fuente que se usa. Está medido en
`docs/auditoria-ux-web-2026-09-14.md`. Lo que sí pesa: **Chillax y Satoshi están en TTF
(263 KB)**, y pasarlas a woff2 ahorraría del orden de 150 KB por primera visita. Queda
propuesto, no hecho.

---

## 2026-09-16 — Cinco documentos decían cosas que el código ya no hace

**A quién le pega:** a quien use `docs/` como fuente de verdad — sobre todo **José** (matriz
de permisos), **Eduardo** y quien consuma `riskLevel` en el panel, y quien toque pánico.

**Qué hacer:** nada que instalar ni correr. Solo saber que estos cinco quedaron al día, todos
verificados contra el código de `main`, no contra otro documento:

1. **`security/permissions-matrix.md`** — los tres endpoints de `community` que se cerraron el
   16-09 seguían figurando como abiertos. `POST /announcements` pasó de ❌ a ✅, y
   `moderation/flagged` y `DELETE /posts/:id` a una categoría nueva, **✅ Autenticado**
   (`JwtAuthGuard` sin `@Roles`, porque el servicio ya distingue autor de psicólogo). El total
   protegido pasó de 19 a 20. `dev-set-days` salió de los huecos críticos: está detrás de
   `ENABLE_DEV_TOOLS` desde el 14-09.
2. **`reglas-asistente.md` §5** — decía que ante un fallo del LLM el `catch` guardaba
   `riskLevel: 'low'`. **Ya no:** hoy guarda `null`, y el tipo es `RiskLevel | null`. La
   distinción importa en pantalla: **`null` es "no se pudo evaluar", `'low'` es "evaluado y
   sin riesgo"**. Si muestras ese dato, no los pintes igual.
3. **`superpowers/specs/…-panic-button-design.md`** — el diseño de junio dice 3 minutos de
   escalada. Manda el criterio CA1.3: **120 s**, que es lo que tienen hoy el backend
   (`ESCALATION_MS`) y mobile (`ESCALATION_SECONDS`). Se avisa arriba del documento.
4. **`planning/evidencia-spike-sprint1.md`** — S.4 decía 19 `@Roles()`; ahora dice 20 y explica
   por qué el número sube. S.8 aclara que su evidencia sigue reproducible (la key local hoy
   está vacía, mismo camino) pero que el modelo cambió a `gemini-3.5-flash-lite`.
5. **`ASUNCIONES-PENDIENTES.md` ítem #4** — pedía reescribir commits por un trailer de
   co-autoría **antes de mergear**. La rama se mergeó hace meses y en `main` conviven cuatro
   variantes del trailer. Se cerró sin acción: reescribir historia compartida por seis
   personas obliga a todos a rebasear sus ramas vivas, y la regla vigente de `CLAUDE.md` ya es
   no ponerlo.

**Lo que NO se tocó, porque sigue siendo verdad:** `POST /panic/assign`,
`GET /community/posts/:id/replies` y `POST /subscriptions` siguen abiertos sin ninguna
identidad. Están en "Huecos críticos" de la matriz, cada uno con su dueño.

---

## 2026-09-16 — Si `pnpm install` te falla con "supply-chain policy check", pullea esto

**A quién le pega:** a todo el que pulleara después del PR #96 (navegación por pestañas).

**El síntoma:** `pnpm install` corta antes de instalar nada, con

```
✗ Lockfile failed supply-chain policy check
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 4 lockfile entries failed verification:
  @react-navigation/material-top-tabs@7.7.1 ... within the minimumReleaseAge cutoff
```

**Qué hacer:** pullear y listo, ya está arreglado. No hay comando nuevo.

**Por qué pasaba.** pnpm rechaza paquetes publicados hace muy poco — es una defensa contra
versiones maliciosas subidas hace horas. Las dependencias de navegación del PR #96 se
publicaron el 2026-09-15 y quedaron dentro de esa ventana. Se agregaron a
`minimumReleaseAgeExclude` en `pnpm-workspace.yaml`, **con versión fija**, igual que se hizo
en su momento con los paquetes de React Native 0.86. Son cuatro: las dos directas
(`material-top-tabs`, `native`) y dos transitivas que reclama después (`core`, `elements`).

**Ojo con el síntoma engañoso:** mientras el install está bloqueado, el `tsc` del backend tira
errores que parecen de código (`Cannot find module 'nodemailer'`,
`Property 'credentialsEmailSent' does not exist`). No son: es el entorno a medias, porque
`nodemailer` no se instaló y `shared-types` no se pudo recompilar. Con el install arreglado
desaparecen los cinco.

### ⚠️ Hallazgo aparte, para José: `pnpm.overrides` ya no se lee

Al instalar, pnpm avisa:

```
[WARN] The "pnpm" field in package.json is no longer read by pnpm.
       The following keys were ignored: "pnpm.overrides"
```

Es el pin de `@nestjs/core`/`@nestjs/common` a `10.4.22` que se agregó el 01-09 para que no
se resolvieran dos instancias de `@nestjs/core` (lo que rompía los 49 tests e2e). **pnpm 11
lo ignora**: ese ajuste se mudó a `pnpm-workspace.yaml`.

Hoy no está causando daño — verificado con pnpm 11.22: queda **una sola** instancia de
`@nestjs/core@10.4.22` y los 270 tests unitarios pasan, porque las bajadas de
`@nestjs/schedule` y `@nestjs/terminus` a versiones de Nest 10 alcanzan por sí solas. Pero el
pin quedó sin efecto, así que la red de seguridad que se puso en su momento ya no está.

**No se tocó acá a propósito**, porque además tiene un efecto colateral: al instalar con
pnpm 11 el lockfile se regenera sin la sección `overrides`. Esa regeneración **no se subió**.
Si alguien la sube sin querer, el diff son ~850 líneas y arranca borrando ese bloque.

---

## 2026-09-16 — La app móvil ahora también es del psicólogo

**A quién le pega:** a quien toque `apps/mobile`, y a quien toque el módulo `community` del
backend.

**Qué cambió.** Al entrar con una cuenta de **psicólogo**, la app ya no rechaza la sesión:
muestra una vista propia con tres secciones —Resumen, Comunidad y Perfil— en vez de la app
del paciente. Es un espejo condensado del Resumen del panel web, **de solo lectura**, más lo
único que se puede escribir desde el teléfono: publicar anuncios de la sede y eliminar
publicaciones reportadas.

**Tres cosas que conviene saber antes de tocar esto:**

1. **Hay dos árboles de navegación, no uno.** `App.tsx` decide por rol: `patient` va a
   `AppNavigator` (lo de siempre) y `psychologist` a `StaffTabs`. El del equipo clínico **no
   monta pánico, asistente ni check-in**, y su barra inferior **no tiene el botón SOS**:
   `POST /panic/alerts` crea una alerta a nombre de quien lo toca, así que ahí no significa
   nada y podría generar una crisis falsa.
2. **El coordinador sigue sin entrar por la app, y no es criterio de producto.** El backend
   no lo atiende: `GET /psychologists/:id` filtra por `role: 'psychologist'` y le responde
   404, y `assertPsychologist` le cierra la moderación con 403. Entraría a una app rota. Si
   alguien quiere sumarlo, primero hay que arreglar esos dos endpoints.
3. **`users.sedeId` guarda dos cosas distintas** y esto no es nuevo, pero acá se nota: las
   cuentas del seed tienen el **nombre** ("Santiago") y las creadas desde el registro tienen
   el **UUID**. `panic_alerts` copia la del paciente, así que arrastra lo mismo. Por eso
   existe `utils/staff.ts → mismaSede()`, que acepta las dos formas. Comparar solo por id
   deja fuera a media sede **sin que nada lo delate**: la lista sale vacía, no rota. El
   arreglo de verdad es normalizar la columna, y eso es una migración.

**Backend — `POST /community/announcements` ahora exige token y rol.** Antes **no verificaba
nada**: bastaba mandar el `x-user-id` de un psicólogo, sin ninguna credencial, para publicar
un anuncio firmado con su nombre a toda la sede. Ahora lleva `JwtAuthGuard + RolesGuard` y el
autor sale del token. `GET /community/moderation/flagged` y `DELETE /community/posts/:id`
llevan `JwtAuthGuard` (sin `@Roles`, porque el servicio ya distingue autor de psicólogo y un
guard de rol le quitaría al paciente el borrado de lo suyo). **Si algo tuyo llama a esos tres
endpoints con `x-user-id` y sin `Authorization: Bearer`, ahora recibe 401.** La web y mobile
ya mandan Bearer.

**No hace falta correr nada** después de pullear: no hay dependencias nuevas. Sí hay que
**recompilar la app** si la tenías instalada, porque cambió la navegación nativa.

---

## 2026-09-15 — La auditoría UX de la web ya está hecha: no la repitas

**A quién le pega:** a quien tome el dashboard web (y a quien vaya a tocar mobile).

**Qué cambió.** Las dos auditorías de UX quedaron cerradas y documentadas. Antes de
auditar nada por tu cuenta, lee la sección de arriba del archivo que te toque:

- **Web** — `docs/auditoria-ux-web-2026-09-14.md` → «Estado al cierre y traspaso». **39 de 42
  hallazgos arreglados y mergeados (PR #95).** Quedan tres (SIS-09 colores a mano, SIS-13
  fuentes de respaldo, SHL-03 el logo de AJUTER que se carga desde ajuter.org), con el porqué
  de cada uno. Esa sección también lista **lo que cambió después de la auditoría** —para que
  no lo reportes como bug— y los huecos que la auditoría UX no cubre (Finanzas y
  Configuración con datos mock, los 14 controladores sin guard, los vínculos de familiar que
  nadie aprueba).
- **Mobile** — `docs/auditoria-ux-mobile-2026-09-14.md` → «Estado al cierre». **72 de 76
  cerrados (PRs #90–#101)**, con la tabla de qué cerró cada PR.

**Lo que falta en las dos no es código: son decisiones.** Están juntas y con nombre en
`docs/ASUNCIONES-PENDIENTES.md`, sección «2026-09-15». Empieza por ahí si vas a hablar con
AJUTER o con el cliente: la pasarela de pago y quién paga, el texto de privacidad del
asistente, el tono de la cuenta suspendida y el género de «compañero de viaje».

**No hace falta correr nada** después de pullear esto: son solo documentos.

---

## 2026-09-15 — El término del programa es «compañero de viaje», no «padrino»

**A quién le pega:** a quien escriba textos en mobile, en la web o en correos.

**Qué cambió.** AJUTER no usa «padrino» ni «madrina»: en su programa la persona que acompaña
al paciente es su **compañero de viaje**. La app usaba el término equivocado en todas partes.
Se renombró el **texto visible** en mobile (pánico, comunidad, plan), en el panel web
(Alertas, Solicitudes) y en los mensajes del backend que llegan al paciente, incluidos los
de respaldo del asistente.

**En el código NO se renombró nada.** El rol sigue siendo `sponsor`, la tabla
`sponsor_assignments`, el header, los DTO y Swagger. Cambiar eso sería un refactor de base
de datos por un tema de vocabulario. **Regla: `sponsor` en el código, «compañero de viaje»
en la pantalla.**

**Dos cosas que conviene saber:**

- **El término es largo** (19 caracteres contra 7). Si escribes una fila de una línea que lo
  incluya, pruébala: las de pánico y comunidad se revisaron una por una y entran, pero
  cualquier fila nueva puede no hacerlo.
- **Queda una pregunta para AJUTER:** para una mujer sería «compañera de viaje», y el género
  de quien acompaña no se conoce en el código. Hoy se usa la forma masculina como nombre del
  rol y, donde se puede, se dice el nombre de la persona en vez del rol («Llamar a Daniela»,
  «Alerta enviada a Daniela»). Si AJUTER prefiere otra fórmula, es cambiar los textos, no la
  estructura.

---

## 2026-09-15 — AJUTER sale del cromo de la app: es un cliente, no la marca

**A quién le pega:** a quien escriba textos de la app mobile.

**La regla, decidida por el PO:** la app es **StopBet**; AJUTER es su primer cliente y en el
futuro puede haber más. Entonces:

- **En el cromo de la app no va el nombre del cliente.** "Ingresa con tus credenciales",
  no "…de AJUTER". "Tu equipo clínico", no "tu equipo AJUTER". "Tu sede", no "tu sede
  AJUTER".
- **Donde sí es un dato del paciente, sale de la sesión.** Perfil ahora dice
  "Paciente · Sede Santiago" leyendo `user.sedeId`, no un texto fijo.
- **Se queda escrito solo donde AJUTER es el dato**: la pantalla de elegir institución, que
  es literalmente la lista de instituciones.

De paso, **Perfil mostraba "Carlos" y la inicial "C" escritos a mano en el JSX**, así que
seguía saliendo Carlos con cualquier cuenta aunque el resto de la app ya usara la sesión
real. Ahora sale el nombre, el apellido y la inicial de quien entró.

Queda pendiente `contacto@ajuter.cl`, que es el correo real del cliente: cuando haya una
segunda institución tendrá que venir de la sede, no del código.

---

## 2026-09-15 — Mobile tiene sesión real: se acabó la cuenta de demo

**A quién le pega:** a todos. Si probabas la app entrando con cualquier cosa, eso ya no
funciona.

**Qué tienes que hacer:** entrar con una cuenta de verdad. Las del seed sirven —
`ana.perez@stopbet.cl`, `pedro.alvarez@stopbet.cl`, `demo@stopbet.cl`… — todas con la clave
`Stopbet2026!`. Si no corriste `pnpm run seed`, no vas a poder entrar.

**Qué estaba pasando.** `LoginScreen` tenía un `TODO`: esperaba 900 ms y llamaba a
`signIn()`. **Cualquier correo con cualquier clave abría la sesión**, y las siete pantallas
leían un `TEMP_USER_ID` fijo. Por eso toda cuenta mostraba "Hola, Carlos" con el mismo
progreso: no es que no se guardara el cambio de cuenta, es que nunca hubo cuentas.

**Qué cambió:**

- `POST /auth/login` de verdad, con sus errores distinguidos: credenciales incorrectas
  (401), cuenta suspendida (403) y "esta app es para pacientes" si entra alguien del equipo
  clínico — el backend no filtra por rol, lo hace la app, igual que la web.
- El token va en `Authorization: Bearer` y **rota solo ante un 401**, con `singleFlight`
  para que varias llamadas en paralelo no se pisen (el backend revoca el refresh al primer
  uso). Si el refresh ya no sirve, la app vuelve al login sola.
- **La sesión sobrevive a cerrar la app.** Ya no vuelve a Bienvenida cada vez.
- Se sigue mandando `x-user-id`, pero **con el id real**: 14 de 17 controladores lo leen sin
  verificarlo. Cuando se registre `JwtAuthGuard` como guard global, ese header se puede
  sacar.

**Si tocas código:**

- **No existe más `TEMP_USER_ID`.** Usa `useUserId()` de `context/AuthContext`, y
  `useCurrentUser()` si necesitas el nombre o la sede.
- **Las cachés sin conexión reciben el `userId`**: `readProgress(userId)`,
  `saveCommunity(userId, data)`, etc. La clave en disco es `@stopbet/last-progress/<userId>`.

**Dos fugas entre cuentas que arreglamos de paso**, y que conviene conocer porque el patrón
se puede repetir: las cachés sin conexión usaban **una sola clave para toda la app**, así que
entrar con otra cuenta y quedarse sin red mostraba el progreso —y el teléfono del padrino—
del paciente anterior. Y el detector de recaída externa guardaba el número de intento del
usuario previo en una variable de módulo: al cambiar de cuenta le anunciaba a quien recién
entraba **"tu psicólogo registró una recaída en tu historial"**. Ojo con el estado de módulo
en `services/`: ahora es por paciente.

⚠️ **Una consecuencia para decidir:** el backend rechaza el login de cuentas suspendidas
(403), y `JwtStrategy` corta las sesiones ya abiertas. Eso deja **`SuspendedAccountScreen`
sin forma de alcanzarse**: un paciente suspendido no puede entrar a pagar desde la app. Hoy
el login le dice que escriba a `contacto@ajuter.cl`. Cuando exista la pasarela habrá que
decidir si el backend le da una sesión limitada para pagar, o si el cobro se resuelve fuera
de la app.

---

## 2026-09-15 — La app ya tiene tema oscuro: no uses `Colors` directo

**A quién le pega:** a cualquiera que escriba UI en mobile.

**Qué cambió.** La app sigue el tema del teléfono, o el que el paciente elija en **Perfil → Apariencia** (Automático / Claro / Oscuro; se guarda en `AsyncStorage`). `StyleSheet.create` corre una sola vez al
cargar el módulo, así que una hoja de estilos fija no puede cambiar de tema. El patrón nuevo:

```tsx
const makeStyles = (c: Palette) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.border },
  title: { color: c.fg1 },
});

export function MiPantalla() {
  const c = useColors();               // solo si usas colores en el JSX
  const styles = useStyles(makeStyles);
  ...
}
```

**Tres reglas para no romperlo:**

1. **No importes `Colors`.** Sigue existiendo apuntando a la paleta clara, pero un color
   leído así se queda claro en modo oscuro. Usa `useColors()` / `makeStyles(c)`.
2. **Para texto e íconos usa `c.primaryText` y `c.dangerText`, no `c.primary` ni `c.danger`.**
   El azul y el rojo del manual son para **rellenos**: como texto sobre fondo oscuro dan
   3,16:1 y 2,72:1, bajo el mínimo. Es el mismo criterio que ya existía con `greenText`.
3. **Si agregas un color, agrégalo a las dos paletas.** El tipo `Palette` obliga a que la
   oscura tenga las mismas llaves, así que el type-check te avisa.

**El manual de marca no se tocó:** el azul, el verde y el rojo son los mismos en los dos
temas como relleno. Un botón azul con texto blanco da 5,09:1 en claro y en oscuro.

Los 12 pares de contraste principales están medidos: **cero por debajo de 4,5:1 en ambos
temas**. Si cambias un color, vuelve a medir.

**Lo que sigue en claro a propósito:** los diálogos nativos (`Alert`), porque el tema de
Android se fijó claro con los colores de marca — ver el aviso de la segunda tanda.

---

## 2026-09-15 — Deslizar entre secciones, avisos que no interrumpen y onda al tocar: `pnpm install` y recompilar

**A quién le pega:** a todo el que corra la app mobile. Y si tocas navegación —**Matías
Barraza** (Inicio, Pánico, Asistente), **Catalina Yáñez** (Comunidad), **HdU03** (Logros)—
léete lo de abajo antes de escribir un `navigate`.

**Qué tienes que hacer, en este orden:**

1. `pnpm install` en la raíz. Hay dos dependencias nuevas: **`react-native-pager-view`**
   (nativa) y `@react-navigation/material-top-tabs`. De paso `@react-navigation/native`
   subió a `^7.4.1`, que es lo que pide la de pestañas.
2. **Recompilar**: `pnpm run android` (o `android:device`). Con solo recargar Metro la app
   arranca en blanco con `Cannot read property 'ScreenStack' of undefined` o similar,
   porque falta el módulo nativo.

**Qué cambió.** Las cuatro secciones de la barra inferior (Inicio, Comunidad, Logros,
Perfil) dejaron de ser pantallas sueltas del stack y ahora son un **navegador de pestañas**,
así que se puede cambiar de sección **deslizando**, no solo tocando. El pánico, el asistente
y la cuenta suspendida siguen siendo pantallas del stack, por encima de las pestañas.

**Lo que te pega si escribes código:**

- **`AppStackParamList` cambió.** Home, Community, Achievements y Profile ya no están ahí:
  viven en `MainTabsParamList`, y el stack expone una sola ruta `MainTabs`.
- **Desde una pantalla que NO es pestaña** (pánico, asistente, cuenta suspendida) hay que
  navegar a la sección anidada:
  ```ts
  navigation.navigate('MainTabs', { screen: 'Community', params: { initialTab: 'forum' } });
  ```
  Desde una pestaña hacia otra, `navigation.navigate('Community')` sigue funcionando igual.
- **Las pantallas de pestaña usan `CompositeScreenProps`**, porque navegan tanto entre
  pestañas como al stack de arriba. Copia el patrón de `HomeScreen.tsx` si agregas una.
- **`BottomNav` ya no se dibuja dentro de cada pantalla.** La pinta el navegador una sola
  vez, en `src/navigation/MainTabs.tsx`. Si la vuelves a poner en una pantalla van a salir
  dos barras. Con eso se fueron los cuatro `handleTabPress` duplicados.

**Tres piezas nuevas que hay que usar en vez de lo de antes:**

- **`components/Touchable.tsx` reemplaza a `TouchableOpacity`.** Android responde al toque
  con una onda; la app solo bajaba la opacidad, que es el gesto de iOS. Migraron los 182
  usos. Tiene la misma forma que `TouchableOpacity` (`style`, `activeOpacity`, `onPress`,
  accesibilidad), así que cambiar el nombre alcanza. Sobre fondo azul o rojo, pásale
  `rippleColor="rgba(255,255,255,0.28)"`: la onda gris no se ve sobre color.
- **`useToast()` para lo que solo hay que leer.** El diálogo del sistema queda para las
  decisiones: eliminar, cerrar sesión, registrar una recaída, salir de una alerta activa.
  Para "Gracias, lo revisaremos" o "guardamos tu check-in" va `showToast(mensaje)`, o
  `toast(mensaje, 'error')` si estás fuera de un componente y no puedes usar hooks.
- **Hay un `SafeAreaProvider` en la raíz de `App.tsx`.** Antes no existía: los insets venían
  del que monta React Navigation dentro de cada navegador. Si algo tuyo usa
  `useSafeAreaInsets` fuera de un navegador, ahora funciona.

**Un arreglo que te puede cambiar lo que ves:** `isNetworkError` ahora reconoce `Aborted`.
El cliente HTTP corta a los 25 s con `AbortController` y eso llegaba como un error normal,
no como falta de conexión: un backend caído mostraba "No pudimos cargar tu progreso" en vez
del estado sin conexión, y en desarrollo levantaba el LogBox encima de la pantalla.

**Dos decisiones, por si te llama la atención:**

- **El botón de pánico quedó fuera del gesto**: el orden de deslizamiento es Inicio →
  Comunidad → Logros → Perfil. A la pantalla de crisis se entra apretando, nunca por un
  deslizamiento accidental.
- **Dentro de Comunidad, deslizar cambia de sección, no de pestaña.** Anuncios y Foro se
  siguen cambiando tocando: un gesto, un significado en toda la app.

---

## 2026-09-15 — Auditoría UX de mobile, segunda tanda: hay que recompilar (PR #96)

**A quién le pega:** a todo el que corra la app en su teléfono o emulador, y en particular a
**Matías Barraza** (Inicio, Pánico, Asistente), **Catalina Yáñez** (Comunidad), **Matías
Lara** (Registro) y **José Meza** (login).

**Qué tienes que hacer:**

1. **Recompilar la app, no basta con recargar el bundle.** Cambiaron `styles.xml` y
   `colors.xml`: `pnpm run android` (o `android:device`). Si solo recargas Metro, los
   diálogos del sistema van a seguir viéndose como antes.
2. **Vuelve a correr `pnpm run seed`** si quieres el texto corregido del anuncio de la
   sesión grupal. Decía «miércoles 18 de junio» y el 18 de junio de 2026 es jueves, así que
   no calzaba con la fecha que la app formatea desde `eventDate`.

**Dos APIs internas cambiaron.** Si tocas estos archivos, ojo:

- `registrarParaNotificaciones(userId)` ya no devuelve una función, devuelve
  `{ activado, detener }`. Se necesitaba saber si el paciente aceptó el permiso para poder
  decírselo en pantalla.
- `StepperHeader` recibe `labels: string[]` y `current: number`. El registro declara sus dos
  pasos reales (Datos · Sede); `PaymentScreen` pasa los tres explícitamente.

**Comportamientos que cambiaron a propósito** (para que nadie los reporte como bug):

- **Inicio y Logros se refrescan cada 3 minutos, no cada 5 segundos.** Si cambias algo en la
  base de datos y no aparece al tiro en la app, es esto: sal y vuelve a entrar a la pantalla.
  Antes eran 2.880 peticiones por hora de pantalla abierta.
- **La pantalla de «tu padrino respondió» ya no se cierra sola a los 30 segundos.** La
  cierra el paciente. Ese temporizador además marcaba como *cancelada* una alerta que sí
  había sido *respondida*, o sea ensuciaba el historial del psicólogo.
- **El registro salta el paso de elegir institución** mientras AJUTER sea la única, y el
  indicador muestra dos pasos en vez de tres. La pantalla `SelectInstitutionScreen` sigue
  existiendo para cuando haya una segunda.
- **El foro usa `FlatList`.** Si agregas contenido al foro, ya no se monta todo de una vez.
- **La app fuerza tema claro.** Con el teléfono en modo oscuro se ve igual que siempre; lo
  que cambia es que los `Alert` nativos ahora salen con los colores de StopBet en vez de
  gris oscuro con botones verde azulado. El modo oscuro de verdad sigue pendiente (SIS-07).
- **Los campos de tarjeta de `PaymentScreen` se eliminaron.** Con una pasarela real (Webpay)
  los datos de tarjeta no deben pasar por la app: el flujo correcto es redirigir al
  formulario alojado de Transbank. Ver `docs/presupuesto-stack-2026-09.md`.

**Colores:** hay cinco tokens nuevos en `constants/colors.ts` (`dangerSurface`,
`dangerBorder`, `successSurface`, `infoSurface`, `infoBorder`). Si vas a pintar un fondo de
estado, úsalos; no inventes otro pálido. Se reemplazaron 57 hex escritos a mano, entre ellos
los restos del tema AJUTER naranja y verde azulado.

El detalle hallazgo por hallazgo está en `docs/auditoria-ux-mobile-2026-09-14.md`.

---

## 2026-09-14 — Auditoría UX de la web: cambios visibles en el panel y el portal (PR #95)

**A quién le pega:** a quien use o muestre el panel web, sobre todo a **Eduardo** (Resumen,
Alertas y `DashboardApp.tsx`), **José Meza** (login), **Matías Lara** y **Catalina Yáñez**
(Solicitudes) y a quien toque Equipo o el portal del familiar.

**Qué hacer:** no hay nada que instalar ni correr. Estos cambios son a propósito:

- **Estados de alerta reales.** Las alertas de pánico muestran «Esperando al padrino»,
  «Escalada · sin respuesta», «El padrino respondió» o «Cerrada». Antes, una alerta
  escalada (que sigue abierta) decía «Resuelto con IA», y una cerrada decía «Sin resolver».
  Se usa `utils/alertStatus.ts` y `components/AlertStatusBadge.tsx`: no vuelvas a mapear
  los estados a mano.
- **Se quitaron botones sin acción:**
  - «Exportar lista», `···`, la paginación falsa y la campana con «3» fijo;
  - «Atender» y «Exportar» en Alertas;
  - los «Guardar cambios» de la ficha y de Configuración.

  Si esperabas verlos, no es un bug.
- **Solicitudes pide menos datos.** Al aprobar ya no se piden padrino, fecha ni notas, y
  al rechazar ya no se pide motivo, porque el backend no recibía ninguno de esos datos.
- **Secciones marcadas como provisorias:**
  - Configuración muestra el usuario de la sesión, en solo lectura;
  - Finanzas avisa que sus datos son de ejemplo;
  - «Mis pacientes» y «Reportes» dicen «Próximamente».
- **Contraste.** Hay un token nuevo, `--secondary-text` (verde para texto), y `--teal-50`
  quedó un punto más claro. El verde `#97b23f` y el azul claro ya no se usan como texto,
  porque no alcanzaban el contraste mínimo. La skill `stopbet-web-design` está actualizada.
- **Modales accesibles.** Para uno nuevo usa `hooks/useDialog`: se cierra con Escape y el
  foco no se escapa.

Detalle completo: `docs/auditoria-ux-web-2026-09-14.md`.

---

## 2026-09-14 — Auditoría UX mobile: hay que recompilar Android y agregar `ENABLE_DEV_TOOLS` al backend (PR #90 a #94)

**A quién le pega:** a todos los que corren la app mobile, y a quien use las herramientas de
prueba de Perfil en la demo. Los cambios tocan pantallas de varios dueños: Pánico, Asistente,
Comunidad, Registro, Login, Logros, Pago y Perfil. El detalle de cada una está en
`docs/auditoria-ux-mobile-2026-09-14.md`.

**Qué hacer:**

1. **Recompilar la app** (PR #94). Recargar Metro no alcanza, porque cambiaron `MainActivity.kt` y el
   ícono adaptativo. En un teléfono: `pnpm run android:device`. En el emulador:
   `npx react-native run-android --active-arch-only`.
2. **Agregar `ENABLE_DEV_TOOLS=true` a `apps/backend/.env`** (PR #93; ya está en `.env.example`) y
   reiniciar el backend. Sin esa línea, "Días sin apostar" de Perfil muestra "Error al
   sincronizar con el servidor", porque `POST /achievements/dev-set-days` responde 404.
   **En Railway no hay que ponerla.** Allá `NODE_ENV` es `development` y no distingue
   producción, así que esta variable es lo único que mantiene cerradas esas herramientas.

**Lo que puede parecer un bug y no lo es:**

- Las herramientas de prueba de Perfil ya no aparecen en un APK de release (`__DEV__`). En
  debug siguen apareciendo.
- El texto secundario (`Colors.fg2`) es un poco más oscuro: ahora es `#6b6a6a`, el mismo de
  la web. El anterior no llegaba al contraste mínimo sobre el fondo crema.
- Hay dos tokens nuevos para texto: `onPrimaryMuted` (sobre azul) y `greenText`. El verde y el
  azul claros quedan solo para rellenos.
- Si Android mata la app en segundo plano o cambias el tamaño de letra, la app arranca de cero
  en vez de intentar restaurar la pantalla (antes se caía). Por ahora eso la deja en
  Bienvenida, porque la sesión demo no se guarda.

---

## 2026-09-03 — Aprobar una solicitud ya refresca el conteo de pacientes en Equipo (commit directo en `main`)

**A quién le pega:** a **Eduardo**, porque toca `apps/web/src/DashboardApp.tsx`, que es suyo — si
lo tienes modificado en tu rama, el rebase trae 3 líneas nuevas dentro de `handleApprove`. Y a
cualquiera que estuviera probando Solicitudes o Equipo y viera números que no cuadraban.

**Qué hacer:** nada más que pullear.

**Por qué:** aprobar una solicitud escribe tres cosas (la solicitud, el paciente y la asignación
del psicólogo), pero `handleApprove` solo invalidaba `['registration', 'pending']`. Como
`EquipoPage` y el selector de psicólogo del propio modal leen `['psychologists']`, y `main.tsx`
fija `staleTime: 30_000`, **la pantalla quedaba una aprobación atrasada**: se aprobaba un
paciente y el psicólogo seguía mostrando el conteo anterior hasta que alguien recargara.

Lo engañoso es que **no se perdía ningún dato** — la asignación siempre se guardó bien — pero
desde el dashboard era indistinguible de un fallo de guardado, y se podía perder rato buscando
el problema en el backend, donde no estaba. Peor aún: al aprobar dos seguidas mostraba un valor
intermedio (1 cuando ya había 2), que parece un dato real y nadie cuestiona.

**Reproducido y verificado en local el 2026-09-03** con la BD del seed: Fernanda Fuentes en 0 →
aprobar 2 solicitudes de Santiago → la pantalla decía 1 y la BD decía 2; con el fix, aprobar una
tercera la deja en 3 al instante, sin recargar.

## 2026-09-03 — Nuevo `pnpm run seed:demo` para la revisión en vivo del Sprint 1 (commit directo en `main`)

**A quién le pega:** a quien vaya a poblar la base para la demo de mañana, o a quien la use
después para probar HdU24, Solicitudes o el portal del familiar con datos reales.

**Qué hacer:** después de `pnpm run seed` y `pnpm run seed:family`, correr también:

```bash
pnpm run seed:demo -- --reset
```

Detalle completo, cuentas y orden sugerido de la demo en
[`docs/demo-sprint1.md`](demo-sprint1.md).

**Por qué:** ni `seed.ts` ni `family.seed.ts` pueblan nunca `patient_assignments`,
`psychologist_sedes`, `registration_requests`, `notifications` ni `subscriptions`/`invoices`
— así que Equipo mostraba 0 pacientes por psicólogo, Solicitudes salía vacía y no había forma
de demostrar CA 24.3/24.5 (reasignar pacientes al desactivar un psicólogo o quitarle una
sede). El script nuevo (`apps/backend/src/demo.seed.ts`) agrega justo eso, sin tocar los otros
dos seeds.

**Ojo con esto si tocas `panic.service.ts` o pruebas el botón de pánico:** el `@Cron` que
escala alertas `pending` a los 120 s (CA 1.3) corre sobre **cualquier** alerta pendiente, sin
mirar antigüedad razonable — una alerta sembrada con `createdAt` de hace varios minutos se
escala sola en los primeros 10 s tras arrancar el backend. Por eso `seed:demo` no siembra
ninguna alerta en `pending`: las tres "de hoy" nacen ya `escalated`/`responded`. Si necesitas
una alerta `pending` real para probar algo, dispárala desde el celular.

---

## 2026-09-03 — El RUT ya no se duplica al escribirlo en el registro mobile (PR #86)

### Si viste el campo RUT escribiendo `123123123123...` solo, esto era

**A quién le pega:** a quien pruebe el registro de paciente (`RegisterStep1Screen`) en un
Android con **texto predictivo activado** en el teclado. Con predicción apagada, o en
iOS, nunca se vio.

**Qué pasaba:** el campo reformatea el RUT en cada tecla (`formatRut` agrega puntos y
mueve el guión), y eso rompía la composición del teclado predictivo: al reescribirle el
texto por debajo, el teclado volvía a soltar su buffer entero. No era una regresión —
estaba así desde HU-06 (27-ago) — pero solo se disparaba con esa combinación puntual de
teclado y ajuste, así que a la mayoría nunca le tocó verlo.

**Qué hacer:** nada que instalar ni correr. Si a alguien le vuelve a pasar en **otro**
campo que se reformatea solo (no en el RUT, que ya está resuelto), es el mismo bug:
revisar `apps/mobile/src/components/FormInput.tsx` — el prop `autoCorrect` no basta en
todos los teclados (el de Samsung lo ignora), hace falta `keyboardType="visible-password"`
en el campo específico, como se dejó en el de RUT.

---

## 2026-09-03 — Publicar y responder en Comunidad ya no se duplica al reintentar (rama `fix/escrituras-idempotentes-comunidad-alex-dominguez`)

### Si viste mensajes repetidos en el foro, esto era

**A quién le pega:** a quien pruebe Comunidad, y a quien toque `community/**` en el backend.

**Qué hacer:** nada que instalar ni correr. Las dos columnas nuevas las crea TypeORM sola al
arrancar el backend.

**Qué pasaba:** la petición llegaba y el servidor la guardaba, pero **la respuesta se perdía
de vuelta**. La app avisaba "sin conexión" con el mensaje ya publicado, el paciente lo
escribía de nuevo y quedaba dos veces en el foro, delante de su grupo. Está verificado en la
base de producción: dos posts idénticos separados por 110 segundos.

**El arreglo:** `CommunityPost` y `PostReply` suman `clientRequestId`, con índice único. La
app genera ese id por acción y **lo conserva al reintentar**; si llega repetido, el backend
devuelve el registro original en vez de crear otro, y tampoco vuelve a notificar al autor.

Detalles que conviene saber si tocas esto:

- **La clave va atada al texto.** Si el paciente corrige lo que escribió antes de reintentar,
  eso es un mensaje distinto y lleva clave nueva; si no, el backend le devolvería el anterior.
- **Es opcional.** Un APK viejo que no manda la clave sigue publicando igual (verificado).
- Quedan 6 tests nuevos en `community.service.spec.ts`, que antes no tenía ninguno.

**Ojo, el mismo patrón está en otras pantallas.** El check-in y el botón de pánico también
escriben sin clave de idempotencia. No se tocaron acá por ser de otros criterios, pero si
alguien reporta un duplicado ahí, la causa es esta misma.

---

## 2026-09-02 — Compartir una insignia ya no precarga el mensaje en el foro (PR #80)

**A quién le pega:** a quien pruebe o demuestre el módulo de Comunidad.

**Qué hacer:** nada que instalar ni correr. Solo saber que el cambio es a propósito.

**Por qué:** el CA5.2 pide un anuncio **automático**, y el backend ya lo publicaba solo. La app
además llegaba al foro con un mensaje predeterminado en el cuadro de abajo, sobrante del flujo
manual anterior: el paciente veía su logro dos veces. **Si esperabas ver el texto precargado y
ya no está, no es un bug.** El anuncio aparece publicado en el feed. De paso el foro ahora se
recarga al enfocar la pantalla, así que el post recién creado se ve al llegar.

**Ojo, quien lleve pánico (CA5.1):** en el mismo PR va un arreglo en `PanicScreen.tsx`. La
pantalla marcaba la comunidad como avisada sin mirar la respuesta, y `notifyCommunity` contesta
200 con `false` cuando el paciente no tiene sede: se ocultaban la tarjeta y el botón, y el
paciente en crisis quedaba sin la opción creyendo que su red ya sabía. Ahora avisa y el botón
sigue disponible. **Queda pendiente el residuo del borrador**: `PanicScreen.tsx:290` todavía
precarga un texto en el composer aunque el post ya se publicó solo — no lo toqué por ser de
otro criterio.
## 2026-09-02 — Si en Comunidad te sale "Sin conexión", revisa primero el interruptor de prueba (rama `fix/errores-comunidad-mobile-alex-dominguez`)

### El mensaje mentía: cualquier error decía "Sin conexión"

**A quién le pega:** a quien pruebe Comunidad en la app mobile.

**Qué hacer:** nada que instalar. Solo saber que **Perfil → Herramientas de prueba →
"Simular sin conexión"** corta *todas* las peticiones de la app, y hasta ahora producía un
aviso idéntico al de una caída de red real. Si estabas probando criterios y de pronto
"dejó de haber conexión", revisa ese interruptor antes de buscar el bug en otro lado. Vive
en memoria, así que cerrar la app del todo también lo apaga.

**Qué cambió:** las seis acciones de la pantalla (asistencia, reacción, publicar, responder,
reportar, eliminar) ahora distinguen tres casos en vez de uno: modo de prueba activo, fallo
de red real, y error del servidor (mostrando el código). Además el error queda en `logcat`,
que antes el `catch` se lo tragaba y no dejaba nada que mirar. El banner de la pantalla
también avisa cuando el modo simulado está encendido.

Ojo: el backend no tenía nada malo. Se verificó contra Railway con el mismo encabezado y
cuerpo que manda la app: 3 respuestas seguidas y 2 reportes, todos OK.

---

## 2026-09-02 — Firebase push activo: falta `firebase-service-account.json` en local (PR pendiente, rama `fix/dependencias-nestjs-jose-meza`)

### Sin ese archivo, el backend arranca igual pero con push desactivado — no es un bug

**A quién le pega:** a quien levante `apps/backend` en local y quiera probar notificaciones
push, o le extrañe ver `[PushService] Firebase sin configurar: las notificaciones push quedan
desactivadas` al arrancar.

**Qué hacer**, una vez, en `apps/backend/`:

1. Pedir el archivo `firebase-service-account.json` a José Meza (o generarlo de nuevo desde
   Firebase Console → Project Settings → Service accounts → Generate new private key, si
   tienes acceso al proyecto).
2. Ponerlo en `apps/backend/firebase-service-account.json` — ya está en `.gitignore`
   (`apps/backend/firebase-service-account.json` y `**/*-firebase-adminsdk-*.json`), nunca se
   sube al repo.
3. Agregar en `apps/backend/.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
   ```

**Por qué:** `push.service.ts` ya soportaba esto desde que se implementó FCM, pero nadie había
configurado la credencial real en ningún ambiente — ni local ni Railway. Se generó el service
account en Firebase Console y se configuró en ambos: local vía
`FIREBASE_SERVICE_ACCOUNT_PATH` (archivo), Railway vía `FIREBASE_SERVICE_ACCOUNT_JSON`
(variable con el JSON completo, porque Railway no permite subir archivos). Producción ya lo
tiene — confirmado en los logs de Railway: `[PushService] Firebase inicializado:
notificaciones push activas`. En local sigue habiendo que configurarlo a mano por persona,
porque el archivo de credenciales nunca puede vivir en el repo.

De paso quedó también resuelto **S.7** (alerta de caída a Discord): `DISCORD_ALERT_WEBHOOK_URL`
estaba configurada hace tiempo en Railway pero nunca se había probado el flujo completo — se
confirmó forzando `AlertsService.checkDatabaseHealth()` contra el webhook real (sin apagar la
BD de producción) y llegó el mensaje al canal del equipo. No requiere ninguna acción de nadie,
va acá solo para que quede registrado junto con el cambio de Firebase de la misma sesión.

---

## 2026-09-02 — Al cerrar sesión, la cuenta siguiente heredaba los datos de la anterior (rama `fix/limpiar-cache-al-cerrar-sesion-alex-dominguez`)

### Confidencialidad: si probaste dos cuentas seguidas, viste datos ajenos

**A quién le pega:** a todo el que pruebe el dashboard cambiando de cuenta, y a cualquier
máquina compartida de la clínica.

**Qué hacer:** nada, solo pullear. No hay comando ni dependencia nueva.

**Qué pasaba:** `clearSession()` en `App.tsx` limpiaba el almacenamiento, los tokens y el
estado de React, pero **no la caché de TanStack Query**, que vive en memoria y sobrevive al
logout. Como **ninguna clave de caché lleva el id del usuario**, la cuenta siguiente heredaba
lo de la anterior: `['patients']`, `['alerts','history']`, `['registration','pending']`,
`['psychologists']`, `['family','sessions']`.

Y era peor que un parpadeo: con `staleTime: 30_000` esos datos se consideraban **frescos**, así
que los componentes ni siquiera volvían a pedirlos. Un psicólogo que entraba después de otro
podía estar viendo la lista de pacientes ajena hasta medio minuto. Recargar con F5 lo tapaba,
porque la caché es solo de memoria.

**El arreglo:** una línea, `queryClient.clear()` dentro de `clearSession()`. Cubre las tres
salidas: logout manual, sesión expirada y el corte por rol.

**Lo que vas a notar:** al cerrar sesión y entrar con otra cuenta, ahora aparece brevemente el
estado de carga en vez de la vista anterior. Eso es lo correcto, no un bug nuevo.

**Para tener en cuenta al escribir queries nuevas:** las claves siguen sin llevar identidad. Si
agregas una `useQuery` con datos de un usuario, considera incluir su id en la clave; hoy lo
único que las separa es este `clear()`.

---

## 2026-09-02 — El portal del familiar suma calendario y sesiones obligatorias (rama `feature/HU-11-calendario-mis-sesiones-alex-dominguez`)

### Corre `pnpm run seed:family` después de pullear

**A quién le pega:** a quien levante el portal del familiar o toque el módulo `family`.

**Qué hacer**, una vez, desde la raíz y con el backend ya reiniciado:

```bash
pnpm run seed:family
```

**Por qué:** `family_sessions` suma la columna `isMandatory`. TypeORM la crea sola al arrancar
el backend (`synchronize`), así que no hay migración que correr, pero **el seed viejo no trae
ninguna sesión obligatoria**: sin volver a sembrar, la funcionalidad nueva no se ve por
ningún lado y parece que no estuviera hecha.

Después del seed, `patricia.gomez@stopbet.cl` queda con 4 sesiones en vez de 3, y una de ellas
es obligatoria.

### Dos cambios visibles que podrías confundir con un bug

- **"Mis sesiones" ya no es la lista de arriba.** El portal se partió en dos: *Próximas
  sesiones* es la agenda de la sede, donde se responde, y *Mis sesiones* es un calendario
  mensual con lo que le corresponde asistir al familiar. Sobre 1024px van lado a lado; abajo
  de eso se apilan como antes.
- **Las tarjetas ya no muestran los botones "Confirmar asistencia" y "No podré ir".** Ahora
  todas usan el interruptor, con **tres** apariencias y no dos: sin responder va con borde
  punteado y la perilla al medio, que no es lo mismo que un rechazo. Si ves una sesión "a
  medio marcar", es eso y está bien.

**Ojo si tocas `apps/web/src/services/api.ts`:** la interfaz `FamilySession` suma el campo
`isMandatory`. Son 3 líneas en medio del archivo, no al final, así que puede chocar con tu rama.

---

## 2026-09-01 — `@nestjs/schedule` y `@nestjs/terminus` rompían **todos** los tests e2e (rama `fix/dependencias-nestjs-jose-meza`)

### Hay que correr `pnpm install` después de pullear — y si `test:e2e` te fallaba entero, no era tu código

**A quién le pega:** a todos los que corran `pnpm run test:e2e` o `pnpm test` en el backend.

**Qué hacer**, una vez después de pullear, desde la raíz:

```bash
pnpm install
```

**Por qué:** `apps/backend/package.json` tenía `@nestjs/schedule@^6.1.3` y
`@nestjs/terminus@^11.1.1` — ambas son versiones para NestJS 11, mientras que el resto del
proyecto (`@nestjs/core`, `@nestjs/common`, etc.) está fijado en 10. Eso rompía la app
**entera** al arrancar en modo test: `Nest can't resolve dependencies of the
SchedulerMetadataAccessor (?) ... Reflector`. Como `AppModule` no levanta, **los 4 suites
e2e fallaban completos (49/49 tests)**, sin relación con lo que cada uno haya tocado —  si te
pasó, no busques el bug en tu código, era esto.

Bajadas a `@nestjs/schedule@^4.1.2` y `@nestjs/terminus@^10.3.0` (compatibles con Nest 10).
Además se agregó `pnpm.overrides` en el `package.json` de la raíz fijando
`@nestjs/core`/`@nestjs/common` a `10.4.22`: sin eso, pnpm seguía resolviendo dos instancias
físicas distintas de `@nestjs/core` en el árbol (una para el resto de la app, otra para
`schedule`/`terminus`), y aunque ambas decían "10.4.22", Nest las trataba como clases
distintas por referencia — el síntoma es el mismo error de `Reflector` incluso con las
versiones ya corregidas. Si en el futuro alguien agrega una dependencia de NestJS y vuelve a
pasar esto, revisen primero `pnpm why @nestjs/core` antes de sospechar del código.

**Ojo si tu `.env` local apunta a Railway en vez de a tu Postgres local:** de paso se encontró
un `apps/backend/.env` con `DATABASE_URL` apuntando a la base de **producción** de Railway y
`NODE_ENV=production`. Si el tuyo también apunta ahí, tus tests e2e van a intentar crear y
borrar usuarios contra la base real — revisa que tu `DATABASE_URL` sea
`postgresql://postgres:password@localhost:5432/stopbet` y `NODE_ENV=development`, como dice
`CLAUDE.md`. Si tu Postgres local no tiene esa contraseña, no hay que reinstalar nada: se
resetea con `ALTER USER postgres WITH PASSWORD 'password';` desde `psql` (requiere editar
`pg_hba.conf` a `trust` temporalmente si perdiste el acceso — pregúntenme si hace falta).

---

## 2026-09-01 — Dependencia nueva (`nodemailer`) y módulo `mail` ([PR #75](https://github.com/StopBet/StopBet/pull/75))

### Corre `pnpm install` después de pullear

**A quién le pega:** a todos. Se agregó `nodemailer` (+ `@types/nodemailer`) a
`apps/backend`. Sin `pnpm install` el backend no compila y el error apunta a un import de
`mail.service.ts`, que no es donde está el problema.

**Qué hacer:** `pnpm install` en la raíz. Nada más.

**Qué cambió:** al crear un psicólogo, el backend ahora **le envía las credenciales por
correo** (CA24.1: "el sistema … le envía sus credenciales de acceso"). Antes solo se mostraban
en pantalla para entrega a mano.

**No necesitas configurar nada.** El correo es **opcional**: sin `SMTP_HOST` en tu `.env` el
backend arranca igual, no manda nada, y la pantalla de Equipo sigue mostrando la contraseña
temporal como siempre, avisando que la entregues tú. Si quieres probar el envío, hay un buzón
falso local documentado en el `README.md` y en `apps/backend/.env.example`.

**Ojo, esto sí se puede confundir con un bug:** el modal "Psicólogo creado" ahora **oculta la
contraseña** cuando el correo salió bien; está detrás del enlace *"¿No le llegó? Ver la
contraseña"*. Si el correo no sale, se muestra como antes.

### Añadido 2026-09-02 — En Railway el correo NO va a funcionar, y no es un bug nuestro

**Railway bloquea las conexiones SMTP salientes en los planes Free, Trial y Hobby** — puertos
25, 465, 587 y 2525. Solo Pro y superiores las permiten, y el proyecto corre en Hobby.
([Documentación de Railway](https://docs.railway.com/networking/outbound-networking).)

**Verificado en producción**, no deducido: con las variables SMTP bien configuradas, el log del
deploy da `ERROR [MailService] ... Connection timeout`, y el Network Log muestra el
`POST /psychologists` tardando **10 s exactos** —el timeout del servicio— antes de responder
`201`. La conexión a Gmail nunca llega a establecerse.

**Qué significa para ti:** si pruebas crear un psicólogo **en la web de producción**, vas a ver
el recuadro rojo *"No se pudo enviar el correo"* y una espera de varios segundos. **No lo
reportes como bug ni lo intentes arreglar**: es una limitación del plan de la infraestructura.
En local, con el buzón falso o con Gmail, funciona perfecto.

**La salida** es cambiar a un proveedor con **API HTTPS** (Brevo o Resend), que no pasa por los
puertos bloqueados — es lo que Railway mismo recomienda. Pendiente, no está hecho.

---

## 2026-09-01 — La skill de diseño web estaba en el tema viejo: si tu Claude escribía naranja, era esto (commit directo en `main`)

### Reinicia tu sesión de Claude Code si trabajas en `apps/web`

**A quién le pega:** a quien use Claude Code para construir componentes o páginas en `apps/web`.

**Qué hacer:** nada que instalar. Solo **reiniciar la sesión de Claude Code** después de pullear:
las skills se cargan al arrancar y quedan en caché, así que una sesión ya abierta sigue con la
versión vieja.

**Por qué:** `.claude/skills/stopbet-web-design/SKILL.md` seguía documentando el tema AJUTER
naranja que se reemplazó el 31-08 por el azul StopBet. Estaba equivocada en casi todo: `bg-primary`
como `#E8883A` en vez de `#396fb6`, las fuentes como Nunito/Inter en vez de Chillax/Satoshi, y una
lista de ~70 íconos que no existen. **Si le pediste un componente nuevo y te salió naranja dentro
del panel azul, no era invento del modelo: era la skill.** Ya está corregida contra el CSS real.

**De paso quedaron documentadas dos trampas** que no estaban en ningún lado:

- Los nombres de las variables crudas **ya no describen su color**. `stopbet-theme.css` redefine
  la paleta de `colors_and_type.css` conservando los nombres: `--teal-700` es azul `#396fb6`,
  `--amber-500` es azul claro. No te guíes por el nombre. Igual que `--ajuter-gradient`, que
  conserva el nombre y hoy es azul.
- **`WIcon` con un nombre que no está en su `ICON_MAP` no falla: renderiza un hueco vacío**, sin
  error ni warning en consola. Si un ícono "no aparece", revisa primero que el nombre esté en la
  lista (son 41, están en la skill) antes de buscar el problema en otro lado.

---

## 2026-09-01 — La demo en la nube ya está lista, y cómo compilar el APK de release en Windows (rama `docs/demo-nube-y-apk-release-alex-dominguez`)

### Para mostrar la app ya no hace falta levantar nada local

**A quién le pega:** a cualquiera que tenga que mostrar el producto (reunión, avance, demo).

**Qué hacer:** mandar el link y entrar. Nada de backend, Metro ni túneles `adb`.

- Dashboard web: <https://stopbet-lemon.vercel.app> (ya apunta al backend de Railway)
- Clave de todas las cuentas de prueba: `Stopbet2026!`

**Por qué:** `CLAUDE.md` decía que la base de Railway estaba vacía y que no había con qué
entrar. Eso quedó desactualizado: alguien ya corrió `pnpm run seed` y `seed:family` contra
ella. Verificado el 2026-09-01, `POST /auth/login` devuelve token para las cuentas del seed,
incluidas las del portal del familiar. Ya lo corregí en `CLAUDE.md`.

### Para compilar el APK de release en Windows, copia el repo a una ruta corta

**A quién le pega:** a quien necesite un APK instalable, para probar sin cable o para pasarle
la app a alguien. Solo en Windows, y **solo para release**: el debug no cambia en nada.

**Qué hacer:** no corras `assembleRelease` sobre el repo que tienes en OneDrive, ni con el
`subst S:`. Copia el repo a una ruta corta, instala ahí y compila ahí:

```bash
robocopy <tu-repo> C:\sb /E /XD node_modules .git build .cxx .gradle dist
cd C:\sb && pnpm install --frozen-lockfile
pnpm --filter @stopbet/shared-types build
cd C:\sb\apps\mobile\android && ./gradlew assembleRelease
```

El APK sale en `C:\sb\apps\mobile\android\app\build\outputs\apk\release\app-release.apk`.
Verificado el 2026-09-01: `BUILD SUCCESSFUL` en 10m 36s, instalado y funcionando en un
Galaxy S21 sin cable. Alternativa sin tocar tu máquina: lanzar
`.github/workflows/mobile-preview.yml` desde Actions > Mobile Preview > Run workflow, que
corre en Linux y publica el APK en Firebase App Distribution.

**Por qué la ruta corta:** el build necesita dos cosas que en el layout actual se estorban, y
ninguna de las dos configuraciones habituales sirve:

- **Desde `C:\Users\...\OneDrive\Escritorio\...` falla el C++.** Ese prefijo son 56
  caracteres, la ruta de objetos de CMake llega a unos 265 y revienta el límite MAX_PATH de
  260 de Windows.
- **Desde el `subst S:` que crea `scripts/android-run.ps1` falla Metro.** Los junctions de
  pnpm apuntan todos a `C:`, así que Metro mezcla dos unidades. Con `STOPBET_REAL_ROOT`
  definida arma rutas imposibles como `S:\C:\Users\...\metro-runtime\...`; sin ella, corta
  con `Failed to get the SHA-1`.

`C:\sb` cumple las dos: ruta corta **y** una sola unidad, sin `subst` de por medio.

**Callejones sin salida, para que nadie los repita:** separar las etapas no sirve
(pre-generar el bundle y correr `gradlew -x createBundleReleaseJsAndAssets` falla porque AGP
consulta el provider de esa tarea igual), y tampoco reemplazar el junction de
`@stopbet/shared-types` por una copia real (destapa que el problema es de todos los junctions
de pnpm, no de ese paquete).

**Ojo con el síntoma:** el primer error es
`ninja: error: mkdir(...): No such file or directory`, que no se parece en nada a un problema
de largo de ruta. Son 8 a 10 minutos por intento.

---

## 2026-08-31 — El dashboard web pasó del naranja AJUTER al azul StopBet (rama `fix/dashboard-responsive-completo-alex-dominguez`)

### El panel se ve azul después de pullear. No está roto.

**A quién le pega:** a cualquiera que levante el dashboard web o trabaje en `apps/web`.

**Qué hacer:** nada. No hay comando ni variable nueva. Solo no asustarse.

**Por qué:** el shell clínico usaba el tema AJUTER (naranja `#E8883A`) y el login la marca
StopBet (azul `#396fb6`). La misma sesión cambiaba de identidad al entrar. Ahora todo el
panel va con la marca del producto. El logo de AJUTER **no desapareció**: bajó al pie del
sidebar, porque el panel sigue identificando a la institución que lo usa.

**Lo que sí cambia si tocas estilos:**

- **`src/styles/ajuter-theme.css` ya no existe.** Lo reemplaza `stopbet-theme.css`, con la
  misma mecánica: redefine los tokens semánticos y las páginas no se tocan una por una. Si
  tu rama lo modificó, ese cambio hay que rehacerlo en el archivo nuevo.
- **Las fuentes cambiaron**: Chillax para títulos y Satoshi para body, con Nunito e Inter de
  respaldo. Si algo se ve con otra métrica de texto, es esto.
- **`--ajuter-gradient` conserva el nombre pero ahora es azul.** Se dejó así para no tocar
  las páginas que ya lo consumen.
- Si escribiste un color a mano en vez de usar un token semántico, tu vista quedó naranja en
  medio de un panel azul. Esa es la señal para cambiarlo por el token.

**Ojo con los conflictos:** el PR toca 12 archivos compartidos de `apps/web` (`Sidebar`,
`TopBar`, `MetricCard`, `index.css` y 7 páginas). Si tu rama toca alguno, rebasea temprano.

---

## 2026-08-31 — Despliegue a producción: backend en Railway, web en Vercel (rama `chore/despliegue-nube-jose-meza`)

### El backend y la web ya están desplegados de verdad — no son solo config sin probar

**A quién le pega:** a todo el equipo, para cualquier cosa que se pruebe contra la nube en vez
de local (demo, QA, mostrarle el avance a alguien).

**Qué hay ahora:**
- Backend: `https://stopbetbackend-production.up.railway.app` (`/health`, `/api/docs`). Base de
  datos sembrada con `pnpm run seed` + `pnpm run seed:family` — las mismas cuentas que en local,
  misma clave `Stopbet2026!`.
- Web: `https://stopbet-lemon.vercel.app`, ya apuntando a ese backend.
- `CORS_ORIGIN` ahora acepta una **lista separada por comas** (`apps/backend/src/main.ts`); antes
  aceptaba un solo origen y con dos se rompía uno de los dos.
- La app mobile ya no tiene `BASE_URL` fijo a `localhost` (`apps/mobile/src/services/api.ts`):
  usa `__DEV__` para elegir entre local (desarrollo) y Railway (release). Cualquier APK de
  release que compilen ustedes o el CI (`mobile-preview.yml`) ahora funciona en un teléfono sin
  el `adb reverse` ni el computador prendido.

**Qué hacer:** nada obligatorio — no hay dependencias nuevas ni pasos de `pnpm install`. Si van
a probar contra la nube, usen las URLs de arriba (también quedaron en el README, sección
"Despliegue en producción").

**Ojo con esto, no es un bug:** en Railway aparecen **dos** proyectos llamados "StopBet". El real
es el de arriba, en la cuenta de José. El otro, en el workspace personal de Matías Barraza, es
un intento viejo muerto desde mayo (deploy `FAILED`, dominio 404) — no hay nada ahí, ignórenlo.

---

## 2026-08-31 — Cierre de acceso a cuentas suspendidas (rama `fix/cuenta-suspendida-cierra-acceso-matias-lara`)

### Suspender un psicólogo ahora sí le cierra el acceso — y toca archivos de `auth/**` (José)

**A quién le pega:** a todo el equipo que pruebe login o cuentas suspendidas; a José, dueño de
`apps/backend/src/auth/**`, aunque no haya podido revisarlo antes de este commit.

**Qué cambió:**
1. Una cuenta con `accountStatus: 'suspended'` ya no puede hacer login (`403`, banner "Tu cuenta
   no tiene permisos para acceder") ni renovar su sesión con `/auth/refresh`.
2. Cualquier request autenticado de una cuenta que se suspendió **mientras tenía sesión abierta**
   se corta en el siguiente request (`401` → el dashboard expulsa al login solo).
3. Suspender ahora revoca en la misma transacción todos los refresh tokens vivos de esa cuenta.
4. `POST /auth/login` puede devolver `403` además de `401` — ojo si tienen scripts o colecciones
   de Postman que solo esperaban `200`/`401`.

**Qué hacer:** si en tu BD local tenías psicólogos de prueba ya suspendidos, dejarán de poder
entrar (era el bug). Correr `pnpm run seed` los devuelve a los estados de siempre.

**Por qué se tocó `auth/**` sin José:** el hallazgo es de seguridad clínica (una cuenta suspendida
podía seguir entrando y viendo pacientes) y él estaba ocupado con otras tareas. Quedó con tests
unitarios, e2e y verificación manual por API y por navegador — ver `claude_privado/pendientes.md`
para el detalle si hace falta.

**Fuera de esta rama a propósito:** no se tocó `docs/security/permissions-matrix.md` (es de José);
esto agrega una condición de estado de cuenta, no cambia permisos por endpoint.

---

## 2026-08-30 — HU-24 · Reasignación de pacientes por sede (rama `feature/HU-24-reasignacion-por-sede-matias-lara`)

### Hay que recompilar `shared-types` después de pullear

**A quién le pega:** a quien levante el backend o el dashboard web.

**Qué hacer**, una vez después de pullear, desde la raíz:

```bash
pnpm --filter @stopbet/shared-types build
```

**Por qué:** `PsychologistListItem` suma un campo obligatorio, `patientsBySede`. Si tu `dist/`
quedó viejo, el type-check falla al usar el tipo. `pnpm run backend` ya lo compila solo; hace
falta a mano si levantas solo la web o solo Metro.

### Desactivar un psicólogo ahora pide un destino **por cada sede**

**A quién le pega:** a quien pruebe la página Equipo o consuma
`PATCH /psychologists/:id/deactivate`.

Antes se mandaba un único `reassignTo` para todos los pacientes, y el backend exigía que ese
destino atendiera **todas** las sedes del psicólogo que se iba. Con pacientes repartidos en
dos sedes eso dejaba la baja **imposible de completar**: la UI ofrecía un destino que el
backend siempre rechazaba con "no atiende todas las sedes", y no había otra opción.

Ahora el cuerpo acepta un mapa `reassignments` de `sedeId → psychologistId`, igual que
`PATCH /psychologists/:id/sedes`:

```json
{ "reassignments": { "<sedeId-santiago>": "<psychId-A>", "<sedeId-vina>": "<psychId-B>" } }
```

**`reassignTo` sigue funcionando** como atajo cuando hay una sola sede: no rompe a nadie que
ya lo esté usando.

**Dos cambios visibles que podrías confundir con un bug:**

- El 409 de "tiene pacientes activos" ahora trae además un `bySede` con las sedes que quedaron
  sin destino. `patientIds` sigue estando donde estaba.
- En la página Equipo, el desplegable de reasignación **ya no lista a todos los psicólogos
  activos**: solo a los que atienden esa sede. Si no hay ninguno, en vez de un desplegable sale
  un mensaje diciendo a qué sede hay que asignarle a alguien primero, y el botón queda
  deshabilitado. **Eso es a propósito**, no es que la lista esté rota.

## 2026-08-30 — PR #58 · Cierre de criterios del SPIKE (S.4, S.5, S.6, S.11)

### Hay que correr `pnpm install` después de pullear

**A quién le pega:** a todos los que levanten el backend.

**Qué hacer**, una vez después de pullear, desde la raíz:

```bash
pnpm install
```

**Por qué:** el backend suma la dependencia `helmet`, que agrega cabeceras de seguridad
(HSTS, `X-Content-Type-Options`, `Cross-Origin-Resource-Policy`) en `main.ts`. Sin
instalarla el backend **no arranca**: revienta en el `import helmet from 'helmet'`.

**No rompe a los clientes.** Se verificó contra el dashboard web en un navegador real,
contra la app mobile en un Android físico y contra Swagger: todo responde igual. La CSP que
helmet trae por defecto viene desactivada a propósito, porque rompía la UI de `/api/docs`.

### El CI ahora **exige** 70% de cobertura en `users`, `panic` y `ai-assistant`

**A quién le pega:** a quien agregue código en esos tres módulos.

Antes la cobertura se medía y se ignoraba. Ahora hay un `coverageThreshold` en
`apps/backend/package.json`: si `statements` o `lines` bajan del 70% en cualquiera de los
tres, **el build falla y el PR no se puede mergear**.

Hoy los tres pasan con margen (`users` 87%, `panic` 92%, `ai-assistant` 86%), así que no
deberías notar nada **salvo que agregues código sin tests**.

**Si te falla**, mira dónde quedaste:

```bash
pnpm run test:coverage
```

El umbral aplica solo a `statements` y `lines`, **no a `branches`**: `ai-assistant` está en
65% de ramas y exigirlo ahí habría roto builds ajenos sin que el criterio lo pida.

### El e2e de roles ahora prueba endpoints que no son de José

**A quién le pega:** a Eduardo (`metrics`), a Matías Lara (`registration`) y a Matías
Barraza (`panic`).

`test/roles.e2e-spec.ts` ahora verifica 401 / 403 / 200 sobre `GET /metrics/patients/:id`,
`GET /registration/pending` y `GET /panic/alerts/history`, asumiendo
`@Roles('psychologist', 'coordinator')` en los tres.

**Si cambias los `@Roles()` de tu endpoint, ese test falla y te bloquea tu propio PR**, en un
archivo que no es tuyo y con un error que parece tuyo. No es un descuido: es deliberado,
porque esos tres devuelven datos identificables de pacientes y reabrirlos por accidente no
puede pasar en silencio. Avísale a José y lo actualiza, es una línea.

---

## 2026-08-28 — PR #56 · Registro de pacientes (HU-06) y cuentas de psicólogo (HU-24)

### Hay que compilar `shared-types` antes de levantar mobile

**A quién le pega:** a quien levante **solo Metro**, sin arrancar el backend.

**Qué hacer**, una vez después de pullear, desde la raíz:

```bash
pnpm --filter @stopbet/shared-types build
```

**Por qué:** `apps/mobile` ahora importa **funciones** de `@stopbet/shared-types` (el
validador de RUT y el de fechas), no solo tipos. Hasta este PR todos los imports del
paquete en mobile eran `import type` y babel los borraba al compilar, así que Metro nunca
necesitó el `dist/` — y `dist/` está en `.gitignore`, o sea que **no viene en el pull**.

**Si no lo haces:**
- Con un `dist/` viejo (lo normal si ya levantaste el backend alguna vez), la app arranca
  bien y revienta con `formatRut is not a function` **al primer carácter que escribas en el
  campo RUT** del registro. Buscar eso en el código de la pantalla no lleva a ninguna parte.
- Con un `dist/` ausente (clon nuevo, o borraste `node_modules`), Metro no resuelve el
  módulo y **falla el bundle entero**: pantalla roja al arrancar.

**Si siempre partes por `pnpm run backend`, no tienes que hacer nada**: ese script ya
compila `shared-types` antes de arrancar, igual que `pnpm run seed` y `build:backend`. En CI
ya está resuelto (`backend-ci.yml` y `mobile-preview.yml` lo compilan explícitamente).

**Pendiente:** `scripts/android-run.ps1` lanza Metro con `npx react-native start` directo
(línea 194), saltándose el script `start` de `apps/mobile/package.json`. Mientras no se le
agregue el build ahí, este paso es manual.

### La app mobile ahora arranca en Welcome, no en Home

**A quién le pega:** a todos los que iteren en pantallas de mobile.

Antes `App.tsx` forzaba `isSignedIn = true` y la app abría directo en Home. Eso dejaba el
stack de autenticación entero inalcanzable, y sin él no había forma de llegar al formulario
de registro (HU-06). Ahora arranca sin sesión: Welcome → Iniciar sesión → Home.

**Cualquier correo y clave no vacíos entran**, igual que antes: el login todavía no valida
contra `POST /auth/login`, sigue en modo demo con `TEMP_USER_ID`. Son dos toques más por
arranque, no un bloqueo.

### Solicitudes ahora filtra por sede

**A quién le pega:** a quien pruebe el flujo de aprobación en el dashboard.

`GET /registration/pending` devolvía **todas** las solicitudes a cualquiera. Ahora un
psicólogo ve solo las de sus sedes, y aprobar una de otra sede responde 403. El coordinador
sigue viendo todas — es un rol administrativo, y si filtrara también, una sede sin
psicólogos no tendría quién le apruebe nada.

**Ojo con el seed:** todos los psicólogos de `pnpm run seed` son de `'Santiago'`. Si
registras un paciente de prueba en Viña, Concepción u Online, **no le va a aparecer a ningún
psicólogo** — entra solo con la cuenta de coordinador. La lista vacía es el comportamiento
correcto, no un bug.

### `approve` / `reject` ya no aceptan `x-user-id`

**A quién le pega:** a quien tenga guardado un Postman o un script contra esos endpoints.

`PATCH /registration/:id/approve` y `/reject` ahora exigen `Authorization: Bearer` y rol
`psychologist` o `coordinator`. Antes cualquiera que supiera la URL podía aprobar una
solicitud inventando el `x-user-id` del revisor. El dashboard web ya va migrado en este
mismo PR; lo que se rompe son las llamadas hechas a mano.

`POST /registration/submit` y `GET /registration/status/:id` **siguen abiertos**, que es lo
que usa la app del paciente para registrarse sin cuenta.

---

## Histórico

_(Vacío por ahora. Acá van las entradas que dejaron de aplicar, con la línea de qué las cerró.)_
