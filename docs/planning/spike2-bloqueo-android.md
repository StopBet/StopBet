# SPIKE 2 (CA1-CA4) — Bloqueo de sitios de apuestas en Android

**Dueño:** Eduardo Pacheco · **Rama:** `feature/spike-2-bloqueo-android`
**Historias que dependen de esto:** HdU08 (bloqueo), HdU15-18 (carga y actualización de URLs)
**Criterios:** CA1, CA2, CA3 y CA4 del SPIKE 2 (`docs/Sprint 2.md`).

> **Estado (07-10-2026): CA1, CA2, CA3 y CA4 cerrados.** El CA2 se corrió el 07-10 en un Xiaomi
> 2412DPC0AG (Android 16, Chrome 154) con video y registro; resultados en §6, paso 3, y la
> evidencia criterio por criterio en `docs/planning/evidencia-spike2.md`. El CA4 quedó decidido
> en §7. Lo marcado _verificado_ tiene fuente en §3; lo marcado _medido_ sale de esa prueba.

**Respuesta corta:** sí es posible. Una app Android común —sin root, sin ser dueña del
dispositivo, instalable desde Google Play— puede bloquear dominios de apuestas en todo el teléfono
usando la API `VpnService` como filtro de DNS local. El paciente puede desactivarlo, pero la app
**sí puede enterarse y dejar registro** cuando eso pasa.

---

## 1. Pros y contras

### 1.1 A favor

| Pro | Por qué importa en StopBet |
|---|---|
| **No requiere root ni permisos especiales** | Funciona en el teléfono que el paciente ya tiene, instalado normalmente |
| **Cubre todo el dispositivo** | Bloquea en cualquier navegador y en cualquier app, no solo dentro de StopBet |
| **Nada del paciente sale del teléfono** | El filtrado ocurre local: no hay servidor intermedio ni historial de navegación enviado a nadie. Encaja con la regla de no registrar datos identificables |
| **Liviano en batería** | En modo solo DNS la app procesa consultas de nombres, no el tráfico completo |
| **Precedentes en producción** | Varias apps de código abierto llevan años haciendo exactamente esto (§3.2) |
| **Se puede probar sin Google** | Un APK por cable no pasa por revisión: el CA2 se cierra dentro del sprint (§4.4) |
| **Detecta su propia desactivación** | `onRevoke()` permite dejar registro clínico de cuándo se apagó (§2.6) |
| **Coincide con lo que hace el Estado** | Chile bloquea estos mismos sitios por DNS (§3.4) |

### 1.2 En contra

| Contra | Impacto |
|---|---|
| **El paciente puede apagarlo en dos toques** | Es una barrera contra el impulso, no un candado. Hay que decirlo al definir qué se promete |
| **El DNS seguro de Chrome se lo salta** | Con *Usar DNS seguro* en un proveedor elegido a mano (Google, Cloudflare…), Chrome resuelve por HTTPS y los sitios cargan, aunque StopBet vea y bloquee la consulta paralela. Además Chrome **guarda esas direcciones y las sigue usando** después de volver a la opción por defecto, incluso tras reiniciar. Con la opción por defecto no pasa _(medido — CA2)_ |
| **El DNS privado estricto de Android rompe la navegación** | Con *DNS privado* en un servidor fijo y StopBet activo, el teléfono deja de resolver casi todo, no solo apuestas. No es un escape, es una avería visible; la app lo detecta y lo avisa en Perfil _(medido — CA2)_ |
| **Una sola VPN activa a la vez** | Si el paciente usa otra VPN, una desactiva a la otra |
| **«VPN siempre activa» con «Bloquear conexiones sin VPN»** | Si el paciente activa las dos en Ajustes, apagar el bloqueo desde la app deja **todo el teléfono sin internet**, y solo con la primera Android lo vuelve a encender solo. Desde Android 10 la app lo detecta (`isAlwaysOn()` / `isLockdownEnabled()`) y manda a Ajustes › VPN en vez de apagar; en Android 7-9 no hay API para saberlo _(verificado en emulador, 29-09)_ |
| **Filtrar DNS no impide abrir aplicaciones** | Una app de apuestas instalada se abre igual; lo que se corta es su conexión, si resuelve por el DNS del sistema. Decisión del CA4 (§7) |
| **Google Play exige declaración, video y aviso propio** | Trámite obligatorio al publicar, más un texto que AJUTER debe validar (§4) |
| **Las listas envejecen solas** | Los operadores cambian de dominio. `rab0na-2417.com` —con un cero— está en la nómina oficial |
| **Es el primer módulo nativo del proyecto** | No había patrón interno del cual copiar; el PoC lo deja establecido (§5.2) |
| **Registrar apagados es vigilancia** | Aunque el fin sea terapéutico, necesita consentimiento explícito y visto bueno de AJUTER (§2.6) |

### 1.3 Lo que simplemente no se puede desde una app común

| Quisiéramos | ¿Se puede? | Qué haría falta |
|---|---|---|
| Que el bloqueo no se pueda apagar | **No** | Device Owner (teléfono reseteado de fábrica) |
| Fijar el DNS privado del sistema | **No** _(verificado)_ | Device Owner |
| VPN permanente con corte de red | **No** _(verificado)_ | Device Owner, o que el paciente lo active a mano en Ajustes |
| Impedir que se desinstale StopBet | **No** | Device Owner |
| Impedir que se apague (solo detectarlo) | **No** | `onRevoke()` avisa **después** de que ya se apagó |

---

## 2. Mecanismos de bloqueo (CA1)

### 2.0 Matriz del CA1

Los tres mecanismos que pide el criterio, en las cinco dimensiones que pide el criterio.

