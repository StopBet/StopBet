# Sprint 1 — Planificación StopBet

**Fecha:** 17-08-2026
**Equipo:** GPI-2026-1 | Grupo 04 | Campus Casa Central
**Duración:** 2 semanas
**Modalidad:** 6 ramas en paralelo, todos trabajando al mismo tiempo

---

## Equipo

| Nombre | Rol | Rama del Sprint 1 |
|--------|-----|-------------------|
| José Meza Pontigo | Scrum Master | `feature/SPIKE-auth-seguridad-jose-meza` |
| Matías Lara Plaza | Tech Leader | `feature/HU-24-cuentas-matias-lara` |
| Eduardo Pacheco Brito | Testing | `feature/HU-04-metricas-eduardo-pacheco` |
| Alex Domínguez Montiel | Product Owner | `feature/HU-11-portal-familiar-alex-dominguez` |
| Catalina Yáñez Ardissoni | UI/UX | `feature/HU-05-comunidad-catalina-yanez` |
| Matías Barraza Huerta | Marketing | `feature/HU-01-crisis-checkin-matias-barraza` |

---

## Alcance del Sprint

| HdU | Nombre | SP | Criterios | Dueño |
|-----|--------|----|-----------|-------|
| HdU01 | Botón de Pánico | 3 | 3 | Matías Barraza |
| HdU02 | Asistente Virtual IA | 3 | 2 | Matías Barraza |
| HdU04 | Dashboard Clínico — Métricas | 5 | 4 | Eduardo Pacheco |
| HdU05 | Comunidad y Red de Apoyo | 8 * | 6 | Catalina Yáñez |
| HdU06 | Registro del Paciente | 3 | 4 | Matías Lara |
| HdU07 | Check-in Emocional Diario | 5 | 4 | Matías Barraza |
| HdU11 | Portal del Familiar | 8 | 6 | Alex Domínguez |
| HdU24 | Gestión de Cuentas de Psicólogo | 5 | 5 | Matías Lara |
| SPIKE 1 | Seguridad, Disponibilidad e IA | 21 | 12 | Repartido (ver §4) |

**Total: 61 SP · 46 criterios de aceptación, todos comprometidos.**

> **Evidencia de cierre del SPIKE 1:** [`evidencia-spike-sprint1.md`](evidencia-spike-sprint1.md) — los 12 criterios (S.1 a S.12), con descripción breve y cómo demostrar cada uno (comando o video).

\* HdU05 llegó sin estimar en el documento de HdU. Se propone **8 SP** según el trabajo restante en el código.

### Nota de capacidad

En el Sprint 0 el equipo definió **1 SP = 6 hrs**. Con 6 personas × 6 hrs/semana × 2 semanas
= **72 hrs de equipo**, la capacidad equivale a ~12 SP con esa conversión.

El equipo decidió mantener el alcance completo de 61 SP. Se deja constancia del dato para la
retrospectiva: **registrar SP comprometidos vs. completados** y usar ese número como
velocidad real para planificar el Sprint 2.

---

## 1. Correcciones al documento de HdU

Resolver en la reunión de planificación, antes de escribir código.

| # | Problema | Resolución |
|---|---|---|
| 1 | **HdU01 se contradice**: la descripción dice "3 minutos", el criterio dice "2 minutos" | Vale el criterio: **120 segundos**. Corregir la descripción. El código tiene un tercer valor: mobile cuenta 30 s (`PanicScreen.tsx:31`, comentado `// demo`) y el backend escala a 3 min (`panic.service.ts:147-155`). Alinear los tres. |
| 2 | **HdU05 sin Story Points** | Estimar en planning poker. Propuesta: **8 SP**. |
| 3 | **El rol `coordinator` de HdU24 no existe** | `UserRole` es `'patient' \| 'psychologist' \| 'sponsor' \| 'family'` (`packages/shared-types/src/index.ts:3`). Agregarlo es cambio de esquema: va en el PR de contrato del día 1. |
| 4 | **El SPIKE dice "los 4 roles del sistema"** | Con `coordinator` pasan a ser **5**. Corregir el criterio S.4. |
| 5 | **HdU11 menciona pagos sin criterio** | La descripción dice que el familiar "gestiona el pago de la mensualidad" pero ningún criterio lo cubre. Sacarlo de la descripción: el módulo `billing` no está conectado a nada. |
| 6 | **HdU02 tiene la estimación confusa** | Dice "13 → 8 SP … restan 3 SP" y luego "3 SP". Dejar solo **3 SP**. |

