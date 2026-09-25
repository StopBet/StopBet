# CLAUDE.md — Reglas del proyecto StopBet

Plataforma clínica para tratamiento de ludopatía. Datos de pacientes son **sensibles**; cualquier decisión de arquitectura que afecte privacidad o seguridad debe ser explícita.

## Estado actual

> _Actualizado 2026-09-16. Mantener al día tras cambios significativos (ver [Trabajando con Claude Code](#trabajando-con-claude-code))._

- **Mobile — dos apps en un mismo binario.** `App.tsx` enruta **por rol** tras el login: `patient` va a `AppNavigator` y `psychologist` a `StaffTabs` (Resumen · Comunidad · Perfil). El `coordinator` **no entra**, y no por producto: `GET /psychologists/:id` filtra por `role: 'psychologist'` y le da 404, y `assertPsychologist` le cierra la moderación. La vista del equipo clínico es un espejo condensado del Resumen de la web, **de solo lectura**, salvo publicar anuncios, **leer y responder el foro de la sede** (pestaña *Foro*, decisión del PO del 22-09: el hilo es la pantalla del stack `StaffThread`, no un composer dentro de la pestaña, por el pager y el teclado) y borrar publicaciones reportadas; **no monta pánico, asistente ni check-in, y su barra no lleva el botón SOS** (crearía una alerta a nombre del psicólogo).
  - ⚠️ **`users.sedeId` guarda el nombre de la sede o su UUID, según de dónde venga la cuenta** (seed → `'Santiago'`; registro → UUID), y `panic_alerts` copia la del paciente. Filtrar solo por id deja fuera a media sede **sin síntoma visible**: la lista sale vacía, no rota. Para eso está `apps/mobile/src/utils/staff.ts → mismaSede()`. El arreglo de verdad es una migración que normalice la columna.
  - **Quién escribe en el foro (22-09):** abrir una publicación es de `patient` y `sponsor` (`@Roles` en `POST /community/posts`); el equipo clínico responde y publica anuncios. La **sede de lo que se escribe sale del token**, no del cuerpo — `CreatePostDto.sede` quedó deprecado y se ignora—, y responder en una publicación de otra sede da 403 (un psicólogo cuenta con todas sus sedes de `psychologist_sedes`). Las lecturas por sede aceptan el nombre y el UUID (`formasDeSede`), porque si no el foro de una sede queda partido en dos mitades que no se ven entre sí.
  - El redactor de anuncios (`NewAnnouncementScreen`) es una **pantalla del stack**, no un `Modal` dentro de la pestaña: abrir el teclado sobre `react-native-pager-view` lo rearma en la primera página y remonta la pantalla, así que un modal hijo se cerraba con el anuncio a medio escribir.
- **Logros en el foro (22-09):** compartir una insignia guarda `community_posts.achievementDays` y la app pinta una **tarjeta con el ícono del hito** (el mismo de la colección, desde `constants/badges.ts`; verde si es de otro, sobre el azul si es propia) en vez de una burbuja de texto. El campo **no está en `CreatePostDto`** a propósito —si viajara en el cuerpo, cualquiera publicaría un logro que no cumplió—: lo llena `createBadgeAnnouncementPost` por un parámetro interno de `createPost`. Los logros antiguos se marcan con **`pnpm run migrate:logros`** (idempotente, reconoce el formato del backend). El backend nunca republica el mismo hito, y ahora el modal lo dice en vez de ofrecer un botón que no hace nada.
- **Push del foro (23-09):** un mensaje nuevo avisa por push a **toda la sede** menos al autor y a quien silenció la comunidad (`community_mutes`, el interruptor de Perfil, que antes solo apagaba los avisos dentro de la app). La notificación **dice quién escribió, nunca lo que escribió**: la pantalla de bloqueo la ve cualquiera y en el foro se habla de recaídas. Al equipo clínico no le llega. Sale con `void` desde `createPost`: si Firebase falla, el mensaje ya está publicado. ⚠️ **La app nunca creó los canales de notificación de Android** y el backend los asumía desde hace tiempo, así que el recordatorio de las 20:00 salía degradado; ahora `MainApplication.kt` crea `recordatorios`, `comunidad` y `panic_alerts` al arrancar, separados para que silenciar el foro no apague el check-in ni el pánico.
- ⚠️ **La comunidad se parece a WhatsApp a propósito (criterio del PO, 22-09): la app la usan adultos mayores.** Ante una duda de diseño en el chat, gana lo que hace WhatsApp por sobre lo original: burbujas, **hora exacta en 24 h** dentro de la burbuja, **separador de día** («Hoy», «Ayer», la fecha), mensajes seguidos del mismo autor pegados, reacciones visibles solo cuando existen y acciones tras el toque largo. Dos excepciones sostenidas: el botón «···» visible, que WhatsApp no tiene pero acá hace descubrible el menú para TalkBack (auditoría UX), y la marca (burbuja propia azul StopBet, no verde). El tablón de *Anuncios* **no** sigue esta regla: ahí el tiempo va relativo («hace 6 días»), porque no es una conversación.
- **El foro se ve como un chat (22-09):** no hay barra de acciones bajo cada mensaje. Las **reacciones solo aparecen si alguien ya reaccionó**, como chips con contador; **reaccionar y responder están en el menú de la burbuja** («···» o toque largo), que abre con las tres reacciones arriba. Tener los cuatro controles siempre visibles dejaba cuatro mensajes por pantalla y parecía una lista de fichas; ahora entran seis o siete. El «···» se mantiene visible a propósito: es lo que hace descubrible el menú para TalkBack (decisión de la auditoría UX).
- **El foro es un chat plano (22-09):** un mensaje puede citar a otro con `community_posts.replyToId`; ya no hay hilos que se expanden ni tabla de respuestas. `GET /community/posts` trae `replyTo` (`{id, authorName, body}` recortado) **dentro** del mensaje, cargado con `relations: ['replyTo', 'replyTo.author']` para no hacer N+1. Citar valida que el original sea de la misma sede. Lo que estaba en `post_replies` se movió con **`pnpm run migrate:replies`** (idempotente, no borra nada); la tabla vieja **sigue existiendo a propósito**, porque con `synchronize` quitar la entidad la borraría. ⚠️ `replyToId` se valida con `@IsDbUuid()`: `@IsUUID()` rechaza los ids del seed.
- **Comunidad en vivo (22-09, fase 1 del chat):** `GET /community/stream?sede=` es un **SSE autenticado** que empuja el mensaje ya serializado (`CommunityStreamEvent`). El servidor **no sondea**: `createPost` y `createReply` emiten a un `Subject` en memoria de `CommunityService` y el stream filtra por sede, aceptando nombre o UUID. En mobile lo consume `services/communityStream.ts` con **`react-native-sse`** (el `EventSource` del navegador no manda cabeceras), solo mientras la pestaña está a la vista, y se reconecta con espera creciente renovando el token ante un 401. El envío es **optimista**: el mensaje aparece con un reloj, se confirma al responder el servidor y, si falla, queda como «No se envió · toca para reintentar» reusando la misma clave de idempotencia. ⚠️ El `Subject` es de una sola instancia: con el backend replicado habría que pasarlo por Redis o la base.
- **Notificaciones del paciente (22-09):** la lista salió del Inicio a su propia pantalla (`NotificationsScreen`), a la que se llega con la **campana del encabezado** y su contador. Dentro del Inicio no tenía techo: con seis avisos empujaba la racha, el check-in y el asistente fuera de pantalla. En el Inicio se quedan **solo las `danger`** (una alerta de pánico no puede estar a un toque de distancia). `Notification` ganó el campo **`target`** (`check-in` · `community` · `achievements` · `panic` · `payment`), que es lo que permite abrir la pantalla correcta al tocarla; es **nullable** porque las notificaciones anteriores no lo tienen y esas solo se marcan leídas.
- **Mobile** (React Native CLI 0.86): compila y corre en Android físico y en emulador. Flujo y *gotchas* del monorepo en `apps/mobile/README.md`. El check-in se encola en `AsyncStorage` si no hay red y se reintenta al reconectar; el asistente muestra una tarjeta de crisis (pánico / compañero de viaje / `*4141`) ante riesgo alto, y un mensaje de respaldo dentro del hilo si el envío falla.
  - **Rendimiento (22-09, `docs/auditoria-rendimiento-mobile-2026-09-22.md`): 15 de 17 hallazgos aplicados.** El bundle de producción pasó de **3,29 MB a 1,78 MB**. Lo que hay que respetar al escribir código:
    - **Los íconos se importan de a uno** (`lucide-react-native/dist/esm/icons/<nombre>.mjs`), nunca desde el índice: Metro no hace tree shaking y el índice mete los 1.714 íconos del paquete. Tipos en `src/types/lucide-icons.d.ts`.
    - **Las filas de una lista van memorizadas y las listas que crecen van en `FlatList`.** `PostCard` usa `React.memo` con un comparador que ignora los callbacks a propósito (está explicado sobre el componente): si le agregas una prop de datos, súmala al comparador.
    - **Los sondeos usan `hooks/useIntervaloActivo.ts`**, que los detiene con la app en segundo plano; volver a una pestaña no recarga si la última carga tiene menos de 30 s (`hooks/useCargaFresca.ts`).
    - **Nada de `console.*`**: van `logWarn`/`logError` de `utils/log.ts`, que desaparecen fuera de `__DEV__`.
    - El caché sin conexión guarda 50 mensajes como máximo, escribe una vez por segundo y poda lo de otras cuentas al entrar. **R8 y `shrinkResources` quedaron activos en release**: si algo falla solo en release, mirar `proguard-rules.pro`.
    - Abierto por decisión del equipo: `reactNativeArchitectures=arm64-v8a` (deja fuera `armeabi-v7a`) y la firma de release, que sigue siendo la de depuración.
  - **Auditoría UX del 14-09** (`docs/auditoria-ux-mobile-2026-09-14.md`, 73 de 76 hallazgos cerrados, PRs #90–#101; INI-05 se cerró el 22-09 con la campana de notificaciones). Los 3 que faltan esperan una **decisión**, no código: están en `docs/ASUNCIONES-PENDIENTES.md`. Lo que salió de ahí y conviene tener cargado antes de tocar la app:
    - **Tema claro/oscuro.** Dos paletas con las mismas llaves en `constants/colors.ts` (tipo `Palette`), `ThemeProvider` + `useColors()` + `useStyles(makeStyles)`. Los estilos se escriben `const makeStyles = (c: Palette) => StyleSheet.create({...})`, porque `StyleSheet.create` corre **una sola vez al cargar el módulo**: un `StyleSheet.create` con colores fijos arriba del archivo no cambia de tema nunca. **La marca no cambia** — en oscuro los azules, verdes y rojos siguen como relleno; lo que se derivó son tokens de **texto** (`primaryText`, `dangerText`), porque `#396fb6` sobre fondo oscuro da 3,16:1. El interruptor vive en Perfil.
    - **Nada de `Alert.alert` ni `TouchableOpacity`**: van `useDialog()` / `useToast()` (`context/DialogContext.tsx`, `context/ToastContext.tsx`) y el componente `Touchable` (Pressable con ripple).
    - **Navegación por gesto**: `navigation/MainTabs.tsx` usa material-top-tabs sobre `react-native-pager-view` con `tabBarPosition="bottom"` y una `TabBar` propia que dibuja `BottomNav`. El pánico queda **fuera** del gesto a propósito.
    - **AJUTER no va en el cromo de la app.** StopBet es el producto; AJUTER es el primer cliente y puede haber más. El término del programa es **«compañero de viaje»**, no «padrino» — pero solo en el texto visible: el rol en base de datos y en los tipos sigue siendo `sponsor`.
  - `BASE_URL` (`src/services/api.ts`) usa `__DEV__` para elegir entre `localhost:3000` (desarrollo, vía túnel `adb reverse`) y la URL pública del backend en Railway (release). React Native no lee `.env` sin una librería extra, así que el dominio va directo en el código — si cambia el servicio de Railway hay que actualizarlo ahí a mano.
- **Auth real, con el dashboard web ya migrado**: módulo `auth` con JWT (`POST /auth/login`, `/auth/refresh` con rotación, `/auth/logout`), `JwtAuthGuard` + `RolesGuard` + `@Roles()` + `@CurrentUser()` en `common/`. Rol `coordinator` agregado. `POST /users/login` **fue eliminado** — no verificaba la contraseña. `/auth/login` **no filtra por rol**: quién entra a la web se decide en `LoginPage.tsx` (psicólogo, coordinador y familiar). **Suspender una cuenta cierra el acceso en las tres puertas**: `login()` y `refresh()` rechazan con 403 a `accountStatus !== 'active'`, `JwtStrategy.validate()` corta con 401 cualquier request de una sesión ya abierta, y `deactivate()` revoca sus refresh tokens en la misma transacción.
  - **`JwtAuthGuard` es global desde el 16-09**: todo endpoint exige token salvo `@Public()` (login, refresh, logout, health, sedes, registro, stream SSE). **La identidad sale del token con `@UserId()`; el backend ya no lee `x-user-id`** — mandarlo sin token da 401. `PatientAccessGuard` acota los endpoints del equipo clínico sobre un paciente: la coordinación ve a todos y un psicólogo, solo a sus asignados. Pendiente: varios endpoints autenticados no restringen **qué rol** puede llamarlos (ver `docs/security/permissions-matrix.md`).
  - **`apps/mobile` ya migró** a `Authorization: Bearer` (15-09). `LoginScreen` valida contra `POST /auth/login` —antes tenía un `TODO` y cualquier credencial entraba como un usuario fijo—, la sesión se guarda en `AsyncStorage` y sobrevive a cerrar la app, el token rota solo ante un 401 y la app filtra por rol: el equipo clínico entra por la web. Todavía manda `x-user-id`, pero el backend ya no lo lee: se puede sacar. Las cachés sin conexión son por paciente (`@stopbet/last-progress/<userId>`).
- **Backend** (NestJS): módulos `achievements`, `ai-assistant`, `auth`, `billing`, `check-ins`, `clinical-records`, `community`, `family`, `health`, `mail`, `notifications`, `panic`, `psychologists`, `push`, `registration`, `sedes`, `subscriptions`, `users`. `GET /health` verifica la conexión real a la BD (antes era un `{status:'ok'}` fijo) y alerta a un webhook de Discord ante caída — `DISCORD_ALERT_WEBHOOK_URL` ya está configurada en Railway y probada de punta a punta (verificado 2026-09-02). El RUT (`User.rut`) se cifra en reposo (AES-256-GCM). Nuevos endpoints para el dashboard web: `GET /users/patients`, `GET /registration/pending`, `GET /panic/alerts/history`.
- **Ficha clínica** (HdU13, 19-09): módulo `clinical-records`. Una ficha por paciente con los
  cinco campos del CA1, los cinco obligatorios: **motivo de ingreso**, antecedentes de juego,
  detonantes, salud y red de apoyo, y **objetivos del tratamiento**. Ojo: el CA1 los nombra
  «motivo de consulta» y «objetivos terapéuticos»; se cambiaron por decisión del PO porque
  AJUTER hace terapia grupal, no consultas individuales. **Decisión cerrada el 20-09**: los
  términos actuales se quedan (ver `docs/ASUNCIONES-PENDIENTES.md`, punto 2-ter). Dos cosas
  que conviene saber antes de tocarlo:
  - **El historial (`clinical_record_versions`) guarda el diff, no un snapshot**, y **no se
    edita ni se borra nunca**: es el registro de auditoría clínica. Un guardado que no cambia
    nada no crea versión, para que el historial no se llene de ruido.
  - **La ficha se abre desde «Mis pacientes»** con el botón *Ficha clínica* de cada fila, y los
    pacientes que todavía no tienen se marcan con un chip *Sin ficha clínica* (`GET
    /clinical-records/status`, que devuelve solo la existencia, nunca el contenido). La página
    abre **en modo lectura** y los campos editables aparecen con *Editar ficha*; una ficha que
    no existe entra directo en edición.
  - **Anotaciones de seguimiento** (`clinical_notes`): cronología con fecha y autor, que se
    acumula en vez de reescribirse como la ficha. No se editan ni se borran, y cuelgan del
    paciente, no de la ficha: se puede anotar antes de que exista la entrevista de ingreso.
  - **Cuestionario de ingreso**: el registro móvil tiene un paso nuevo con cuatro preguntas de
    alternativas sobre el juego (`RegisterIntakeScreen`), todas opcionales y saltables. Se
    guardan en `registration_requests.intake` (`jsonb`) y la ficha las muestra **aparte y en
    solo lectura**, nunca fusionadas con lo que escribe el psicólogo.
  - **El paciente no accede a su propia ficha** (403): es material que el psicólogo escribe
    sobre él. Abrirlo es decisión clínica de AJUTER. Lo único de la ficha que sale hacia el
    asistente IA son los **detonantes**, saneados con `sanitizePii`, que omite el nombre del
    paciente, los RUT, los teléfonos y correos, y los nombres de quienes el sistema tiene
    registrados a su alrededor (familiares vinculados y compañero de viaje). Sigue pasando el
    nombre de un tercero **no registrado** (ver `docs/ASUNCIONES-PENDIENTES.md`, punto 2-bis).
- **Envío de correo** (CA24.1): al crear un psicólogo, el backend le manda sus credenciales por correo. Módulo `mail` con **Nodemailer sobre SMTP genérico** — no el SDK de un proveedor — así que cambiar de Gmail a Resend o Brevo es cambiar variables de entorno, sin tocar código. **Es opcional y se apaga solo**: sin `SMTP_HOST` el backend arranca igual, `send()` devuelve `false`, y la respuesta del `POST /psychologists` lo informa en `credentialsEmailSent` para que `EquipoPage` caiga al flujo anterior (mostrar la contraseña en pantalla para entrega a mano). **Hay dos transportes y se elige solo según qué variable exista** (si están las dos, gana Brevo):
  - `BREVO_API_KEY` → envía por **HTTPS**. Es el único que sirve en producción.
  - `SMTP_HOST` (+ `SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`) → envía por **SMTP**. Para local.

  Tres avisos:
  - 🚫 **Railway bloquea SMTP saliente en los planes Free, Trial y Hobby** (puertos 25, 465, 587 y 2525; solo Pro y superiores lo permiten). El proyecto corre en Hobby. **Verificado en producción el 2026-09-02**: con las variables SMTP bien puestas, el log da `ERROR [MailService] ... Connection timeout` y el `POST /psychologists` tarda exactamente 10 s —el `TIMEOUT_MS` del servicio— antes de responder `201`. La cuenta se crea igual y la UI cae al respaldo, pero **la espera de 10 s se ve en pantalla**: por eso en Railway hay que usar `BREVO_API_KEY` y **no** definir `SMTP_HOST`. Ver `docs/avisos-al-equipo.md`.
  - ⚠️ **Los correos caen en spam.** Verificado el 2026-09-02 con la cuenta `stopbet.fds@gmail.com`. No es problema de autenticación (la firma de Gmail pasa): es que el remitente es un `@gmail.com` sin historial y el cuerpo lleva una contraseña, que es la forma exacta de un correo de phishing. **Cambiar a Brevo o Resend no lo arregla**: son dos problemas distintos, y este se resuelve con dominio propio más el enlace de un solo uso.
  - Mandar la contraseña en texto plano es mala práctica en una plataforma clínica. Lo correcto es un **enlace de invitación de un solo uso** — y arregla el spam de paso. No se hizo porque necesita una pantalla web nueva y una ruta en `DashboardApp.tsx`, que es de otro integrante.
- **Web dashboard**: vistas del terapeuta (login, Overview, Alertas, Finanzas, Solicitudes, Sesiones de familiares, Configuración) conectadas a la API real con TanStack Query (`@tanstack/react-query`). `Finanzas` y `Configuración` siguen con datos mock. El cliente HTTP (`apps/web/src/services/api.ts`) manda `Authorization: Bearer` con refresh automático; ya no manda `x-user-id`: la ficha registra recaídas y el PDF lee pagos por endpoints del equipo clínico acotados por asignación.
  - **El Resumen es solo un vistazo** (16-09): un bloque por sección con enlace a ella; sin tabla de pacientes ni PDF. El **Seguimiento** del paciente (`components/PatientDrawer.tsx`) y el reporte PDF (`components/ReportDialog.tsx`) viven en **«Mis pacientes»** (`/pacientes`). **Ojo con el nombre**: ese panel se llamaba «ficha» hasta la HdU13, y ahora «ficha clínica» es otra cosa —lo que el psicólogo escribe sobre el paciente, en `/pacientes/:id/ficha`—. El panel muestra lo que el paciente genera (check-ins, alertas, sesiones con el asistente); la ficha clínica, lo que el psicólogo registra. La regla de seguimiento y el armado del paciente están en `utils/patientView.ts`: no la dupliques. `GET /users/patients` devuelve a un psicólogo **solo sus asignados** y a nadie los postulantes (`approval_pending`).
  - **Portal del familiar** (`src/pages/familiar/`): app aparte del shell clínico, no rutas dentro de `DashboardApp`. `App.tsx` bifurca por `user.role === 'family'` antes del gate de psicólogo.
  - **Colores de AJUTER** (22-09, `styles/ajuter-brand.css`): Apariencia tiene dos ejes, *Tema* (automático/claro/oscuro) y *Colores* (StopBet/AJUTER), en `components/ThemePicker.tsx`. AJUTER se activa con `data-brand="ajuter"` en `<html>`, que ponen el panel y el portal al montarse (`hooks/useBrandInShell`) y sacan al desmontarse: **el login siempre va StopBet**. Acciones en ocre `#92611D`; el rojo AJUTER no se usa porque el rojo es pánico. **El sidebar y el encabezado del portal pintan con `--chrome-bg` / `--chrome-bg-active` / `--chrome-accent`, no con `--primary`**: en AJUTER son carbón mientras los botones son ocre. Lo que existe en una sola marca (logos, «Con tecnología StopBet») se muestra con las clases `sb-only-ajuter` / `sb-only-stopbet`. El PDF sigue saliendo con la paleta StopBet. **El equipo clínico de AJUTER arranca en AJUTER** si no eligió otra cosa: sale de `users.institutionId` (`'AJUTER'`), que `/auth/login` devuelve; el mapa institución → colores está en `utils/theme.ts` (`defaultBrandFor`). La elección explícita se guarda en `localStorage` (`sb-brand`) y gana siempre.
  - Las páginas usan **estilos en línea con las variables del tema** y el componente `WIcon`, no las clases de Tailwind que describe la sección de Design System más abajo.
  - **Modo oscuro** (16-09, `styles/stopbet-dark.css`, Configuración → Apariencia, misma paleta que mobile). **Texto e íconos de marca van con `--primary-text` / `--danger-text`**; `--primary` y `--danger` son solo para rellenos y bordes — en claro se ven iguales, así que el error no se nota hasta activar el oscuro. Texto sobre el verde de relleno: `--fg-on-secondary`. El reporte PDF se genera siempre con la paleta clara.
  - **Auditoría UX del 14-09** (`docs/auditoria-ux-web-2026-09-14.md`, 39 de 42 hallazgos resueltos). Los estados de alerta de pánico salen de `utils/alertStatus.ts`: `escalated` es una alerta activa, no una resuelta. Los modales usan `hooks/useDialog`. El verde de texto es `--secondary-text`. Finanzas sigue con datos de ejemplo, pero lo avisa en pantalla.
- **CI**: `.github/workflows/backend-ci.yml` corre type-check, tests unitarios (con cobertura) y e2e en cada push/PR a `main` con un Postgres de servicio. `apps/backend/test/` tiene el primer e2e (`roles.e2e-spec.ts`).
- **DB local**: datos de prueba en PostgreSQL (usuario `postgres`, pass `password`, db `stopbet`) creados con `pnpm run seed` — 9 usuarios (patient/sponsor/psychologist/coordinator), todos con la misma clave de desarrollo `Stopbet2026!`. El script viejo `python scripts/populate_db.py` sigue existiendo pero `pnpm run seed` es la vía actual.
- **Asistente IA**: modelo `gemini-3.5-flash-lite` (el anterior, `gemini-2.5-flash-lite`, empezó a devolver 404 para cuentas nuevas y el asistente caía al mensaje de respaldo en cada mensaje **sin que nada lo delatara**). Requiere una `GEMINI_API_KEY` válida: sin ella todo cae al respaldo y los resúmenes clínicos quedan sin evaluar. El `riskLevel` del resumen ahora es `RiskLevel | null` — **`null` significa "no se pudo evaluar", distinto de `'low'`, que significa "evaluado y sin riesgo"**. Las reglas de tono y las 3 conversaciones de prueba están en `docs/reglas-asistente.md`. Ojo: el tono depende del LLM y **no es determinista** — en un muestreo de 3 corridas, una se pasó del límite de 2-4 frases del documento.
- **CI mobile**: `.github/workflows/mobile-preview.yml` **volvió a dispararse solo** en push a `main`. El diagnóstico anterior ("`react-native@0.86` ya no publica `hermesc`, no tiene arreglo") era falso: el binario se movió a un paquete propio, `hermes-compiler`, que ya estaba en el lockfile. El workflow apuntaba con `chmod` a la ruta vieja y se tragaba el fallo con `|| true`. Corregido en `bbbec9d`.
- **Portal del familiar (HdU11)**: módulo `family` con vínculo familiar↔paciente, sesiones grupales por sede y confirmación de asistencia. Dos avisos:
  - ⚠️ **Nadie aprueba los vínculos.** `requestLink` los crea en `pending` y no existe endpoint ni pantalla que los pase a `active`: solo lo hace `src/family/family.seed.ts`. En producción un familiar quedaría en "pendiente de vinculación" para siempre.
  - Datos de prueba, después de `pnpm run seed`: `pnpm run seed:family` desde la raíz. Sin correrlo, la demo no tiene cuentas de familiar. Crea los tres estados (vínculo activo con sesiones, pendiente, y activo sin sesiones próximas).
- **Deudas técnicas**:
  - ⚠️ **No hay ninguna migración en el repo, y por eso el backend de Railway corre con `NODE_ENV=development`** — se dejó así a propósito para que TypeORM cree el esquema con `synchronize`. Es decir: las tablas nuevas **sí** se crean en producción, pero al precio de violar la regla del propio proyecto ("nunca `synchronize: true` en producción"). Hay que resolverlo con migraciones reales **antes de manejar datos de pacientes de verdad**.
  - ⚠️ **Hay dos proyectos de Railway llamados "StopBet".** El real vive en la cuenta de José Meza (`stopbetbackend-production.up.railway.app`, deploy `SUCCESS`). El otro es un intento anterior en el workspace personal de Matías Barraza, muerto desde mayo (deploy `FAILED`, su dominio devuelve 404). Si alguien lo encuentra buscando "StopBet" en Railway, es ese — no hay nada que rescatar ahí.
  - Borrar `apps/mobile/package-lock.json` (residuo de npm en repo pnpm); conectar `FinanzasPage` y `ConfiguracionPage` a la API; reemplazar la contraseña temporal por correo con un **enlace de invitación de un solo uso** (ver "Envío de correo" arriba).
  - _Resueltas:_ seed del usuario demo; `GEMINI_API_KEY` opcional; dashboard web conectado a la API real y migrado a Bearer; módulo `auth`; los dos endpoints que respondían sin login (`/panic/alerts/history`, `/registration/pending`); **FCM implementado y activo** (módulo `push` con `firebase-admin`, tabla `device_tokens`; el service account ya está configurado en Railway vía `FIREBASE_SERVICE_ACCOUNT_JSON` y en local vía `FIREBASE_SERVICE_ACCOUNT_PATH` — confirmado con `[PushService] Firebase inicializado` en ambos, 2026-09-02; sin esa variable el backend arranca igual con los push desactivados, ver `docs/avisos-al-equipo.md`); **backend y dashboard desplegados** en Railway y Vercel (ver `README.md` → "Despliegue en producción"); `BASE_URL` de mobile ya no está fijo a `localhost`; el servicio duplicado y mal configurado `@stopbet/web` de Railway (corría el build y el start command del backend sin ninguna de sus variables de entorno, así que el healthcheck siempre fallaba) se borró; **la base de datos de Railway ya está poblada** (verificado el 2026-09-01: `/health` responde `200` y `POST /auth/login` devuelve token para las cuentas del seed, incluidas las de `seed:family`), así que la demo en la nube ya tiene con qué entrar.

## Estructura del monorepo

```
apps/web/        → Dashboard terapeuta: React 19 + Vite 6 + Tailwind v4 + Recharts
apps/backend/    → API: NestJS 10 + TypeORM + LangChain.js + PostgreSQL
apps/mobile/     → App paciente: React Native CLI 0.86 (corre en Android físico)
packages/shared-types/ → Tipos TS compartidos entre backend y web
```

## Convenciones de código

### General
- TypeScript estricto en todos los workspaces. No usar `any`; si es inevitable, comentar por qué.
- Nombres en inglés para código (variables, funciones, clases). Strings de UI en español.
- Sin comentarios que expliquen qué hace el código; solo comentar el **por qué** cuando no es obvio.

### Backend (NestJS)
- Un módulo NestJS por dominio: `auth`, `users`, `sessions`, `jitai`, `ai-assistant`.
- Guards para control de acceso por rol (`@Roles('psychologist')`, etc.). Nunca validar roles dentro de la lógica de servicio.
- DTOs con `class-validator` para toda entrada de datos. No confiar en datos del cliente.
- Entidades TypeORM en `src/<modulo>/entities/`. Migraciones explícitas, nunca `synchronize: true` en producción.
- Variables de entorno vía `ConfigService` de `@nestjs/config`. Nunca hardcodear secrets.
- Todos los endpoints documentados con decoradores `@ApiOperation`, `@ApiResponse` de Swagger.

### Web Dashboard (React + Vite)
- Componentes en `src/components/`, páginas en `src/pages/`.
- Estado servidor con TanStack Query (agregar cuando se conecte la API). Estado local con `useState`/`useReducer`.
- Tailwind v4: usar clases utilitarias directamente. No crear CSS custom salvo para animaciones complejas.
- Recharts para todas las visualizaciones de métricas JITAI.

#### Design System (marca StopBet)
El dashboard usa la marca StopBet — azul `#396fb6` sobre crema, con Chillax y Satoshi.

> **Cambió el 2026-08-31.** Antes el shell clínico iba con el tema AJUTER (naranja `#E8883A`)
> y el login era la única excepción azul: la misma sesión cambiaba de identidad al entrar.
> Ahora todo el panel va con la marca del producto y `ajuter-theme.css` **ya no existe**. El
> logo de AJUTER no desapareció: vive al pie del sidebar, porque el panel sigue identificando
> a la institución que lo usa. La paleta completa está en
> [`docs/manual-marca.md`](docs/manual-marca.md).

**Archivos:**
```
apps/web/src/styles/
├── fonts/               ← Fuentes self-hosted (woff2, ya en el repo)
│   ├── Inter-{400,600,700}.woff2
│   └── Nunito-{400,600,700}.woff2
├── colors_and_type.css  ← Tokens base + @font-face
├── stopbet-brand.css    ← @font-face de Chillax/Satoshi + tokens del login (--sb-)
└── stopbet-theme.css    ← Override de paleta del shell (azul StopBet)
```

**Regla:** usar siempre tokens semánticos de Tailwind, nunca colores genéricos.
```tsx
// ✅ correcto
<div className="bg-bg text-fg1">
<button className="bg-primary text-fg-on-primary">

// ❌ evitar
<div className="bg-orange-100 text-gray-900">
```

**Tokens principales:**
| Clase Tailwind | Hex | Uso |
|---|---|---|
| `bg-primary` / `text-primary` | `#396fb6` | Azul StopBet — acciones, headers |
| `bg-accent` / `text-accent` | `#93bce5` | Azul claro — CTAs, highlights |
| `bg-bg` | `#f4f4e9` | Fondo crema |
| `bg-surface` | `#FFFFFF` | Tarjetas, modales |
| `text-fg1` | `#3a3939` | Texto principal |
| `text-fg2` | `#6b6a6a` | Texto secundario |
| `bg-danger` / `text-danger` | `#B83232` | Solo botón de pánico |

El verde del manual (`#c2d66e`) se usa oscurecido a `#97b23f` como `--sage-500`: el original
no alcanza contraste AA sobre blanco.

**Tipografía:**
- Headings: **Chillax** (respaldo Nunito) — `font-heading` o `style={{ fontFamily: 'var(--font-heading)' }}`
- Body/UI: **Satoshi** (respaldo Inter) — `font-body` (aplicado globalmente en `body`)

### Mobile (React Native CLI)
- Navegación con React Navigation v7.
- Estado global con Zustand.
- Módulo nativo VPNService en `android/` para filtrado DNS on-device.
- FCM via `@react-native-firebase/messaging` para notificaciones JITAI.
- Prioridad Android en el MVP.

### Shared Types
- Todo tipo compartido entre backend y web vive en `packages/shared-types/src/index.ts`.
- Los tipos no deben importar dependencias externas.

## Seguridad clínica

- **Nunca loguear** datos identificables de pacientes (nombre, RUT, email) en logs del servidor.
- El asistente IA debe operar únicamente con el system prompt validado por AJUTER. No modificar sin revisión clínica.
- El botón de pánico debe tener ruta de escalada siempre disponible, incluso sin conexión.
- JWT con expiración corta (access: 15min, refresh: 7 días). Rotar refresh tokens en cada uso.

## Infraestructura

| Servicio | Plataforma | Configuración |
|---------|-----------|--------------|
| Dashboard web | Vercel | `vercel.json` en raíz |
| Backend + DB | Railway | `apps/backend/railway.toml` |
| Archivos (PDF, fotos) | Cloudflare R2 | API compatible S3 |

- Railway conecta automáticamente con GitHub para deploys en push a `main`.
- Vercel detecta `apps/web` via `vercel.json`.
- Variables de entorno de producción se configuran en los dashboards de Railway y Vercel, **nunca en el repo**.

## Formato de commits

Seguimos **Conventional Commits** con referencia a ticket Jira:

```
<tipo>(HU-XXX): <descripción en imperativo, español, máx 72 chars>

[cuerpo opcional — explica el POR QUÉ, no el qué]

[footer opcional: BREAKING CHANGE: ..., Closes HU-XXX]
```

### Tipos permitidos

| Tipo | Cuándo usarlo |
|------|--------------|
| `feat` | Nueva funcionalidad visible para el usuario |
| `fix` | Corrección de un bug |
| `docs` | Solo cambios en documentación |
| `style` | Formato, espacios, sin cambios de lógica |
| `refactor` | Restructuración de código sin feat ni fix |
| `test` | Agregar o corregir tests |
| `chore` | Mantenimiento: dependencias, configuración, build |
| `ci` | Cambios en pipelines CI/CD (Railway, Vercel, GitHub Actions) |
| `perf` | Mejoras de rendimiento |

### Reglas

- El ticket Jira **es obligatorio** en todo commit de feature/fix: `feat(HU-42): ...`
- Para commits que no corresponden a una historia (setup, hotfix urgente): omitir el ticket: `chore: actualizar dependencias`
- Descripción en **español**, en imperativo: "agregar" no "agregado", "corregir" no "corrige"
- Sin punto final en la descripción
- Si hay breaking change, indicarlo en el footer: `BREAKING CHANGE: <explicación>`

### Ejemplos válidos

```bash
feat(HU-12): agregar pantalla de login con autenticación JWT
fix(HU-34): corregir cálculo de riesgo en motor JITAI
docs: agregar instrucciones de setup mobile en README
chore: actualizar dependencias de seguridad en backend
refactor(HU-56): extraer lógica de notificaciones a módulo propio
test(HU-78): agregar tests unitarios para AppService
ci: configurar deploy automático en Railway
```

### Ejemplos inválidos

```bash
fix: arregle el bug           # ❌ no imperativo
feat: added login screen      # ❌ en inglés
feat: nueva pantalla.         # ❌ punto final
update stuff                  # ❌ sin tipo ni descripción clara
```

## Trabajando con Claude Code

- **No agregar el trailer `Co-Authored-By: Claude`** en los commits. El trabajo se atribuye únicamente al autor humano. (Cualquier integrante puede pedírselo explícitamente en la conversación; esta regla lo hace por defecto para todos.)
- **Mantener al día la sección "Estado actual"** de este archivo: tras un commit grande, mover muchos directorios, o cambios importantes en la estructura o el README, actualizar ese resumen. Así cualquier sesión nueva de Claude —de cualquier integrante— entiende el estado del proyecto al instante, sin reconstruirlo.
- **Anotar en `docs/avisos-al-equipo.md`** todo cambio que obligue a un compañero a hacer algo distinto después de pullear —un comando nuevo, una variable de entorno, un paso de build, un flujo que se movió de lugar— o que cambie un comportamiento visible lo bastante como para que alguien lo confunda con un bug. Va una entrada nueva **arriba del todo**, con fecha y PR, diciendo a quién le pega y qué tiene que correr. Si el cambio no le pide nada a nadie, **no va**: ese archivo sirve mientras se pueda leer entero en un minuto. Trabajamos 6 personas en ramas paralelas y nadie lee los diffs ajenos; esto es lo único que evita que alguien pierda una tarde buscando el problema donde no está.
  - **Esto incluye siempre agregar, actualizar o quitar una dependencia** (cualquier cambio a un `package.json` o al lockfile que obligue a correr `pnpm install`, o a recompilar `packages/shared-types`, después de pullear). Es el caso más frecuente de este aviso: sin la entrada, el síntoma típico es un error que parece bug de código —un import roto, un type-check que falla en un archivo que nadie tocó— y en realidad es un entorno local desactualizado.

## Flujo de sprints

1. Historias de usuario vinculadas en **Jira** antes de iniciar el sprint.
2. Rama por historia: `feature/HU-XXX-descripcion-corta`.
3. PR a `main` con al menos 1 reviewer.
4. Criterios de aceptación de la historia deben estar cubiertos en el PR.
5. `main` siempre deployable.

## Comandos frecuentes

> **Siempre `pnpm`.** `npm install` genera un `package-lock.json` que rompe el monorepo.

```bash
# Instalar todo
pnpm install

# Levantar web local
pnpm run web                   # http://localhost:5173

# Levantar backend local
pnpm run backend               # http://localhost:3000
                               # Swagger: http://localhost:3000/api/docs
                               # compila shared-types antes de arrancar

# Datos de prueba
pnpm run seed                  # 9 usuarios, clave Stopbet2026!
pnpm run seed:family           # cuentas del portal del familiar (correr después del seed)
pnpm run seed:fichas           # fichas clínicas de la HdU13 (deja 2 pacientes sin ficha a propósito)

# Compilar shared-types a mano (solo hace falta si levantas Metro sin el backend)
pnpm --filter @stopbet/shared-types build

# Build web para producción
pnpm run build:web
```

Setup completo, requisitos y variables de entorno: [`README.md`](README.md).

## App Mobile en dispositivo Android físico

Requisitos, script de Windows, ruta manual para Linux/macOS y *gotchas* del monorepo pnpm:
**[`apps/mobile/README.md`](apps/mobile/README.md)**. No dupliques esos pasos acá.

Lo único que se repite en este archivo es el aviso de abajo, porque es la causa número uno
de horas perdidas y conviene que toda sesión lo tenga cargado de entrada.

### ⚠️ Los túneles `adb reverse` se caen solos — revísalos primero

El teléfono no tiene red propia hacia tu computador: **todo pasa por `adb reverse`**. Y
esos túneles **se borran** cuando se reinicia el daemon de adb, cuando se desconecta y
reconecta el cable, o al forzar el cierre de la app. No avisan.

Cuando eso pasa, **los síntomas mienten**: la app muestra datos vacíos como si no
hubiera nada, y el login del portal web decía "correo o contraseña incorrectos" cuando
en realidad la petición nunca salía del teléfono. Se pierde mucho rato buscando el
problema donde no está.

**Antes de dar por roto cualquier cosa en el celular:**

```bash
adb reverse --list        # si sale vacío, ese es el problema
```

Restaurarlos:

```bash
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:3000 tcp:3000   # Backend
adb reverse tcp:5173 tcp:5173   # Web, solo si vas a abrir el dashboard o el
                                # portal del familiar en el navegador del teléfono
```

El script `pnpm run android:device` configura 8081 y 3000, pero **no 5173**: ese hay que
agregarlo a mano. Y ojo con Vite: por omisión escucha solo en IPv6 (`::1`) y `adb
reverse` conecta por IPv4, así que para el teléfono hay que levantarlo con
`pnpm --filter @stopbet/web dev -- --host 0.0.0.0` o dará `ERR_EMPTY_RESPONSE`.

## Variables de entorno requeridas

### Backend (`apps/backend/.env`)
```
PORT=3000
DATABASE_URL=postgresql://...
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=...
GEMINI_API_KEY=...
ENCRYPTION_KEY=...

# Opcionales — sin SMTP_HOST no se envía ningún correo y el backend arranca igual
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM=StopBet <no-reply@...>
WEB_APP_URL=http://localhost:5173
```

> Para probar el correo en local sin cuenta de ningún proveedor, hay un buzón falso
> documentado en [`README.md`](README.md) y en `apps/backend/.env.example`. En producción,
> `WEB_APP_URL` **debe ser la URL de Vercel**, no `localhost`: es lo que se enlaza dentro
> del correo.

> **`ENCRYPTION_KEY` es obligatoria** — cifra el RUT en reposo (AES-256-GCM). Sin ella
> `pnpm run seed` **se cae** y el backend no puede escribir ningún RUT. Debe ser una
> cadena **hexadecimal de 64 caracteres** (32 bytes); cualquier otro largo se rechaza
> al arrancar. Genera la tuya con:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> Es local y personal: no la compartas ni la subas. En producción va configurada en
> Railway. `GEMINI_API_KEY` sí es opcional (sin ella el asistente usa mensajes de respaldo).

### Web (`apps/web/.env`)
```
VITE_API_URL=http://localhost:3000
```
