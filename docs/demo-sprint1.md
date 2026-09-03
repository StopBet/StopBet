# Runbook — revisión en vivo del Sprint 1

Guía para poblar la base de datos antes de la revisión de los 46 criterios de aceptación de
[`SPRINT1.md`](planning/SPRINT1.md) §4, y para recorrerlos en el orden que menos tiempo pierde
cambiando de cuenta.

`pnpm run seed` y `pnpm run seed:family` cubren la mayoría de las historias. `pnpm run
seed:demo` (`apps/backend/src/demo.seed.ts`) agrega lo que esos dos no pueblan nunca —
psicólogos con varias sedes, pacientes asignados, solicitudes pendientes, notificaciones,
suscripciones/facturas — y refresca lo que caduca cada 24 h (alertas de pánico "de hoy").

## 1. Poblar la base

Los tres seeds son idempotentes: correrlos de nuevo no duplica nada.

```bash
pnpm run seed
pnpm run seed:family
pnpm run seed:demo -- --reset
```

Si el comando de la raíz no reenvía los flags correctamente, corre el tercero directo desde
`apps/backend`:

```bash
cd apps/backend
pnpm run seed:demo -- --reset
```

**`--reset`** deja repetibles los pasos que la propia demo ensucia: check-in de hoy de Carlos,
alerta de pánico colgada, insignia ya compartida, reportes propios, comunidad silenciada.
Sin la bandera esos datos no se tocan. **Corre el seed con `--reset` la misma mañana de la
demo** — las alertas "de hoy" y el check-in del día caducan cada 24 h.

**`--sin-padrino`** desactiva el padrino de Carlos, necesario para demostrar CA 1.2 (sin
padrino → directo a la IA). Después de usarla, vuelve a correr el seed sin la bandera (o con
`--reset`) para reactivarlo antes de demostrar CA 1.1 y CA 1.3.

### Contra Railway (producción)

En `apps/backend/.env`, apunta `DATABASE_URL` al valor **público** del Postgres de Railway
(no el `.railway.internal`) y usa la **misma `ENCRYPTION_KEY`** que tiene el servicio — si no
coincide, los RUT quedan cifrados con una clave que el backend no puede descifrar. Detalle
completo en [`README.md`](../README.md) → "Poblar la base de datos de producción". Con eso
puesto, los mismos tres comandos de arriba pueblan Railway.

### Contra la base local

`apps/backend/.env` con `DATABASE_URL=postgresql://postgres:password@localhost:5432/stopbet`
(la de `CLAUDE.md`). Arranca el backend una vez antes del primer seed (`pnpm run backend`) para
que `SedesService` cree las 4 sedes; si ya las creó antes, no hace falta repetirlo.

### Por qué corre contra las dos

El dashboard web se prueba contra Railway (`stopbet-lemon.vercel.app` o localhost apuntando a
Railway). El **móvil en build debug** (`__DEV__`) va fijo a `localhost:3000`
(`apps/mobile/src/services/api.ts`) — solo un **APK release** pega a Railway. Si la demo usa
el celular con el build de desarrollo, hay que:

1. Backend local corriendo (`pnpm run backend`) con la base local poblada.
2. `adb reverse --list` — si sale vacío, restaurar los túneles (ver `CLAUDE.md`, sección de
   `adb reverse`, es la causa número uno de "no pasa nada" en el celular).

## 2. Cuentas de la demo

Clave de **todas** las cuentas: `Stopbet2026!`.

