# Evidencia del SPIKE 2 — Bloqueo de sitios de apuestas en Android (CA1-CA4)

**Objetivo de este documento:** demostrar, criterio por criterio, que los cuatro criterios del
SPIKE 2 que corresponden al bloqueo (ver `docs/Sprint 2.md`, SPIKE 2) están cumplidos. Para cada
uno: qué es, quién lo hizo y **cómo demostrarlo**. El análisis completo está en
[`spike2-bloqueo-android.md`](spike2-bloqueo-android.md); acá va solo la prueba.

**Dueño:** Eduardo Pacheco. **Fecha de la prueba en dispositivo:** 07-10-2026.

> CA5-CA6 (pasarela de pago) son de Matías Lara y CA7 (manual de usuario) de Catalina Yáñez:
> no están en este documento.

## Preparación

Para repetir la prueba del CA2 en un teléfono Android con depuración USB:

```bash
pnpm install
pnpm run seed           # cuenta demo@stopbet.cl, clave Stopbet2026!
pnpm run backend
pnpm run android:device # compila el nativo, instala y abre la app
adb logcat -s STOPBET_BLOCK   # registro de cada dominio bloqueado
```

---

## CA1 — ≥3 mecanismos de bloqueo comparados, con descartes justificados ✅

**Qué es:** matriz de los tres mecanismos que pide el criterio —`VpnService` solo DNS,
`VpnService` con todo el tráfico y DNS privado con filtrado externo— en las cinco dimensiones que
pide: permisos, si el paciente puede desactivarlo, privacidad de sus datos, política de Google
Play y limitaciones. Device Owner y `AccessibilityService` quedan como descartes justificados.

**Cómo demostrarlo:** entregable de documento. Las limitaciones que dependían de la prueba en el
teléfono (DNS cifrado, reinicio) quedaron medidas en el CA2 y no estimadas.

📄 [`spike2-bloqueo-android.md` §2.0](spike2-bloqueo-android.md) (matriz) y §2.4-§2.5 (descartes)

---

## CA2 — Prueba de factibilidad en un Android físico, con video ✅

**Qué es:** el APK de StopBet con el módulo nativo `VpnService` solo DNS (`apps/mobile/android/.../com/stopbet/blocking/`),
corrido en un teléfono real.

| | |
|---|---|
| **Teléfono** | Xiaomi 2412DPC0AG, Android 16 |
| **Navegador** | Chrome 154.0.8037.126 |
| **Red** | Datos móviles de Claro y wifi residencial |
| **Build** | Desarrollo, `main` del 07-10-2026 |
| **Video** | 14 clips de pantalla del teléfono (~25 min). Enlace: **_pendiente de subir_** |
| **Registro** | `registro-stopbet.txt`: 1.140 consultas bloqueadas, 26 dominios distintos, con hora |

### Lo que pide el criterio

| Exigencia del CA2 | Resultado | Dónde verlo |
|---|---|---|
| **Bloquea ≥ 20 dominios de apuestas** | ✅ **20 de 20** (12 internacionales de control + 8 de la nómina de Subtel). Chrome muestra `DNS_PROBE_FINISHED_NXDOMAIN` en todos y el registro tiene `BLOQUEADO <dominio>` para cada uno, entre 11:30:23 y 11:33:31. Perfil marca 509 consultas bloqueadas | Clips 01-02; capturas `p2_*.png` y `p3b_contador.png` |
| **La navegación normal sigue funcionando** | ✅ BancoEstado, SII, Google y Wikipedia cargan con la protección activa | Clip 02; capturas `p3_*.png` |
| **Comportamiento al desactivar la VPN** | ✅ Se apaga en dos toques desde Ajustes. La app se entera al instante (`onRevoke` 11:37:09): Perfil muestra la hora y Inicio ofrece *Reactivar*. Sin VPN, **7 dominios de control vuelven a cargar** (pokerstars, 888casino, unibet, williamhill, draftkings, betmgm, skybet). Los de Subtel siguen cortados, pero **por Claro**, no por StopBet | Clips 03-04; capturas `p4_*.png` |
| **Comportamiento con el DNS seguro de Chrome** | ❌ **Lo salta** con un proveedor elegido (Google): cargan los de control y también `stake.com` y `1xbet.com`, que el operador sí corta. Con la opción por defecto (*Usa tu proveedor de servicios actual*) el bloqueo funciona: es la configuración con la que pasaron los 20 de 20. Es un resultado válido del spike y quedó como límite conocido en el CA4 | Clips 05-07; capturas `p5_*.png` |

### Pruebas adicionales

