# Contextualización para implementar las tablas PostgreSQL de StopBet

## 1. Objetivo del documento

Este documento entrega el contexto funcional y técnico necesario para que un LLM, desarrollador o agente de código pueda implementar correctamente las tablas PostgreSQL del PMV de **StopBet** dentro del backend NestJS.

El objetivo no es solo ejecutar un archivo SQL, sino comprender **por qué existen las tablas**, **qué historia de usuario soporta cada grupo de tablas**, **en qué orden deben implementarse** y **cómo conectarlas con los módulos del backend**.

Archivo SQL asociado sugerido:

```bash
StopBet/apps/backend/src/database/migrations/001_pmv_schema.sql
```

Archivo de contextualización sugerido:

```bash
StopBet/apps/backend/src/database/README_SCHEMA_CONTEXT.md
```

---

## 2. Contexto del proyecto

StopBet es una plataforma digital de acompañamiento para personas en rehabilitación por ludopatía. El sistema busca entregar apoyo fuera de las sesiones terapéuticas tradicionales, especialmente en momentos críticos donde el paciente puede sentir impulso de apostar.

El PMV se centra en cinco funcionalidades principales:

1. **Botón de Pánico**: permite al paciente pedir ayuda inmediata.
2. **Asistente Virtual IA 24/7**: entrega contención emocional cuando no hay personas disponibles.
3. **Tracker de Logros y Gamificación**: muestra días de abstinencia e insignias.
4. **Dashboard Clínico**: permite al psicólogo revisar métricas y eventos relevantes.
5. **Comunidad y Red de Apoyo**: permite interacción entre pacientes de la misma sede.

Estas funcionalidades corresponden a las historias de usuario priorizadas para el PMV: **HdU01, HdU02, HdU03, HdU04 y HdU05**.

---

## 3. Stack esperado

La estructura del proyecto considera:

```bash
StopBet/
├── apps/
│   ├── backend/      # API NestJS
│   ├── mobile/       # App React Native
│   └── web/          # Dashboard terapeuta React + Vite
├── packages/
│   └── shared-types/ # Tipos TypeScript compartidos
└── package.json      # Workspace root pnpm
```

Para la base de datos se usa:

- **PostgreSQL** como base de datos principal.
- **UUID** como identificador primario en la mayoría de las tablas.
- **ENUMS** para roles, estados y niveles de riesgo.
- **JSONB** para información flexible como contexto de dispositivo, resúmenes IA, evolución anímica y logs JITAI.
- **Índices** para acelerar consultas frecuentes del dashboard, comunidad, asistente IA y eventos clínicos.

---

## 4. Principio de diseño de la base de datos

La base de datos está diseñada para cubrir el flujo central del PMV:

```text
Paciente siente impulso de apostar
        ↓
Activa Botón de Pánico
        ↓
Se notifica a padrino / comunidad
        ↓
Si nadie responde en 3 minutos, escala a IA
        ↓
IA entrega contención y genera resumen clínico
        ↓
El psicólogo visualiza eventos y métricas en dashboard
        ↓
El paciente refuerza su proceso mediante logros y comunidad
```

El diseño combina datos relacionales y datos semiestructurados:

- Usar tablas relacionales cuando la entidad es estable y consultada frecuentemente.
- Usar `JSONB` cuando la estructura puede cambiar, como payloads del motor JITAI, metadatos del chat IA o evolución anímica.

---

## 5. Orden recomendado de implementación

Un LLM o agente de código debe implementar el esquema en este orden para evitar errores de dependencias:

1. Extensión `uuid-ossp`.
2. ENUMS.
3. Función `set_updated_at()`.
4. Tabla `branches`.
5. Tabla `users`.
6. Tabla `patient_profiles`.
7. Tabla `sponsor_assignments`.
8. Tablas de Botón de Pánico.
9. Tablas del Asistente IA.
10. Tablas de Logros y Gamificación.
11. Tablas del Dashboard Clínico.
12. Tablas de Comunidad.
13. Tabla general `patient_events`.
14. Índices.
15. Triggers.
16. Vista `therapist_patient_dashboard`.
17. Datos semilla.

No se debe crear una tabla que referencie otra tabla aún inexistente.

---

## 6. Módulos sugeridos en NestJS

El backend puede organizarse así:

```bash
apps/backend/src/
├── auth/
├── users/
├── patients/
├── panic/
├── ai-assistant/
├── achievements/
├── community/
├── dashboard/
└── database/
    ├── migrations/
    │   └── 001_pmv_schema.sql
    └── README_SCHEMA_CONTEXT.md
```

