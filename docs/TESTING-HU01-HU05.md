# Testing HU-01 a HU-05 — Resultados

> Sesión de testeo: 2026-06-10. Testeado en emulador Android (API 35, 1080×2400).
> Backend local en puerto 3000. HU-02 excluida (la trabaja otro colega).

---

## HU-01 — Botón de Pánico

| CA | Descripción | Estado | Notas |
|----|-------------|--------|-------|
| CA1 | Botón visible y accesible desde cualquier pantalla (BottomNav) | ✅ PASA | Ícono rojo en barra inferior, funciona desde Home, Logros, Comunidad |
| CA2 | Activar pánico crea registro en BD con fecha/hora/paciente | ✅ PASA | `POST /panic/alerts` crea fila en `panic_alerts` con `status: pending` |
| CA3 | Sin conexión: muestra mensaje, teléfono padrino y línea de crisis | ✅ PASA | Banner "Sin conexión a internet", teléfono del padrino clickeable, línea \*4141 |

**Padrino seed:** Daniela Soto — +56 9 8765 4321

---

## HU-02 — Asistente IA

> **No testeado en esta sesión.** Lo trabaja otro integrante del equipo.

---

## HU-03 — Logros y Gamificación

| CA | Descripción | Estado | Notas |
|----|-------------|--------|-------|
| CA1 | Compartir insignia en comunidad | ⬜ PENDIENTE | Flujo UI existe; no se completó testeo end-to-end |
| CA2 | Contador de días, insignias ganadas y próximo hito | ✅ PASA | Muestra días actuales, 7 insignias para período actual, barra de progreso |
| CA3 | Reportar recaída muestra modal con mensaje de contención + botón a asistente | ✅ PASA (bug fixeado) | Ver bug #1 abajo |
| CA4 | Historial de ciclos anteriores visible | ✅ PASA | Sección "Ciclos históricos" muestra intentos pasados con fechas e insignias |

---

## HU-04 — Dashboard Clínico

> **No testeado en esta sesión** (requiere web dashboard en localhost:5173).
> Las vistas están implementadas con datos mock. Pendiente conectar a API.

---

## HU-05 — Comunidad

| CA | Descripción | Estado | Notas |
|----|-------------|--------|-------|
| CA1 | Publicar en foro, reaccionar a posts, responder | ✅ PASA (bug fixeado) | Ver bug #2 abajo. Verificado vía API y reacciones en UI |
| CA2 | Cache offline: muestra últimos posts sin conexión | ⬜ PENDIENTE | La lógica está implementada (`offlineCache` module-level), no se completó el test de flujo por loop de error en HomeScreen al simular offline |
| CA3 | Moderación: psicólogo ve posts reportados | ✅ PASA | `GET /community/moderation/flagged` con header del psicólogo devuelve post con `reportCount=5`. Verificado vía curl |

---

## Bugs encontrados y corregidos

### Bug #1 — Backend con caché de módulos pnpm obsoleto (HU-03 CA3)

**Síntoma:** `POST /achievements/relapse` devuelve 400 desde la app pero 200 desde curl sin body.  
**Causa:** El proceso del backend (NestJS) fue iniciado antes de que `npm install` reemplazara el virtual store pnpm. `body-parser` tenía rutas de módulo cacheadas apuntando a `.pnpm/iconv-lite@0.4.24/...` que ya no existían. Cualquier POST con body (incluido `{}`) fallaba al intentar parsear el body con iconv-lite.  
**Fix:** Reiniciar el proceso del backend. Con el nuevo proceso, Node.js resuelve `iconv-lite` desde `node_modules/iconv-lite/` (real) correctamente.  
**Importante para el equipo:** Después de correr `npm install` o `pnpm install`, siempre reiniciar el servidor de desarrollo del backend.

### Bug #2 — `addReaction` / `removeReaction` retornaban objeto en lugar de array (HU-05 CA1)

**Síntoma:** Al tocar un botón de reacción en el Foro → crash con `Render Error: undefined is not a function` en `CommunityScreen.tsx:448` (`post.reactions.find`).  
**Causa:** El backend devuelve `{ reactions: ReactionSummary[] }`, pero `api.ts` lo tipaba como `ReactionSummary[]` y `handleReaction` lo asignaba directamente a `post.reactions`. Al renderizar, `.find()` fallaba sobre un objeto en lugar de un array.  
**Fix aplicado:**
- `apps/mobile/src/services/api.ts`: cambiar tipo de retorno de `addReaction` y `removeReaction` a `{ reactions: ReactionSummary[] }`.
- `apps/mobile/src/screens/CommunityScreen.tsx`: destructurar `const { reactions } = await api.addReaction(...)`.

---

## Pendientes para próxima sesión

- [ ] HU-03 CA1: Completar testeo de compartir insignia en comunidad
- [ ] HU-04: Testear dashboard web (login psicólogo → lista pacientes → alertas de pánico)
- [ ] HU-05 CA2: Testear cache offline de comunidad (navegar online → cargar posts → desconectar → verificar banner "Sin conexión · Solo lectura" con posts visibles)
- [ ] Eliminar `apps/mobile/package-lock.json` (residuo de npm en repo pnpm, deuda técnica ya registrada en CLAUDE.md)
- [ ] Completar reemplazo de emojis en `SuspendedAccountScreen.tsx` líneas 338 y 348 (🔗 y 📤)