---

## 2. Estado real del código (punto de partida)

Antes de repartir se revisó el repositorio. Muchos criterios están a medio camino, no en cero:

- **El backend ya tiene casi todos los endpoints**: `panic`, `community`, `check-ins`,
  `ai-assistant`, `notifications`, `registration`.
- **No existe autenticación real.** `POST /users/login` (`users.service.ts:48-54`) recibe la
  contraseña y **la descarta**; todos los usuarios tienen `passwordHash: null`. En web la
  sesión son dos flags de localStorage falsificables (`App.tsx:6-7`). En mobile `isSignedIn`
  está hardcodeado en `true`.
- **No hay tests ni CI de backend/web.** Solo existe `.github/workflows/mobile-preview.yml`.
- **`apps/web` no tiene router.** La navegación es `useState` en `DashboardApp.tsx:58`.
- **Bug de corrección clínica:** `MoodChart.tsx:16-20` tiene un `defaultData = [3,4,4,3,4]`
  de respaldo, así que un paciente **sin ningún check-in** le muestra al psicólogo una curva
  de ánimo inventada.

---

## 3. Cómo trabajamos en paralelo

### Las 6 ramas arrancan el día 1, a la vez

```bash
git checkout main && git pull
git checkout -b <tu-rama-de-la-tabla-de-arriba>
```

### Las dos únicas dependencias reales

Ambas se mergean en los **primeros 2 días** para que nadie quede bloqueado.

**① PR de contrato — José, día 1.** Un PR chico, solo de interfaces, que se mergea antes que
cualquier otro:
- `'coordinator'` agregado a `UserRole` en `packages/shared-types/src/index.ts`
- `@Roles()`, `RolesGuard`, `JwtAuthGuard` (esqueleto funcional)
- Shape de la respuesta de login: `{ accessToken, refreshToken, user }`

**② PR de router — Eduardo, día 2.** Instala `react-router` y migra `DashboardApp.tsx`.
Desbloquea la parte web de Alex (HdU11).

**Mientras esos dos PRs se mergean, todos tienen trabajo que no depende de nada:** Matías
Lara con el modelo de datos y el validador de RUT, Alex con el backend de sesiones de
familiares, Catalina con el backend de comunidad, Matías Barraza con FCM y la cola offline,
Eduardo con el bug de MoodChart y el endpoint de métricas.

---

## 4. Matriz de responsabilidad — los 46 criterios

**Cada criterio tiene un único dueño.** Si algo no está en esta tabla, no está en el sprint.

**Los 12 criterios `S.*` del SPIKE tienen su evidencia de cierre en
[`evidencia-spike-sprint1.md`](evidencia-spike-sprint1.md).**