| | **A. `VpnService` solo DNS** | **B. `VpnService` con todo el tráfico** | **C. DNS privado a un filtro externo** |
|---|---|---|---|
| **Permisos** | `BIND_VPN_SERVICE` (lo declara el servicio, no el usuario) + consentimiento de VPN una sola vez (`prepare()`). Para el servicio en primer plano: `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`. **Ningún permiso peligroso en tiempo de ejecución** _(verificado)_ | Los mismos que A | **Ninguno para la app**: lo configura el paciente en Ajustes › Red › DNS privado. Una app común no puede hacerlo por código _(verificado)_ |
| **¿El paciente puede desactivarlo?** | Sí: desde Ajustes › VPN, desde la notificación, forzando el cierre o desinstalando. La app **se entera** por `onRevoke()` en los dos primeros casos; en los otros, solo por la ausencia de latido (§2.6) | Igual que A | Sí, desde Ajustes. **No hay aviso**: la app solo puede sondear `LinkProperties.getPrivateDnsServerName()` para ver si sigue puesto |
| **Privacidad de sus datos** | La app ve **solo los nombres** que el teléfono consulta, y los procesa en el teléfono. No sale nada del dispositivo | La app ve **todas las conexiones** (IPs, puertos, nombre del servidor TLS). Nada sale, pero la responsabilidad es mucho mayor | ⚠️ **Todas las consultas DNS del paciente van a un tercero** (p. ej. NextDNS), normalmente fuera de Chile: es su historial de navegación en manos de un proveedor que StopBet no controla |
| **Política de Google Play** | Formulario de declaración de `VpnService`, categoría de control parental / seguridad, aviso destacado con consentimiento y video ≤ 90 s (§4) | Mismo trámite, **más difícil de justificar**: la app ve tráfico que no necesita para bloquear | No usa `VpnService`: **sin declaración**. La app solo daría instrucciones |
| **Limitaciones** | El DNS seguro de Chrome con un proveedor elegido lo salta _(medido)_; el DNS privado estricto de Android deja el teléfono sin resolver _(medido)_; una IP escrita a mano también; una sola VPN a la vez; no impide abrir apps | Batería y complejidad: hay que reimplementar el reenvío TCP/UDP en la app. Tampoco descifra HTTPS: bloquea por IP o por nombre TLS | Depende de la categoría del proveedor, no de la nómina chilena (salvo lista propia); plan gratuito de NextDNS limitado a 300.000 consultas/mes; el paciente debe configurarlo a mano |
| **Veredicto** | **Elegido para el PoC** | Solo si A se evade con facilidad | No como mecanismo propio |

| Descarte | Por qué |
|---|---|
| **D. Device Owner** | Es lo único que impide apagar el bloqueo, pero exige aprovisionar un teléfono recién reseteado. Inviable en el celular propio del paciente (§2.4) |
| **E. `AccessibilityService`** | Lee todo lo que el paciente ve en pantalla. Play lo restringe a herramientas de accesibilidad y el costo en privacidad es desproporcionado para datos clínicos (§2.5) |

### 2.1 Método A — `VpnService` en modo solo DNS

La app levanta una interfaz de red local y se declara servidor DNS del sistema. Solo se enruta
hacia ella el tráfico DNS; **todo lo demás sale directo a internet**, sin pasar por la app.

```
Chrome / app de apuestas
   │  "¿qué IP tiene bwin.com?"
   ▼
Interfaz local de StopBet  (solo recibe consultas DNS)
   │
   ├─ el dominio o un dominio padre está en la lista  →  responde NXDOMAIN ("no existe")
   └─ no está                                           →  reenvía al DNS real de la red y devuelve la respuesta
```

Es el más liviano, el más privado y el más simple de auditar. Su límite conocido es que una app
que resuelva por su cuenta con DNS cifrado no pasa por el filtro.

### 2.2 Método B — `VpnService` con todo el tráfico

Misma API, enrutando todas las conexiones. Permite reconocer el destino aunque el DNS se haya
saltado, a cambio de más batería, más complejidad y de que la app vea **todo** el tráfico del
paciente — responsabilidad mayor en una plataforma clínica y más difícil de justificar ante Play.

**Criterio de decisión:** solo si el PoC demuestra que la evasión por DNS cifrado es fácil.

### 2.3 Método C — DNS privado apuntando a un filtro externo

Android permite fijar un servidor DNS cifrado a nivel de sistema, y hay servicios que filtran la
categoría de apuestas (NextDNS, por ejemplo, tiene la categoría en su control parental y acepta
listas propias). **Una app normal no puede activarlo por código**: hacerlo es
`setGlobalPrivateDnsModeSpecifiedHost`, reservado al dueño del dispositivo _(verificado)_. Queda
como instrucción manual, y además mandaría las consultas del paciente a un tercero.

### 2.4 Método D — Device Owner (descartado, con razón)

Es la única vía para que el paciente **no** pueda apagar el bloqueo: permite VPN permanente con
corte de red (`setAlwaysOnVpnPackage(..., lockdownEnabled)`) y fijar el DNS del sistema
_(verificado)_. Exige un aprovisionamiento especial, normalmente sobre un teléfono recién
reseteado: inviable para una app que el paciente instala en su propio celular. Queda anotado como
lo que habilitaría un eventual convenio con teléfonos entregados por AJUTER.

### 2.5 Método E — `AccessibilityService` (descartado)

Leer la URL del navegador por accesibilidad implica que la app puede leer el contenido de la
pantalla. Play lo restringe fuertemente y, para datos clínicos, el costo en privacidad es
desproporcionado frente a filtrar DNS.

### 2.6 Activación automática y registro de encendido/apagado

**Activar al abrir la app: sí, salvo la primera vez.** El consentimiento se pide una sola vez;
después `prepare()` devuelve `null` y la app levanta el bloqueo **sin diálogo** en cada apertura
_(verificado)_. La primera vez el paciente debe tocar aceptar, y eso no se puede saltar. Hay que
llamar a `prepare()` siempre antes de arrancar, porque el paciente pudo haber elegido otra VPN.

