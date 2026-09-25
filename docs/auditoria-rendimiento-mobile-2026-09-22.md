# Auditoría de rendimiento · StopBet Mobile

- **Fecha:** 22-09-2026
- **Alcance:** `apps/mobile` completo: bundle de producción, render de listas, red, batería, almacenamiento y configuración de build de Android.
- **Tipo:** diagnóstico el 22-09 por la mañana; **los arreglos se aplicaron el mismo día** (ver "Estado al cierre").
- **Motivo:** antes de convertir Comunidad en un chat en vivo conviene saber qué aguanta la app hoy, porque un chat multiplica los renders y las peticiones.
- **Rutas:** relativas a `apps/mobile/src/` salvo que se indique otra.

## Resumen

| Métrica | Resultado |
|---|---|
| Hallazgos | **17** · 0 P0 · 5 P1 · 8 P2 · 4 P3 |
| Bundle JS de producción, hoy | **3,29 MB** |
| Bundle JS con el arreglo de íconos (medido, no estimado) | **1,77 MB · 46% menos** |
| Fuentes empaquetadas | 1,7 MB, de los cuales **1,28 MB no se usan** |
| Minificación en release | **Desactivada** |

Gravedad: **P0** rompe la app · **P1** se nota hoy en un teléfono de gama media · **P2** se va a notar con el chat en vivo · **P3** pulido.

**Veredicto: la app está bien construida por dentro y mal empaquetada por fuera.**

Lo que se escribió con cuidado se nota: el foro ya usa `FlatList` virtualizada con parámetros sensatos, las hojas de estilo se memorizan por tema, el cliente HTTP tiene tiempo límite y evita la tormenta de refrescos, y alguien ya bajó un sondeo de 5 segundos a 3 minutos pensando en la batería del paciente. No hay deudas de arquitectura graves.

El peso, en cambio, viene casi entero de cosas que nadie eligió: una librería de íconos que entra completa, dos fuentes que no usa nadie y la minificación apagada. **Más de la mitad del bundle es código que la app nunca ejecuta.** Son arreglos de horas, no de días, y se pueden hacer antes del chat.

---

## Lo más rentable, en orden

| # | Arreglo | Ganancia | Costo |
|---|---|---|---|
| 1 | Importar los íconos uno por uno (BUN-01) | **1,55 MB menos de bundle**, medido | 1 hora |
| 2 | Sacar las fuentes Lato (BUN-02) | 1,28 MB menos de APK | 15 minutos |
| 3 | Activar minificación en release (BLD-01) | Menos APK y arranque algo más rápido | 30 minutos más una prueba de release |
| 4 | Convertir el splash a WebP (BUN-03) | ~1 MB menos de APK | 30 minutos |
| 5 | Memorizar las burbujas del foro (RND-01) | Lo que decide si el chat va fluido o a tirones | Medio día |

Los cuatro primeros suman **cerca de 4 MB menos** sin tocar una línea de lógica.

---

## Bundle y peso

### BUN-01 · P1 · Lucide entra completo: 1.714 íconos para usar 67

`components/Icon.tsx:3` importa los íconos desde el índice del paquete. Metro no hace
*tree shaking*, así que empaqueta la librería entera.

**Verificado en el bundle de producción**, no deducido: íconos que la app no menciona en
ninguna parte (`Banana`, `Biohazard`, `Radiation`, `Webhook`, `Wallpaper`…) aparecen dentro
del `index.android.bundle` exactamente igual que los 67 que sí se usan. El paquete trae
1.714 archivos de íconos, 1,19 MB de fuente; los 67 que usamos son 40 KB.

**Medición del arreglo.** Se reescribió el import a rutas directas
(`lucide-react-native/dist/esm/icons/house.mjs`), se generó el bundle otra vez y se restauró
el archivo:

| | Bundle de producción |
|---|---|
| Hoy | 3,29 MB |
| Con imports directos | **1,77 MB** |
| Diferencia | **1,55 MB, un 46%** |