| ID | Criterio (resumido) | Dueño |
|----|---------------------|-------|
| **1.1** | Padrino confirma → el paciente ve quién respondió | Matías Barraza |
| **1.2** | Sin padrino / padrino inactivo → conecta directo con la IA | Matías Barraza |
| **1.3** | Padrino no responde en 2 min → escala automáticamente a la IA | Matías Barraza |
| **2.1** | Riesgo alto sostenido → sugiere pánico / padrino / `*4141` | Matías Barraza |
| **2.2** | Mensaje sin crisis → tono empático, sin activar protocolo | Matías Barraza |
| **4.1** | Alerta de pánico visible en tiempo real, sin recargar | Eduardo Pacheco |
| **4.2** | Buscar paciente por nombre filtra la lista | Eduardo Pacheco |
| **4.3** | Paciente sin check-ins → estado vacío, no gráfico en blanco ni error | Eduardo Pacheco |
| **4.4** | Perfil: evolución 30 días + total check-ins + alertas del periodo | Eduardo Pacheco |
| **5.1** | Alerta de pánico a la comunidad → responder con mensaje de apoyo | Catalina Yáñez |
| **5.2** | Nueva insignia compartida → anuncio automático en el foro | Catalina Yáñez |
| **5.3** | Reportar mensaje → registra, suma al conteo y lo oculta al denunciante | Catalina Yáñez |
| **5.4** | Eliminar publicación propia → deja de ser visible | Catalina Yáñez |
| **5.5** | Responden/reaccionan a mi post → notificación de la interacción | Catalina Yáñez |
| **5.6** | Silenciar notificaciones de comunidad desde el perfil | Catalina Yáñez |
| **6.1** | Registro con sede activa → cuenta "pendiente" + pantalla de confirmación | Matías Lara |
| **6.2** | Correo existente → "Ya existe una cuenta con este correo electrónico" | Matías Lara |
| **6.3** | Campo obligatorio vacío → bloquea avance, resalta, no pierde datos | Matías Lara |
| **6.4** | Formato inválido de RUT/correo → error específico, no pierde datos | Matías Lara |
| **7.1** | Selecciona emoción y confirma → guarda + confirmación visual | Matías Barraza |
| **7.2** | Ya registró hoy → rechaza mostrando el que había elegido | Matías Barraza |
| **7.3** | Sin internet → avisa y permite reintentar al recuperar conexión | Matías Barraza |
| **7.4** | Sin check-in pasadas las 20:00 → notificación push | Matías Barraza |
| **11.1** | Vista "Sesiones": solo las de su sede, por fecha más próxima | Alex Domínguez |
| **11.2** | Login de familiar en <3 s → vista principal | Alex Domínguez |
| **11.3** | "Mis sesiones": calendario con nombre, fecha, hora, lugar y botón | Alex Domínguez |
| **11.4** | Confirmar asistencia <3 s → se refleja y el psicólogo la ve | Alex Domínguez |
| **11.5** | Sin sesiones en 4 semanas → "No hay sesiones programadas próximamente" | Alex Domínguez |
| **11.6** | Cuenta sin vincular → estado "pendiente de vinculación" | Alex Domínguez |
| **24.1** | Crear psicólogo con sedes → rol correcto + credenciales enviadas | Matías Lara |
| **24.2** | Correo ya registrado → rechaza la creación | Matías Lara |
| **24.3** | Desactivar psicólogo con pacientes → exige reasignarlos antes | Matías Lara |
| **24.4** | Psicólogo sin rol coordinador → bloqueado por permisos | Matías Lara |
| **24.5** | Agregar/quitar sede; si tiene pacientes ahí, pide reasignar | Matías Lara |
| **S.1** | Documento de reglas del asistente + 3 conversaciones de prueba | Eduardo Pacheco |
| **S.2** | Respuesta del asistente ≤5 s, medida | Eduardo Pacheco |
| **S.3** | Nombre y RUT excluidos de lo que se envía al LLM | Alex Domínguez |
| **S.4** | Matriz de permisos: endpoints por rol | José Meza |
| **S.5** | Rol sin permiso → 403 en ≥4 endpoints probados | José Meza |
| **S.6** | Datos clínicos cifrados en BD + todo sobre HTTPS | José Meza |
| **S.7** | Alerta automática al equipo si el backend deja de responder | José Meza |
| **S.8** | Si el asistente falla → mensaje de respaldo ≤5 s | Eduardo Pacheco |
| **S.9** | Límite de mensajes por usuario por minuto | José Meza |
| **S.10** | Pruebas automáticas: pánico / acceso por rol / respuesta del asistente | José (rol) · Catalina (pánico) · M. Barraza (asistente) |
| **S.11** | Cobertura ≥70% en `panic`, `ai-assistant`, `users` | José (`users`) · Catalina (`panic`) · M. Barraza (`ai-assistant`) |
| **S.12** | Los tests corren solos en push a `main` (CI) | José Meza |