Cada módulo debe encargarse de un subconjunto claro de tablas.

---

## 7. Mapeo entre historias de usuario y tablas

| Historia | Funcionalidad | Tablas principales |
|---|---|---|
| HdU01 | Botón de Pánico | `panic_events`, `panic_event_responses`, `sponsor_assignments` |
| HdU02 | Asistente IA 24/7 | `ai_chat_sessions`, `ai_messages`, `ai_session_summaries` |
| HdU03 | Tracker de Logros | `abstinence_cycles`, `achievement_definitions`, `patient_achievements`, `validated_support_messages` |
| HdU04 | Dashboard Clínico | `patient_profiles`, `panic_events`, `ai_session_summaries`, `clinical_reports`, `therapist_patient_dashboard` |
| HdU05 | Comunidad | `community_posts`, `community_reactions`, `community_reports` |
| Transversal | Logs clínicos / JITAI | `patient_events` |

---

## 8. Descripción funcional de cada grupo de tablas

### 8.1. `branches`

Representa las sedes de AJUTER.

Sedes iniciales:

- AJUTER Santiago
- AJUTER Viña del Mar
- AJUTER Concepción

Se usa para segmentar pacientes, comunidad y dashboard.

---

### 8.2. `users`

Tabla central de usuarios del sistema.

Roles permitidos:

```text
patient
therapist
sponsor
family
admin
```

Esta tabla representa a pacientes, psicólogos, padrinos, familiares y administradores.

Cada usuario puede pertenecer a una sede mediante `branch_id`.

---

### 8.3. `patient_profiles`

Extiende la información de un usuario con rol `patient`.

Guarda:

- Psicólogo asignado.
- Fecha de inicio de abstinencia.
- Notas clínicas.
- Notas de emergencia.
- Consentimiento de privacidad.

Esta tabla es clave para el dashboard clínico y para asociar pacientes con terapeutas.

---

### 8.4. `sponsor_assignments`

Relaciona pacientes con padrinos o referentes de apoyo.

Permite que un paciente tenga uno o más padrinos asignados.

La columna `is_primary` indica si ese padrino es el contacto principal.

Restricción importante:

```sql
CHECK (patient_id <> sponsor_id)
```

Esto evita que un usuario sea su propio padrino.

---

## 9. HdU01 - Botón de Pánico

### Objetivo funcional

Cuando un paciente siente un impulso de apostar, puede activar el botón de pánico desde la app móvil.

El sistema debe:

1. Registrar el evento.
2. Notificar a los padrinos asignados.
3. Esperar respuesta durante 3 minutos.
4. Escalar al asistente IA si nadie responde.
5. Guardar el evento para que el psicólogo lo vea en el dashboard.

### Tablas

#### `panic_events`

Registra cada activación del botón de pánico.

Campos importantes:

- `patient_id`: paciente que activó la alerta.
- `status`: estado actual del evento.
- `triggered_at`: momento exacto de activación.
- `escalation_deadline`: fecha/hora límite para escalar a IA.
- `patient_message`: mensaje opcional del paciente.
- `location_context`: contexto opcional en JSONB.
- `device_context`: información opcional del dispositivo en JSONB.

Estados posibles:

```text
pending
accepted_by_sponsor
escalated_to_ai
resolved
failed_offline
```

#### `panic_event_responses`

Registra la respuesta de un padrino ante una alerta.

Un padrino solo puede responder una vez al mismo evento gracias a:

```sql
UNIQUE(panic_event_id, sponsor_id)
```

### Consideraciones para el backend

El módulo `panic` debería exponer endpoints como:

```http
POST /panic-events
POST /panic-events/:id/respond
PATCH /panic-events/:id/escalate
PATCH /panic-events/:id/resolve
GET /panic-events/patient/:patientId
GET /panic-events/therapist/:therapistId
```

Al crear un `panic_event`, el backend debe calcular automáticamente el vencimiento de escalamiento usando el valor por defecto de PostgreSQL:

```sql
NOW() + INTERVAL '3 minutes'
```

---

## 10. HdU02 - Asistente Virtual IA 24/7

### Objetivo funcional

El paciente puede conversar con un asistente IA para recibir contención emocional. El asistente puede activarse directamente desde la app o como respaldo luego de un botón de pánico sin respuesta.

### Tablas

#### `ai_chat_sessions`

Representa una conversación completa entre paciente e IA.