El paquete no publica tipos para esas rutas, así que hace falta un `.d.ts` de cuatro líneas
con `declare module 'lucide-react-native/dist/esm/icons/*'`. Con él, `tsc` queda limpio:
también se comprobó. Los dos archivos listos están guardados fuera del repo; se aplican en
una hora, incluida la prueba en el emulador.

### BUN-02 · P1 · 1,28 MB de fuentes que no usa nadie

`android/app/src/main/assets/fonts/` empaqueta 8 tipografías, 1,7 MB. **Lato-Regular y
Lato-Bold pesan 656 KB cada una** y no las usa ninguna pantalla: `constants/typography.ts:18`
las declara como `Fonts.caption` y `Fonts.captionBold`, y no hay una sola referencia a esas
dos claves en todo `src/`. Para comparar, Chillax y Satoshi pesan entre 60 y 74 KB cada una.

**Arreglo:** borrar los dos `.ttf` y las dos claves. Si más adelante se quiere Lato de verdad,
volver a agregarla subseteada, no el archivo completo.

### BUN-03 · P2 · El splash pesa 1,37 MB en PNG

`drawable-xxxhdpi/splash_logo.png` son 724 KB, y con las otras cuatro densidades suman
1,37 MB. En WebP sin pérdida ese logo baja alrededor de un 70% sin diferencia visible.
Android lo soporta desde la 4.3 y Android Studio convierte la carpeta entera de una pasada.

### BUN-04 · P3 · `x-user-id` en cada petición

`services/api.ts:41` sigue mandando la cabecera `x-user-id` en todas las llamadas. El backend
**ya no la lee** desde el 16-09: la identidad sale del token. Son bytes despreciables, pero es
una cabecera que invita a confiar en ella. Es borrar tres líneas.

---

## Render y fluidez

### RND-01 · P1 · Las burbujas del foro no están memorizadas

`screens/CommunityScreen.tsx:715` define `PostCard` como función suelta, sin `React.memo`, y
`renderItem` le pasa cinco callbacks creados de nuevo en cada render de la pantalla. Hoy casi
no se nota porque la lista se recarga poco y `FlatList` solo monta lo visible, pero **con
mensajes entrando cada pocos segundos cada mensaje nuevo repinta todas las burbujas montadas**.
Es justo el patrón que hace que un chat se sienta a tirones en gama media.

**Arreglo:** `React.memo` en `PostCard` con comparación por id y marca de tiempo, y callbacks
estables (`useCallback` por id o un manejador único que reciba el id). Medio día, y conviene
hacerlo **antes** del chat, no después.

### RND-02 · P2 · La lista del asistente no está afinada

`screens/AssistantScreen.tsx:371`: `FlatList` sin `initialNumToRender`, `windowSize`,
`maxToRenderPerBatch` ni `removeClippedSubviews`, con `renderItem` recreado en cada render
(`AssistantScreen.tsx:264`) y un `scrollToEnd` en **cada** `onContentSizeChange`, que dispara
también mientras aparece el indicador de "escribiendo". El foro ya tiene los parámetros
buenos (`CommunityScreen.tsx:433-441`): copiarlos de ahí.

### RND-03 · P2 · Toast y Dialog re-renderizan a todos sus consumidores

`context/ToastContext.tsx:83` y `context/DialogContext.tsx:56` pasan `value={{ showToast }}` y
`value={{ showDialog }}`: un objeto nuevo en cada render del provider. Como los dos envuelven
la app entera, **cada aviso que aparece re-renderiza toda pantalla que llame a `useToast()` o
`useDialog()`**. `ThemeContext` y `SedeContext` sí memorizan su valor; estos dos se quedaron
atrás. Arreglo de una línea en cada uno.

### RND-04 · P2 · Listas que crecen dibujadas enteras dentro de un `ScrollView`

Tres pantallas recorren con `.map()` listas que no tienen techo:

- `screens/staff/StaffHomeScreen.tsx:326` · todos los pacientes de la sede. Con 8 va bien;
  una sede real tiene decenas.