**Carga:** José 8 · Matías Lara 9 · Eduardo 7 · Alex 7 · Catalina 7 · Matías Barraza 9

---

## 5. Detalle por integrante

### José Meza — Auth, seguridad y CI · ~11 SP
**Criterios: S.4, S.5, S.6, S.7, S.9, S.12 + tests de `users` (S.10, S.11)**
**Es el desbloqueante del sprint: su PR de contrato sale el día 1 y tiene prioridad de review.**

1. **PR de contrato (día 1, primero que todo)** — `'coordinator'` en `UserRole`; `@Roles()`,
   `RolesGuard`, `JwtAuthGuard`; shape de la respuesta de login.
2. **Módulo `auth` real** — habilitante de 11.2 y 24.4:
   - `POST /auth/login` verificando `passwordHash` con bcrypt. Hoy `users.service.ts:48-54`
     **descarta la contraseña**: quien sepa el correo de un psicólogo entra al dashboard.
   - JWT access 15 min / refresh 7 días con rotación en cada uso.
   - `pnpm run seed` debe generar `passwordHash` reales (hoy todos son `null`).
   - Reemplazar el header `x-user-id` por `Authorization: Bearer` en los tres clientes.
   - Eliminar el bypass de `App.tsx:6-7`: hoy basta `localStorage.setItem('sb-dashboard-auth','1')`.
3. **S.4** — Matriz de permisos: documento con los **5 roles** × endpoints.
4. **S.5** — 403 comprobado en ≥4 endpoints con un rol sin permiso, con test que lo demuestre.
5. **S.6** — Cifrado en reposo del RUT + HTTPS en todas las conexiones.
6. **S.9** — Rate limiting con `@nestjs/throttler`.
7. **S.7** — Healthcheck + alerta automática al equipo cuando el backend cae.
8. **S.12** — Jest, `pnpm test` en la raíz, `.github/workflows/backend-ci.yml` en push a
   `main` y en cada PR, reporte de cobertura.

---

### Matías Lara — Creación de cuentas · ~8 SP
**Criterios: 24.1, 24.2, 24.3, 24.4, 24.5, 6.1, 6.2, 6.3, 6.4**

Dueño de **todo lo que sea crear cuentas y validarlas**. HdU24 y HdU06 comparten la misma
regla de correo duplicado y el mismo validador de RUT: hacerlo una vez en `shared-types`.

1. **24.1** — Tabla M2M `psychologist_sedes` (hoy `User.sedeId` es un solo string) +
   endpoint que crea el psicólogo vinculado a esas sedes y entrega credenciales.
2. **24.2** — Correo ya registrado → 409, sin crear duplicado.
3. **24.3** — Desactivar cuenta **exigiendo reasignar los pacientes antes** de completar la baja.
4. **24.5** — Agregar/quitar sedes; si quita una donde tiene pacientes, pide reasignarlos.
5. **24.4** — `@Roles('coordinator')` → 403 para un psicólogo normal. *(Requiere el PR de contrato.)*
6. **UI web** — página nueva "Equipo". De paso: el dropdown de psicólogos de
   `mockData.ts:174` es un array hardcodeado y **el valor elegido nunca se envía al backend**.
7. **6.4** — Validador de **RUT módulo 11**. Hoy `RegisterStep1Screen.tsx:48` solo comprueba
   que no esté vacío. Va en `shared-types` y se usa también en 24.1.