**Tras reiniciar el teléfono el bloqueo vuelve solo** si estaba encendido: `BootReceiver` lo
levanta sin abrir la app, y Android 16 autoriza el servicio en primer plano desde el arranque
(`Background started FGS: Allowed ... code:BOOT_COMPLETED`). **Con demora**: el Xiaomi avisó del
arranque casi 2 minutos después de encender, y durante ese tiempo el teléfono queda sin filtro.
*VPN siempre activa* en Ajustes también lo levanta _(medido — CA2)_.

**Ojo en Xiaomi:** apagar la VPN desde Ajustes **retira también el consentimiento**, así que
*Reactivar* vuelve a mostrar el diálogo del sistema _(medido — CA2)_.

**Detectar que lo apagaron: sí.** Android llama a **`onRevoke()`** cuando el usuario desactiva la
VPN o cuando otra app de VPN toma su lugar _(verificado)_. Dos detalles: cuando llega, la interfaz
**ya está desactivada**, y el método **puede no correr en el hilo principal**.

**El hueco que decide el diseño:** si el paciente fuerza el cierre, desinstala, apaga el teléfono
o está sin señal, el evento no se dispara o no alcanza a salir. Un registro hecho solo de eventos
tiene, justo en el caso más delicado, un silencio que parece normalidad. Por eso hacen falta dos
piezas:

| Pieza | Qué responde | Cómo |
|---|---|---|
| **Evento** | "Se activó / se desactivó, a esta hora" | `onRevoke()` y el encendido manual |
| **Latido** | "Sigue activo ahora" | Reporte periódico; el dashboard marca *sin reporte desde…* |

Sin el latido, desinstalar la app se ve igual que tenerla funcionando.

**Dos decisiones previas que no son técnicas:**

1. **Consentimiento clínico.** Avisar que un paciente apagó el bloqueo a las 3 AM es vigilancia,
   aunque el fin sea terapéutico. Debe estar consentido explícitamente y validado por AJUTER —el
   mismo camino que el texto de privacidad del asistente en `docs/ASUNCIONES-PENDIENTES.md`—, y
   hay riesgo real de que el paciente se sienta vigilado y abandone la app.
2. **Google Play.** Reportar esa conducta es recolectar datos del usuario vía `VpnService`, y eso
   exige aviso destacado y consentimiento explícito (§4.2).

---

## 3. Documentación que lo respalda

### 3.1 Fuentes oficiales