- `screens/staff/StaffCommunityScreen.tsx` · pestaña *Foro*, hasta 30 publicaciones por carga.
- `screens/staff/StaffThreadScreen.tsx` · todas las respuestas de un hilo.

Ninguna virtualiza: se montan todas las filas aunque se vean cinco. El foro del paciente ya
resolvió esto en su momento y el comentario del código lo explica. Pasar estas tres a
`FlatList` es media jornada y elimina el problema antes de que aparezca.

### RND-05 · P3 · `Animated` está bien usado

Sin hallazgo: las cinco animaciones (`TypingIndicator`, `BadgeUnlockModal`, `ToastContext`,
`PanicScreen`, `SuspendedAccountScreen`) usan `useNativeDriver: true`. Queda anotado para que
nadie lo vuelva a revisar.

---

## Red y batería

### RED-01 · P1 · Ningún sondeo se detiene con la app en segundo plano

**No hay un solo uso de `AppState` en toda la app.** El caso más claro es
`navigation/StaffTabs.tsx:47`: el contador de alertas de la barra inferior usa `useEffect`
plano con `setInterval` de 60 segundos, así que **sigue pidiendo alertas cada minuto con el
teléfono en el bolsillo y la pantalla apagada**, mientras la sesión del psicólogo esté abierta.
Son 60 peticiones por hora que nadie ve.

Las pantallas del paciente están mejor porque usan `useFocusEffect` y el intervalo se limpia
al cambiar de sección (`HomeScreen.tsx:178`, cada 3 minutos), pero tampoco distinguen entre
"pantalla en segundo plano" y "pantalla a la vista".

**Arreglo:** un hook `useIntervalActivo` que escuche `AppState` y pause los temporizadores en
`background`. Un archivo, se usa en los cuatro sitios que sondean. Medio día.

### RED-02 · P2 · Cambiar de pestaña vuelve a pedirlo todo

`screens/staff/StaffCommunityScreen.tsx:77` recarga sus **tres** endpoints (anuncios, foro y
reportadas) en cada `useFocusEffect`, y `StaffHomeScreen.tsx:91` hace lo propio con los suyos.
Ir a Perfil y volver son seis peticiones, aunque hayan pasado dos segundos. Con el pager, ese
viaje de ida y vuelta es un gesto, no una decisión.

**Arreglo:** una marca de tiempo por pantalla y no recargar si la última carga tiene menos de
30 segundos, mostrando lo que ya está. Un par de horas.

### RED-03 · P2 · El foro pide una sola página y ahí se queda

`screens/CommunityScreen.tsx:125` llama a `getForumPosts(userId, sede)` sin página, así que
trae los primeros 20 mensajes y no hay forma de ver más atrás: no hay `onEndReached`. En un
foro pasa desapercibido; en un chat es lo primero que se nota. El backend ya pagina, así que
el trabajo es solo del lado de la app.

### RED-04 · P3 · Para el chat en vivo, emitir en vez de sondear

Aviso para la fase siguiente, no un defecto de hoy. `panic-stream.controller.ts:30` (backend)
resuelve el tiempo real consultando la base cada 5 segundos **por cada cliente conectado**,
porque no tenía dónde engancharse. Copiar ese patrón para el chat saldría caro: 50 pacientes
de una sede conectados son 10 consultas por segundo constantes contra el Postgres de Railway,
que está en plan Hobby. En Comunidad sí controlamos `createPost`, así que el evento se puede
emitir desde ahí y el costo baja a casi cero.

---

## Almacenamiento

### ALM-01 · P2 · El caché sin conexión guarda todo, en cada cambio

`services/offlineStore.ts:79` · `saveCommunity` serializa con `JSON.stringify` **todo** lo
cargado y lo escribe entero en AsyncStorage, sin recortar ni espaciar las escrituras. Con 20
publicaciones es gratis. Con un chat de cientos de mensajes es una serialización grande en el
hilo de JS **por cada mensaje que llega**, y eso se siente como un tirón justo al recibir.

**Arreglo:** guardar solo los últimos 50 mensajes y espaciar la escritura (un `debounce` de
un segundo basta). Medio día, y es requisito para el chat.