8. **6.3** — Sede obligatoria y bloqueo de avance. Ojo al desorden actual: `address` está
   marcado como requerido pero **nunca se valida**, y el correo se valida pero **no está
   marcado como requerido**.
9. **6.2** — Mensaje exacto: *"Ya existe una cuenta con este correo electrónico"*. Hoy el 409
   se detecta con un `includes('409')` sobre el string del error y muestra otro texto.
10. **6.1** — Ya funciona. Verificar y dejar evidencia en el PR.

---

### Eduardo Pacheco — Métricas y tiempo real · ~8 SP
**Criterios: 4.1, 4.2, 4.3, 4.4, S.1, S.2, S.8**

1. **Router (día 2, prioridad — desbloquea a Alex)** — Instalar `react-router`, migrar la
   navegación por `useState` de `DashboardApp.tsx:58` a rutas reales, crear `/pacientes/:id`.
2. **4.3 — Arreglar primero, es un bug de corrección clínica.** `MoodChart.tsx:16-20` tiene
   `defaultData = [3,4,4,3,4]` de respaldo: **un paciente sin check-ins le muestra hoy al
   psicólogo una curva de ánimo inventada**. Eliminar el fallback y renderizar el estado vacío.
3. **4.4** — Perfil de métricas:
   - Backend: endpoint con evolución de 30 días, `totalCheckIns` y `panicCount` **del periodo**.
     Ya existe `GET /users/:id/progress` (`users.controller.ts:36`) que la web **nunca llama**.
   - Web: gráfico con **Recharts** (está en `package.json` y no se importa en ningún archivo;
     hoy el gráfico es un SVG hecho a mano). Hoy agrupa por semana ISO y dice "Últimas 4
     semanas", no 30 días; el total de check-ins no existe; el conteo de pánico es de siempre,
     no del periodo; y "Promedio de estado" es literalmente un guion (`moodAvg: '—'`).
4. **4.1** — Tiempo real: SSE en el backend + consumo en Alertas y Overview. Hoy
   `AlertasPage.tsx:66` no tiene ni `refetchInterval`: una alerta nueva no aparece hasta recargar.
5. **4.2** — La búsqueda ya funciona en `OverviewPage.tsx:356`. Verificar y dejar evidencia.
   **Ojo**: el buscador de `TopBar.tsx:43` es otro input distinto y está muerto.
6. **S.1** — Documento de reglas del asistente + 3 conversaciones de prueba. Base:
   `ai-assistant/prompts/ajuter-system.prompt.ts`. Coordinar con Matías Barraza, que
   implementa 2.1 y 2.2 contra este documento.
7. **S.2** — Medir e instrumentar la latencia del asistente (≤5 s).
8. **S.8** — Mensaje de respaldo ≤5 s si el asistente falla. El backend ya tiene un fallback
   genérico pero **el cliente no lo muestra como respuesta**: hoy un fallo lanza un `Alert`
   y deja la pantalla vacía e inutilizable.

---

### Alex Domínguez — Portal del familiar · ~10 SP
**Criterios: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, S.3**

La historia más grande y **100% greenfield**: `apps/web` no tiene ninguna ocurrencia de
`familiar` ni `family`. A favor: el rol `'family'` ya existe en el modelo de datos y
`community/entities/attendance-confirmation.entity.ts` ya está creado.

**Backend (arranca acá el día 1, no depende de nadie):**
1. Vínculo familiar ↔ paciente.
2. **11.1** — Sesiones grupales de familiares solo de la sede del paciente vinculado,
   ordenadas por fecha más próxima.
3. **11.4** — Confirmar o rechazar asistencia, respondiendo en <3 s.
4. **S.3** — Sanitización de PII antes de enviar al LLM: excluir nombre y RUT.