Puede estar vinculada a un evento de pánico mediante `panic_event_id`.

#### `ai_messages`

Guarda cada mensaje enviado dentro de una sesión.

Valores permitidos para `sender`:

```text
patient
assistant
system
```

`metadata` permite guardar información adicional como tokens, modelo usado, latencia o clasificación de intención.

#### `ai_session_summaries`

Guarda el resumen estructurado de una sesión cerrada o inactiva.

Debe contener:

- Estado anímico predominante.
- Nivel de riesgo final.
- Técnica aplicada.
- Detonante identificado.
- Resumen legible.
- Resumen estructurado JSONB.

### Consideraciones para el backend

El módulo `ai-assistant` debería exponer endpoints como:

```http
POST /ai/sessions
POST /ai/sessions/:id/messages
PATCH /ai/sessions/:id/close
GET /ai/sessions/patient/:patientId
GET /ai/sessions/:id/messages
```

Al cerrar una sesión o detectar 10 minutos de inactividad, el backend debe crear un registro en `ai_session_summaries`.

No guardar únicamente el texto del chat; guardar también el resumen clínico estructurado.

---

## 11. HdU03 - Tracker de Logros y Gamificación

### Objetivo funcional

El paciente debe visualizar sus días de abstinencia, logros e historial de ciclos. Si hay una recaída, el contador actual se reinicia, pero el historial anterior no se borra.

### Tablas

#### `achievement_definitions`

Define las insignias disponibles.

Ejemplos:

- Resiliencia 1 día
- Resiliencia 7 días
- Resiliencia 30 días
- Resiliencia 90 días

Cada insignia tiene `required_days`.

#### `abstinence_cycles`

Guarda ciclos de abstinencia del paciente.

Un ciclo activo tiene:

```sql
end_date IS NULL
```

Cuando ocurre una recaída:

- El ciclo actual recibe `end_date`.
- Se marca `ended_by_relapse = true`.
- Se crea un nuevo ciclo desde la nueva fecha de inicio.

#### `patient_achievements`

Registra qué logros obtuvo un paciente en un ciclo específico.

Esto permite preservar logros históricos aunque el contador se reinicie.

#### `validated_support_messages`

Guarda mensajes de apoyo validados para mostrar en momentos de recaída o crisis.

Ejemplo:

```text
Tu esfuerzo anterior no se borra, estamos aquí para retomar el camino.
```

### Consideraciones para el backend

El módulo `achievements` debería exponer endpoints como:

```http
GET /achievements/definitions
GET /achievements/patient/:patientId
POST /achievements/check/:patientId
POST /abstinence-cycles/:patientId/relapse
GET /support-messages/random?category=relapse_support
```

El backend debe calcular los días de abstinencia usando:

```text
CURRENT_DATE - start_date del ciclo activo
```

No calcular logros desde `patient_profiles.abstinence_start_date` si existen ciclos en `abstinence_cycles`; esa fecha solo sirve como dato inicial.

---

## 12. HdU04 - Dashboard Clínico

### Objetivo funcional

El psicólogo debe poder visualizar pacientes, eventos de pánico, sesiones IA, días de abstinencia y reportes exportables.

### Tablas y vistas

#### `clinical_reports`

Registra reportes generados por un psicólogo para un paciente y rango de fechas.

Guarda:

- Total de eventos de pánico.
- Evolución anímica en JSONB.
- Resumen de riesgo en JSONB.
- URL del PDF generado.

#### `therapist_patient_dashboard`

Vista SQL que resume información útil para el dashboard.

Incluye:

- Psicólogo.
- Paciente.
- Email del paciente.
- Sede.
- Total de eventos de pánico.
- Último evento de pánico.
- Total de sesiones IA.
- Última sesión IA.
- Fecha de inicio del ciclo activo.
- Días actuales de abstinencia.

### Consideraciones para el backend

El módulo `dashboard` debería exponer endpoints como:

```http
GET /dashboard/therapist/:therapistId/patients
GET /dashboard/patients/:patientId/metrics
POST /dashboard/reports
GET /dashboard/reports/:reportId
```

Para la lista principal del dashboard, usar la vista:

```sql
SELECT *
FROM therapist_patient_dashboard
WHERE therapist_id = $1;
```

Para métricas detalladas, consultar directamente:

- `panic_events`
- `ai_session_summaries`
- `abstinence_cycles`
- `patient_achievements`
- `patient_events`

---

## 13. HdU05 - Comunidad y Red de Apoyo