### ALM-02 · P3 · El caché no se limpia nunca

No hay poda de las claves `@stopbet/*`. Hoy son pocas y pequeñas, pero con historial de chat
por sede conviene decidir un techo antes, no cuando el almacenamiento del paciente crezca sin
que nadie lo mire.

---

## Build de Android

### BLD-01 · P1 · La minificación está apagada en release

`android/app/build.gradle:63` · `enableProguardInReleaseBuilds = false`, que es el valor de la
plantilla de React Native y nadie cambió. El APK de release va sin minificar ni reducir
recursos. Activarlo exige probar el release completo, porque R8 puede romper reflexión (ojo
con Firebase), pero es la práctica esperable antes de publicar.

De paso: `signingConfig signingConfigs.debug` dentro del bloque `release`
(`build.gradle:109`) firma la versión de producción con la llave de depuración. No es
rendimiento, pero está en el mismo archivo y hay que resolverlo antes de publicar en Play.

### BLD-02 · P2 · 14 `console.*` viajan al build de producción

`babel.config.js` no incluye `transform-remove-console`, así que los 14 `console.log`,
`console.warn` y `console.error` de `HomeScreen`, `CommunityScreen`, `AchievementsScreen`,
`SuspendedAccountScreen` y `StaffThreadScreen` se ejecutan también en release. En Hermes cada
llamada serializa sus argumentos aunque nadie mire la consola.

**Cuidado al arreglarlo:** varios de esos avisos son el único rastro de errores tragados por
un `catch`. Conviene quitarlos solo en release y dejarlos en desarrollo, no borrarlos.

### BLD-03 · P3 · Una sola arquitectura y una ruta de Windows

`android/gradle.properties` fija `reactNativeArchitectures=arm64-v8a`. Está bien para compilar
rápido y para el APK de demo, pero un release real deja fuera a los teléfonos `armeabi-v7a`,
que en Chile todavía existen en gama baja. Conviene decidirlo explícitamente antes de publicar.

En el mismo archivo, `android.cxxBuildDirectory=C:/cxx/sb` es una ruta de Windows: en Linux o
macOS crea una carpeta literal llamada `C:` dentro del proyecto. No afecta a la app, pero
ensucia el repo de quien no compila en Windows.

---

## Lo que ya está bien, y conviene no romper

- **El foro del paciente ya virtualiza bien** (`CommunityScreen.tsx:433-441`):
  `initialNumToRender: 6`, `windowSize: 11`, `removeClippedSubviews` e `inverted`. Es la base
  correcta para el chat; lo que falta es memorizar las filas (RND-01).
- **Las hojas de estilo se memorizan por tema** (`ThemeContext.tsx:74`), con caché por fábrica.
  Sin eso, cada render crearía estilos nuevos.
- **El cliente HTTP está bien resuelto** (`services/api.ts`): tiempo límite con `AbortController`
  y refresco de token con `singleFlight`, así que varios 401 simultáneos no disparan varios
  refrescos.
- **Ya hubo una pasada de batería**: el comentario de `HomeScreen.tsx:175` documenta que el
  sondeo bajó de 5 segundos a 3 minutos, con el cálculo de peticiones por hora incluido.
- **Las dependencias son livianas**: 14 paquetes, sin `lodash`, sin `moment`, sin librerías de
  animación pesadas. Hermes y la nueva arquitectura están activados.
- **Todas las animaciones usan el driver nativo.**

---

## Antes de empezar el chat

Tres de esta lista dejan de ser optimización y pasan a ser requisito, porque el chat los
convierte en problema visible:

1. **RND-01**, memorizar las burbujas. Es lo que decide si el chat va fluido.
2. **ALM-01**, acotar el caché. Si no, cada mensaje recibido escribe el historial entero.
3. **RED-04**, emitir el evento desde `createPost` en vez de sondear la base.

Y los cuatro de peso (BUN-01, BUN-02, BUN-03, BLD-01) conviene hacerlos ahora justamente
porque no se cruzan con nada: son empaquetado, no lógica, y bajan el APK cerca de 4 MB antes
de que el chat sume código nuevo.

