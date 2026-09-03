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