| Tema | Fuente |
|---|---|
| `prepare()`, consentimiento, `onRevoke()`, VPN siempre activa | [VPN · Android Developers](https://developer.android.com/develop/connectivity/vpn) |
| API de `VpnService` | [VpnService · API reference](https://developer.android.com/reference/android/net/VpnService) |
| Tipo `systemExempted` para apps de VPN y su permiso | [Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types) |
| Detectar el DNS privado | [LinkProperties · API reference](https://developer.android.com/reference/android/net/LinkProperties) |
| DNS privado solo por device owner | [setGlobalPrivateDnsModeSpecifiedHost](https://learn.microsoft.com/en-us/dotnet/api/android.app.admin.devicepolicymanager.setglobalprivatednsmodespecifiedhost) |
| VPN permanente con corte de red | [setAlwaysOnVpnPackage](https://learn.microsoft.com/en-us/dotnet/api/android.app.admin.devicepolicymanager.setalwaysonvpnpackage) |
| Política de `VpnService` en Play | [Understanding Google Play's VpnService policy](https://support.google.com/googleplay/android-developer/answer/12564964) |

### 3.2 Precedentes en producción — y un aviso de licencias

Apps de código abierto que ya hacen esto sin root: [DNS66](https://github.com/julian-klode/dns66),
[personalDNSfilter](https://f-droid.org/en/packages/dnsfilter.android/),
[NetGuard](https://github.com/m66b/netguard) (cortafuegos por app con la misma API),
[DNSNet](https://github.com/t895/DNSNet) y [RethinkDNS](https://github.com/celzero/rethink-app),
cuyo propio issue tracker documenta que el DNS privado de Android
[se salta el filtro](https://github.com/celzero/rethink-app/issues/25).

> ⚠️ **No copiar su código.** personalDNSfilter y NetGuard están bajo **GPL** _(verificado)_.
> Incorporarlo obligaría a liberar StopBet bajo la misma licencia. Sirven como **referencia de
> arquitectura**, no como fuente de código. El PoC (§5) está escrito desde cero, sin dependencias.

### 3.3 Fuentes de dominios (CA3)

| Fuente | Licencia | Formato | Costo |
|---|---|---|---|
| [StevenBlack/hosts](https://github.com/StevenBlack/hosts/blob/master/alternates/gambling-only/readme.md) (variante *gambling*) | MIT _(verificado)_ | hosts | Gratuita |
| [The Blocklist Project](https://github.com/blocklistproject/Lists) (*gambling*) | Unlicense / MIT según formato _(verificado)_ | hosts, AdGuard | Gratuita |
| [HaGeZi](https://github.com/hagezi/dns-blocklists) (*gambling*) | **GPL-3.0** _(verificado)_ | adblock, hosts, otros | Gratuita |
| Nómina oficial de Subtel (§3.4) | Acto administrativo público | Lista de dominios | Gratuita |

#### Cobertura medida contra la nómina chilena _(medido el 22-09-2026)_

No es una estimación: se descargaron las tres listas y se cruzaron con los 42 dominios de Subtel
con `scripts/spike2-cobertura-listas.mjs`, que está en el repo para poder repetirlo.

| Fuente | Entradas | Exactos | Por padre | **Cubiertos** | Sin cubrir | Última actualización |
|---|---:|---:|---:|---:|---:|---|
| StevenBlack (*gambling-only*) | 5.106 | 7 | 3 | **10 (24 %)** | 32 | 20-09-2026 |
| The Blocklist Project | 342.623 | 32 | 4 | **36 (86 %)** | 6 | **20-07-2026** |
| HaGeZi (*gambling*) | 530.632 | 35 | 4 | **39 (93 %)** | 3 | 22-09-2026 |

> **Exacto vs. por padre.** "Por padre" significa que la lista trae el dominio superior (p. ej.
> `betano.com` para `lat.betano.com`). Solo sirve si el filtro corta también los subdominios. **El
> PoC sí lo hace** (`DomainList.isBlocked` sube por los dominios padre), así que para StopBet
> cuenta la columna *Cubiertos*.

**Cuatro hallazgos que deciden la elección:**

1. **La lista más cómoda de licencia es la que menos sirve.** StevenBlack es MIT y está al día,
   pero cubre solo **24 %** de lo que Chile bloquea. Sola, no alcanza.
2. **The Blocklist Project lleva dos meses sin actualizarse** (20-07-2026). En un rubro donde los
   operadores cambian de dominio, la frescura pesa tanto como la cobertura.
3. **HaGeZi es la mejor en cobertura y frescura** (93 %, actualizada el mismo día). Se reconstruye
   **varias veces al día** y se descarga por enlace directo.
   - **No cuesta nada** _(verificado)_: sin pago, sin suscripción, sin cuenta ni clave de API. Lo
     que sí puede ser de pago son los **servicios** de DNS con filtrado del método C, que son otra
     cosa.
   - Su licencia **GPL-3.0 no es un costo, es una condición de redistribución**: permite uso
     comercial, pero exige mantener la licencia al redistribuir. **Descargarla en el backend y
     servir el resultado no es empaquetarla en el APK**; empaquetarla dentro del APK sí obliga a
     incluir el texto de la licencia. Conviene el visto bueno de quien lleve lo legal.
4. **Ninguna lista cubre tres dominios de la nómina oficial**: `estelarbet.cl`,
   `latamwinonline.com` y `nayafacil-903.com`. Es la prueba dura de que **la nómina chilena tiene
   que ser una fuente propia**, no un complemento.

**Falsos positivos:** ninguna de las tres bloquea servicios legítimos de control (bancos, SII,
Correos, Mercado Libre, Railway, Vercel, Google, WhatsApp). El riesgo de romperle la navegación al
paciente —o la propia app— es bajo.

**Un caso que es decisión de producto, no error:** Blocklist Project y HaGeZi **sí bloquean
`polla.cl` y `loteria.cl`**, que son juego de azar **legal** en Chile. Para una app de
rehabilitación de ludopatía probablemente sea deseable bloquearlos, pero hay que decidirlo
explícitamente: es una pregunta para AJUTER (§7).

**Recomendación:** **HaGeZi como fuente principal** por cobertura y frescura, **más la nómina de
Subtel mantenida por StopBet** para lo que ninguna lista trae. StevenBlack queda descartada por
cobertura insuficiente y Blocklist Project como respaldo si la licencia GPL resultara ser un
impedimento.

### 3.4 El respaldo chileno — el hallazgo más fuerte

Existe una **nómina oficial y vigente**: la Subsecretaría de Telecomunicaciones (Subtel) ordenó
bloquear **42 dominios el 01-09-2026** y **37 más el 21-09-2026**, en cumplimiento de resoluciones
de la Corte Suprema y la Corte de Apelaciones de Santiago. La **Superintendencia de Casinos de
Juego (SCJ)** valida cuáles corresponden a operadores no autorizados, y el bloqueo ordenado **se
ejecuta por DNS** _(verificado:
[Subtel](https://www.subtel.gob.cl/subtel-ordena-bloqueo-de-42-sitios-de-apuestas-online/),
[Emol, 21-09](https://www.emol.com/noticias/Economia/2026/09/21/1211996/bloqueo-apuestas-online-subtel.html))_.

Importa por tres razones: cubre el punto ciego de las listas internacionales (los sitios que
operan acá), respalda la decisión técnica (el Estado bloquea por el mismo mecanismo), y es una
fuente oficial citable.

Nómina del 01-09-2026 — va completa en el PoC:

```
lat.betano.com        coolbet.com           coolbetchile.com      1xbet.com
chile.1xbet.com       betsson.com           betsson1001.com       rojabet.cl
rojabet.com           betsala.com           betsala11.com         micasino.com
micasinoenvivo.com    jugabet.cl            stake.com             allsport365.com
z2.bet365.com         1wins.cl              estelarbet.cl         estelarbet.vip
juegalo.com           apuestasroyal.com     cl.novibet.com        epicbet.com
bc.game               playglobal5.com       rabona.com            rab0na-2417.com
pin-up.world          latamwinonline.com    melbet.com            tikitaka.com
tonybet.com           betfury.com           bet7k.cl              doradobet.com
winchile.com          jackpotcitycasino.com juegaconelking.com    casinonano.com
nayafacil-903.com     betcris.com
```

La orden del 21-09 suma, entre otras, Kto Bet, Marathonbet, Betway, Betfair y Sporting Bet, y
advierte que se seguirá aplicando a nuevos dominios, subdominios y espejos. **Esa nómina no está
publicada como dominios literales**: hay que pedirla por transparencia (OIRS de Subtel).

> ⚠️ **Consecuencia para el CA2 que no es obvia:** como los ISP chilenos ya bloquean estos 42
> dominios, en una red chilena **aparecen bloqueados aunque la VPN de StopBet esté apagada**. Si
> el video usara solo esos, "desactivar la VPN" seguiría mostrando bloqueo y la prueba no
> demostraría nada. Por eso el PoC suma **12 dominios de control** —casas de apuestas
> internacionales fuera de la nómina— y el protocolo del §6 los usa para las pruebas de
> encendido y apagado.

---

## 4. Requisitos para publicarlo en Google Play

_(verificado — Play Console Help)_

### 4.1 Uso permitido

Play acepta `VpnService` como funcionalidad central en, entre otras, **apps de control parental y
gestión empresarial, seguimiento de uso de apps y seguridad del dispositivo** (antivirus, MDM,
cortafuegos). El bloqueo terapéutico de sitios de apuestas encaja, pero **hay que argumentarlo por
escrito**. El PoC no crea un túnel a un servidor remoto: todo queda en el teléfono.

### 4.2 Obligaciones concretas

| Requisito | Detalle |
|---|---|
| **Formulario de declaración** | Obligatorio en Play Console para toda app que use `VpnService`: si es funcionalidad central, categoría, datos que recolecta |
| **Dos videos** | Uno de ≤ 90 s mostrando el uso de la VPN, y otro del aviso y el consentimiento dentro de la app. El video del CA2 sirve de base |
| **Aviso destacado dentro de la app** | En el uso normal de la app, **separado** de la política de privacidad, explicando qué datos accede la VPN, y con una acción afirmativa del paciente para aceptar |
| **Consentimiento explícito para datos** | Si se reporta al psicólogo que el paciente apagó el bloqueo (§2.6), eso es recolección de datos y cae en esta regla |
| **Prohibido** | Recolectar datos sin aviso y consentimiento; redirigir o manipular tráfico de otras apps para monetizar |

### 4.3 Firma de la aplicación

⚠️ Hoy el build de `release` se firma con `debug.keystore`
(`apps/mobile/android/app/build.gradle`). Sirve para instalar y repartir en pruebas, **no para
publicar en Play**, que exige firma propia. No frena al Spike, pero sí a HdU08.

### 4.4 Nada de esto bloquea las pruebas

**Todo lo anterior aplica al publicar, no al probar.** Un APK instalado por cable no pasa por
Google: no hay revisión, formulario ni cuenta de desarrollador. Y el diálogo de permiso lo dibuja
el sistema operativo, así que se comporta igual en una compilación de prueba.

---

## 5. El PoC y los requisitos técnicos

> **Dos alcances.** §5.1 a §5.3 es el **PoC del CA2**, ya construido en esta rama. §5.4 a §5.6 es
> el **diseño de HdU08/HdU15-18**: queda documentado, no se implementa en el Spike.

### 5.1 Entorno y build

| Requisito | Detalle |
|---|---|
| **JDK 17** | Gradle lo exige. Con el JDK 25 de Android Studio el build muere en `configureCMakeDebug` |
| **`google-services.json`** | En `apps/mobile/android/app/`. No está en el repo; sin él no compila |
| **Dispositivo físico** | `gradle.properties` fija `reactNativeArchitectures=arm64-v8a`: un emulador x86_64 no sirve sin tocar esa línea |
| **Arquitectura nueva** | `newArchEnabled=true` → el módulo va como TurboModule con codegen (`codegenConfig` en `apps/mobile/package.json`) |
| **SDK** | `minSdk 24`, `targetSdk 36` |

Verificado el 26-09-2026: `./gradlew app:assembleDebug` con JDK 17 → **BUILD SUCCESSFUL**.

### 5.2 Módulo nativo

Es el **primer módulo nativo propio del proyecto**. Vive en
`apps/mobile/android/app/src/main/java/com/stopbet/blocking/`:

| Archivo | Responsabilidad |
|---|---|
| `BlockingVpnService.kt` | Levanta la interfaz (solo enruta la IP del DNS falso `192.0.2.53`), filtra, reenvía el resto al DNS de la red física con `protect()`, implementa `onRevoke()` |
| `DnsPacket.kt` | Lee la consulta IPv4/UDP y arma la respuesta NXDOMAIN. Sin librerías: las que hacen esto son GPL |
| `DomainList.kt` | 42 dominios de Subtel + 12 de control; bloquea también los subdominios |
| `BlockingModule.kt` / `BlockingPackage.kt` | TurboModule: puente hacia JavaScript |

Manifiesto:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED" />

<service
    android:name=".blocking.BlockingVpnService"
    android:permission="android.permission.BIND_VPN_SERVICE"
    android:foregroundServiceType="systemExempted"
    android:exported="false">
    <intent-filter>
        <action android:name="android.net.VpnService" />
    </intent-filter>
</service>
```

⚠️ Con `targetSdk 36` un servicio en primer plano **debe declarar su tipo y el permiso de ese
tipo**. `systemExempted` es el que Android reserva a las apps de VPN; sin
`FOREGROUND_SERVICE_SYSTEM_EXEMPTED` el servicio se cae al arrancar, y el error apunta al arranque
del servicio, no al bloqueo.

### 5.3 Puente con JavaScript y pantalla de prueba

Spec en `apps/mobile/src/specs/NativeBlocking.ts`:

| Función | Devuelve | Nota |
|---|---|---|
| `requestPermission()` | `boolean` | Llama a `prepare()`; si ya hay consentimiento resuelve `true` sin diálogo |
| `start()` / `stop()` | `void` | `start()` falla si no hay consentimiento |
| `getStatus()` | objeto | `active`, `domainCount`, `blockedCount`, `recentBlocked`, `lastRevokedAt`, `privateDnsServer` |

La pantalla es `components/BlockingPocCard.tsx`, dentro de **Perfil › Herramientas de prueba**,
que solo existe con `__DEV__`: **no aparece en el APK de pacientes**. Muestra el interruptor, el
contador de consultas bloqueadas, los últimos dominios bloqueados, la hora del último apagado
hecho desde Ajustes y un aviso si el DNS privado estricto está activo. Todo eso sirve de evidencia
en el video.

### 5.4 Backend — diseño propuesto (HdU08, no se implementa en el Spike)

Siguiendo las convenciones del repo: módulo por dominio, DTOs con `class-validator`, entidades en
`src/<modulo>/entities/`, Swagger en todos los endpoints, y roles por guard, nunca dentro del
servicio.

Módulo nuevo `blocking`. Endpoints propuestos:

| Método y ruta | Quién | Para qué |
|---|---|---|
| `POST /blocking/events` | Paciente | Registrar activación o desactivación |
| `POST /blocking/heartbeat` | Paciente | Latido: "sigue activo" |
| `GET /blocking/patients/:patientId/status` | Equipo clínico | Estado actual y último latido |
| `GET /blocking/patients/:patientId/events` | Equipo clínico | Historial para el seguimiento |
| `GET /blocking/domains?since=<versión>` | Paciente | Lista vigente y su versión (HdU15/18) |

Reglas que impone el repo:

- **La identidad sale del token.** `@UserId()`, nunca un `patientId` en el cuerpo: el backend ya
  no lee `x-user-id` y `JwtAuthGuard` es global desde el 16-09.
- **Los endpoints del equipo clínico sobre un paciente** llevan `PatientAccessGuard`, que ya acota
  a un psicólogo a sus pacientes asignados.
- **Idempotencia**: `POST /blocking/events` recibe un identificador de evento generado en el
  teléfono y responde **409** si ya lo tenía. El cliente ya sabe tratar ese 409 como éxito
  (`esConflicto` en `services/reintentoEscritura.ts`), que es lo que permite reintentar sin
  duplicar.
- **Entidad** `blocking_events` (paciente, tipo, momento en que ocurrió, momento en que se
  recibió, identificador de cliente único). El momento de ocurrencia lo pone el teléfono: puede
  haber estado sin red durante horas.
- **Tipos compartidos** en `packages/shared-types/src/index.ts`, sin dependencias externas.

### 5.5 Comunicación entre las partes

```
Servicio VpnService  ──onRevoke()──▶  TurboModule  ──evento──▶  JS de la app
                                                                    │
                                          cola offline (AsyncStorage)│ conReintento()
                                                                    ▼
                                                    POST /blocking/events   (Bearer)
                                                                    │
                                    ┌───────────────────────────────┼─────────────────┐
                                    ▼                               ▼                 ▼
                          tabla blocking_events        notifications (in-app)   PushService
                                    │                                                  │
                                    ▼                                                  ▼
                        dashboard web (SSE, patrón de alertas)                push al psicólogo
```

Ojo: `onRevoke()` corre en el servicio, y el JS puede no estar vivo en ese momento. En HdU08 el
evento debe quedar guardado del lado nativo y enviarse cuando la app vuelva, no depender de que JS
lo escuche en vivo.

**Nada de lo demás se construye de cero:**

| Necesidad | Lo que ya existe |
|---|---|
| Envío confiable sin red | `services/checkInQueue.ts` y `services/reintentoEscritura.ts` (`conReintento`, `esConflicto`) |
| Cliente HTTP con token | `apps/mobile/src/services/api.ts`, ya manda Bearer y renueva el token solo |
| Aviso al psicólogo | Tabla `notifications` y `PushService.enviarAUsuarios` |
| Dashboard en vivo | SSE en `panic/alerts/stream` + `apps/web/src/hooks/useAlertsRealtime.ts` |

### 5.6 Actualización de la lista (HdU15 vs. HdU18)

| Modo | Qué implica |
|---|---|
| **Carga manual (HdU15)** | El equipo carga dominios en el backend; el teléfono los baja con `GET /blocking/domains`. Simple, pero envejece |
| **Actualización automática (HdU18)** | Un proceso del backend baja HaGeZi y la nómina de Subtel, arma una versión nueva y el teléfono la toma sola |

---

## 6. Pasos para cubrir mis CA (Eduardo Pacheco)

### Paso 1 — CA1: comparación de mecanismos ✅ listo

Matriz en §2.0: los tres mecanismos del criterio en las cinco dimensiones, más Device Owner y
`AccessibilityService` como descartes justificados. Las celdas que dependían de la prueba
quedaron medidas en el paso 3.

### Paso 2 — CA3: fuentes de dominios ✅ listo

Cuatro fuentes (tres internacionales + la nómina oficial), con licencia, frecuencia de
actualización, **cobertura medida** contra lo que opera en Chile y falsos positivos (§3.3). La
medición es reproducible:

```bash
# descargar las listas (no van al repo, ~19 MB)
curl -L -o stevenblack.txt      https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling-only/hosts
curl -L -o blocklistproject.txt https://raw.githubusercontent.com/blocklistproject/Lists/master/gambling.txt
curl -L -o hagezi.txt           https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/gambling.txt

node scripts/spike2-cobertura-listas.mjs <carpeta-con-las-listas>
```

Quedan abiertos, sin frenar el cierre: pedir por transparencia la nómina del 21-09, y la pregunta
de `polla.cl` / `loteria.cl` a AJUTER (§7).

### Paso 3 — CA2: correr el PoC y grabar el video ✅ 07-10-2026

**Instalar** (teléfono con depuración USB, JDK 17, desde la raíz del repo):

```bash
pnpm run android:device      # compila, instala y levanta Metro con los túneles adb reverse
```

En la app: **Perfil › Herramientas de prueba › Bloqueo de apuestas (Spike 2)**.

> **Prueba de humo (27-09-2026, HONOR ABR-NX1, Android 16, wifi):** el diálogo del sistema
> aparece, el servicio arranca con el tipo `systemExempted` sin errores y se ve el ícono VPN.
> `www.bwin.com` → `DNS_PROBE_FINISHED_NXDOMAIN` en Chrome y `BLOQUEADO www.bwin.com` en el log;
> `www.sii.cl` carga normal. Una consulta reenviada tuvo un timeout de 5 s y Chrome la resolvió al
> reintentar: anotarlo si se repite durante la prueba. Después se reinstaló la app para que el
> diálogo vuelva a aparecer en el video.

**Antes de grabar:** en Ajustes › Red › DNS privado, dejarlo en *Automático*; en Chrome ›
Configuración › Privacidad › *Usar DNS seguro*, dejarlo en la opción por defecto. Así el punto de
partida es el de un teléfono normal.

| # | Prueba | Qué demuestra | Resultado |
|---|---|---|---|
| 1 | Encender desde Inicio → aparece el diálogo del sistema → aceptar | Consentimiento | ✅ Diálogo *Solicitud de conexión*; al aceptar, VPN `tun0` conectada (DNS `192.0.2.53`). En video: la reactivación de las 11:42 |
| 2 | Con el bloqueo **activo**, abrir en Chrome al menos **20 dominios** de la lista: 12 de control (`bwin.com`, `pokerstars.com`, `888casino.com`, `williamhill.com`, `unibet.com`, `draftkings.com`, `fanduel.com`, `ladbrokes.com`, `paddypower.com`, `bovada.lv`, `betmgm.com`, `skybet.com`) + 8 de Subtel (`coolbet.com`, `1xbet.com`, `stake.com`, `betsson.com`, `rojabet.cl`, `jugabet.cl`, `melbet.com`, `bc.game`). El contador y *Últimos bloqueados* los van registrando | **Que bloquea ≥ 20 dominios** | ✅ **20 de 20**: `DNS_PROBE_FINISHED_NXDOMAIN` en Chrome y `BLOQUEADO` en el registro, entre 11:30:23 y 11:33:31. Contador: 509 consultas bloqueadas |
| 3 | Abrir sitios normales: `bancoestado.cl`, `sii.cl`, `google.com`, y usar StopBet (asistente, comunidad) | Que no rompe nada | ✅ BancoEstado, SII, Google y Wikipedia cargan. ⚠️ Con wifi **y** datos encendidos a la vez aparecía un bug que dejaba todo sin resolver; arreglado en `fix/HU-08-dns-red-activa` (ver hallazgos) |
| 4 | **Desactivar la VPN desde Ajustes** y volver a StopBet. Reabrir dominios de control | Que se evade en dos toques, que la app se entera (`onRevoke()`) y que los de control vuelven a cargar | ✅ `onRevoke` a las 11:37:09. Perfil: *Desactivado desde el sistema a las 11:37:09*; Inicio: *La protección está apagada · Reactivar*. **Cargan 7 de control** (pokerstars, 888casino, unibet, williamhill, draftkings, betmgm, skybet) y StopBet no registra nada |
| 5 | Mismo apagado, reabrir dominios de Subtel | Que los de Subtel siguen cortados **por el ISP**, no por StopBet | ✅ En datos de **Claro**: `1xbet.com` y `stake.com` NXDOMAIN, `coolbet.com` `ERR_CONNECTION_REFUSED`. Claro corta también `bwin.com`, que en wifi sí cargaba: **cada operador bloquea listas distintas** |
| 6 | Reactivar. Chrome › *Usar DNS seguro* › *Google (Public DNS)*. Reabrir dominios | **Si Chrome se salta el filtro** → decide A vs. B | ❌ **Se lo salta.** Con la opción por defecto (*Usa tu proveedor de servicios actual*) los 20 se bloquean; con Google cargan unibet, pokerstars, williamhill y draftkings, **y también** `stake.com` y `1xbet.com`: el bloqueo del operador tampoco aplica. StopBet igual ve y registra la consulta |
| 7 | Volver Chrome a la opción por defecto. DNS privado del sistema = `dns.google`. Reabrir dominios | Si el DNS privado del sistema se salta el filtro, y que la app lo detecta | ⚠️ **No lo salta: rompe la resolución.** Apuestas y sitios normales (Emol, YouTube) dan `ERR_NAME_NOT_RESOLVED`. Perfil muestra *DNS privado activo (dns.google): las consultas no pasan por el filtro* |
| 8 | DNS privado en *Automático*. Reiniciar el teléfono con el bloqueo activo, **sin abrir la app** | Que vuelve solo (`BootReceiver`) | ✅ Vuelve solo a las 12:07:38, ~2 min después de encender (Xiaomi avisa tarde del arranque). `888casino.com` y `coolbet.com` NXDOMAIN |
| 9 | Ajustes › VPN › StopBet › *VPN siempre activa*. Reiniciar | Que así también vuelve | ➖ No hizo falta: con `BootReceiver` ya vuelve. El caso *siempre activa* lo verificó Alex en emulador (PR #140) |
| 10 | Dejarlo activo unas horas y mirar Ajustes › Batería | Impacto en batería, aproximado | ➖ No medido: la prueba duró ~40 min con el teléfono cargando. Queda para HdU08 |

Registro de apoyo, con el teléfono conectado:

```bash
adb logcat -s STOPBET_BLOCK
```

Muestra `BLOQUEADO <dominio>` por cada consulta cortada y `onRevoke` al apagar desde Ajustes.

**Criterio de cierre:** el video muestra los ≥ 20 dominios bloqueados y la navegación intacta
(filas 1-3), y las filas 4, 6 y 7 —las que pide el CA2— quedan documentadas **aunque el resultado
sea negativo**. Anotar modelo del teléfono, versión de Android, versión de Chrome y red usada.

**Equipo de la prueba:** Xiaomi 2412DPC0AG, Android 16, Chrome 154.0.8037.126. Red: datos móviles
de Claro y wifi residencial (el teléfono pasó de una a otra durante la prueba). Build de desarrollo
de `main` del 07-10. Evidencia: `docs/planning/evidencia-spike2.md`.

**Hallazgos que no estaban en el plan:**

1. **Bug con wifi y datos a la vez (arreglado).** El servicio reenviaba al DNS de la primera red
   que listaba Android —la de datos de Claro— mientras el paquete salía por el wifi, donde ese DNS
   no contesta. Con las dos redes encendidas, que es lo normal en un teléfono, **no resolvía nada**
   (802 timeouts en el registro). Ahora elige la red como lo hace el sistema (validada, y wifi
   antes que datos) y envía la consulta por esa misma red (`Network.bindSocket`). Rama
   `fix/HU-08-dns-red-activa`.
2. **Chrome recuerda las direcciones del DNS seguro.** Después de la prueba 6, `pokerstars.com`
   seguía cargando con la opción por defecto y tras reiniciar, aunque el sistema lo daba por
   inexistente (`ping: unknown host`) y StopBet lo bloqueó 73 veces. Chrome guarda en disco lo que
   resolvió y lo reutiliza.
3. **Cada operador bloquea distinto.** `bwin.com` carga en el wifi y está cortado en Claro.
4. **Xiaomi retira el consentimiento** al apagar la VPN desde Ajustes, y avisa del arranque con
   ~2 minutos de demora.

### Paso 4 — CA4: confirmar la decisión ✅

Ver §7.

### Paso 5 — Cierre ✅

- Documento de evidencia en el formato de `docs/planning/evidencia-spike-sprint1.md`: criterio
  por criterio, qué es y cómo demostrarlo, con el enlace al video.
- **`CLAUDE.md`**: la sección de Mobile dice "Módulo nativo VPNService en `android/`". Con este PR
  pasa a ser cierta, pero hay que aclarar que es un PoC detrás de `__DEV__`.
- **Entrada en `docs/avisos-al-equipo.md`**: el PR toca el manifiesto, agrega un TurboModule con
  codegen y registra un paquete en `MainApplication.kt` → **hay que recompilar el nativo**
  (`pnpm run android:device`); un bundle JS nuevo sobre un APK viejo muestra *Bloqueo no
  disponible*.
- PR a `main` con al menos un reviewer (idealmente Matías Barraza o Alex, los con más Android).

---

## 7. Alcance (CA4) — decidido el 07-10-2026 con los resultados del CA2

| Pregunta | Decisión | Por qué | Resultado del CA2 que la respalda |
|---|---|---|---|
| **¿Carga manual (HdU15) o automática (HdU18)?** | **HdU15 dentro del MVP**, pero como lista **servida por el backend** (`GET /blocking/domains` con versión), no como lista fija en el APK. Arranca con la nómina de Subtel + un corte de HaGeZi, y el equipo agrega dominios a mano. **HdU18 queda como mejora futura**: un proceso que baje HaGeZi y Subtel solo | Una lista dentro del APK solo cambia publicando otra versión en Play. Servida por el backend, la carga manual ya llega a todos los teléfonos sin reinstalar, y HdU18 es solo automatizar quién la llena. Subtel advierte que la nómina seguirá creciendo con espejos | Fila 2: el filtro por lista bloqueó 20 de 20. Fila 5: cada operador bloquea listas distintas, así que no basta con lo que corta el ISP |
| **¿Bloqueo de aplicaciones (HdU08)?** | **Fuera del alcance** impedir que una app **se abra**. **Dentro, como efecto**, que una app de apuestas **no conecte** si usa dominios de la lista | Impedir abrir apps exige `AccessibilityService` o Device Owner, los dos descartados en el CA1. El filtro DNS corta la conexión de la app igual que la del navegador | _No verificado en el teléfono_: no hay apps de apuestas instalables desde Play en Chile para probarlo. Queda como prueba de HdU08 |
| **¿Qué se le promete al paciente?** | Una **barrera contra el impulso** que puede apagar, no un candado. Si la apaga, queda registrado solo si lo consintió | Es lo que la tecnología permite sin Device Owner (§1.3) | Fila 4: se apaga en dos toques. Fila 6: el DNS seguro de Chrome con un proveedor se lo salta. Las dos exigen una acción deliberada del paciente |
| **¿Método A o B?** | **Se mantiene A (solo DNS).** El escape del DNS seguro de Chrome queda como límite conocido | El método B tampoco lo resuelve sin descifrar HTTPS: tendría que bloquear las direcciones de los proveedores de DNS cifrado, una lista que cambia, a cambio de ver todo el tráfico del paciente | Fila 6 |
| **¿Se bloquean `polla.cl` y `loteria.cl`?** | Pregunta para AJUTER → `docs/ASUNCIONES-PENDIENTES.md` | Es juego legal en Chile; HaGeZi y Blocklist Project ya lo bloquean | — |
| **¿Se avisa al psicólogo cuando se apaga?** | Pregunta para AJUTER → `docs/ASUNCIONES-PENDIENTES.md` | Consentimiento clínico y regla de Play (§2.6, §4.2) | — |

### Versión de producción (29-09-2026)

Construida en la misma rama sobre el PoC, siguiendo esta propuesta:

| Pieza | Dónde |
|---|---|
| Invitación en Inicio = aviso destacado de Play (Activar / Ahora no; "Reactivar" si se apagó desde Ajustes) | `components/BlockingInviteCard.tsx` |
| Estado en Perfil, **sin interruptor**; botón a Ajustes › VPN | `components/BlockingProfileSection.tsx` |
| Reanudar al abrir la app si el sistema lo mató, nunca si el paciente lo apagó | `hooks/useBlocking.ts` → `useBlockingAutoStart()` en `App.tsx` |
| Reanudar tras reiniciar el teléfono | `blocking/BootReceiver.kt` |
| Conservar el módulo frente a R8 en release | `proguard-rules.pro` |

APK de release compilado el 29-09 (41 MB, apunta a Railway). **Sin cambios en el backend**: no se
envía ningún evento al psicólogo, y el texto del aviso lo dice. **Probado el 07-10 en el Xiaomi**:
activar desde Inicio, apagar desde Ajustes y ver *Reactivar*, y reiniciar el teléfono (filas 1, 4 y 8).

### Riesgo que queda

El DNS seguro de Chrome con un proveedor elegido (fila 6). Se acepta como límite conocido: exige
que el paciente cambie un ajuste a propósito, y el resto del teléfono sigue filtrado. Para HdU08
queda por probar bloquear los nombres de los proveedores de DNS cifrado (`dns.google`,
`cloudflare-dns.com`, `chrome.cloudflare-dns.com`), sabiendo que Chrome puede conocer sus
direcciones sin preguntarlas.