| Cuenta | Rol | Para qué |
|---|---|---|
| `sofia.reyes@ajuter.cl` | coordinator | HdU24 completo (crear/desactivar psicólogo, sedes), 403 de rol (S.5) |
| `miguel.lara@ajuter.cl` | psychologist | Overview/Alertas/Solicitudes/Equipo — 2 sedes, 3 pacientes. Es el único rol que puede moderar comunidad (`community.service.ts` exige `psychologist` estricto, un coordinador recibe 403) |
| `valentina.rojas@ajuter.cl` | psychologist | Equipo — 1 sede, 2 pacientes (Roberto, Jorge) |
| `tomas.herrera@ajuter.cl` | psychologist | Equipo — Viña del Mar, 1 paciente (Lucía) |
| `camila.soto@ajuter.cl` | psychologist | Equipo — cuenta **suspendida**, para mostrar ese estado |
| `demo@stopbet.cl` (Carlos) | patient (móvil) | Pánico, check-in, comunidad, asistente, insignias |
| `pedro.alvarez@stopbet.cl`, `ana.perez@stopbet.cl`, `roberto.fuentes@stopbet.cl`, `jorge.morales@stopbet.cl`, `lucia.vega@stopbet.cl` | patient | Material de Overview/métricas — ver tabla de abajo |
| `patricia.gomez@stopbet.cl` | family | Portal familiar con sesiones (CA 11.1–11.4) |
| `rodrigo.munoz@stopbet.cl` | family | "Pendiente de vinculación" (CA 11.6) |
| `elena.vidal@stopbet.cl` | family | "No hay sesiones programadas" (CA 11.5) |

### Qué paciente usar para cada cosa (HdU04)

| Paciente | Qué muestra |
|---|---|
| **Roberto Fuentes** | **Cero check-ins** → estado vacío en su ficha, no una curva inventada (**CA 4.3**). Tiene una alerta de pánico de hoy (escalada) |
| **Ana Pérez** | 28 check-ins en mejora, 93 días de racha, alerta de hoy (respondida) — evolución completa (**CA 4.4**) |
| **Pedro Álvarez** | Check-ins irregulares con huecos |
| **Jorge Morales** | Check-ins en deterioro, alerta de hoy (escalada), asignado a Valentina |
| **Lucía Vega** | Check-ins estables, **cuenta suspendida por mora** — usar solo desde el móvil (`SuspendedAccountScreen`, factura vencida $30.000). **No sirve para el dashboard**: `/auth/login` la rechaza con 403 ("cuenta suspendida") |

## 3. Orden sugerido de la demo

Sigue el mismo recorrido de `SPRINT1.md` §9 ("Verificación" → "Integración"), que es el que
cubre más criterios en menos pasos.

1. **Login web con contraseña incorrecta → falla** (auth real, S.4/S.5).
2. **Miguel → Overview**: "Alertas hoy" > 0 (las 3 de hoy), pacientes con mini-gráfico, abrir
   la ficha de **Roberto** → estado vacío (**4.3**). Buscar por nombre (**4.2**).