**Web (tras el router de Eduardo, día 2-3):**
5. **11.2** — Login de familiar en <3 s. Ojo: hoy el login web **rechaza a todo el que no
   sea psicólogo** (`users.service.ts:51`) — hay que abrirlo al rol `family`.
6. **11.3** — Vista "Mis sesiones": calendario con nombre, fecha, hora, lugar (o si es online)
   y botón de confirmar/rechazar.
7. **11.4 (segunda mitad)** — La confirmación se refleja en la tarjeta **y el psicólogo la ve
   desde el dashboard**.
8. **11.5** — Sin sesiones en 4 semanas → *"No hay sesiones programadas próximamente"*.
9. **11.6** — Cuenta sin vincular → estado "pendiente de vinculación".

---

### Catalina Yáñez — Comunidad · ~9 SP
**Criterios: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6 + tests de `panic` (S.10, S.11)**

La app ya tiene posts, respuestas, reacciones y reportes funcionando. Falta el resto.

1. **5.1 — El criterio clínico, empezar por acá.** Hoy está roto de punta a punta:
   `notifyCommunity` (`panic.service.ts:196-209`) **solo cambia un booleano** — no crea ningún
   post, nada que la comunidad pueda ver. El paciente en crisis navega a Comunidad con un
   borrador que **tiene que enviar él mismo**, y para el resto se ve como un mensaje cualquiera.
2. **5.4** — Eliminar publicación propia. El backend ya está listo
   (`DELETE /community/posts/:id`); falta `deletePost` en `apps/mobile/src/services/api.ts` y
   el menú "···", que hoy **solo ofrece reportar, incluso en tus propios posts**.
3. **5.3** — Reportar: el reporte ya se registra y suma al conteo; falta **ocultarlo de la
   vista de quien reportó**.
4. **5.5** — Notificación al autor cuando alguien responde o reacciona. El módulo
   `notifications` ya existe; hoy nada crea ni lee estas notificaciones. Nota:
   `CommunityScreen` carga una sola vez, así que el feed queda viejo — agregar refresco.
5. **5.2** — Publicación **automática** del anuncio al obtener una insignia. Hoy solo marca
   `sharedToCommunity = true` y navega con un borrador manual.
6. **5.6** — Silenciar notificaciones desde el perfil, con reactivación. No existe nada.
7. **S.10 + S.11** — Tests del módulo `panic`, hasta ≥70% de cobertura.

---

### Matías Barraza — Línea de crisis y check-in · ~11 SP
**Criterios: 1.1, 1.2, 1.3, 2.1, 2.2, 7.1, 7.2, 7.3, 7.4 + tests de `ai-assistant`**

Dueño de **la línea de crisis completa**: pánico → escalamiento → asistente, más el check-in.
HdU01 y HdU02 van juntas porque ambas terminan en el asistente.

1. **1.2** — Sin padrino o padrino inactivo → conectar **directo con la IA**. Hoy
   `panic.service.ts:103` lanza un 404 y la pantalla **se queda muda**: el botón sigue
   habilitado, no pasa nada y no se muestra ningún mensaje.
2. **1.3** — Escalamiento automático a los **120 s**. Hoy hay tres valores distintos.
3. **1.1** — Ya funciona. Verificar y dejar evidencia.
4. **2.1** — Riesgo alto → sugerir pánico, padrino o `*4141`. Hoy el `riskLevel` se calcula
   **solo al cerrar la sesión** (`ai-assistant.service.ts:277`) y **nunca llega al cliente**.
   Hay que exponerlo por mensaje y renderizar la tarjeta de crisis en `AssistantScreen`.
5. **2.2** — Un saludo o pregunta general **no** debe disparar el protocolo. Validar contra
   el documento de reglas de Eduardo (S.1).
6. **7.4 — Lo más pesado: FCM desde cero.** No hay `@react-native-firebase/*` en
   `package.json`. Sí existe la mitad nativa: `google-services.json` y el plugin de Gradle.
   - Instalar `@react-native-firebase/app` + `messaging`, permiso Android 13+, registrar token.
   - Backend: `@nestjs/schedule` que a las 20:00 notifica a quien no registró su check-in.