### Objetivo funcional

Los pacientes pueden acceder a una comunidad segmentada por sede, publicar mensajes, responder, reaccionar y reportar contenido.

### Tablas

#### `community_posts`

Guarda publicaciones y respuestas.

Si `parent_post_id IS NULL`, es una publicación principal.

Si `parent_post_id` tiene valor, es una respuesta a otra publicación.

La eliminación es lógica:

```sql
is_deleted = TRUE
```

No se recomienda borrar físicamente los mensajes, porque pueden formar parte del historial clínico o de moderación.

#### `community_reactions`

Guarda reacciones con emojis.

Un usuario no puede repetir el mismo emoji en el mismo post gracias a:

```sql
UNIQUE(post_id, user_id, emoji)
```

#### `community_reports`

Guarda reportes de publicaciones.

Cuando una publicación recibe reportes, un psicólogo o moderador puede revisarla.

Estados posibles:

```text
pending
reviewed
dismissed
deleted
```

### Consideraciones para el backend

El módulo `community` debería exponer endpoints como:

```http
GET /community/branches/:branchId/posts
POST /community/posts
POST /community/posts/:id/replies
POST /community/posts/:id/reactions
POST /community/posts/:id/reports
PATCH /community/reports/:id/review
PATCH /community/posts/:id/delete
```

Por defecto, al listar publicaciones, filtrar:

```sql
WHERE is_deleted = FALSE
```

---

## 14. Tabla transversal `patient_events`

### Objetivo funcional

Esta tabla guarda eventos clínicos generales y logs relevantes para JITAI, dashboard y análisis futuro.

No reemplaza las tablas principales. Sirve como registro flexible de eventos.

Ejemplos de `event_type`:

```text
panic_button_pressed
panic_escalated_to_ai
ai_session_started
ai_session_finished
achievement_unlocked
relapse_reported
community_post_created
```

Ejemplos de `event_source`:

```text
mobile_app
backend
ai_assistant
therapist_dashboard
community
```

`payload` debe usarse para guardar detalles variables.

Ejemplo:

```json
{
  "panic_event_id": "uuid",
  "device": "android",
  "trigger": "craving nocturno"
}
```

---

## 15. Reglas de autorización esperadas

El esquema no implementa permisos por sí solo. El backend debe aplicar autorización por rol.

Reglas mínimas:

### Paciente

Puede:

- Crear eventos de pánico propios.
- Crear sesiones IA propias.
- Ver sus mensajes IA.
- Ver sus logros.
- Publicar en comunidad de su sede.
- Reaccionar y reportar publicaciones.

No puede:

- Ver datos clínicos de otros pacientes.
- Editar su fecha de abstinencia directamente si el flujo exige validación clínica.
- Acceder a reportes clínicos de otros usuarios.

### Psicólogo

Puede:

- Ver pacientes asignados.
- Ver métricas clínicas.
- Ver eventos de pánico de sus pacientes.
- Generar reportes.
- Moderar comunidad.

No debería ver pacientes de otro psicólogo salvo rol admin.

### Padrino

Puede:

- Recibir alertas de pacientes asignados.
- Responder eventos de pánico.

No debería acceder al detalle clínico completo del paciente.

### Familiar

Puede:

- Acceder a funcionalidades familiares futuras.

En este PMV, el rol existe en `users`, pero sus tablas específicas no están implementadas todavía.

### Admin

Puede:

- Gestionar sedes.
- Revisar datos generales.
- Apoyar tareas operativas.

---

## 16. Consideraciones sobre JSONB

Usar `JSONB` para datos que pueden cambiar de forma durante el desarrollo.

Campos JSONB actuales:

| Tabla | Campo | Uso |
|---|---|---|
| `panic_events` | `location_context` | Contexto opcional de ubicación o sede |
| `panic_events` | `device_context` | Datos del dispositivo o conexión |
| `ai_messages` | `metadata` | Modelo IA, tokens, latencia, intención, etc. |
| `ai_session_summaries` | `structured_summary` | Resumen clínico estructurado |
| `clinical_reports` | `mood_evolution` | Serie de evolución anímica |
| `clinical_reports` | `risk_summary` | Resumen de riesgos del periodo |
| `patient_events` | `payload` | Datos flexibles de eventos JITAI |

No usar JSONB para reemplazar relaciones importantes. Si un dato se consulta constantemente o representa una entidad estable, debe ir en una tabla relacional.

---

## 17. Reglas importantes para un LLM implementador