## Cómo se midió

- Bundle de producción con `npx react-native bundle --platform android --dev false`, con la
  app tal cual está en la rama y después con el import de íconos reescrito.
- Presencia de íconos sin usar dentro del bundle, buscando sus nombres en el archivo generado.
- Tamaños de fuente y recursos con `du` sobre `android/app/src/main/assets` y `res`.
- El resto es lectura del código, con archivo y línea en cada hallazgo.

**No se midió** el APK de release final (habría que compilarlo con Gradle) ni FPS ni memoria en
el dispositivo. Eso se hace cuando la fase 1 del chat esté armada, con una conversación de
prueba larga y el monitor de rendimiento de React Native.

---

## Estado al cierre · 22-09-2026

**17 hallazgos · 15 aplicados · 1 sin trabajo pendiente (RND-05) · 1 abierto por decisión (BLD-03).**

| Resultado | Antes | Ahora |
|---|---|---|
| Bundle JS de producción | 3,29 MB | **1,78 MB** |
| Fuentes empaquetadas | 1,7 MB | **408 KB** |
| Splash (cinco densidades) | 1.355 KB | **139 KB** |
| Minificación en release | Apagada | **R8 y shrinkResources activos, con el APK abierto y probado** |

### Qué se hizo en cada uno

| Hallazgo | Arreglo |
|---|---|
| BUN-01 | `Icon.tsx` importa cada ícono por su ruta, con `src/types/lucide-icons.d.ts` para los tipos |
| BUN-02 | Lato fuera del APK; `Fonts.caption` y `captionBold` eliminados |
| BUN-03 | Splash en WebP calidad 98, comparado píxel a píxel con el PNG antes de reemplazarlo |
| BUN-04 | `api.ts` dejó de mandar `x-user-id` |
| RND-01 | `PostCard` con `React.memo` y comparador explícito que ignora los callbacks |
| RND-02 | Lista del asistente virtualizada, `renderItem` estable y `scrollToEnd` solo cuando la conversación crece |
| RND-03 | `ToastContext` y `DialogContext` memorizan su valor |
| RND-04 | Comunidad del equipo clínico y el hilo de respuestas pasaron a `FlatList`; la fila de paciente quedó memorizada |
| RND-05 | Sin trabajo: las animaciones ya usaban el driver nativo |
| RED-01 | `hooks/useIntervaloActivo.ts` con `AppState`, en los cuatro sondeos |
| RED-02 | `hooks/useCargaFresca.ts`, 30 segundos de gracia al volver a una pestaña |
| RED-03 | Foro con `onEndReached` y páginas de 20 |
| RED-04 | No aplica todavía: es para cuando exista el chat en vivo |
| ALM-01 | Caché recortado a 50 y escrito una vez por segundo, no por cada cambio |
| ALM-02 | Al entrar se borran las cachés de otras cuentas del teléfono |
| BLD-01 | `minifyEnabled` y `shrinkResources` en `true`, **con reglas de `keep` para JNI**: ver abajo |
| BLD-02 | `utils/log.ts`: los avisos existen en desarrollo y desaparecen en release |
| BLD-03 | **Abierto.** Ver abajo |

### Probar el APK de release no es opcional, y una lección sobre las arquitecturas

Al abrir el primer APK con `minifyEnabled true`, la app murió en el arranque:

```
FATAL EXCEPTION: mqt_v_native
java.lang.UnsatisfiedLinkError: No implementation found for
com.facebook.jni.HybridData com.swmansion.rnscreens.NativeProxy.initHybrid()
```

Parecía el fallo clásico de R8 con JNI, pero **no era R8**. El mapping mostró que la clase
había conservado su nombre, y al mirar dentro del APK apareció la causa real:
`librnscreens.so` estaba **solo para `arm64-v8a`**, y el emulador de esta máquina es
`x86_64`. La app arrancaba y se caía al pedir la librería que no venía.

Dos cosas que deja esto:

