# Diseño: Botón de Pánico (HdU01)

**Fecha:** 2026-06-09  
**Issue:** [#1 — HdU01 Botón de Pánico](https://github.com/StopBet/StopBet/issues/1)

## Contexto

La función más crítica de StopBet. Un toque sostenido (2 s) alerta al padrino (sponsor) asignado. Si en 3 minutos nadie responde, el sistema escala automáticamente al asistente IA. Debe funcionar en modo lectura sin conexión mostrando el teléfono directo del padrino y la línea *4141.

## Base de datos

### `sponsor_assignments`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK | |
| patientId | uuid FK → users | CASCADE |
| sponsorId | uuid FK → users | CASCADE |
| isActive | boolean | DEFAULT true |
| createdAt | timestamptz | |

Restricción: un solo padrino activo por paciente (gestionado en servicio).

### `panic_alerts`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK | |
| patientId | uuid FK → users | CASCADE |
| sponsorId | uuid | Denormalizado al momento del disparo |
| status | enum | pending \| responded \| escalated \| cancelled |
| communityNotified | boolean | DEFAULT false |
| respondedAt | timestamptz | NULL |
| escalatedAt | timestamptz | NULL |
| cancelledAt | timestamptz | NULL |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

## API REST

| Método | Ruta | Actor | Descripción |
|--------|------|-------|-------------|
| GET | /panic/sponsor | paciente | Info del padrino asignado |
| POST | /panic/alerts | paciente | Crear alerta de pánico |
| GET | /panic/alerts/active | paciente / padrino | Estado actual (polling 5 s) |
| POST | /panic/alerts/:id/respond | padrino | Padrino confirma recepción |
| POST | /panic/alerts/:id/cancel | paciente | Cancelar alerta |
| POST | /panic/alerts/:id/escalate | paciente | Escalar a IA manualmente |
| POST | /panic/alerts/:id/community | paciente | Notificar a la comunidad |
| GET | /panic/pending | padrino | Alertas pendientes (padrino polling) |
| POST | /panic/assign | psicólogo | Asignar padrino a paciente |

### Escalado automático server-side
`getActiveAlert` comprueba si `status === 'pending'` y `createdAt < NOW() - 3min`. Si es así, actualiza a `escalated` antes de devolver, como red de seguridad ante cierres de app.

## Mobile — PanicScreen

**Máquina de estados:**
```
idle ──(hold 2 s + API)──► waiting ──(sponsor responds)──► responded
                                    ──(3 min elapsed)────► escalated  
                                    ──(patient cancels)──► idle
offline (sin red)
```

**Polling:** cada 5 s mientras `status === 'pending'`.  
**Offline:** captura de errores de red en llamadas API → transición a estado offline.  
**Hold-to-activate:** `Animated.timing` 0→1 en 2 s sobre `Pressable`. Si se suelta antes: cancela la animación y vuelve a 0.

## Supuestos MVP
- `isOnline` del sponsor siempre devuelve `false` — no hay presencia real hasta integrar WebSockets.
- La notificación a comunidad crea un post anónimo en la sede del paciente.
- El chat con el padrino (Estado 3) y el chat con IA (Estados 2 y 3) abren las pantallas correspondientes que existan en la app.
- FCM push al sponsor: pendiente para cuando se integre Firebase (HdU02 ya lo requiere).