Al implementar este esquema en el backend, seguir estas reglas:

1. No cambiar nombres de tablas sin actualizar todas las consultas y servicios.
2. No eliminar `patient_events`; aunque sea transversal, será útil para dashboard y JITAI.
3. No borrar físicamente publicaciones de comunidad; usar `is_deleted`.
4. No borrar ciclos de abstinencia antiguos; preservarlos para historial.
5. No guardar contraseñas en texto plano; usar `password_hash`.
6. No exponer `clinical_notes` a pacientes, padrinos ni familiares.
7. No permitir que un paciente vea sesiones IA de otro paciente.
8. No permitir que un padrino responda eventos de pacientes no asignados.
9. No usar `users.role` como única validación de seguridad; verificar también relaciones como `therapist_id` y `sponsor_assignments`.
10. No asumir que todas las sesiones IA vienen de botón de pánico; `panic_event_id` puede ser `NULL`.
11. No asumir que todos los pacientes tienen padrino asignado desde el inicio.
12. No asumir que todos los pacientes tienen psicólogo asignado desde el inicio.
13. Mantener datos sensibles protegidos y devolver solo lo necesario en DTOs.

---

## 18. Ejemplos de consultas útiles

### 18.1. Pacientes asignados a un psicólogo

```sql
SELECT *
FROM therapist_patient_dashboard
WHERE therapist_id = $1;
```

### 18.2. Eventos de pánico recientes de un paciente

```sql
SELECT *
FROM panic_events
WHERE patient_id = $1
ORDER BY triggered_at DESC
LIMIT 20;
```

### 18.3. Sesiones IA de un paciente

```sql
SELECT *
FROM ai_chat_sessions
WHERE patient_id = $1
ORDER BY started_at DESC;
```

### 18.4. Mensajes de una sesión IA

```sql
SELECT *
FROM ai_messages
WHERE session_id = $1
ORDER BY created_at ASC;
```

### 18.5. Ciclo activo de abstinencia

```sql
SELECT *
FROM abstinence_cycles
WHERE patient_id = $1
  AND end_date IS NULL
LIMIT 1;
```

### 18.6. Días actuales de abstinencia

```sql
SELECT CURRENT_DATE - start_date AS abstinence_days
FROM abstinence_cycles
WHERE patient_id = $1
  AND end_date IS NULL;
```

### 18.7. Publicaciones visibles de una sede

```sql
SELECT *
FROM community_posts
WHERE branch_id = $1
  AND is_deleted = FALSE
  AND parent_post_id IS NULL
ORDER BY created_at DESC;
```

### 18.8. Cantidad de reportes pendientes por publicación

```sql
SELECT post_id, COUNT(*) AS pending_reports
FROM community_reports
WHERE status = 'pending'
GROUP BY post_id
HAVING COUNT(*) >= 5;
```

---

## 19. Flujo recomendado de implementación técnica

### Paso 1: Agregar variables de entorno