3. **Alertas**: las 3 alertas de hoy con sus 3 estados. *(No hay ninguna alerta sintética en
   `pending`: el backend la escala sola a los 120 s — ver nota abajo. Para el panel "Requieren
   atención" hay que disparar una alerta real desde el celular, paso 7.)*
4. **Solicitudes**: 3 pendientes (Fernanda, Diego en Santiago; Camila en Viña). Aprobar una →
   el modal ofrece psicólogo de esa sede (**6.1**). Sección de posts reportados abajo: 2 casos
   (**5.3** vía Miguel, requiere rol `psychologist`, no `coordinator`).
5. **Cambiar a Sofía (coordinator) → Equipo**: Miguel con 2 sedes y 3 pacientes. Intentar
   desactivarlo → pide reasignar por sede (**24.3**). Quitarle Viña del Mar → pide reasignar a
   Ana (**24.5**). Crear un psicólogo nuevo (**24.1**, correo puede caer a mostrar clave en
   pantalla si no hay `BREVO_API_KEY`). Repetir con Camila para el correo duplicado (**24.2**).
6. **Sesiones de familiares** (Miguel): lista con confirmaciones. Login como **Patricia** en
   el portal familiar → confirma asistencia, se refleja en el dashboard (**11.1–11.4**).
   **Rodrigo** → pendiente de vinculación (**11.6**). **Elena** → sin sesiones próximas
   (**11.5**).
7. **Móvil — Carlos**: check-in del día (**7.1**, `--reset` lo deja sin hacer), comunidad con
   post propio para borrar (**5.4**) y para que otro reaccione/responda en vivo (**5.5**),
   insignia de 45 días para compartir (**5.2**), reportar uno de los posts limpios de Jorge o
   Lucía (**5.3**), silenciar notificaciones desde el perfil (**5.6**). Pánico: con padrino
   activo → responde/escala a los 120 s (**1.1, 1.3**); correr
   `pnpm run seed:demo -- --sin-padrino` y repetir → directo a la IA (**1.2**). Asistente:
   mensaje de riesgo alto → tarjeta de crisis (**2.1**), saludo normal → sin protocolo
   (**2.2**).
8. **Móvil — Lucía**: `SuspendedAccountScreen` con la factura vencida, pagar → reactiva.

## 4. Por qué no hay ninguna alerta sembrada en `pending`

`panic.service.ts` corre un `@Cron` cada 10 s que escala **cualquier** alerta `pending` con
más de 120 s desde su creación (CA 1.3), sin mirar si tiene padrino. Con el backend de Railway
corriendo siempre, una alerta sembrada en `pending` se ve `escalated` segundos después de que
el seed termina — verificado en local. Por eso las 3 alertas de hoy se siembran ya resueltas
(2 `escalated`, 1 `responded`). El estado `pending` real —y el panel "Requieren atención" de
Alertas— solo se puede mostrar con el botón de pánico en vivo desde el celular (paso 7 de
arriba); dura hasta 120 s antes de escalar solo, tiempo de sobra para mostrarlo en pantalla.

## 5. Lo que el seed no puede arreglar

1. **Hay que cambiar de cuenta.** 24.1/24.3/24.4/24.5 exigen rol `coordinator` (Sofía).
   Moderar comunidad desde el dashboard (5.3, 5.4) exige rol `psychologist` **estricto**:
   `community.service.ts` rechaza a un coordinador con 403 — usar a Miguel, no a Sofía.
2. **`FinanzasPage` y `ConfiguracionPage` son 100% mock/estáticas.** Se ven igual con la base
   llena o vacía. No prometerlas como conectadas a la API.
3. **La pestaña "Sesiones IA" del drawer de paciente en Overview está hardcodeada a `[]`**
   (`OverviewPage.tsx`): dice "Sin sesiones IA registradas" aunque Carlos sí tenga 3 sesiones
   guardadas. No es falta de datos, es que esa pestaña no llama al endpoint.
4. **`GEMINI_API_KEY` tiene que estar viva en Railway** para S.1/S.2 y 2.1/2.2; sin ella el
   asistente cae siempre al mensaje de respaldo (igual demuestra S.8).
5. **`CORS_ORIGIN` de Railway** debe incluir el dominio de Vercel usado en la demo.
6. **`ENCRYPTION_KEY` local debe ser igual a la de Railway** al poblar producción, o los RUT
   quedan cifrados con una clave que el backend no puede descifrar.

## 6. Qué agrega `seed:demo` (referencia rápida)

| Bloque | Qué crea |
|---|---|
| Sedes | Asegura las 4 (Santiago, Viña del Mar, Concepción, Online) si la tabla estaba vacía |
| `psychologist_sedes` | Miguel → Santiago + Viña; Valentina → Santiago; Tomás → Viña; Camila → Concepción |
| `patient_assignments` | Carlos, Pedro → Miguel (Santiago); Ana → Miguel (Viña); Roberto, Jorge → Valentina (Santiago); Lucía → Tomás (Viña). Se recalcula en cada corrida |
| `registration_requests` | 3 pendientes (Fernanda, Diego en Santiago; Camila en Viña), siempre forzadas a `pending` |
| `check_ins` | Ana (28d, mejora), Pedro (12d, irregular), Jorge (7d, deterioro), Lucía (21d, estable). Roberto sin ninguno, a propósito |
| `abstinence_periods` | Abre los que faltaban para Jorge (7d) y Lucía (21d) |
| `panic_alerts` | 3 "de hoy", siempre `escalated`/`responded` (nunca `pending`, ver §4). Se refrescan en cada corrida |
| `notifications` | 6 para Carlos, 2 para Pedro (solo la primera vez) |
| Comunidad | Post de Carlos (para 5.4/5.5 en vivo), anuncio con evento futuro + 3 confirmaciones, 2 posts limpios (para reportar en vivo), 1 post con 1 reporte (segundo caso de moderación) |
| `subscriptions`/`invoices` | Carlos y Pedro al día; Lucía suspendida con factura vencida |