7. **7.3** — Cola offline. Hoy si no hay conexión **el ánimo se pierde**; `AsyncStorage` ni
   siquiera es dependencia.
8. **Bug de zona horaria** — El día se calcula en UTC. Para Chile el "día" del check-in
   **cambia a las 20:00 o 21:00 hora local**, justo cuando llega el recordatorio de 7.4.
9. **7.1 y 7.2** — Ya funcionan. Verificar. Extra: `HomeScreen` muestra 4 notificaciones mock
   hardcodeadas cuando el backend devuelve lista vacía.
10. **S.10 + S.11** — Tests de `ai-assistant`, hasta ≥70%.

---

## 6. Reglas de Pull Request

**PR obligatorio para los seis, sin excepción.** Razones de este repo:

1. **Railway despliega automáticamente en cada push a `main`.** Un push directo despliega a
   producción sin que nadie lo haya visto.
2. `CLAUDE.md` ya lo exige: "PR a `main` con al menos 1 reviewer" y "`main` siempre deployable".
3. Es evidencia evaluable del proceso de trabajo.
4. Con el CI de José, cada PR corre los tests antes de mergear.
5. Seis ramas simultáneas van a chocar en `shared-types` y `app.module.ts`. Mejor descubrirlo
   en un PR que en `main`.

**Para que el PR no se vuelva el cuello de botella:**

- **Un PR por criterio de aceptación**, no uno gigante por historia al final.
- **Draft PR desde el día 1**: se abre apenas se crea la rama. Todos ven en qué va cada uno.
- **SLA de review: 24 h.** Si nadie revisó en 24 h y el CI está verde, se mergea.
- **1 reviewer**, round-robin: José → M. Lara → Eduardo → Alex → Catalina → M. Barraza → José.
- **Squash merge.**
- **Rebase diario obligatorio**: `git fetch origin && git rebase origin/main`.
- **Proteger `main`** en GitHub: requiere PR + CI en verde. Lo configura José el día 1.
- **Descripción del PR**: qué criterio cubre (con su ID de la §4) y cómo se probó.

**Único caso para saltarse el PR:** un hotfix con `main` roto durante la demo.

### Convención de commits

```
<tipo>(HU-XX): <descripción en imperativo, español, máx 72 chars>
```