En `apps/backend/.env.example`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/stopbet
```

Si se usa Railway, esta variable debe apuntar a la base PostgreSQL provista por Railway.

---

### Paso 2: Crear carpeta de migraciones

```bash
mkdir -p apps/backend/src/database/migrations
```

Colocar el SQL en:

```bash
apps/backend/src/database/migrations/001_pmv_schema.sql
```

---

### Paso 3: Definir estrategia de ejecución

Hay dos opciones simples.

#### Opción A: Ejecutar SQL manualmente

```bash
psql "$DATABASE_URL" -f apps/backend/src/database/migrations/001_pmv_schema.sql
```

#### Opción B: Crear script de migración en Node/NestJS

Crear un script que:

1. Lea `DATABASE_URL`.
2. Abra conexión con PostgreSQL.
3. Lea el archivo SQL.
4. Ejecute el contenido dentro de la base.
5. Cierre la conexión.

Esta opción es útil para correr:

```bash
pnpm db:migrate
```

---

### Paso 4: Crear servicios por módulo

Orden recomendado:

1. `users`
2. `patients`
3. `panic`
4. `ai-assistant`
5. `achievements`
6. `community`
7. `dashboard`

---

### Paso 5: Crear DTOs seguros

No devolver directamente filas completas de la base de datos en respuestas HTTP.

Crear DTOs que oculten campos sensibles como:

- `password_hash`
- `clinical_notes`
- `emergency_notes`, excepto para roles autorizados
- `metadata` interna de IA si no corresponde mostrarla
- `structured_summary` si no corresponde al usuario

---

## 20. Criterios de validación después de ejecutar la migración

Después de correr el SQL, validar que existan:

### ENUMS

```sql
SELECT typname
FROM pg_type
WHERE typname IN (
  'user_role',
  'panic_event_status',
  'risk_level',
  'mood_type',
  'community_report_status'
);
```

### Tablas principales

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deben aparecer, al menos:

```text
branches
users
patient_profiles
sponsor_assignments
panic_events
panic_event_responses
ai_chat_sessions
ai_messages
ai_session_summaries
achievement_definitions
abstinence_cycles
patient_achievements
validated_support_messages
clinical_reports
community_posts
community_reactions
community_reports
patient_events
```

### Vista del dashboard

```sql
SELECT *
FROM therapist_patient_dashboard
LIMIT 5;
```

---

## 21. Datos semilla incluidos

La migración incluye datos iniciales para:

### Sedes

```text
AJUTER Santiago
AJUTER Viña del Mar
AJUTER Concepción
```

### Logros

```text
1, 3, 7, 14, 21, 30, 45, 60, 75 y 90 días
```

### Mensajes de apoyo

Mensajes validados de ejemplo para recaída y crisis.

Estos datos permiten probar el sistema sin tener que insertar configuraciones manualmente.

---

## 22. Implementación mínima recomendada para probar el PMV

Para comprobar que el esquema funciona, crear datos de prueba en este orden:

1. Crear una sede.
2. Crear un usuario psicólogo.
3. Crear un usuario paciente.
4. Crear `patient_profiles` vinculando paciente y psicólogo.
5. Crear un usuario padrino.
6. Crear `sponsor_assignments` entre paciente y padrino.
7. Crear un `abstinence_cycle` activo para el paciente.
8. Crear un `panic_event`.
9. Crear una `panic_event_response` o escalar a IA.
10. Crear una `ai_chat_session`.
11. Crear mensajes en `ai_messages`.
12. Crear un `ai_session_summary`.
13. Consultar `therapist_patient_dashboard`.

---

## 23. Diagrama simplificado del flujo

```mermaid
flowchart TD
    A[Paciente] --> B[Botón de Pánico]
    B --> C{¿Padrino responde en 3 minutos?}
    C -->|Sí| D[Contención por padrino]
    C -->|No| E[Escalamiento a Asistente IA]
    E --> F[Sesión de chat IA]
    F --> G[Resumen clínico estructurado]
    G --> H[Dashboard Psicólogo]

    A --> I[Tracker de Logros]
    I --> J[Ciclos de abstinencia]
    J --> K[Insignias]

    A --> L[Comunidad por sede]
    L --> M[Publicaciones, respuestas y reacciones]
    M --> N[Reportes moderados]

    B --> O[patient_events]
    F --> O
    I --> O
    L --> O
    O --> H
```

---

## 24. Resultado esperado

Al finalizar la implementación, el backend debería poder soportar el flujo principal del PMV:

1. Registrar usuarios por rol.
2. Asociar pacientes con psicólogos, sedes y padrinos.
3. Crear y resolver eventos de botón de pánico.
4. Escalar eventos críticos al asistente IA.
5. Guardar conversaciones y resúmenes clínicos.
6. Registrar ciclos de abstinencia e insignias.
7. Mostrar métricas principales en el dashboard clínico.
8. Gestionar comunidad por sede.
9. Registrar eventos clínicos flexibles para análisis futuro.

El esquema no implementa por sí solo la lógica clínica ni la IA; entrega la estructura persistente para que el backend pueda construir esos flujos de forma ordenada, segura y extensible.

---

## 25. Instrucción breve para un LLM implementador

Si un LLM recibe este documento junto con el archivo `001_pmv_schema.sql`, debe actuar así:

```text
Implementa la base de datos PostgreSQL del PMV de StopBet en el backend NestJS.
Usa el archivo SQL como fuente principal del esquema.
No modifiques nombres de tablas ni columnas sin justificación.
Crea una carpeta database/migrations si no existe.
Agrega DATABASE_URL al .env.example.
Crea un script db:migrate para ejecutar el SQL.
Luego implementa módulos NestJS por dominio: users, patients, panic, ai-assistant, achievements, community y dashboard.
Respeta las relaciones de seguridad: pacientes solo ven sus datos; psicólogos solo ven sus pacientes; padrinos solo responden alertas asignadas.
Usa DTOs para no exponer password_hash, notas clínicas ni metadata sensible.
```