| Prueba | Resultado |
|---|---|
| DNS privado estricto de Android (`dns.google`) | No salta el bloqueo: **rompe la resolución de todo** (`ERR_NAME_NOT_RESOLVED` también en Emol y YouTube). La app lo detecta y lo avisa en Perfil. Clips 07-09; capturas `p7_*.png` |
| Reiniciar el teléfono sin abrir la app | Vuelve solo (`BootReceiver`, 12:07:38), ~2 min después de encender porque Xiaomi avisa tarde del arranque. Clip 20; capturas `p8_*.png` |
| Reactivar tras apagarlo desde Ajustes | En Xiaomi vuelve a pedir el permiso: apagarla retiró el consentimiento. Clip 05 |

### Bug encontrado y arreglado durante la prueba

Con **wifi y datos encendidos a la vez**, el servicio reenviaba las consultas al DNS de Claro
mientras el paquete salía por el wifi, y no resolvía nada (802 timeouts, clips 10-11). Se arregló
eligiendo la red como lo hace el sistema y enviando la consulta por esa misma red; verificado en
el mismo teléfono (clip 12: Emol y YouTube cargan, cero timeouts). Rama `fix/HU-08-dns-red-activa`.

### Índice del video

| Clip | Hora (aprox.) | Qué muestra |
|---|---|---|
| 01 | 11:29-11:32 | Prueba 2: dominios 1-13 bloqueados |
| 02 | 11:32-11:35 | Prueba 2: dominios 14-20; prueba 3: sitios normales |
| 03 | 11:35-11:38 | Contador en Perfil; apagado desde Ajustes y aviso en la app |
| 04 | 11:38-11:41 | Sin VPN: los de control cargan, los de Subtel los corta Claro |
| 05 | 11:41-11:44 | *Reactivar* desde Inicio, diálogo del sistema, bloqueo de vuelta |
| 06-07 | 11:44-11:50 | DNS seguro de Chrome con Google: los sitios cargan; vuelta a la opción por defecto |
| 08-10 | 11:50-11:58 | DNS privado estricto de Android |
| 11 | 11:58-12:01 | Bug de wifi + datos: nada resuelve |
| 12 | 12:01-12:03 | Arreglo instalado: la navegación vuelve |
| 20 | 12:08-12:11 | Tras reiniciar: bloqueo activo sin abrir la app |

---

## CA3 — ≥3 fuentes externas evaluadas ✅

**Qué es:** StevenBlack, The Blocklist Project y HaGeZi, más la nómina oficial de Subtel,
comparadas en licencia, frecuencia de actualización, cobertura de los sitios que operan en Chile y
falsos positivos. La cobertura está **medida** contra los 42 dominios de Subtel: 24 %, 86 % y 93 %.

**Cómo demostrarlo:** la medición es reproducible.

```bash
curl -L -o stevenblack.txt      https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling-only/hosts
curl -L -o blocklistproject.txt https://raw.githubusercontent.com/blocklistproject/Lists/master/gambling.txt
curl -L -o hagezi.txt           https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/gambling.txt
node scripts/spike2-cobertura-listas.mjs .
```

📄 [`spike2-bloqueo-android.md` §3.3-§3.4](spike2-bloqueo-android.md)

---

## CA4 — Alcance definido a partir de la prueba ✅

**Qué es:** las decisiones, cada una apoyada en un resultado del CA2:

| Decisión | Resultado del CA2 que la respalda |
|---|---|
| **Carga manual (HdU15) dentro del MVP**, servida por el backend; **actualización automática (HdU18) para después** | 20 de 20 bloqueados con lista propia; cada operador corta listas distintas, así que no basta con lo que bloquea el ISP |
| **Impedir abrir apps de apuestas: fuera**. Que no conecten: dentro, como efecto del filtro | Lo primero exige `AccessibilityService` o Device Owner (descartados en el CA1). Lo segundo queda sin verificar en el teléfono: no hay apps de apuestas instalables desde Play en Chile |
| **Se mantiene el método A (solo DNS)**; el DNS seguro de Chrome con proveedor queda como límite conocido | El escape exige cambiar un ajuste a propósito, y el método B tampoco lo resuelve sin descifrar HTTPS |
| **Lo que se promete:** una barrera contra el impulso, no un candado | Se apaga en dos toques y la app solo se entera después |

📄 [`spike2-bloqueo-android.md` §7](spike2-bloqueo-android.md)

Quedan para AJUTER, sin bloquear el cierre: si se bloquean `polla.cl` y `loteria.cl`, y si se
avisa al psicólogo cuando el paciente apaga la protección.

---

## Resumen

| CA | Estado | Evidencia |
|---|---|---|
| CA1 | ✅ | Matriz §2.0 |
| CA2 | ✅ | Video (14 clips), 84 capturas, registro con hora |
| CA3 | ✅ | §3.3 + script reproducible |
| CA4 | ✅ | §7, decidido con los resultados del CA2 |