**Tipos:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`
**Sin el trailer `Co-Authored-By`.** El gestor de paquetes es **`pnpm`**, siempre.

---

## 7. Archivos compartidos — riesgo de conflicto

Con seis ramas simultáneas, estos archivos los tocan varios. **Regla: agregar al final, nunca
reordenar ni reformatear**, y avisar por el grupo antes de editarlos.

| Archivo | Quiénes | Mitigación |
|---|---|---|
| `packages/shared-types/src/index.ts` | los 6 | Va en el PR de contrato de José el día 1. Después, solo agregar tipos al final. |
| `apps/backend/src/app.module.ts` | José, M. Lara, Alex | Una línea de import y una entrada al final del array. |
| `apps/web/src/services/api.ts` | M. Lara, Eduardo, Alex | Agregar funciones al final. **Ojo**: `get<T>()` (líneas 3-13) se traga *todos* los errores y devuelve `[]`, así que un backend caído se ve como "0 pacientes" sin ningún aviso. Lo arregla Eduardo. |
| `apps/mobile/src/services/api.ts` | Catalina, M. Barraza, M. Lara | Agregar funciones al final. `BASE_URL` está hardcodeado a `localhost:3000`. |
| `apps/web/src/DashboardApp.tsx` | M. Lara, Eduardo, Alex | Eduardo lo migra a router el día 2; los demás esperan ese merge. |
| `apps/backend/src/ai-assistant/` | Eduardo, Alex, M. Barraza | **M. Barraza es el único que edita `ai-assistant.service.ts`.** Eduardo entrega `fallback.ts` + interceptor de latencia, Alex entrega `sanitizer.ts`, ambos como archivos nuevos; M. Barraza los conecta. |
| `apps/backend/src/panic/` | Catalina, Eduardo, M. Barraza | **M. Barraza es el único que edita `panic.service.ts`.** Eduardo crea el controller de SSE aparte; Catalina escribe el post de alerta en `community.service.ts` y M. Barraza agrega la línea que lo llama. |

### Módulos nuevos para evitar colisiones en `users/`

`users.service.ts` lo necesitaban tres ramas. Para que **solo José** lo toque:

- **Matías Lara** crea `apps/backend/src/psychologists/` (no dentro de `users/`).
- **Eduardo** crea `apps/backend/src/metrics/` (no dentro de `users/`).
- **Alex** crea `apps/backend/src/family/`. El login por rol `family` lo hace José en `users/`.

**Deuda conocida:** el UUID demo `11111111-1111-1111-1111-111111111111` está **duplicado en
7 archivos** de mobile. Cuando José entregue auth, unificarlo en un contexto de sesión.

---

## 8. Regla local por integrante (`CLAUDE.local.md`)

Para que nadie pise archivos ajenos, **cada integrante crea un `CLAUDE.local.md`** en la raíz
del repo con sus límites de propiedad. Claude Code lo carga automáticamente en cada sesión.

Ese archivo **está en `.gitignore` y no se versiona**: es por persona, y si se subiera los 6
estaríamos pisando el mismo archivo en cada merge.

El texto a pegar (parte común + bloque personal) lo distribuyó José por el grupo. Reglas centrales:

- Antes de editar cualquier archivo, verificar que está en la lista propia; si no, preguntar.
- En archivos compartidos: solo agregar al final, nunca reordenar ni reformatear.
- Si hace falta algo de un archivo ajeno: escribirlo en un archivo nuevo y pedirle al dueño la
  línea que lo conecta. Nunca duplicar la lógica.
- `git status` antes de cada commit, confirmando que no se coló ningún archivo ajeno.

---

## 9. Verificación

**Cada uno, antes de pedir review:**

```bash
pnpm install
pnpm run backend          # http://localhost:3000 · Swagger en /api/docs
pnpm run web              # http://localhost:5173
pnpm run android:device   # solo ramas con cambios mobile
pnpm test                 # disponible desde que José mergee el CI
```

En el PR: el ID del criterio que cubre y cómo se probó.

**Integración (José, cierre de cada semana):**

1. `git checkout main && pnpm install && pnpm run backend` — arranca sin errores.
2. Login web: una contraseña **incorrecta ahora falla**, y
   `localStorage.setItem('sb-dashboard-auth','1')` ya **no** basta para entrar.
3. 403 en ≥4 endpoints con un rol sin permiso *(S.5)*.
4. Pánico completo en el celular: activar → padrino responde → se ve quién *(1.1)*; sin
   padrino → conecta con la IA de inmediato *(1.2)*; sin respuesta → escala a los 120 s *(1.3)*.
5. Dashboard abierto + alerta disparada desde el celular → aparece **sin recargar** *(4.1)*.
6. Perfil de un paciente **sin check-ins** → estado vacío, **no** una curva inventada *(4.3)*.
7. Familiar entra al portal, ve las sesiones de su sede y confirma asistencia; el psicólogo la
   ve en el dashboard *(11.1–11.4)*.
8. Check-in en modo avión → se guarda y se reintenta al volver la conexión *(7.3)*.
9. CI en verde en push a `main`; cobertura ≥70% en `panic`, `ai-assistant` y `users` *(S.11, S.12)*.

**Demo de cierre:** seguir ese mismo orden. Es el recorrido que cubre más criterios de
aceptación en menos pasos.