- **El APK de release hay que abrirlo, no solo compilarlo.** Compiló sin un aviso las dos
  veces. Lo que se rompe en release no aparece en debug.
- **Cuidado con `reactNativeArchitectures`.** Está fijo en `arm64-v8a`, así que un APK de
  release no corre en un emulador x86_64 ni en un teléfono `armeabi-v7a` (BLD-03). Para
  probar en el emulador hay que compilar con `-PreactNativeArchitectures=x86_64`.

Las reglas de `keep` para JNI quedaron igual en `android/app/proguard-rules.pro`: son la
recomendación estándar y no cuestan tamaño, pero **no están verificadas contra un fallo real**
y el comentario del archivo lo dice.

### Lo que quedó abierto, y por qué

- **BLD-03 · arquitecturas y ruta de Windows.** `reactNativeArchitectures=arm64-v8a` deja
  fuera a los teléfonos `armeabi-v7a`, y `android.cxxBuildDirectory=C:/cxx/sb` es una ruta de
  Windows que alguien puso para compilar en su máquina. Las dos son decisiones del equipo:
  agregar arquitecturas encarece el build de todos, y cambiar la ruta de C++ le pega a quien
  compila en Windows. **No se tocaron sin preguntar.**
- **La firma de release sigue siendo la de depuración** (`signingConfig signingConfigs.debug`).
  No es rendimiento y necesita el keystore real del equipo, pero hay que resolverlo antes de
  publicar en Play.

### Cómo se comprobó

El APK de release con todo aplicado se instaló en el emulador y se recorrió a mano: arranca,
entra con una cuenta real contra el backend de Railway, el Inicio carga notificaciones y racha,
y el foro dibuja las burbujas, las reacciones y el historial hacia atrás. Sin un solo error en
`logcat`. Importa porque el release es lo único que pasa por R8: en debug nada de esto se
ejercita.

### Medición del chat con una conversación larga (22-09, tarde)

Era el pendiente de esta auditoría y ya está hecho, con la fase 1 del chat andando. Se
generaron **300 mensajes** de prueba en la sede Santiago (314 en total) y se recorrió el foro
en el emulador con `dumpsys gfxinfo` y `meminfo`.

| Escenario | Frames con tirón | p50 | p90 | p99 | Memoria (PSS) |
|---|---|---|---|---|---|
| Al abrir, sin paginar | — | — | — | — | 316 MB |
| 25 desplazamientos, sin cargar páginas | **0,8%** | 21 ms | 22 ms | 32 ms | 320 MB |
| 40 desplazamientos seguidos paginando (6 páginas, 120 mensajes) | **5,1%** | 26 ms | 32 ms | 48 ms | 432 MB |

**Lectura:** el desplazamiento por lo ya cargado es liso (menos del 1% de frames con tirón).
Los tirones aparecen al traer página nueva y meter 20 mensajes de golpe en la lista, y aun así
se quedan en el 5% **desplazando sin parar**, que no es lo que hace una persona. La
virtualización y la memorización de las burbujas están haciendo su trabajo: sin ellas, cada
mensaje nuevo repintaría todo lo montado.

**Lo que sí conviene vigilar:** la memoria sube alrededor de **1 MB por mensaje cargado**,
porque `posts` crece sin techo mientras se pagina. Con 120 mensajes son 432 MB de PSS, que en
un teléfono de gama baja empieza a ser mucho. Si se vuelve un problema, la salida es acotar la
ventana en memoria (quedarse con los últimos N y volver a pedir al subir), como hacen los
chats grandes. No se hizo todavía porque complica el desplazamiento y hoy no duele.

**Cómo repetirlo:** insertar mensajes de prueba con prefijo `[carga]`, recorrer el foro y
mirar `adb shell dumpsys gfxinfo com.stopbet` y `meminfo`. Ojo con dos cosas que confunden:
los mensajes insertados por SQL **no** llegan por el stream (lo emite el servicio, no la
base), y la paginación se detiene si el total que conoce la app quedó viejo, así que hay que
volver a entrar a la pestaña antes de medir.
