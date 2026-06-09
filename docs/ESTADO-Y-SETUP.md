# Estado del MVP y guía de setup (traspaso)

**Última actualización:** 2026-06-09
**Rama de trabajo:** `feature/HU-05-comunidad` · **PR:** [#15](https://github.com/StopBet/StopBet/pull/15)

> Documento de traspaso para continuar el trabajo desde cualquier máquina (Windows, Mac o un compañero). Empieza por aquí.

---

## 1. Dónde quedamos

Se cerró el grueso del MVP en **backend + mobile**, se dejó el backend arrancando y se levantaron varios bugs que impedían que compilara. Falta el **dashboard web (HdU04)**, que no está implementado.

### Estado de criterios de aceptación

| HdU | Estado | Detalle |
|-----|--------|---------|
| **HdU01 — Botón de Pánico** | ✅ CA1-CA4 | CA1: notificación al padrino con el texto requerido. ⚠️ El push en tiempo real (FCM) **no** está; la notificación se persiste y se ve por polling. |
| **HdU02 — Asistente IA** | ⏭️ Fuera del MVP | Documentado para sprint futuro (no se evalúa ahora). |
| **HdU03 — Logros** | ✅ CA1-CA4 | CA3: mensaje de contención aleatorio desde tabla `validated_messages`. CA1: compartir insignia publica en el foro. |
| **HdU04 — Dashboard Clínico** | 🔴 **Sin implementar** | `apps/web` está vacío (solo logo). Los 3 CA no son alcanzables sin construir el dashboard. |
| **HdU05 — Comunidad** | ✅ CA1/CA2/CA4 · ⚠️ CA3 | Foro, reacciones, respuestas, asistencia, offline con caché. CA3: backend de moderación listo (umbral 5 + borrado por psicólogo), pero el **borrado se hace desde el dashboard (HdU04)** que no existe. |

### Qué tachar en Jira
- **Tachar:** HdU01 CA2/CA3/CA4 · HdU03 CA1/CA2/CA3/CA4 · HdU05 CA1/CA2/CA4.
- **Tachar con reparo:** HdU01 CA1 (falta FCM real) · HdU05 CA4 (caché en memoria, no persistente entre reinicios).
- **No tachar:** HdU05 CA3 (depende del dashboard) · sub-tarea [HdU05-BE] (se hizo en REST, no Socket.io) · sub-tarea [HdU01-BE] parte FCM · **HdU04 completo**.

---

## 2. Antes de mergear el PR

Leer **[ASUNCIONES-PENDIENTES.md](ASUNCIONES-PENDIENTES.md)**. Puntos rojos a revisar:
1. **Contenido clínico inventado** (mensajes de recaída + texto de pánico) — debe validar AJUTER.
2. **Cambio de contrato de `reportRelapse`** — lo trabaja Alex (HdU03); coordinar.
3. **Reestructura del build** (shared-types con build propio, deps agregadas) — que la revise el Tech Leader.
4. **Co-autoría de los commits** dice "Claude Opus 4.8"; el modelo real es Sonnet 4.6.

---

## 3. Próximos pasos sugeridos
1. Revisar y mergear PR #15 (con 1 reviewer).
2. Resolver los 4 puntos rojos de las asunciones.
3. **Construir el dashboard web (HdU04)** — es el bloque grande pendiente del MVP. Necesita diseños.
4. Pendientes técnicos: FCM (push real), `AsyncStorage` (caché offline persistente), autenticación real (hoy se usa header `x-user-id` temporal).

---

## 4. Cómo correr el proyecto

### Requisitos (instalar una vez)
- **Node.js 20+** (instalador precompilado / LTS, con npm)
- **pnpm**: `corepack enable` y `corepack prepare pnpm@10 --activate`
- **PostgreSQL 16**
- **Solo mobile:** Android Studio + SDK + **JDK 17**, `adb` en el PATH, y en el celular: Depuración USB ON

### Backend + base de datos
```bash
git clone https://github.com/StopBet/StopBet.git
cd StopBet
git checkout feature/HU-05-comunidad
pnpm install
```
Crear la base de datos `stopbet` y el archivo `apps/backend/.env`:
```
PORT=3000
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/stopbet
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=local_dev_secret
GEMINI_API_KEY=dummy-key-local
NODE_ENV=development
```
Levantar:
```bash
pnpm backend      # API en :3000 · Swagger en /api/docs
pnpm web          # (opcional) :5173 — hoy solo el logo
```

### Mobile (Windows — recomendado, alineado con los scripts del repo)

**Importante:** la carpeta nativa `apps/mobile/android/` está en `.gitignore` y **no viene en el repo**. Hay que generarla la primera vez.

**Paso 1 — generar `android/` (solo la primera vez):**
```powershell
# fuera del repo, generar un proyecto RN del mismo nombre (package com.stopbet)
npx @react-native-community/cli@latest init StopBet --version 0.86.0
# copiar las carpetas nativas al proyecto real
xcopy /E /I StopBet\android RUTA-AL-REPO\apps\mobile\android
xcopy /E /I StopBet\ios     RUTA-AL-REPO\apps\mobile\ios
```
> Puede requerir ajustes manuales (versiones, `applicationId` = `com.stopbet`). No está automatizado.

**Paso 2 — correr (con el backend ya levantado, celular por USB):**
```powershell
npm run android:device      # 1ª vez: compila APK (~5-15 min)
npm run android:reload      # veces siguientes: solo recarga JS
```

> En Mac el mobile también corre (emulador Android o simulador iOS), pero los scripts `android:*` son PowerShell (solo Windows); en Mac se usarían comandos de React Native a mano.

---

## 5. Notas
- El asistente IA no responde hasta poner una `GEMINI_API_KEY` real.
- No hay módulo nativo VPNService ni FCM todavía (mencionados en CLAUDE.md, no implementados).
- Autenticación real pendiente: todo usa el header `x-user-id` temporal.
